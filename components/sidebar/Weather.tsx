"use client";

import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Cloud, Sun, CloudRain, Zap, Wind, Moon, MapPin, Loader2 } from "lucide-react";

interface WeatherData {
  location: string;
  temperature: number;
  description: string;
  weatherCode: string;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
}

interface ForecastData {
  date: string;
  temperature: {
    max: number;
    min: number;
  };
  description: string;
  weatherCode: string;
  time?: string;
}

interface WeatherSheetProps {
  trigger?: React.ReactNode;
}

const WeatherSheet: React.FC<WeatherSheetProps> = ({ trigger }) => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const getLocation = (): Promise<{ lat: number; lon: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('地理位置不被支持'));
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          reject(new Error('获取位置失败'));
        }
      );
    });
  };

  const fetchWeatherData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { lat, lon } = await getLocation();
      
      // 获取当前天气
      const currentResponse = await fetch(`/api/weather/current?lat=${lat}&lon=${lon}`);
      if (!currentResponse.ok) throw new Error('获取天气数据失败');
      const currentData = await currentResponse.json();
      
      // 获取预报数据
      const forecastResponse = await fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`);
      if (!forecastResponse.ok) throw new Error('获取预报数据失败');
      const forecastData = await forecastResponse.json();
      
      setWeatherData(currentData);
      setForecastData(forecastData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取天气数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !weatherData) {
      fetchWeatherData();
    }
  }, [isOpen, weatherData]);

  const getWeatherBackground = (weatherCode: string) => {
    const code = weatherCode.toLowerCase();
    
    if (code.includes('clear') || code.includes('sunny')) {
      return 'bg-gradient-to-b from-blue-400 via-blue-300 to-blue-100';
    } else if (code.includes('cloud')) {
      return 'bg-gradient-to-b from-gray-400 via-gray-300 to-gray-100';
    } else if (code.includes('rain') || code.includes('drizzle')) {
      return 'bg-gradient-to-b from-gray-600 via-gray-500 to-gray-400';
    } else if (code.includes('storm') || code.includes('thunder')) {
      return 'bg-gradient-to-b from-gray-900 via-gray-700 to-gray-600';
    } else if (code.includes('snow')) {
      return 'bg-gradient-to-b from-blue-200 via-blue-100 to-white';
    } else if (code.includes('mist') || code.includes('fog')) {
      return 'bg-gradient-to-b from-gray-300 via-gray-200 to-gray-100';
    }
    
    return 'bg-gradient-to-b from-blue-400 via-blue-300 to-blue-100';
  };

  const getWeatherIcon = (weatherCode: string, size: number = 48) => {
    const code = weatherCode.toLowerCase();
    const iconProps = { size, className: "text-white drop-shadow-lg" };
    
    if (code.includes('clear') || code.includes('sunny')) {
      return <Sun {...iconProps} className="text-yellow-300 drop-shadow-lg" />;
    } else if (code.includes('cloud')) {
      return <Cloud {...iconProps} />;
    } else if (code.includes('rain') || code.includes('drizzle')) {
      return <CloudRain {...iconProps} />;
    } else if (code.includes('storm') || code.includes('thunder')) {
      return <Zap {...iconProps} className="text-yellow-400 drop-shadow-lg" />;
    } else if (code.includes('snow')) {
      return <Cloud {...iconProps} />;
    } else if (code.includes('mist') || code.includes('fog')) {
      return <Wind {...iconProps} />;
    }
    
    return <Sun {...iconProps} className="text-yellow-300 drop-shadow-lg" />;
  };

  const WeatherAnimation = ({ weatherCode }: { weatherCode: string }) => {
    const code = weatherCode.toLowerCase();
    
    if (code.includes('rain') || code.includes('drizzle')) {
      const intensity = code.includes('heavy') ? 'heavy' : code.includes('light') ? 'light' : 'medium';
      const raindrops = intensity === 'heavy' ? 50 : intensity === 'medium' ? 30 : 15;
      
      return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: raindrops }).map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 bg-blue-200 opacity-70 animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                height: `${Math.random() * 20 + 10}px`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${Math.random() * 0.5 + 0.5}s`,
                transform: `translateY(-${Math.random() * 100 + 100}px)`,
              }}
            />
          ))}
        </div>
      );
    }
    
    if (code.includes('storm') || code.includes('thunder')) {
      return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-yellow-400 opacity-20 animate-pulse" 
               style={{ animationDuration: '3s' }} />
        </div>
      );
    }
    
    return null;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Cloud className="w-4 h-4" />
            天气
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[500px] p-0">
        <div className="h-full flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-blue-400 to-blue-100">
              <div className="text-center text-white">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p>获取天气数据中...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-red-400 to-red-100">
              <div className="text-center text-white">
                <p className="mb-4">{error}</p>
                <Button onClick={fetchWeatherData} variant="secondary">
                  重试
                </Button>
              </div>
            </div>
          ) : weatherData ? (
            <div className="h-full overflow-y-auto">
              {/* 主要天气显示区域 */}
              <div 
                className={`relative ${getWeatherBackground(weatherData.weatherCode)} p-6 text-white overflow-hidden min-h-[400px]`}
              >
                <WeatherAnimation weatherCode={weatherData.weatherCode} />
                
                {/* 位置信息 */}
                <div className="flex items-center gap-2 mb-6">
                  <MapPin className="w-5 h-5" />
                  <span className="text-lg font-medium">{weatherData.location}</span>
                </div>
                
                {/* 主要温度和图标 */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-6xl font-bold mb-2">
                      {Math.round(weatherData.temperature)}°
                    </div>
                    <p className="text-xl opacity-90">{weatherData.description}</p>
                    <p className="text-sm opacity-75">体感温度 {Math.round(weatherData.feelsLike)}°</p>
                  </div>
                  <div className="flex flex-col items-center">
                    {getWeatherIcon(weatherData.weatherCode, 80)}
                  </div>
                </div>
                
                {/* 详细信息 */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-white bg-opacity-20 rounded-lg p-3">
                    <p className="opacity-75">湿度</p>
                    <p className="text-lg font-semibold">{weatherData.humidity}%</p>
                  </div>
                  <div className="bg-white bg-opacity-20 rounded-lg p-3">
                    <p className="opacity-75">风速</p>
                    <p className="text-lg font-semibold">{weatherData.windSpeed} km/h</p>
                  </div>
                </div>
              </div>
              
              {/* 未来天气预报 */}
              <div className="bg-white p-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">未来天气</h3>
                <div className="space-y-2">
                  {forecastData.map((forecast, index) => (
                    <Card key={index} className="border-0 shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getWeatherIcon(forecast.weatherCode, 24)}
                            <div>
                              <p className="font-medium text-gray-800">
                                {forecast.time ? formatTime(forecast.date) : formatDate(forecast.date)}
                              </p>
                              <p className="text-sm text-gray-600">{forecast.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-800">
                              {Math.round(forecast.temperature.max)}°
                              {forecast.temperature.min !== forecast.temperature.max && (
                                <span className="text-gray-500 font-normal">
                                  /{Math.round(forecast.temperature.min)}°
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WeatherSheet;
