import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request) {
  try {
    const body = await request.json();
    const { webhookUrl, keyword, location, title, limit, source } = body;

    // 1. Verify user session server-side using JWT token from Authorization header
    const authHeader = request.headers.get('Authorization');
    const token = authHeader ? authHeader.split(' ')[1] : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized access. No session token provided." }, { status: 401 });
    }

    // Initialize a user-scoped Supabase client that carries the user's JWT token
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    // Securely verify the token directly with Supabase engine
    const { data: { user }, error: authError } = await userSupabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized access. Invalid session or expired token." }, { status: 401 });
    }

    if (!webhookUrl) {
      return NextResponse.json({ error: "n8n Webhook URL is missing in settings." }, { status: 400 });
    }

    // 2. Implement Rate Limiting for the Free Scraper (Max 10 searches per hour per user)
    if (source === 'free') {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { count, error: countError } = await userSupabase
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
    
    const { error: insertSearchError } = await userSupabase
      .from('lead_searches')
      .insert({
        request_id: requestId,
        user_id: user.id,
        search_query: keyword,
        location: location,
        source: source,
        status: 'processing',
        results_count: 0,
        credits_used: source === 'api' ? 5 : 0
      });

    if (insertSearchError) {
      throw insertSearchError;
    }

    // 4. Trigger n8n Webhook (Awaiting the fast immediate-respond trigger to prevent serverless process cutoff)
    const appUrl = request.headers.get('origin') || `${request.headers.get('x-forwarded-proto')}://${request.headers.get('host')}`;

    console.log(`Triggering n8n for search request: ${requestId} via URL: ${webhookUrl}`);
    
    try {
      const n8nResponse = await fetch(webhookUrl, {
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
          appSaveUrl: `${appUrl}/api/save-leads`
        }),
      });

      if (!n8nResponse.ok) {
        console.error(`n8n webhook returned non-200 status code: ${n8nResponse.status}`);
      } else {
        console.log("Successfully triggered n8n webhook and received queued confirmation response.");
      }
    } catch (n8nError) {
      console.error("Failed to connect or fetch n8n webhook:", n8nError);
    }

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