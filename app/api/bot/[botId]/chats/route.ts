import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// GET /api/bot/[botId]/chats
export async function GET(request: Request, { params }: { params: { botId: string } }) {
  try {
    const botId = params.botId;
    if (!botId) {
      return NextResponse.json({ error: 'Bot ID is required.' }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    // Fetch distinct chats for the bot, with last message info
    const { data, error } = await supabase
      .rpc('get_bot_chats', { bot_id_input: botId }); // You should have a Postgres function for this

    if (error) {
      console.error('Error fetching chats:', error);
      return NextResponse.json({ error: `Failed to fetch chats: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error in /api/bot/[botId]/chats (GET):', error);
    return NextResponse.json({ error: 'Failed to fetch chats.' }, { status: 500 });
  }
}
