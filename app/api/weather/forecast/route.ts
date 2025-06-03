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
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=${lang}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OpenWeather API 请求失败: ${response.status}`);
    }
    
    const data = await response.json();

    const forecastData = [];
    const now = new Date();
    const processedDates = new Set();

    for (let i = 0; i < Math.min(8, data.list.length); i++) {
      const item = data.list[i];
      const date = new Date(item.dt * 1000);
      
      forecastData.push({
        date: date.toISOString(),
        time: date.toISOString(),
        temperature: {
          max: item.main.temp,
          min: item.main.temp,
        },
        description: item.weather[0].description,
        weatherCode: item.weather[0].main,
        isEnglish,
      });
    }

    const dailyForecasts = new Map();
    
    data.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toDateString();

      if (dateKey === now.toDateString()) {
        return;
      }
      
      if (!dailyForecasts.has(dateKey)) {
        dailyForecasts.set(dateKey, {
          date: date.toISOString(),
          temperatures: [item.main.temp],
          descriptions: [item.weather[0].description],
          weatherCodes: [item.weather[0].main],
        });
      } else {
        const existing = dailyForecasts.get(dateKey);
        existing.temperatures.push(item.main.temp);
        existing.descriptions.push(item.weather[0].description);
        existing.weatherCodes.push(item.weather[0].main);
      }
    });

    dailyForecasts.forEach((dayData) => {
      const maxTemp = Math.max(...dayData.temperatures);
      const minTemp = Math.min(...dayData.temperatures);

      const weatherCodeCounts = dayData.weatherCodes.reduce((acc: any, code: string) => {
        acc[code] = (acc[code] || 0) + 1;
        return acc;
      }, {});
      
      const mostCommonWeatherCode = Object.keys(weatherCodeCounts).reduce((a, b) => 
        weatherCodeCounts[a] > weatherCodeCounts[b] ? a : b
      );
      
      const descriptionCounts = dayData.descriptions.reduce((acc: any, desc: string) => {
        acc[desc] = (acc[desc] || 0) + 1;
        return acc;
      }, {});
      
      const mostCommonDescription = Object.keys(descriptionCounts).reduce((a, b) => 
        descriptionCounts[a] > descriptionCounts[b] ? a : b
      );

      forecastData.push({
        date: dayData.date,
        temperature: {
          max: maxTemp,
          min: minTemp,
        },
        description: mostCommonDescription,
        weatherCode: mostCommonWeatherCode,
        isEnglish,
      });
    });

    const limitedForecast = forecastData.slice(0, 15);

    return NextResponse.json(limitedForecast);
  } catch (error) {
    console.error('获取天气预报数据错误:', error);
    return NextResponse.json(
      { error: '获取天气预报数据失败' },
      { status: 500 }
    );
  }
}
