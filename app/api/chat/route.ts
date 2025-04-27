import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

export const runtime = 'edge';

const removeThinkTags = (text: string) => {
  return text.replace(/<think>.*?<\/think>/gs, '');
};

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
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
      max_tokens: 1024,
      stream: true
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        for await (const chunk of chatCompletion) {
          let content = chunk.choices[0]?.delta?.content || '';
          // 过滤<think>标签
          content = removeThinkTags(content);
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        
        controller.close();
      }
    });

    return new Response(stream);

  } catch (error: any) {
    console.error('Groq API Error:', error);
    return NextResponse.json(
      {
        error: 'Groq API Error',
        message: error.message
      },
      { status: 500 }
    );
  }
}
