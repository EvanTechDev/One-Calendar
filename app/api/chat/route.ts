import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { NextResponse } from 'next/server';

// export const runtime = 'edge';

export async function POST(req: Request) {
  console.log('Groq API Key:', process.env.GROQ_API_KEY ? 'exists' : 'missing');
  
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: 'Server misconfiguration: GROQ_API_KEY is required' },
      { status: 500 }
    );
  }

  try {
    const { messages } = await req.json();
    console.log('Received messages:', JSON.stringify(messages, null, 2));

    const result = await streamText({
      model: groq('deepseek-r1-distill-llama-70b'),
      messages,
      apiKey: process.env.GROQ_API_KEY,
    });

    const stream = result.toAIStream();
    console.log('Stream created successfully');

    return new Response(stream);
    
  } catch (error: any) {
    console.error('Full error:', error);
    return NextResponse.json(
      { 
        error: 'AI Service Error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
