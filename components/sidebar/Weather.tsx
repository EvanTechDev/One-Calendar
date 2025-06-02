import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Eye, Droplets, Thermometer, MapPin, Calendar, Clock } from 'lucide-react';

const WeatherSheet = () => {
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 获取当前位置
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('浏览器不支持地理定位'));
        return;
      }

      navigator.geolocation.getCurrentLocation(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          reject(new Error('无法获取位置信息'));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  };

  // 获取天气数据
  const fetchWeatherData = async (lat, lon) => {
    try {
      // 获取当前天气
      const currentResponse = await fetch(`/api/weather/current?lat=${lat}&lon=${lon}`);
      if (!currentResponse.ok) {
        throw new Error('获取当前天气失败');
      }
      const currentData = await currentResponse.json();
      setCurrentWeather(currentData);

      // 获取预报数据
      const forecastResponse = await fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`);
      if (!forecastResponse.ok) {
        throw new Error('获取天气预报失败');
      }
      const forecastData = await forecastResponse.json();
      setForecast(forecastData);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initWeather = async () => {
      try {
        const position = await getCurrentLocation();
        setLocation(position);
        await fetchWeatherData(position.lat, position.lon);
      } catch (err) {
        // 如果获取位置失败，使用默认位置（北京）
        const defaultLat = 39.9042;
        const defaultLon = 116.4074;
        setLocation({ lat: defaultLat, lon: defaultLon });
        await fetchWeatherData(defaultLat, defaultLon);
      }
    };

    initWeather();
  }, []);

  // 获取天气图标
  const getWeatherIcon = (weatherCode, size = 24) => {
    const iconProps = { size, className: "text-white" };
    
    switch (weatherCode?.toLowerCase()) {
      case 'clear':
        return <Sun {...iconProps} />;
      case 'clouds':
        return <Cloud {...iconProps} />;
      case 'rain':
      case 'drizzle':
        return <CloudRain {...iconProps} />;
      case 'snow':
        return <CloudSnow {...iconProps} />;
      case 'mist':
      case 'fog':
        return <Wind {...iconProps} />;
      default:
        return <Sun {...iconProps} />;
    }
  };

  // 获取背景渐变色
  const getWeatherGradient = (weatherCode) => {
    switch (weatherCode?.toLowerCase()) {
      case 'clear':
        return 'from-blue-400 via-blue-500 to-blue-600';
      case 'clouds':
        return 'from-gray-400 via-gray-500 to-gray-600';
      case 'rain':
      case 'drizzle':
        return 'from-blue-600 via-blue-700 to-blue-800';
      case 'snow':
        return 'from-blue-200 via-blue-300 to-blue-400';
      default:
        return 'from-blue-400 via-blue-500 to-blue-600';
    }
  };

  // 格式化时间
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return '今天';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return '明天';
    } else {
      return date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric',
        weekday: 'short'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-400 via-red-500 to-red-600 flex items-center justify-center">
        <div className="text-white text-xl">错误: {error}</div>
      </div>
    );
  }

  const weatherGradient = getWeatherGradient(currentWeather?.weatherCode);

  return (
    <div className={`min-h-screen bg-gradient-to-br ${weatherGradient} relative`}>
      {/* 动态背景效果 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white opacity-10 rounded-full animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white opacity-5 rounded-full animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* 当前天气卡片 */}
        {currentWeather && (
          <div className="bg-white/20 backdrop-blur-md rounded-3xl p-8 mb-8 shadow-2xl border border-white/30">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <MapPin className="text-white" size={20} />
                <span className="text-white text-lg font-medium">{currentWeather.name}</span>
              </div>
              <div className="text-white text-sm opacity-80">
                {new Date().toLocaleString('zh-CN')}
              </div>
            </div>

            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="text-6xl font-light text-white mb-2">
                  {Math.round(currentWeather.temperature)}°
                </div>
                <div className="text-white text-xl opacity-90">
                  {currentWeather.description}
                </div>
                <div className="text-white text-sm opacity-80 mt-1">
                  体感温度 {Math.round(currentWeather.feelsLike)}°
                </div>
              </div>
              <div className="text-white">
                {getWeatherIcon(currentWeather.weatherCode, 80)}
              </div>
            </div>

            {/* 详细信息网格 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Wind className="text-white mx-auto mb-2" size={24} />
                <div className="text-white text-sm opacity-80">风速</div>
                <div className="text-white text-lg font-semibold">{currentWeather.windSpeed} m/s</div>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Droplets className="text-white mx-auto mb-2" size={24} />
                <div className="text-white text-sm opacity-80">湿度</div>
                <div className="text-white text-lg font-semibold">{currentWeather.humidity}%</div>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Eye className="text-white mx-auto mb-2" size={24} />
                <div className="text-white text-sm opacity-80">能见度</div>
                <div className="text-white text-lg font-semibold">{(currentWeather.visibility / 1000).toFixed(1)} km</div>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 text-center">
                <Thermometer className="text-white mx-auto mb-2" size={24} />
                <div className="text-white text-sm opacity-80">气压</div>
                <div className="text-white text-lg font-semibold">{currentWeather.pressure} hPa</div>
              </div>
            </div>
          </div>
        )}

        {/* 预报部分 */}
        {forecast.length > 0 && (
          <div className="bg-white/20 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white/30">
            <h2 className="text-white text-2xl font-semibold mb-6 flex items-center">
              <Calendar className="mr-3" size={24} />
              未来天气
            </h2>

            {/* 小时预报 */}
            <div className="mb-8">
              <h3 className="text-white text-lg font-medium mb-4 flex items-center">
                <Clock className="mr-2" size={20} />
                未来24小时
              </h3>
              <div className="flex space-x-4 overflow-x-auto pb-4">
                {forecast.slice(0, 8).map((item, index) => (
                  <div key={index} className="bg-white/10 rounded-2xl p-4 text-center min-w-[100px] flex-shrink-0">
                    <div className="text-white text-sm opacity-80 mb-2">
                      {formatTime(item.time)}
                    </div>
                    <div className="mb-2">
                      {getWeatherIcon(item.weatherCode, 32)}
                    </div>
                    <div className="text-white text-lg font-semibold">
                      {Math.round(item.temperature.max)}°
                    </div>
                    <div className="text-white text-xs opacity-70 mt-1">
                      {item.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 日预报 */}
            <div>
              <h3 className="text-white text-lg font-medium mb-4">未来几天</h3>
              <div className="space-y-3">
                {forecast.slice(8).map((item, index) => (
                  <div key={index} className="bg-white/10 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-white font-medium min-w-[60px]">
                        {formatDate(item.date)}
                      </div>
                      <div className="flex items-center space-x-2">
                        {getWeatherIcon(item.weatherCode, 28)}
                        <span className="text-white opacity-90">
                          {item.description}
                        </span>
                      </div>
                    </div>
                    <div className="text-white font-semibold">
                      <span className="text-lg">{Math.round(item.temperature.max)}°</span>
                      <span className="text-sm opacity-70 ml-2">
                        {Math.round(item.temperature.min)}°
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherSheet;
