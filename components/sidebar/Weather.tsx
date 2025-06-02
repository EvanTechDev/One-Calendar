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
        reject(new Error('Geolocation is not supported'));
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          reject(new Error('Failed to get location'));
        }
      );
    });
  };

  const fetchWeatherData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { lat, lon } = await getLocation();
      
      // Get current weather
      const currentResponse = await fetch(`/api/weather/current?lat=${lat}&lon=${lon}`);
      if (!currentResponse.ok) throw new Error('Failed to fetch weather data');
      const currentData = await currentResponse.json();
      
      // Get forecast data
      const forecastResponse = await fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`);
      if (!forecastResponse.ok) throw new Error('Failed to fetch forecast data');
      const forecastData = await forecastResponse.json();
      
      setWeatherData(currentData);
      setForecastData(forecastData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch weather data');
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
      return 'bg-gradient-to-b from-blue-400 via-blue-300 to-blue-100 dark:from-blue-900 dark:via-blue-800 dark:to-blue-700';
    } else if (code.includes('cloud')) {
      return 'bg-gradient-to-b from-gray-400 via-gray-300 to-gray-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-600';
    } else if (code.includes('rain') || code.includes('drizzle')) {
      return 'bg-gradient-to-b from-gray-600 via-gray-500 to-gray-400 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700';
    } else if (code.includes('storm') || code.includes('thunder')) {
      return 'bg-gradient-to-b from-gray-900 via-gray-700 to-gray-600 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800';
    } else if (code.includes('snow')) {
      return 'bg-gradient-to-b from-blue-200 via-blue-100 to-white dark:from-slate-700 dark:via-slate-600 dark:to-slate-500';
    } else if (code.includes('mist') || code.includes('fog')) {
      return 'bg-gradient-to-b from-gray-300 via-gray-200 to-gray-100 dark:from-gray-700 dark:via-gray-600 dark:to-gray-500';
    }
    
    return 'bg-gradient-to-b from-blue-400 via-blue-300 to-blue-100 dark:from-blue-900 dark:via-blue-800 dark:to-blue-700';
  };

  const getWeatherIcon = (weatherCode: string, size: number = 48, isInForecast: boolean = false) => {
    const code = weatherCode.toLowerCase();
    const baseIconProps = { size };
    
    // Main display area icons - always white for clarity on gradient backgrounds
    const mainIconClass = "text-white drop-shadow-lg";
    
    // Forecast area icons - different colors for light and dark modes
    const forecastIconClass = "text-gray-700 dark:text-gray-200";
    const sunClass = isInForecast ? "text-orange-500 dark:text-orange-400" : "text-yellow-300 drop-shadow-lg";
    const lightningClass = isInForecast ? "text-purple-600 dark:text-purple-400" : "text-yellow-400 drop-shadow-lg";
    const rainClass = isInForecast ? "text-blue-600 dark:text-blue-400" : mainIconClass;
    const snowClass = isInForecast ? "text-blue-400 dark:text-blue-300" : "text-blue-200 drop-shadow-lg";
    const moonClass = isInForecast ? "text-indigo-400 dark:text-indigo-300" : "text-blue-200 drop-shadow-lg";
    
    // Priority matching for more specific weather conditions
    if (code.includes('tornado')) {
      return <Wind {...baseIconProps} className={isInForecast ? "text-red-600 dark:text-red-400" : "text-red-400 drop-shadow-lg"} />;
    }
    else if (code.includes('thunderstorm') || code.includes('thunder') || code.includes('lightning')) {
      return <Zap {...baseIconProps} className={lightningClass} />;
    }
    else if (code.includes('hail')) {
      return <CloudRain {...baseIconProps} className={isInForecast ? "text-gray-600 dark:text-gray-300" : "text-gray-300 drop-shadow-lg"} />;
    }
    else if (code.includes('extreme rain') || code.includes('very heavy rain') || code.includes('heavy rain')) {
      return <CloudRain {...baseIconProps} className={rainClass} />;
    }
    else if (code.includes('moderate rain') || code.includes('rain')) {
      return <CloudRain {...baseIconProps} className={rainClass} />;
    }
    else if (code.includes('light rain') || code.includes('drizzle')) {
      return <CloudRain {...baseIconProps} className={rainClass} />;
    }
    else if (code.includes('shower') || code.includes('precipitation')) {
      return <CloudRain {...baseIconProps} className={rainClass} />;
    }
    else if (code.includes('heavy snow') || code.includes('snow showers') || code.includes('blizzard')) {
      return <CloudRain {...baseIconProps} className={snowClass} />;
    }
    else if (code.includes('light snow') || code.includes('snow')) {
      return <CloudRain {...baseIconProps} className={snowClass} />;
    }
    else if (code.includes('sleet') || code.includes('freezing')) {
      return <CloudRain {...baseIconProps} className={snowClass} />;
    }
    else if (code.includes('heavy fog') || code.includes('fog')) {
      return <Wind {...baseIconProps} className={isInForecast ? forecastIconClass : mainIconClass} />;
    }
    else if (code.includes('mist') || code.includes('haze')) {
      return <Wind {...baseIconProps} className={isInForecast ? forecastIconClass : mainIconClass} />;
    }
    else if (code.includes('sandstorm') || code.includes('dust')) {
      return <Wind {...baseIconProps} className={isInForecast ? "text-yellow-700 dark:text-yellow-400" : "text-yellow-600 drop-shadow-lg"} />;
    }
    else if (code.includes('smoke')) {
      return <Wind {...baseIconProps} className={isInForecast ? "text-gray-600 dark:text-gray-300" : "text-gray-400 drop-shadow-lg"} />;
    }
    else if (code.includes('clear') || code.includes('sunny') || code.includes('fair')) {
      return <Sun {...baseIconProps} className={sunClass} />;
    }
    else if (code.includes('overcast') || code.includes('broken clouds')) {
      return <Cloud {...baseIconProps} className={isInForecast ? forecastIconClass : mainIconClass} />;
    }
    else if (code.includes('scattered clouds') || code.includes('partly cloudy')) {
      return <Cloud {...baseIconProps} className={isInForecast ? forecastIconClass : mainIconClass} />;
    }
    else if (code.includes('few clouds') || code.includes('mostly clear')) {
      return <Cloud {...baseIconProps} className={isInForecast ? forecastIconClass : mainIconClass} />;
    }
    else if (code.includes('cloud')) {
      return <Cloud {...baseIconProps} className={isInForecast ? forecastIconClass : mainIconClass} />;
    }
    
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 18) {
      return <Sun {...baseIconProps} className={sunClass} />;
    } else {
      return <Moon {...baseIconProps} className={moonClass} />;
    }
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
    return new Date(dateString).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
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
            Weather
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[500px] p-0">
        <div className="h-full flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-blue-400 to-blue-100">
              <div className="text-center text-white">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <p>Loading weather data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-red-400 to-red-100">
              <div className="text-center text-white">
                <p className="mb-4">{error}</p>
                <Button onClick={fetchWeatherData} variant="secondary">
                  Retry
                </Button>
              </div>
            </div>
          ) : weatherData ? (
            <div className="h-full overflow-y-auto">
              {/* Main weather display area */}
              <div 
                className={`relative ${getWeatherBackground(weatherData.weatherCode)} p-6 text-white overflow-hidden min-h-[400px]`}
              >
                <WeatherAnimation weatherCode={weatherData.weatherCode} />
                
                {/* Location info */}
                <div className="flex items-center gap-2 mb-6">
                  <MapPin className="w-5 h-5" />
                  <span className="text-lg font-medium">{weatherData.location}</span>
                </div>
                
                {/* Main temperature and icon */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-6xl font-bold mb-2">
                      {Math.round(weatherData.temperature)}°
                    </div>
                    <p className="text-xl opacity-90">{weatherData.description}</p>
                    <p className="text-sm opacity-75">Feels like {Math.round(weatherData.feelsLike)}°</p>
                  </div>
                  <div className="flex flex-col items-center">
                    {getWeatherIcon(weatherData.weatherCode, 80)}
                  </div>
                </div>
                
                {/* Detailed info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-white bg-opacity-20 dark:bg-black dark:bg-opacity-30 rounded-lg p-3 backdrop-blur-sm">
                    <p className="opacity-75">Humidity</p>
                    <p className="text-lg font-semibold">{weatherData.humidity}%</p>
                  </div>
                  <div className="bg-white bg-opacity-20 dark:bg-black dark:bg-opacity-30 rounded-lg p-3 backdrop-blur-sm">
                    <p className="opacity-75">Wind Speed</p>
                    <p className="text-lg font-semibold">{weatherData.windSpeed} km/h</p>
                  </div>
                </div>
              </div>
              
              {/* Future weather forecast */}
              <div className="bg-white dark:bg-gray-900 p-4">
                <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">Weather Forecast</h3>
                <div className="space-y-2">
                  {forecastData.map((forecast, index) => (
                    <Card key={index} className="border-0 shadow-sm dark:bg-gray-800 dark:shadow-gray-700/20">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getWeatherIcon(forecast.weatherCode, 24, true)}
                            <div>
                              <p className="font-medium text-gray-800 dark:text-gray-100">
                                {forecast.time ? formatTime(forecast.date) : formatDate(forecast.date)}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{forecast.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-800 dark:text-gray-100">
                              {Math.round(forecast.temperature.max)}°
                              {forecast.temperature.min !== forecast.temperature.max && (
                                <span className="text-gray-500 dark:text-gray-400 font-normal">
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
