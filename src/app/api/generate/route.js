import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { webhookUrl, keyword, location, title, limit, user_id } = body;

    if (!webhookUrl) {
      return NextResponse.json({ error: "n8n Webhook URL is missing in settings." }, { status: 400 });
    }

    console.log("--------------------------------------------------");
    console.log("Connecting to n8n Webhook URL:", webhookUrl);
    console.log("Sending Payload:", { keyword, location, title, limit, user_id });

    // n8n-এ রিকোয়েস্ট পাঠানো হচ্ছে
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keyword, location, title, limit, user_id }),
    });

    // n8n থেকে সরাসরি টেক্সট রেসপন্স নেওয়া (যাতে JSON পার্সিং এরর এড়ানো যায়)
    const responseText = await response.text();
    console.log("Raw Response from n8n:", responseText);
    console.log("--------------------------------------------------");

    if (!response.ok) {
      return NextResponse.json({ 
        error: `n8n responded with status ${response.status}`, 
        details: responseText 
      }, { status: response.status });
    }

    // রেসপন্সটি যদি সাধারণ টেক্সট হয়, তবে তাকে JSON অবজেক্টে রূপান্তর করা
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      // যদি n8n কোনো JSON না পাঠিয়ে সাধারণ টেক্সট পাঠায় (যেমন: "Workflow started")
      data = { message: responseText };
    }

    return NextResponse.json(data);
  } catch (error) {
    // যেকোনো ধরনের ক্র্যাশ বা নেটওয়ার্ক এরর আপনার VS Code টার্মিনালে প্রিন্ট হবে
    console.error("❌ NEXT.JS API ROUTE CRASHED WITH ERROR:");
    console.error(error);
    console.log("--------------------------------------------------");
    
    return NextResponse.json({ 
      error: error.message || "Internal Server Error",
      details: "Check your VS Code terminal for the detailed error log."
    }, { status: 500 });
  }
}