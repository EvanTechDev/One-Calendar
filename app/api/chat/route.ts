import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });

    const { messages } = await req.json();

    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: "qwen-qwq-32b",
      temperature: 0.6,
      max_tokens: 1024,
      stream: true
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        for await (const chunk of chatCompletion) {
          const content = chunk.choices[0]?.delta?.content || '';
          controller.enqueue(encoder.encode(content));
        }
        
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });

  } catch (error: any) {
    console.error('Groq API Error:', error);
    return NextResponse.json(
      {
        error: 'Groq API Error',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
