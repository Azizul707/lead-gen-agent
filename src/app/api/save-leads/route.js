import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request) {
  try {
    const body = await request.json();
    const { requestId, userId, source, leads } = body;

    if (!requestId || !userId || !Array.isArray(leads)) {
      return NextResponse.json({ error: "Missing required payload parameters." }, { status: 400 });
    }

    if (!supabaseServiceKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is missing in your environment variables.");
      return NextResponse.json({ error: "Server misconfiguration. Admin key is missing." }, { status: 500 });
    }

    // Initialize admin client with the service role key to securely bypass RLS for background n8n tasks
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Received ${leads.length} leads from n8n for search request: ${requestId}`);

    if (leads.length === 0) {
      await supabaseAdmin
        .from('lead_searches')
        .update({ status: 'completed', results_count: 0 })
        .eq('request_id', requestId);

      return NextResponse.json({ status: "success", message: "No leads were found to save." });
    }

    // 1. Format and map leads to our unified Supabase database schema
    const leadsToInsert = leads.map((lead) => ({
      search_id: requestId,
      user_id: userId,
      name: lead.name || 'N/A',
      phone: lead.phone || 'N/A',
      formatted_phone: lead.formatted_phone || lead.phone || 'N/A',
      facebook: lead.facebook || null,
      website: lead.website || 'N/A',
      address: lead.address || 'N/A',
      rating: lead.rating ? parseFloat(lead.rating) : null,
      reviews_count: lead.reviews_count || null,
      is_claimed: lead.is_claimed !== undefined ? lead.is_claimed : null,
      category: lead.category || 'N/A',
      source: source || 'free'
    }));

    // 2. Insert mapped leads using admin bypass client
    const { error: insertError } = await supabaseAdmin
      .from('leads')
      .insert(leadsToInsert);

    if (insertError) {
      throw insertError;
    }

    // 3. Update the search campaign status as 'completed'
    const { error: updateSearchError } = await supabaseAdmin
      .from('lead_searches')
      .update({ 
        status: 'completed', 
        results_count: leads.length 
      })
      .eq('request_id', requestId);

    if (updateSearchError) {
      throw updateSearchError;
    }

    console.log(`Successfully saved ${leads.length} leads and completed search campaign: ${requestId}`);
    
    return NextResponse.json({ 
      status: "success", 
      message: `Successfully processed and saved ${leads.length} leads.` 
    });

  } catch (error) {
    console.error("SAVE LEADS API ERROR:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}