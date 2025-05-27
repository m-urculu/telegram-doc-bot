import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Assume this is correctly configured
import { callGemini } from '@/lib/gemini'; // Assume this is correctly configured

// --- 0. Interfaces & Types ---
// Only interfaces directly relevant to receiving message, context, and bot profile.
interface BotProfile {
    id: string;
    ai_persona: string;
    fallback_response: string;
}

interface IncomingMessage {
    message_id: number;
    from?: {
        id: number;
        is_bot?: boolean;
        first_name?: string;
        last_name?: string;
        username?: string;
    };
    chat?: {
        id: number;
        type?: string;
    };
    date: number;
    text?: string;
    [key: string]: unknown;
}

interface ContextMessage {
    text: string;
    user_id: number;
    is_bot_response: boolean; // To distinguish user messages from bot replies in context
}

// Simplified LLMDecision as it will only output a direct response.
// interface LLMDecision {
//     response_text: string; // The LLM will directly generate the response text
// }

export async function POST(request: Request) {
    try {
        // --- 1. Receive the message from user, chat context and documentation (Bot Profile) ---
        const { searchParams } = new URL(request.url);
        const apiKey = searchParams.get('api_key'); // This is the Telegram Bot API Key
        if (!apiKey) return NextResponse.json({ ok: false, error: 'Missing Telegram api_key for bot identification' }, { status: 400 });

        const body = await request.json();
        const message = body.message as IncomingMessage | undefined;

        // Log received Telegram message
        console.log('[Telegram] Received message:', JSON.stringify(message, null, 2));

        if (!message || !message.text) {
            console.log('No message or no text in message, skipping.');
            return NextResponse.json({ ok: true, info: 'No message text to process' });
        }

        const { message_id, from, chat, text, date } = message;
        const userTelegramId = from?.id;
        const chatTelegramId = chat?.id;

        if (!userTelegramId || !chatTelegramId) {
            console.error('Missing user_id or chat_id from Telegram message.');
            return NextResponse.json({ ok: false, error: 'Missing user or chat ID from Telegram.' }, { status: 400 });
        }

        // Fetch Bot Profile (personality and fallback response)
        const { data: bot, error: botError } = await supabase
            .from('bots')
            .select('id, ai_persona, fallback_response')
            .eq('api_key', apiKey)
            .single();

        if (botError || !bot) {
            console.error('Bot not found for the given api_key (Telegram token). Error:', botError?.message);
            return NextResponse.json({ ok: false, error: 'Bot configuration not found.' }, { status: 404 });
        }
        const botProfile = bot as BotProfile;
        const botId = botProfile.id;

        // --- Fetch documentation for this bot (step 1) ---
        let documentation: { file_name: string; document: string }[] = [];
        try {
            const { data: docs, error: docsError } = await supabase
                .from('documentation')
                .select('file_name, document')
                .eq('bot_id', botId);

            if (docsError) {
                console.error('Error fetching documentation for bot:', docsError);
            } else if (docs) {
                documentation = docs;
                console.log(`[Docs] Fetched ${docs.length} documentation entries for bot ${botId}`);
            }
        } catch (e) {
            console.error('Exception fetching documentation for bot:', e);
        }

        // Store Incoming Message & Fetch Context
        const { error: insertError } = await supabase.from('messages').insert({
            bot_id: botId,
            message_id: message_id,
            user_id: userTelegramId,
            username: from?.username || `${from?.first_name ?? ''} ${from?.last_name ?? ''}`.trim(),
            chat_id: chatTelegramId,
            text: text,
            date: new Date(date * 1000).toISOString(),
            raw: message,
        });
        if (insertError) {
            console.error('DB insert error for incoming message:', insertError);
        } else {
            // Log successful storage of incoming message
            console.log(`[DB] Stored incoming message from user ${userTelegramId} in chat ${chatTelegramId}`);
        }

        let contextMessages: ContextMessage[] = [];
        try {
            // Fetch the last 10 messages for context, excluding the current one
            const { data: messagesData, error: contextError } = await supabase
                .from('messages')
                .select('text, user_id, date, raw')
                .eq('bot_id', botId)
                .eq('chat_id', chatTelegramId)
                .order('date', { ascending: false })
                .limit(10);

            if (contextError) throw contextError;

            if (messagesData) {
                // Filter out the current incoming message if it's already in the context
                contextMessages = messagesData
                    .filter(m => m.text !== text || m.user_id !== userTelegramId)
                    .map(m => ({
                        text: m.text || '',
                        user_id: m.user_id,
                        is_bot_response: m.raw === null, // Infer if it's a bot response
                    }))
                    .reverse(); // Oldest first for chronological context
            }
            console.log('Context Messages:', JSON.stringify(contextMessages, null, 2));
        } catch (e) {
            const error = e instanceof Error ? e.message : 'Unknown error fetching context messages';
            console.error('Error fetching context messages:', error, e);
        }

        // --- 2. Generate response ---
        let finalAiResponseText: string = botProfile.fallback_response || "Sorry, I didn't quite understand that.";

        // Incorporate documentation into the LLM prompt if available
        let docsSnippet = '';
        if (documentation.length > 0) {
            // Use up to 2 docs, truncate each to 1000 chars for context
            docsSnippet =
                '\nRelevant Documentation:\n' +
                documentation
                    .slice(0, 2)
                    .map(
                        (doc, i) =>
                            `Doc${i + 1} (${doc.file_name}):\n${doc.document.slice(0, 1000)}${
                                doc.document.length > 1000 ? '...' : ''
                            }`
                    )
                    .join('\n\n');
        }

        const llmPrompt = `
            You are a general assistant with the following persona: "${botProfile.ai_persona}".
            Your goal is to provide helpful, conversational, and concise responses.
            You should always maintain your assigned persona.

            Conversation History (most recent messages first):
            ${contextMessages.slice(-5).map(m => `${m.is_bot_response ? 'Bot' : 'User'}: ${m.text}`).join('\n')}
            User's latest message: "${text}"
            ${docsSnippet}

            Based on the above, generate a direct conversational response.
            Do NOT use Markdown or HTML in your response.
            Be conversational and offer further assistance if appropriate.
            If you don't have enough information to provide a specific answer, state that politely.
        `;

        console.log("LLM Prompt (snippet):", llmPrompt.substring(0, 500) + "...");
        const llmResult = await callGemini(llmPrompt);

        if (typeof llmResult === 'string' && llmResult.trim().length > 0) {
            finalAiResponseText = llmResult.trim();
        } else {
            console.warn("Gemini response was empty or not a string, using fallback.");
            finalAiResponseText = botProfile.fallback_response || "I'm not sure how to respond to that.";
        }
        // Log the AI response before sending
        console.log('[AI] Response to be sent:', finalAiResponseText);


        // --- 3. Store response on the chat context db & Send to Telegram ---
        try {
            const botMessageId = -1 * Date.now(); // Using negative timestamp as a unique ID for bot messages

            const { error: insertBotMessageError } = await supabase.from('messages').insert({
                bot_id: botId,
                message_id: botMessageId,
                user_id: userTelegramId,
                chat_id: chatTelegramId,
                text: finalAiResponseText,
                date: new Date().toISOString(),
                raw: null, // This is key for is_bot_response inference in context fetching
            });
            if (insertBotMessageError) {
                console.error('DB insert error for bot response:', insertBotMessageError);
            } else {
                // Log successful storage of bot response
                console.log(`[DB] Stored bot response for user ${userTelegramId} in chat ${chatTelegramId}`);
            }

            const TELEGRAM_MAX_LENGTH = 4096;
            const messagesToSend: string[] = [];
            let remaining = finalAiResponseText;

            while (remaining.length > TELEGRAM_MAX_LENGTH) {
                let splitIdx = remaining.lastIndexOf('\n', TELEGRAM_MAX_LENGTH);
                if (splitIdx === -1 || splitIdx < TELEGRAM_MAX_LENGTH / 2) splitIdx = TELEGRAM_MAX_LENGTH;
                messagesToSend.push(remaining.slice(0, splitIdx));
                remaining = remaining.slice(splitIdx);
            }
            if (remaining.length > 0) messagesToSend.push(remaining);

            const telegramSendMessageUrl = `https://api.telegram.org/bot${apiKey}/sendMessage`;
            for (const msg of messagesToSend) {
                const sendRes = await fetch(telegramSendMessageUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatTelegramId, text: msg }),
                });
                const sendResult = await sendRes.json();
                if (!sendResult.ok) {
                    console.error('Failed to send message to Telegram:', sendResult);
                } else {
                    // Log successful sending of message chunk
                    console.log('[Telegram] Successfully sent message chunk to Telegram:', msg.substring(0, 80));
                }
            }
        } catch (e) {
            const error = e instanceof Error ? e.message : 'Unknown error sending to Telegram or DB';
            console.error('Error sending message to Telegram/DB:', error, e);
        }

        return NextResponse.json({ ok: true, response_sent: finalAiResponseText.substring(0, 100) + "..." });

    } catch (e) {
        const error = e instanceof Error ? e.message : 'Unknown webhook processing error';
        console.error('Overall Telegram webhook error:', error, e);
        return NextResponse.json({ ok: false, error: 'Webhook error: ' + error }, { status: 500 });
    }
}
