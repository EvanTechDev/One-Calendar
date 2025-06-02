import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Eye, Droplets, Thermometer, MapPin, RefreshCw } from 'lucide-react';

// 天气数据接口
interface WeatherData {
  date: string;
  time?: string;
  temperature: {
    max: number;
    min: number;
  };
  description: string;
  weatherCode: string;
  isEnglish: boolean;
}

interface CurrentWeatherData {
  location: string;
  temperature: number;
  description: string;
  weatherCode: string;
  humidity: number;
  windSpeed: number;
  visibility: number;
  feelsLike: number;
}

const WeatherApp: React.FC = () => {
  const [currentWeather, setCurrentWeather] = useState<CurrentWeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 获取天气图标
  const getWeatherIcon = (weatherCode: string, size: number = 24) => {
    const iconProps = { size, className: "text-white" };
    
    switch (weatherCode.toLowerCase()) {
      case 'clear':
        return <Sun {...iconProps} />;
      case 'clouds':
        return <Cloud {...iconProps} />;
      case 'rain':
      case 'drizzle':
        return <CloudRain {...iconProps} />;
      case 'snow':
        return <CloudSnow {...iconProps} />;
      case 'thunderstorm':
        return <CloudRain {...iconProps} />;
      default:
        return <Cloud {...iconProps} />;
    }
  };

  // 格式化日期
  const formatDate = (dateString: string, isEnglish: boolean) => {
    const date = new Date(dateString);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    
    const dateKey = date.toDateString();
    const nowKey = now.toDateString();
    const tomorrowKey = tomorrow.toDateString();
    
    if (dateKey === nowKey) {
      return isEnglish ? 'Today' : '今天';
    } else if (dateKey === tomorrowKey) {
      return isEnglish ? 'Tomorrow' : '明天';
    } else {
      return isEnglish 
        ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : date.toLocaleDateString('zh-CN', { weekday: 'short', month: 'numeric', day: 'numeric' });
    }
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // 获取用户位置
  const getCurrentLocation = (): Promise<{ lat: number; lon: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        }
      );
    });
  };

  // 获取当前天气数据
  const fetchCurrentWeather = async (lat: number, lon: number) => {
    try {
      const response = await fetch(`/api/weather/current?lat=${lat}&lon=${lon}`);
      if (!response.ok) {
        throw new Error('Failed to fetch current weather data');
      }
      const data = await response.json();
      setCurrentWeather(data);
    } catch (err) {
      console.error('Error fetching current weather:', err);
    }
  };

  // 获取天气预报数据
  const fetchWeatherForecast = async (lat: number, lon: number) => {
    try {
      const response = await fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`);
      if (!response.ok) {
        throw new Error('Failed to fetch weather forecast data');
      }
      const data = await response.json();
      setForecast(data);
    } catch (err) {
      console.error('Error fetching weather forecast:', err);
      setError('无法获取天气数据');
    }
  };

  // 加载天气数据
  const loadWeatherData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const location = await getCurrentLocation();
      await Promise.all([
        fetchCurrentWeather(location.lat, location.lon),
        fetchWeatherForecast(location.lat, location.lon)
      ]);
    } catch (err) {
      console.error('Error loading weather data:', err);
      setError('无法获取位置信息或天气数据');
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载数据
  useEffect(() => {
    loadWeatherData();
  }, []);

  // 分离小时预报和日预报
  const hourlyForecast = forecast.filter(item => item.time);
  const dailyForecast = forecast.filter(item => !item.time);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 flex items-center justify-center">
        <div className="text-center text-white">
          <RefreshCw className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-xl">正在获取天气数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 flex items-center justify-center">
        <div className="text-center text-white">
          <Cloud size={48} className="mx-auto mb-4" />
          <p className="text-xl mb-4">{error}</p>
          <button
            onClick={loadWeatherData}
            className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-lg transition-colors duration-200"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 当前天气卡片 */}
        {currentWeather && (
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <MapPin size={24} />
                <h1 className="text-2xl font-bold">{currentWeather.location}</h1>
              </div>
              <button
                onClick={loadWeatherData}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors duration-200"
              >
                <RefreshCw size={20} />
              </button>
            </div>
            
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="text-6xl font-light mb-2">
                  {Math.round(currentWeather.temperature)}°C
                </div>
                <div className="text-xl text-white/80 capitalize">
                  {currentWeather.description}
                </div>
                <div className="text-lg text-white/60">
                  体感温度 {Math.round(currentWeather.feelsLike)}°C
                </div>
              </div>
              <div className="text-right">
                {getWeatherIcon(currentWeather.weatherCode, 80)}
              </div>
            </div>

            {/* 天气详情 */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Droplets size={24} className="mx-auto mb-2 text-blue-200" />
                <div className="text-2xl font-semibold">{currentWeather.humidity}%</div>
                <div className="text-sm text-white/70">湿度</div>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Wind size={24} className="mx-auto mb-2 text-blue-200" />
                <div className="text-2xl font-semibold">{currentWeather.windSpeed} m/s</div>
                <div className="text-sm text-white/70">风速</div>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Eye size={24} className="mx-auto mb-2 text-blue-200" />
                <div className="text-2xl font-semibold">{(currentWeather.visibility / 1000).toFixed(1)} km</div>
                <div className="text-sm text-white/70">能见度</div>
              </div>
            </div>
          </div>
        )}

        {/* 小时预报 */}
        {hourlyForecast.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Thermometer size={24} />
              24小时预报
            </h2>
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 shadow-2xl">
              <div className="flex gap-4 overflow-x-auto pb-2">
                {hourlyForecast.map((item, index) => (
                  <div key={index} className="flex-shrink-0 text-center min-w-[80px]">
                    <div className="text-sm text-white/70 mb-2">
                      {formatTime(item.time!)}
                    </div>
                    <div className="mb-3">
                      {getWeatherIcon(item.weatherCode, 32)}
                    </div>
                    <div className="text-lg font-semibold">
                      {Math.round(item.temperature.max)}°
                    </div>
                    <div className="text-xs text-white/60 mt-1 capitalize">
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 未来天气预报 */}
        <div>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Cloud size={24} />
            未来天气
          </h2>
          <div className="space-y-3">
            {dailyForecast.map((day, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-md rounded-2xl p-6 shadow-xl hover:bg-white/15 transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-lg font-semibold min-w-[100px]">
                      {formatDate(day.date, day.isEnglish)}
                    </div>
                    <div className="flex items-center gap-3">
                      {getWeatherIcon(day.weatherCode, 28)}
                      <span className="text-white/80 capitalize">{day.description}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xl font-semibold">
                        {Math.round(day.temperature.max)}°
                      </div>
                      <div className="text-sm text-white/60">
                        最低 {Math.round(day.temperature.min)}°
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherApp;
