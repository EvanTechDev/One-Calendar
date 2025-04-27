import { groq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { createStreamableValue } from 'ai/rsc';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const latestUserMessage = messages[messages.length - 1].content;

  try {
    const result = await streamText({
      model: groq('deepseek-r1-distill-llama-70b'),
      messages,
    });

    const stream = createStreamableValue(result.textStream);
    
    return new Response(stream.value, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error) {
    console.error('Error streaming text:', error);
    return NextResponse.json(
      { error: 'Error processing your request' },
      { status: 500 }
    );
  }
}
