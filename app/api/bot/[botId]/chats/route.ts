import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

type Context = { params: { botId: string } };

// GET /api/bot/[botId]/chats
export async function GET(request: Request, { params }: Context) {
  try {
    const botId = params.botId;
    if (!botId) {
      return NextResponse.json({ error: 'Bot ID is required.' }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    // Fetch distinct chat IDs for the bot, with last message info
    const { data, error } = await supabase
      .from('messages')
      .select('chat_id, user_id, username, text, date')
      .eq('bot_id', botId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching chats:', error);
      return NextResponse.json({ error: `Failed to fetch chats: ${error.message}` }, { status: 500 });
    }

    // Group messages by chat_id and get the latest message per chat
    interface ChatSummary {
      chat_id: number;
      telegram_user_id: number;
      telegram_username: string | null;
      last_message_text: string | null;
      last_message_at: string | null;
    }
    const chatMap = new Map<number, ChatSummary>();
    for (const msg of data || []) {
      if (!chatMap.has(msg.chat_id)) {
        chatMap.set(msg.chat_id, {
          chat_id: msg.chat_id,
          telegram_user_id: msg.user_id,
          telegram_username: msg.username ?? null,
          last_message_text: msg.text ?? null,
          last_message_at: msg.date ?? null,
        });
      }
    }
    const chats = Array.from(chatMap.values());

    return NextResponse.json({ data: chats }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error in /api/bot/[botId]/chats (GET):', error);
    return NextResponse.json({ error: 'Failed to fetch chats.' }, { status: 500 });
  }
}
