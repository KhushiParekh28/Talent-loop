import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface WorkerSkill {
  name: string
  level: number
  verified: boolean
}

interface MatchedWorkerRow {
  id: string
  full_name: string
  headline: string | null
  hourly_rate: number
  availability_hours_per_week: number
  experience_years: number
  skills: WorkerSkill[]
  semantic_similarity: number
}

// 1. Budget Compatibility (0-100)
function calcBudgetScore(workerRate: number, minBudget: number, maxBudget: number): number {
  if (workerRate >= minBudget && workerRate <= maxBudget) return 100
  if (workerRate < minBudget) return 95 // Under budget is still great for clients
  const overageRatio = (workerRate - maxBudget) / Math.max(maxBudget, 1)
  return Math.max(0, Math.round(100 - overageRatio * 150))
}

// 2. Availability Match (0-100)
function calcAvailabilityScore(workerHoursPerWeek: number, jobEstimatedHours: number): number {
  // Assume standard 2-week delivery window for short-term gigs
  const requiredWeeklyHours = Math.min(40, Math.ceil(jobEstimatedHours / 2))
  if (workerHoursPerWeek >= requiredWeeklyHours) return 100
  return Math.max(20, Math.round((workerHoursPerWeek / Math.max(requiredWeeklyHours, 1)) * 100))
}

// 3. Experience & Verification Relevance (0-100)
function calcExperienceScore(
  workerYears: number,
  jobLevel: string,
  skills: WorkerSkill[]
): number {
  const targetYears = jobLevel === 'expert' ? 4.5 : jobLevel === 'intermediate' ? 2.5 : 1.0
  const expRatio = Math.min(1, workerYears / targetYears)

  const verifiedCount = skills.filter((s) => s.verified).length
  const verifiedRatio = skills.length > 0 ? verifiedCount / skills.length : 0

  // 70% experience fit + 30% verified skill credentials
  return Math.round((expRatio * 0.7 + verifiedRatio * 0.3) * 100)
}

// 4. Hybrid Skill Compatibility (pgvector cosine similarity + implicit skill overlap)
function calcSkillAnalysis(
  semanticSimilarity: number,
  workerSkills: WorkerSkill[],
  jobSkills: string[]
) {
  const workerSkillMap = new Map(
    workerSkills.map((s) => [s.name.toLowerCase(), s])
  )

  const matchedSkills: string[] = []
  const missingSkills: string[] = []

  for (const req of jobSkills) {
    if (workerSkillMap.has(req.toLowerCase())) {
      matchedSkills.push(req)
    } else {
      missingSkills.push(req)
    }
  }

  const overlapRatio = jobSkills.length > 0 ? matchedSkills.length / jobSkills.length : 0
  // Calibrate Gemini cosine similarity (typically 0.45 - 0.85) onto a 0-1 scale
  const calibratedSemantic = Math.min(1, Math.max(0, (semanticSimilarity - 0.35) / 0.5))

  // Blend 65% semantic vector similarity + 35% explicit/implicit skill overlap
  const skillCompatibility = Math.round((calibratedSemantic * 0.65 + overlapRatio * 0.35) * 100)

  return {
    skillCompatibility: Math.min(99, Math.max(10, skillCompatibility)),
    matchedSkills,
    missingSkills,
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Optional query params: ?jobId=...&wSkill=0.45&wBudget=0.25&wAvailability=0.15&wExperience=0.15
    const requestedJobId = searchParams.get('jobId')

    // Parse & normalize utility weights so alpha + beta + gamma + delta = 1.0
    const rawSkill = Number(searchParams.get('wSkill') ?? 0.45)
    const rawBudget = Number(searchParams.get('wBudget') ?? 0.25)
    const rawAvail = Number(searchParams.get('wAvailability') ?? 0.15)
    const rawExp = Number(searchParams.get('wExperience') ?? 0.15)
    const weightSum = rawSkill + rawBudget + rawAvail + rawExp || 1

    const weights = {
      skill: Number((rawSkill / weightSum).toFixed(3)),
      budget: Number((rawBudget / weightSum).toFixed(3)),
      availability: Number((rawAvail / weightSum).toFixed(3)),
      experience: Number((rawExp / weightSum).toFixed(3)),
    }

    // 1. Fetch the target job (defaults to the first open job if no jobId is provided)
    const jobQuery = supabase.from('jobs').select('*')
    const { data: job, error: jobErr } = requestedJobId
      ? await jobQuery.eq('id', requestedJobId).single()
      : await jobQuery.eq('status', 'open').order('created_at', { ascending: true }).limit(1).single()

    if (jobErr || !job) {
      return NextResponse.json(
        { error: jobErr?.message ?? 'No open job found' },
        { status: 404 }
      )
    }

    if (!job.embedding) {
      return NextResponse.json(
        { error: 'Job has no embedding yet. Run /api/ai/embed-seed first.' },
        { status: 400 }
      )
    }

    // 2. Query pgvector in Supabase for semantically similar workers
    const { data: candidates, error: rpcErr } = await supabase.rpc('match_workers_to_job', {
      query_embedding: job.embedding,
      match_count: 10,
    })

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    const allJobSkills = Array.from(
      new Set([...(job.required_skills ?? []), ...(job.extracted_skills ?? [])])
    )

    // 3. Compute Multi-Objective Utility Score & Explainable Breakdown
    const matches = ((candidates as MatchedWorkerRow[]) ?? [])
      .map((worker) => {
        const skills = Array.isArray(worker.skills) ? worker.skills : []
        const { skillCompatibility, matchedSkills, missingSkills } = calcSkillAnalysis(
          worker.semantic_similarity,
          skills,
          allJobSkills
        )
        const budgetCompatibility = calcBudgetScore(
          Number(worker.hourly_rate),
          Number(job.budget_min),
          Number(job.budget_max)
        )
        const availabilityMatch = calcAvailabilityScore(
          worker.availability_hours_per_week,
          job.estimated_hours
        )
        const experienceRelevance = calcExperienceScore(
          Number(worker.experience_years),
          job.experience_level,
          skills
        )

        const overallScore = Math.round(
          weights.skill * skillCompatibility +
            weights.budget * budgetCompatibility +
            weights.availability * availabilityMatch +
            weights.experience * experienceRelevance
        )

        return {
          workerId: worker.id,
          fullName: worker.full_name,
          headline: worker.headline,
          hourlyRate: Number(worker.hourly_rate),
          availabilityHoursPerWeek: worker.availability_hours_per_week,
          experienceYears: Number(worker.experience_years),
          overallScore,
          breakdown: {
            skillCompatibility,
            budgetCompatibility,
            availabilityMatch,
            experienceRelevance,
            rawCosineSimilarity: Number(worker.semantic_similarity.toFixed(4)),
          },
          matchedSkills,
          missingSkills,
        }
      })
      .sort((a, b) => b.overallScore - a.overallScore)

    return NextResponse.json({
      job: {
        id: job.id,
        title: job.title,
        budgetRange: [job.budget_min, job.budget_max],
        allJobSkills,
      },
      weights,
      matches,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
// Helper to safely parse pgvector strings ("[0.1, -0.2, ...]") or arrays
function parseVector(v: unknown): number[] | null {
  if (Array.isArray(v)) return v.map(Number)
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed.map(Number) : null
    } catch {
      return null
    }
  }
  return null
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const workerId = body.workerId || '22222222-2222-2222-2222-222222222201' // Default demo worker: Aarav Mehta

    const rawWeights = body.weights ?? { skill: 0.45, budget: 0.25, availability: 0.15, experience: 0.15 }
    const wSum = (rawWeights.skill + rawWeights.budget + rawWeights.availability + rawWeights.experience) || 1
    const weights = {
      skill: rawWeights.skill / wSum,
      budget: rawWeights.budget / wSum,
      availability: rawWeights.availability / wSum,
      experience: rawWeights.experience / wSum,
    }

    // 1. Fetch worker profile & all open jobs
    const [{ data: worker, error: wErr }, { data: jobs, error: jErr }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', workerId).single(),
      supabase.from('jobs').select('*').eq('status', 'open'),
    ])

    if (wErr || !worker) return NextResponse.json({ error: wErr?.message ?? 'Worker not found' }, { status: 404 })
    if (jErr) return NextResponse.json({ error: jErr.message }, { status: 500 })

    const workerVec = parseVector(worker.embedding)
    const workerSkills: WorkerSkill[] = Array.isArray(worker.skills) ? worker.skills : []
    const workerSkillNames = new Set(workerSkills.map((s) => s.name.toLowerCase()))

    // 2. Score every live job using pgvector cosine similarity + Multi-Objective Utility
    const missingSkillCounts = new Map<string, number>()

    const matches = (jobs ?? []).map((job) => {
      const jobVec = parseVector(job.embedding)
      const sim = workerVec && jobVec ? cosineSimilarity(workerVec, jobVec) : 0.55
      const allJobSkills = Array.from(
        new Set([...(job.required_skills ?? []), ...(job.extracted_skills ?? [])])
      )

      const { skillCompatibility, matchedSkills, missingSkills } = calcSkillAnalysis(
        sim,
        workerSkills,
        allJobSkills
      )
      const budgetCompatibility = calcBudgetScore(
        Number(worker.hourly_rate),
        Number(job.budget_min),
        Number(job.budget_max)
      )
      const availabilityMatch = calcAvailabilityScore(
        worker.availability_hours_per_week,
        job.estimated_hours
      )
      const experienceRelevance = calcExperienceScore(
        Number(worker.experience_years),
        job.experience_level,
        workerSkills
      )

      const score = Math.round(
        weights.skill * skillCompatibility +
          weights.budget * budgetCompatibility +
          weights.availability * availabilityMatch +
          weights.experience * experienceRelevance
      )

      for (const ms of missingSkills) {
        if (!workerSkillNames.has(ms.toLowerCase())) {
          missingSkillCounts.set(ms, (missingSkillCounts.get(ms) ?? 0) + 1)
        }
      }

      const explanation =
        matchedSkills.length > 0
          ? `Matched on ${matchedSkills.slice(0, 3).join(', ')} · Skill ${skillCompatibility}% · Budget ${budgetCompatibility}% · Availability ${availabilityMatch}%`
          : `Semantic vector match (${Math.round(sim * 100)}% cosine similarity) · Budget ${budgetCompatibility}%`

      return {
        jobId: job.id,
        score,
        matchedSkills,
        missingSkills,
        explanation,
        breakdown: {
          skillCompatibility,
          budgetCompatibility,
          availabilityMatch,
          experienceRelevance,
        },
      }
    }).sort((a, b) => b.score - a.score)

    // 3. Real-time Labor Market Skill Intelligence computed from live jobs
    const topMissing = Array.from(missingSkillCounts.entries()).sort((a, b) => b[1] - a[1])[0]
    const trendingSkill = topMissing ? topMissing[0] : 'Motion Graphics'
    const demandCount = topMissing ? topMissing[1] : 1
    const totalJobs = jobs?.length || 1
    const addressableLift = Math.round((demandCount / totalJobs) * 100)

    return NextResponse.json({
      matches,
      marketInsight: `Ranked ${totalJobs} live jobs using 768-dim Gemini embeddings + Multi-Objective Utility (α=${weights.skill.toFixed(2)}, β=${weights.budget.toFixed(2)}, γ=${weights.availability.toFixed(2)}, δ=${weights.experience.toFixed(2)}).`,
      trendingSkill,
      demandSignal: `+${addressableLift}% pool`,
      learningSuggestion: `Adding "${trendingSkill}" appears in ${demandCount} of ${totalJobs} active briefs you're currently missing, expanding your addressable gig pool by +${addressableLift}%.`,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}