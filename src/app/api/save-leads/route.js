import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const { requestId, userId, source, leads } = body;

    if (!requestId || !userId || !Array.isArray(leads)) {
      return NextResponse.json({ error: "Missing required payload parameters." }, { status: 400 });
    }

    console.log(`Received ${leads.length} leads from n8n for search request: ${requestId}`);

    if (leads.length === 0) {
      // If no leads were found, update the search status as completed with 0 results
      await supabase
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
      formatted_phone: lead.formatted_phone || lead.phone || 'N/A', // WhatsApp standard E.164 formatted number
      facebook: lead.facebook || null,
      website: lead.website || 'N/A',
      address: lead.address || 'N/A',
      rating: lead.rating ? parseFloat(lead.rating) : null,
      source: source || 'free'
    }));

    // 2. Insert mapped leads into 'leads' table
    const { error: insertError } = await supabase
      .from('leads')
      .insert(leadsToInsert);

    if (insertError) {
      throw insertError;
    }

    // 3. Update the search campaign status as 'completed' and save results count
    const { error: updateSearchError } = await supabase
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