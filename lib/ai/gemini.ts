import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

/**
 * Generates a 768-dimension semantic embedding vector for pgvector matching.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: {
      outputDimensionality: 768,
    },
  })

  const values = response.embeddings?.[0]?.values
  if (!values) {
    throw new Error('Failed to generate embedding values from Gemini API')
  }
  return values
}

/**
 * Extracts explicit AND implicit skills from a job title + description.
 */
export async function extractSkillsFromJob(
  title: string,
  description: string
): Promise<string[]> {
  const prompt = `You are an expert technical recruiter and labor market analyst.
Analyze the following gig job posting and return a JSON array of 4 to 8 specific skills required—including BOTH explicit skills mentioned and implicit skills strongly implied by the tasks.

Example: "create social media campaigns, design Instagram creatives, and analyse engagement metrics"
Output: ["Social Media Marketing", "Canva", "Graphic Design", "Content Strategy", "Instagram Marketing", "Marketing Analytics"]

Job Title: ${title}
Job Description: ${description}

Return ONLY a raw JSON array of strings.`

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    },
  })

  try {
    const parsed = JSON.parse(response.text ?? '[]')
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}