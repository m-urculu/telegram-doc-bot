// src/app/api/bot/route.ts
// Handles CRUD /api/bot (Create, Read, Update, Delete) operations for bots

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { v4 as uuidv4 } from 'uuid';
import { callGemini } from '@/lib/gemini'; // Assuming this is your Gemini utility

// --- Helper function to get user ---
const getUser = async () => {
  const cookieStore = await cookies(); // Ensure cookies() is awaited
  const supabase = createServerComponentClient({ cookies: () => cookieStore }); // Pass the awaited cookie store
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error getting user session:', userError?.message);
    // If the error is the specific Next.js cookies error, rethrow it or a custom one.
    if (userError && (userError.message.includes("cookies() should be awaited") || userError.message.includes("used `cookies().get`"))) {
        throw userError; // Propagate the specific error
    }
    throw new Error('Could not retrieve user session.');
  }
  return user;
};

// --- POST (Create) ---
export async function POST(request: Request) {
  try {
    const user = await getUser();

    const { apiKey, name, personalityPrompt } = await request.json();

    if (!apiKey || !name || !personalityPrompt) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const cookieStore = cookies(); // Get cookie store for this handler
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    // Fetch all bots' API keys for the authenticated user
    const { data: bots, error: fetchError } = await supabase
      .from('bots')
      .select('api_key')
      .eq('user_id', user.id);

    if (fetchError) {
      console.error('Error fetching bots for API key validation:', fetchError);
      return NextResponse.json({ error: 'Failed to validate API key.' }, { status: 500 });
    }

    // Check if the provided API key already exists
    const apiKeyExists = bots.some((bot: { api_key: string }) => bot.api_key === apiKey);

    if (apiKeyExists) {
      return NextResponse.json({ error: 'API key already exists in another bot.' }, { status: 400 });
    }

    // 2. Generate Persona, Greeting, and Fallback using Gemini
    const geminiPrompt = `Generate a JSON object containing the following for a sales bot based on this personality prompt: "${personalityPrompt}". The JSON object should have the keys "persona" (a detailed JSON object representing the bot's personality traits, tone, style, and specific instructions), "greeting" (a short and engaging greeting message), and "fallback" (a polite and helpful fallback response when the bot doesn't understand).`;
    const geminiResponse = await callGemini(geminiPrompt); // Ensure callGemini handles its errors

    if (!geminiResponse) {
      console.error('Gemini call returned no response.');
      return NextResponse.json({ error: 'Failed to get response from Gemini.' }, { status: 500 });
    }

    let botDetails: { persona: unknown; greeting: string; fallback: string };
    try {
      // Remove JavaScript-style comments before parsing
      const cleanedGeminiResponse = geminiResponse
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // Remove multi-line and single-line comments
        .trim(); // Trim whitespace just in case
      botDetails = JSON.parse(cleanedGeminiResponse);
      if (
        typeof botDetails !== 'object' ||
        !botDetails ||
        !('persona' in botDetails) ||
        !('greeting' in botDetails) ||
        !('fallback' in botDetails)
      ) {
        console.error('Gemini response did not contain expected keys:', botDetails);
        return NextResponse.json({ error: 'Invalid format in Gemini response.' }, { status: 500 });
      }
    } catch (error: unknown) {
      console.error('Error parsing Gemini response:', error);
      console.error('Raw Gemini Response:', geminiResponse);
      return NextResponse.json({ error: 'Failed to parse Gemini response.' }, { status: 500 });
    }

    // 3. Write Bot Data to Supabase
    const newBotId = uuidv4(); // Generate ID beforehand

    const { data: insertedBot, error: dbError } = await supabase
      .from('bots')
      .insert({
        id: newBotId, // Use generated ID
        user_id: user.id,
        api_key: apiKey, // Consider encrypting this at rest
        name: name,
        personality_prompt: personalityPrompt,
        ai_persona: botDetails.persona,
        greeting_message: botDetails.greeting,
        fallback_response: botDetails.fallback,
      })
      .select() // Select the inserted row
      .single(); // Expect a single row back

    if (dbError) {
      console.error('Error saving bot to database:', dbError);
      // Check for specific errors like unique constraints if needed
      return NextResponse.json({ error: `Failed to save bot configuration: ${dbError.message}` }, { status: 500 });
    }
    
    if (!insertedBot) {
        // This case might happen if RLS prevents the insert or select,
        // or if .single() unexpectedly returns null after a successful insert without error.
        console.error('Bot insertion seemed successful, but no data was returned.');
        return NextResponse.json({ error: 'Failed to retrieve bot details after creation.' }, { status: 500 });
    }

    // --- Set Telegram webhook dynamically ---
    try {
      const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
      if (!vercelUrl) {
        console.warn('NEXT_PUBLIC_VERCEL_URL environment variable is not set. Skipping webhook setup.');
      } else {
        const webhookUrl = `https://${vercelUrl}/api/telegram`;
        const telegramSetWebhookUrl = `https://api.telegram.org/bot${apiKey}/setWebhook`;
        const res = await fetch(telegramSetWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl }),
        });
        const webhookResult = await res.json();
        if (!webhookResult.ok) {
          console.error('Failed to set Telegram webhook:', webhookResult);
        } else {
          console.log('Telegram webhook set successfully:', webhookResult);
        }
      }
    } catch (webhookError) {
      console.error('Error setting Telegram webhook:', webhookError);
    }

    // Return the newly created bot data
    return NextResponse.json({ data: insertedBot }, { status: 201 }); // Use 201 Created status

  } catch (error: unknown) {
    console.error('Error in /api/bot (POST):', error);
    let errorMessage = 'Failed to create bot.';
    let status = 500;
    if (error instanceof Error) {
      if (error.message.includes("cookies() should be awaited") || error.message.includes("used `cookies().get`")) {
        errorMessage = "Session handling error. Please ensure you are logged in and try again.";
        status = 500; // Internal Server Error, as it's a server-side misconfiguration or bug
      } else if (error.message === 'Could not retrieve user session.') {
        errorMessage = 'Authentication required.';
        status = 401;
      } else {
        errorMessage = `Failed to create bot: ${error.message}`;
      }
    }
    return NextResponse.json({ error: errorMessage }, { status });
  }
}

// --- GET (Read) ---
export async function GET() {
  try {
    const user = await getUser();

    const cookieStore = await cookies(); // Ensure cookies() is awaited
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    // Fetch all bots for the authenticated user
    const { data, error } = await supabase
      .from('bots')
      .select('id, user_id, api_key, name, personality_prompt, ai_persona, greeting_message, fallback_response') // Correct fields
      .eq('user_id', user.id); // Filter by the authenticated user's ID

    if (error) {
      console.error('Error fetching bots:', error);
      return NextResponse.json({ error: `Failed to fetch bots: ${error.message}` }, { status: 500 });
    }

    if (!data || data.length === 0) {
      console.warn('No bots found for the user.');
      return NextResponse.json({ data: [] }, { status: 200 }); // Return an empty array if no bots are found
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error in /api/bot (GET):', error);
    let errorMessage = 'Failed to fetch bots.';
    let status = 500;
    if (error instanceof Error) {
      if (error.message.includes("cookies() should be awaited") || error.message.includes("used `cookies().get`")) {
        errorMessage = "Session handling error. Please try again.";
        status = 500;
      } else if (error.message === 'Could not retrieve user session.') {
        errorMessage = 'Authentication required.';
        status = 401;
      } else {
        errorMessage = `Failed to fetch bots: ${error.message}`;
      }
    }
    return NextResponse.json({ error: errorMessage }, { status });
  }
}

// --- DELETE (Delete) ---
export async function DELETE(request: Request) {
  try {
    const user = await getUser(); // Authenticate the user
    const { id } = await request.json(); // Parse the request body to get the bot ID

    if (!id) {
      return NextResponse.json({ error: 'Bot ID is required.' }, { status: 400 });
    }

    const cookieStore = cookies(); // Get cookie store for this handler
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    // Delete the bot from the database
    const { error } = await supabase
      .from('bots')
      .delete()
      .eq('id', id) // Filter by bot ID
      .eq('user_id', user.id); // Ensure the bot belongs to the authenticated user

    if (error) {
      console.error('Error deleting bot:', error);
      return NextResponse.json({ error: `Failed to delete bot: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ message: 'Bot deleted successfully.' }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error in /api/bot (DELETE):', error);
    let errorMessage = 'Failed to delete bot.';
    let status = 500;
    if (error instanceof Error) {
      if (error.message.includes("cookies() should be awaited") || error.message.includes("used `cookies().get`")) {
        errorMessage = "Session handling error. Please try again.";
        status = 500;
      } else if (error.message === 'Could not retrieve user session.') {
        errorMessage = 'Authentication required.';
        status = 401;
      } else {
        errorMessage = `Failed to delete bot: ${error.message}`;
      }
    }
    return NextResponse.json({ error: errorMessage }, { status });
  }
}

// --- PATCH (Update) ---
export async function PATCH(request: Request) {
  try {
    const user = await getUser(); // Authenticate the user
    const body = await request.json(); // Parse the request body

    const {
      id,
      // name, // Not currently sent by the dashboard edit form for PATCH
      // apiKey, // Not currently sent by the dashboard edit form for PATCH
      personalityPrompt, // Sent from the edit form
      aiPersona,         // Sent from the edit form (already a JSON object or null)
      greetingMessage,   // Sent from the edit form
      fallbackResponse   // Sent from the edit form
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Bot ID is required.' }, { status: 400 });
    }

    const cookieStore = cookies(); // Get cookie store for this handler
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    // Note: API key validation during PATCH is only relevant if apiKey is part of the PATCH payload.
    // The current dashboard form doesn't send apiKey for updates, so this block might not be hit.
    if (body.apiKey) { // Check if apiKey was part of the body
      const { data: existingBot, error: apiKeyError } = await supabase
        .from('bots')
        .select('id')
        .eq('api_key', body.apiKey)
        .neq('id', id) // Exclude the current bot from the check
        .single();

      if (apiKeyError && apiKeyError.code !== 'PGRST116') { // Ignore "no rows found" error
        console.error('Error checking API key:', apiKeyError);
        return NextResponse.json({ error: 'Failed to validate API key.' }, { status: 500 });
      }

      if (existingBot) {
        return NextResponse.json({ error: 'API key already exists in another bot.' }, { status: 400 });
      }
    }

    const updatedFields: Record<string, string | object | null> = {};

    // Map provided fields from the request body to database column names
    // Only add fields to `updatedFields` if they were actually included in the request
    if (body.name !== undefined) { // If name update is ever added to the form
      updatedFields.name = body.name;
    }
    if (body.apiKey !== undefined) { // If apiKey update is ever added to the form
      updatedFields.api_key = body.apiKey;
    }
    if (personalityPrompt !== undefined) {
      updatedFields.personality_prompt = personalityPrompt;
    }
    if (aiPersona !== undefined) { // aiPersona is expected to be an object or null
      updatedFields.ai_persona = aiPersona;
    }
    if (greetingMessage !== undefined) {
      updatedFields.greeting_message = greetingMessage;
    }
    if (fallbackResponse !== undefined) {
      updatedFields.fallback_response = fallbackResponse;
    }

    // If no fields were provided to update (that this handler processes), return an error
    if (Object.keys(updatedFields).length === 0) {
      return NextResponse.json({ error: 'No recognized fields to update were provided.' }, { status: 400 });
    }

    // Update the bot in the database
    const { data: updatedBot, error: updateError } = await supabase
      .from('bots')
      .update(updatedFields)
      .eq('id', id) // Filter by bot ID
      .eq('user_id', user.id) // Ensure the bot belongs to the authenticated user
      .select()
      .single();

    if (updateError) {
      console.error('Error updating bot:', updateError);
      return NextResponse.json({ error: `Failed to update bot: ${updateError.message}` }, { status: 500 });
    }

    if (!updatedBot) {
      // This could happen if RLS prevents the update, or the bot ID + user ID combo wasn't found.
      console.error('Bot not found or update failed to return data.');
      return NextResponse.json({ error: 'Bot not found or failed to retrieve details after update.' }, { status: 404 });
    }

    // Return the updated bot data
    return NextResponse.json({ data: updatedBot }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error in /api/bot (PATCH):', error);
    let errorMessage = 'Failed to update bot.';
    let status = 500;
    if (error instanceof Error) {
      if (error.message.includes("cookies() should be awaited") || error.message.includes("used `cookies().get`")) {
        errorMessage = "Session handling error. Please try again.";
        status = 500;
      } else if (error.message === 'Could not retrieve user session.') {
        errorMessage = 'Authentication required.';
        status = 401;
      } else {
        errorMessage = `Failed to update bot: ${error.message}`;
      }
    }  else if (typeof error === 'string') {
        errorMessage = `Failed to update bot: ${error}`;
    }
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
