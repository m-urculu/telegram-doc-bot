import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

// Helper to get the authenticated user
const getUser = async () => {
  const cookieStore = cookies(); // Invoke cookies() to get the store
  const supabase = createServerComponentClient({ cookies: () => cookieStore }); // Pass a function that returns the store
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error getting user session:', userError?.message);
    if (userError && (userError.message.includes("cookies() should be awaited") || userError.message.includes("used `cookies().get`"))) {
        throw userError; 
    }
    throw new Error('Could not retrieve user session.');
  }
  return user;
};

// POST /api/document - Store a documentation URL (e.g., Google Docs link)
export async function POST(request: Request) {
  try {
    const user = await getUser();

    // Accept JSON body with file_url, file_name, bot_id
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    const file_url = body.file_url;
    // const file_name_from_body = body.file_name; // We'll ignore this for the database file_name
    const bot_id = body.bot_id || null;

    if (!file_url || typeof file_url !== 'string') {
      return NextResponse.json({ error: 'file_url is required and must be a string.' }, { status: 400 });
    }

    // Initialize documentTitle with a default. It will be updated if fetched successfully from the URL.
    let documentTitle = 'Google Doc'; 
    let document = ''; // For storing the document content
    try {
      const match = file_url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        const docId = match[1];
        // Fetch document content as plain text
        const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
        const res = await fetch(exportUrl);
        if (res.ok) {
          document = await res.text();
        } else {
          console.warn('Failed to fetch document content from Google Docs export endpoint:', res.status);
        }
        // Try to fetch the document metadata to get the title
        try {
          console.log(`Attempting to fetch metadata for docId: ${docId} from URL: ${file_url}`);
          const metaRes = await fetch(`https://docs.google.com/document/d/${docId}/edit`);
          console.log(`Metadata fetch response status for ${docId}: ${metaRes.status}`);

          if (metaRes.ok) {
            const html = await metaRes.text();
            // For debugging, log a larger portion of the HTML to inspect its structure
            // In production, you'd want to be more careful with logging large strings.
            console.log(`Fetched HTML for ${docId} (first 2000 chars): ${html.substring(0, 2000)}`); 
            
            let extractedTitle = "";
            let titleSource = "";

            // Try to find Open Graph title first
            const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"\s*\/?>/i);
            if (ogTitleMatch && ogTitleMatch[1]) {
              extractedTitle = ogTitleMatch[1];
              titleSource = "og:title";
              console.log(`Raw title from <meta property="og:title"> for ${docId}: "${extractedTitle}"`);
            } else {
              // Fallback to <title> tag
              const titleTagMatch = html.match(/<title>(.*?)<\/title>/i);
              if (titleTagMatch && titleTagMatch[1]) {
                extractedTitle = titleTagMatch[1];
                titleSource = "<title> tag";
                console.log(`Raw title from <title> tag for ${docId}: "${extractedTitle}"`);
              } else {
                console.log(`Could not find <meta property="og:title"> or <title> tag in HTML for ${docId}.`);
              }
            }

            if (extractedTitle) {
              // Remove " - Google Docs" suffix (case-insensitive) and trim
              const cleanedTitle = extractedTitle.replace(/\s*-\s*Google Docs\s*$/i, '').trim();
              const lowerCleanedTitle = cleanedTitle.toLowerCase();
              if (cleanedTitle.length > 0 && lowerCleanedTitle !== 'google docs' && lowerCleanedTitle !== 'docs') {
                documentTitle = cleanedTitle;
                console.log(`Successfully updated documentTitle (from ${titleSource}) for ${docId} to: "${documentTitle}"`);
              } else {
                console.log(`Cleaned title for ${docId} ("${cleanedTitle}") was empty or a generic placeholder, using default: "${documentTitle}"`);
              }
            } else {
              // This case is already handled by the "Could not find..." log above if both attempts fail
            }            
          } else {
            console.warn(`Metadata fetch response for ${docId} was not OK (status: ${metaRes.status}). The document might not be public or accessible.`);
          }
        } catch (metaError) {
          console.error(`Error fetching or parsing document metadata for ${docId}:`, metaError);
          // If an error occurs here, documentTitle remains the default 'Google Doc'
        }
      } else {
        console.warn('file_url does not match expected Google Docs pattern, document content will be empty.');
      }
    } catch {
      console.error('Error fetching document content from URL');
    }

    const postCookieStore = cookies(); // Get cookie store for this handler
    const supabase = createServerComponentClient({ cookies: () => postCookieStore });
    const { data, error } = await supabase
      .from('documentation')
      .insert({
        user_id: user.id,
        bot_id,
        file_name: documentTitle,
        file_url,
        document,
      })
      .select()
      .single();

    if (error) {
      console.error('Error uploading documentation URL:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    let errorMessage = 'Failed to upload documentation URL.';
    let status = 500;
    if (error instanceof Error) {
      errorMessage = error.message === 'Could not retrieve user session.'
        ? 'Authentication required.'
        : `Failed to upload documentation URL: ${error.message}`;
      status = error.message === 'Could not retrieve user session.' ? 401 : 500;
    } else if (typeof error === 'string') {
      errorMessage = `Failed to upload documentation URL: ${error}`;
    } else {
      // Handle other unknown error types if necessary
    }
    // Log the error for debugging
    console.error('POST /api/document error:', error);
    return NextResponse.json({ error: errorMessage }, { status });
  }
}

// DELETE /api/document - Delete a specific document for the authenticated user
export async function DELETE(request: Request) {
  try {
    const user = await getUser();
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    const { id: documentId } = body;

    if (!documentId || typeof documentId !== 'string') {
      return NextResponse.json({ error: 'Document ID is required and must be a string.' }, { status: 400 });
    }

    const deleteCookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => deleteCookieStore });

    const { error } = await supabase
      .from('documentation')
      .delete()
      .eq('id', documentId)
      .eq('user_id', user.id); // Ensure the document belongs to the authenticated user

    if (error) {
      console.error('Error deleting document:', error);
      return NextResponse.json({ error: `Failed to delete document: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ message: 'Document deleted successfully.' }, { status: 200 });
  } catch (error: unknown) {
    let errorMessage = 'Failed to delete document.';
    let status = 500;
    if (error instanceof Error) {
      errorMessage = error.message === 'Could not retrieve user session.' ? 'Authentication required.' : `Failed to delete document: ${error.message}`;
      status = error.message === 'Could not retrieve user session.' ? 401 : 500;
    }
    return NextResponse.json({ error: errorMessage }, { status });
  }
}

// GET /api/document - Retrieve all documentation files for the authenticated user
export async function GET() {
  try {
    const user = await getUser();
    const getCookieStore = cookies(); // Get cookie store for this handler
    const supabase = createServerComponentClient({ cookies: () => getCookieStore });

    const { data, error } = await supabase
      .from('documentation')
      .select('id, file_name, file_url, uploaded_at, bot_id')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching documentation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    let errorMessage = 'Failed to fetch documentation.';
    let status = 500;
    if (error instanceof Error) {
      errorMessage = error.message === 'Could not retrieve user session.'
        ? 'Authentication required.'
        : `Failed to fetch documentation: ${error.message}`;
      status = error.message === 'Could not retrieve user session.' ? 401 : 500;
    } else if (typeof error === 'string') {
      errorMessage = `Failed to fetch documentation: ${error}`;
    } else {
      // Handle other unknown error types
    }
    return NextResponse.json({ error: errorMessage }, { status });
  }
}

// PATCH /api/document - Update a document's bot_id
export async function PATCH(request: Request) {
  try {
    const user = await getUser();
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    const { documentId, botId } = body; // botId can be string (UUID) or null

    if (!documentId || typeof documentId !== 'string') {
      return NextResponse.json({ error: 'Document ID is required and must be a string.' }, { status: 400 });
    }
    // Allow botId to be null (for unassigning) or a string (UUID)
    if (botId !== null && typeof botId !== 'string') {
        return NextResponse.json({ error: 'Bot ID must be a string (UUID) or null.' }, { status: 400 });
    }

    const patchCookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => patchCookieStore });

    const { data: updatedDocument, error } = await supabase
      .from('documentation')
      .update({ bot_id: botId }) // Update only bot_id
      .eq('id', documentId)
      .eq('user_id', user.id) // Ensure the document belongs to the authenticated user
      .select()
      .single();

    if (error) {
      console.error('Error updating document assignment:', error);
      return NextResponse.json({ error: `Failed to update document assignment: ${error.message}` }, { status: 500 });
    }
    if (!updatedDocument) {
        return NextResponse.json({ error: 'Document not found or update failed.' }, { status: 404 });
    }

    return NextResponse.json({ data: updatedDocument }, { status: 200 });
  } catch (error: unknown) {
    let errorMessage = 'Failed to update document assignment.';
    let status = 500;
    if (error instanceof Error) {
      errorMessage = error.message === 'Could not retrieve user session.' ? 'Authentication required.' : `Failed to update document assignment: ${error.message}`;
      status = error.message === 'Could not retrieve user session.' ? 401 : 500;
    }
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
