'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

interface WeatherData {
  icon: string;
  description: string;
  temp: number;
}

export default function Weather() {
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchWeather = async (lat: number, lon: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      const data = await res.json();
      if (res.ok) {
        setWeather(data);
        setError(null);
      } else {
        setError(data.error || '无法获取天气数据');
      }
    } catch (err) {
      setError('请求失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('浏览器不支持地理位置功能');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLat(latitude);
        setLon(longitude);
        fetchWeather(latitude, longitude);
      },
      (err) => {
        setLoading(false);
        setError(`获取位置失败: ${err.message}`);
      }
    );
  }, []);

  return (
    <div className="flex flex-col items-start gap-2">
      {weather && (
        <Button variant="outline" className="flex items-center gap-2 px-4 py-2 w-[92px]"> 
         <Image
            src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
            alt={weather.description}
            width={32}
            height={32}
          />
          <span>{Math.round(weather.temp)}°C</span>
        </Button>
      )}
    </div>
  );
}
