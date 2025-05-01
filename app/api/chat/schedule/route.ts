import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

export const runtime = 'edge';

const SYSTEM_PROMPT = `
你是一个智能日程助手，专门帮助用户创建和优化日历事件。请根据用户提示生成合适的日程安排。

输出要求：
1. 必须返回纯JSON格式，不带任何Markdown符号或额外解释
2. 只包含用户提示中明确提到的或可以合理推断出的字段
3. 时间格式必须为ISO字符串(YYYY-MM-DDTHH:mm)
4. 参与者格式为逗号分隔的字符串

示例输出：
{
  "title": "团队会议",
  "startDate": "2025-04-29T10:00:00",
  "endDate": "2025-04-29T11:00:00",
  "location": "会议室A",
  "participants": "张三,李四",
  "description": "讨论项目进度"
}

只有 title、日期 是必填的，其他都是可选项，你需要依据用户的要求要生成，但是比如说没有 location，那 location 就返回一个空字符串而不是不输出 location
`;

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY未配置');
    }

    const origin = req.headers.get('origin') || '';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

    if (origin !== baseUrl) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Invalid origin' },
        { status: 403 }
      );
    }

    const { prompt, currentValues } = await req.json();
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `当前值: ${JSON.stringify(currentValues)}\n用户提示: ${prompt}` }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) throw new Error('AI未返回有效内容');

    return NextResponse.json({ 
      data: JSON.parse(result) 
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
