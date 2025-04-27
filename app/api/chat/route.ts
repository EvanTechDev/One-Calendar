import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { createStreamableValue } from 'ai/rsc';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    const { messages } = await req.json();

    const result = await streamText({
      model: groq('deepseek-r1-distill-llama-70b'),
      messages,
      apiKey: process.env.GROQ_API_KEY,
    });

    const stream = createStreamableValue(result.textStream);
    
    return new Response(stream.value, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });

  } catch (error: any) {
    console.error('AI Service Error:', error);
    return NextResponse.json(
      {
        error: 'AI Service Error',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
