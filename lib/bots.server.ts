// src/lib/bots.server.ts
// Server-Side Logic: Bot CRUD Operations

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { callGemini } from '@/lib/gemini';
import { v4 as uuidv4 } from 'uuid';

// --- CREATE ---
export async function createBotServerAction(
  apiKey: string,
  name: string,
  personalityPrompt: string
): Promise<{ error?: string; data?: unknown }> {
  try {
    // 1. Get User Session
    const supabase = createServerComponentClient({ cookies });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Error getting user session:', userError);
      return { error: 'Could not retrieve user session.' };
    }

    // 2. Generate Persona, Greeting, and Fallback using Gemini
    const geminiPrompt = `Generate a JSON object containing the following for a sales bot based on this personality prompt: "${personalityPrompt}". The JSON object should have the keys "persona" (a detailed JSON object representing the bot's personality traits, tone, style, and specific instructions), "greeting" (a short and engaging greeting message), and "fallback" (a polite and helpful fallback response when the bot doesn't understand).`;

    const geminiResponse = await callGemini(geminiPrompt);

    if (!geminiResponse) {
      return { error: 'Failed to get response from Gemini.' };
    }

    let botDetails: { persona: unknown; greeting: string; fallback: string };
    try {
      // Attempt to parse the Gemini response as JSON
      botDetails = JSON.parse(geminiResponse);
      if (!botDetails?.persona || !botDetails?.greeting || !botDetails?.fallback) {
        console.error('Gemini response did not contain expected keys:', botDetails);
        return { error: 'Invalid format in Gemini response.' };
      }
    } catch (error: unknown) {
      console.error('Error parsing Gemini response:', error);
      console.error('Raw Gemini Response:', geminiResponse); // Log the raw response for debugging
      return { error: 'Failed to parse Gemini response.' };
    }

    // 3. Write Bot Data to Supabase
    const { data: insertedBot, error: dbError } = await supabase
      .from('bots')
      .insert({
        id: uuidv4(),
        user_id: user.id,
        api_key: apiKey,
        name: name,
        personality_prompt: personalityPrompt,
        ai_persona: botDetails.persona,
        greeting_message: botDetails.greeting,
        fallback_response: botDetails.fallback,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error saving bot to database:', dbError);
      return { error: 'Failed to save bot configuration.' };
    }

    return { data: insertedBot };

  } catch (error: unknown) {
    console.error('An unexpected error occurred:', error);
    let message = 'An unexpected error occurred.';
    if (error instanceof Error) {
      message = `An unexpected error occurred: ${error.message}`;
    }
    return { error: message };
  }
}

// --- READ ---
export async function getBotByIdServerAction(botId: string): Promise<{ error?: string; data?: unknown }> {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data, error } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .single();

    if (error) {
      console.error('Error fetching bot:', error);
      return { error: 'Failed to fetch bot.' };
    }
    return { data };
  } catch (error: unknown) {
    console.error('An unexpected error occurred:', error);
    let message = 'An unexpected error occurred.';
    if (error instanceof Error) {
      message = `An unexpected error occurred: ${error.message}`;
    }
    return { error: message };
  }
}

export async function getAllUserBotsServerAction(): Promise<{ error?: string; data?: unknown }> {
  try {
    const supabase = createServerComponentClient({ cookies });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: 'Could not retrieve user session.' };
    }

    const { data, error } = await supabase
      .from('bots')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching user bots:', error);
      return { error: 'Failed to fetch user bots.' };
    }
    return { data };
  } catch (error: unknown) {
    console.error('An unexpected error occurred:', error);
    let message = 'An unexpected error occurred.';
    if (error instanceof Error) {
      message = `An unexpected error occurred: ${error.message}`;
    }
    return { error: message };
  }
}

// --- UPDATE ---
export async function updateBotServerAction(
  botId: string,
  updates: { name?: string; apiKey?: string; personalityPrompt?: string; ai_persona?: unknown; greeting_message?: string; fallback_response?: string }
): Promise<{ error?: string; data?: unknown }> {
  try {
    const supabase = createServerComponentClient({ cookies });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: 'Could not retrieve user session.' };
    }

    const { data, error } = await supabase
      .from('bots')
      .update(updates)
      .eq('id', botId)
      .eq('user_id', user.id) // Ensure user owns the bot
      .select()
      .single();

    if (error) {
      console.error('Error updating bot:', error);
      return { error: 'Failed to update bot.' };
    }
    return { data };
  } catch (error: unknown) {
    console.error('An unexpected error occurred:', error);
    let message = 'An unexpected error occurred.';
    if (error instanceof Error) {
      message = `An unexpected error occurred: ${error.message}`;
    }
    return { error: message };
  }
}

// --- DELETE ---
export async function deleteBotServerAction(botId: string): Promise<{ error?: string }> {
  try {
    const supabase = createServerComponentClient({ cookies });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { error: 'Could not retrieve user session.' };
    }

    const { error } = await supabase
      .from('bots')
      .delete()
      .eq('id', botId)
      .eq('user_id', user.id); // Ensure user owns the bot

    if (error) {
      console.error('Error deleting bot:', error);
      return { error: 'Failed to delete bot.' };
    }
    return {}; // Success, no data to return
  } catch (error: unknown) {
    console.error('An unexpected error occurred:', error);
    let message = 'An unexpected error occurred.';
    if (error instanceof Error) {
      message = `An unexpected error occurred: ${error.message}`;
    }
    return { error: message };
  }
}