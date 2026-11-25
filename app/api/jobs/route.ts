import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractSkillsFromJob, generateEmbedding } from '@/lib/ai/gemini'

export async function GET() {
  const supabase = await createClient()

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(`
      *,
      client:profiles!jobs_client_id_fkey (
        id,
        full_name,
        company_name,
        location
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ jobs })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      required_skills = [],
      experience_level = 'intermediate',
      budget_min = 30,
      budget_max = 60,
      estimated_hours = 20,
      work_type = 'remote',
      location = 'Remote',
      deadline,
      client_id = '11111111-1111-1111-1111-111111111101', // Default demo client
    } = body

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required.' },
        { status: 400 }
      )
    }

    // 1. Extract explicit + implicit skills using Gemini
    const extracted_skills = await extractSkillsFromJob(title, description)

    // 2. Generate 768-dim embedding for pgvector semantic matching
    const allSkills = Array.from(new Set([...required_skills, ...extracted_skills]))
    const embedText = `Job Title: ${title}. Description: ${description}. Skills: ${allSkills.join(', ')}`
    const embedding = await generateEmbedding(embedText)

    // 3. Save to Supabase
    const supabase = await createClient()
    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        client_id,
        title,
        description,
        required_skills,
        extracted_skills,
        experience_level,
        budget_min: Number(budget_min),
        budget_max: Number(budget_max),
        estimated_hours: Number(estimated_hours),
        work_type,
        location,
        deadline: deadline || null,
        status: 'open',
        embedding,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ job }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}