import { GoogleGenAI } from '@google/genai'

// ============================================================
// Gemini client singleton
// ============================================================
// MUST only be imported in server-side code.
// The GEMINI_API_KEY must never be exposed to the browser.
// ============================================================

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. ' +
        'Add it to .env.local and ensure it is not prefixed with NEXT_PUBLIC_.',
    )
  }
  return new GoogleGenAI({ apiKey })
}

let _gemini: GoogleGenAI | null = null

export function getGemini(): GoogleGenAI {
  if (!_gemini) {
    _gemini = createGeminiClient()
  }
  return _gemini
}
