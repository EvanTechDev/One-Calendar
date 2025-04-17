import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat');
  const lon = req.nextUrl.searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: '缺少纬度或经度' }, { status: 400 });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=zh_cn`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (res.status !== 200) {
      return NextResponse.json({ error: data.message }, { status: res.status });
    }

    return NextResponse.json({
      icon: data.weather[0].icon,
      description: data.weather[0].description,
      temp: data.main.temp,
    });
  } catch (error) {
    return NextResponse.json({ error: '请求天气失败' }, { status: 500 });
  }
}
