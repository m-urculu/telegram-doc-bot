// src/lib/gemini.ts
// Library: Gemini API Interaction Module

// Define interfaces for better type safety with the Gemini API response
interface GeminiPart {
  text: string;
}

interface GeminiContent {
  parts: GeminiPart[];
  role?: string;
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason?: string;
  index?: number;
  // Define safetyRatings more specifically if needed
  safetyRatings?: Record<string, string>[];
}

interface GeminiApiResponse {
  candidates?: GeminiCandidate[];
  // Define promptFeedback more specifically if needed
  promptFeedback?: Record<string, unknown>;
}

async function getGeminiResponse(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL_NAME || 'gemini-1.5-flash-latest'; // Use a current model, allow override

  if (!apiKey) {
    console.error('GEMINI_API_KEY environment variable not set.');
    return null;
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      console.error(`Gemini API error: ${response.status} - ${response.statusText}`);
      const errorData = await response.json();
      console.error('Error details:', errorData);
      return null;
    }

    const data: GeminiApiResponse = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Remove Markdown code fences if present
    const jsonStart = rawText.indexOf('{');
    const jsonEnd = rawText.lastIndexOf('}');

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonStart < jsonEnd) {
      return rawText.substring(jsonStart, jsonEnd + 1);
    } else {
      console.warn('Could not find valid JSON boundaries in Gemini response:', rawText);
      return rawText; // Return the raw text in case it's valid JSON without fences
    }

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return null;
  }
}

export async function callGemini(prompt: string) {
  const response = await getGeminiResponse(prompt);
  if (response) {
    console.log('Gemini Response (Processed):', response);
    return response;
  } else {
    console.log('Failed to get a response from Gemini.');
    return null;
  }
}