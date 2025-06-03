import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json(
      { error: '缺少纬度或经度参数' },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: '缺少API密钥配置' },
      { status: 500 }
    );
  }

  try {
    const acceptLanguage = request.headers.get('accept-language') || 'zh-cn';
    const isEnglish = acceptLanguage.toLowerCase().includes('en');
    const lang = isEnglish ? 'en' : 'zh_cn';
    
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=${lang}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OpenWeather API 请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    
    const weatherData = {
      location: `${data.name}, ${data.sys.country}`,
      temperature: data.main.temp,
      description: data.weather[0].description,
      weatherCode: data.weather[0].main,
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6), // 转换为 km/h
      feelsLike: data.main.feels_like,
      isEnglish,
    };

    return NextResponse.json(weatherData);
  } catch (error) {
    console.error('获取天气数据错误:', error);
    return NextResponse.json(
      { error: '获取天气数据失败' },
      { status: 500 }
    );
  }
}
