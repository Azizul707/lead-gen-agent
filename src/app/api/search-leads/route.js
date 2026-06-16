import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const body = await request.json();
    const { webhookUrl, keyword, location, title, limit, source } = body;

    // 1. Verify user session server-side
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access. Please log in." }, { status: 401 });
    }

    if (!webhookUrl) {
      return NextResponse.json({ error: "n8n Webhook URL is missing in settings." }, { status: 400 });
    }

    // 2. Implement Rate Limiting for the Free Scraper (Max 10 searches per hour per user)
    if (source === 'free') {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { count, error: countError } = await supabase
        .from('lead_searches')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('source', 'free')
        .gt('created_at', oneHourAgo);

      if (countError) {
        throw new Error("Failed to verify search rate limits.");
      }

      if (count && count >= 10) {
        return NextResponse.json({ 
          error: "Rate limit exceeded. Free search is limited to 10 searches per hour. Please upgrade to premium for unlimited searches." 
        }, { status: 429 });
      }
    }

    // 3. Generate a unique requestId and set campaign status as 'processing'
    const requestId = crypto.randomUUID();
    
    const { error: insertSearchError } = await supabase
      .from('lead_searches')
      .insert({
        request_id: requestId,
        user_id: user.id,
        search_query: keyword,
        location: location,
        source: source,
        status: 'processing',
        results_count: 0,
        credits_used: source === 'api' ? 5 : 0 // Premium API consumes 5 credits, free consumes 0
      });

    if (insertSearchError) {
      throw insertSearchError;
    }

    // 4. Trigger n8n Webhook asynchronously (Do not wait for n8n to finish scraping)
    // We send Next.js application root URL so n8n knows where to save results back
    const appUrl = request.headers.get('origin') || `${request.headers.get('x-forwarded-proto')}://${request.headers.get('host')}`;

    console.log(`Triggering n8n asynchronously for search request: ${requestId}`);
    
    // We fire the fetch without awaiting it, or awaiting a fast immediately-respond trigger
    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        searchQuery: keyword,
        location,
        industry: title || 'N/A',
        source,
        limit: parseInt(limit, 10),
        requestId,
        userId: user.id,
        appSaveUrl: `${appUrl}/api/save-leads` // n8n will send the scraped leads to this endpoint when finished
      }),
    }).catch(err => {
      console.error("Failed to trigger n8n background execution:", err);
    });

    // 5. Instantly return status 'processing' and requestId to the client
    return NextResponse.json({ 
      status: "processing", 
      requestId,
      message: "Lead generation agent started in the background."
    });

  } catch (error) {
    console.error("API ROUTE ERROR:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}