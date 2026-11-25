import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/ai/gemini'

const DEFAULT_WORKER_ID = '22222222-2222-2222-2222-222222222201' // Aarav Mehta

interface SkillItem {
  name: string
  level: number
  verified: boolean
}

function calculateCompletion(profile: {
  full_name?: string
  headline?: string
  bio?: string
  location?: string
  hourly_rate?: number
  skills?: SkillItem[]
}) {
  let score = 20
  if (profile.full_name?.trim()) score += 15
  if (profile.headline?.trim()) score += 15
  if (profile.bio?.trim() && profile.bio.trim().length > 20) score += 15
  if (profile.location?.trim()) score += 10
  if (Number(profile.hourly_rate) > 0) score += 10
  if (Array.isArray(profile.skills) && profile.skills.length >= 3) score += 15
  return Math.min(100, score)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const workerId = searchParams.get('id') || DEFAULT_WORKER_ID

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, headline, bio, location, hourly_rate, availability_hours_per_week, availability_status, experience_years, skills, profile_completion')
    .eq('id', workerId)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: error?.message ?? 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({ profile })
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const workerId = body.id || DEFAULT_WORKER_ID

    const skills: SkillItem[] = Array.isArray(body.skills)
      ? body.skills.map((s: SkillItem) => ({
          name: String(s.name).trim(),
          level: Math.min(100, Math.max(1, Number(s.level) || 80)),
          verified: Boolean(s.verified),
        }))
      : []

    const profile_completion = calculateCompletion({
      full_name: body.full_name,
      headline: body.headline,
      bio: body.bio,
      location: body.location,
      hourly_rate: body.hourly_rate,
      skills,
    })

    // Re-generate 768-dim Gemini embedding so pgvector match scores update dynamically
    const skillNames = skills.map((s) => s.name).join(', ')
    const embedText = `Headline: ${body.headline ?? ''}. Bio: ${body.bio ?? ''}. Skills: ${skillNames}`
    const embedding = await generateEmbedding(embedText)

    const supabase = await createClient()
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        full_name: body.full_name,
        headline: body.headline,
        bio: body.bio,
        location: body.location,
        hourly_rate: Number(body.hourly_rate) || 0,
        availability_hours_per_week: Number(body.availability_hours_per_week) || 20,
        availability_status: body.availability_status || 'available',
        experience_years: Number(body.experience_years) || 1,
        skills,
        profile_completion,
        embedding,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workerId)
      .select('id, role, full_name, headline, bio, location, hourly_rate, availability_hours_per_week, availability_status, experience_years, skills, profile_completion')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}