import React, { useEffect, useState } from 'react';
import { format, startOfWeek, addDays, startOfYear, endOfYear, isSameDay, parseISO, getDay, differenceInDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { es } from "@/lib/encryptedStorage";

interface CalendarEvent {
  id: string;
  title: string;
  isAllDay: boolean;
  startDate: string;
  endDate: string;
  calendarId: string;
  color: string;
  description: string;
  location: string;
  notification: number;
  participants: any[];
  recurrence: string;
}

type Language = 'en' | 'zh';

interface Translations {
  eventsCalendar: string;
  selectYear: string;
  noEvents: string;
  less: string;
  more: string;
  weekdays: string[];
  months: string[];
}

const translations: Record<Language, Translations> = {
  en: {
    eventsCalendar: 'Events Calendar',
    selectYear: 'Select year',
    noEvents: 'No events found',
    less: 'Less',
    more: 'More',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  },
  zh: {
    eventsCalendar: '事件日历',
    selectYear: '选择年份',
    noEvents: '未找到事件',
    less: '较少',
    more: '较多',
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    months: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
  }
};

const EventsCalendar: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [language, setLanguage] = useState<Language>('zh'); // 默认中文，稍后会根据系统语言更新
  
  // 检测系统语言并设置组件语言
  useEffect(() => {
    const detectLanguage = () => {
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('zh')) {
        setLanguage('zh');
      } else {
        setLanguage('en');
      }
    };

    detectLanguage();
  }, []);
  
  const t = translations[language];
  
  useEffect(() => {
    const loadEvents = () => {
      if (!es.isUnlocked) return;
      
      const storedEvents = es.getItem('calendar-events');
      if (storedEvents) {
        try {
          const parsedEvents = JSON.parse(storedEvents) as CalendarEvent[];
          setEvents(parsedEvents);
          
          const years = new Set<number>();
          parsedEvents.forEach(event => {
            const startYear = new Date(event.startDate).getFullYear();
            const endYear = new Date(event.endDate).getFullYear();
            for (let year = startYear; year <= endYear; year++) {
              years.add(year);
            }
          });
          
          const sortedYears = Array.from(years).sort();
          setAvailableYears(sortedYears);
          
          if (sortedYears.length > 0) {
            const currentYear = new Date().getFullYear();
            const closestYear = sortedYears.reduce((prev, curr) => 
              Math.abs(curr - currentYear) < Math.abs(prev - currentYear) ? curr : prev
            );
            setSelectedYear(closestYear);
          }
        } catch {}
      }
    };

    loadEvents();

    const handleStorageChange = () => {
      loadEvents();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const getEventCountForDay = (day: Date) => {
    return events.filter(event => {
      const startDate = parseISO(event.startDate);
      const endDate = parseISO(event.endDate);
      
      return (
        isSameDay(day, startDate) || 
        isSameDay(day, endDate) ||
        (day > startDate && day < endDate)
      );
    }).length;
  };

  const getColorIntensity = (count: number) => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800';
    if (count === 1) return 'bg-emerald-100 dark:bg-emerald-900';
    if (count === 2) return 'bg-emerald-300 dark:bg-emerald-700';
    if (count === 3) return 'bg-emerald-500 dark:bg-emerald-600';
    return 'bg-emerald-700 dark:bg-emerald-500';
  };

  const formatMonthLabel = (date: Date) => {
    // 获取月份索引 (0-11)
    const monthIndex = date.getMonth();
    // 从翻译对象中获取对应语言的月份名称
    return t.months[monthIndex];
  };

  const renderCalendarGrid = () => {
    if (availableYears.length === 0) {
      return <div className="text-gray-500 dark:text-gray-400">{t.noEvents}</div>;
    }

    // 创建日历的数据
    const firstDayOfYear = startOfYear(new Date(selectedYear, 0, 1));
    const lastDayOfYear = endOfYear(new Date(selectedYear, 11, 31));
    
    // 确保日历从周日开始
    const startDay = startOfWeek(firstDayOfYear);
    // 确保日历到周六结束
    const endDay = addDays(lastDayOfYear, 6 - getDay(lastDayOfYear));
    
    // 计算总天数
    const totalDays = differenceInDays(endDay, startDay) + 1;
    // 计算总周数
    const totalWeeks = Math.ceil(totalDays / 7);
    
    // 生成所有日期
    const allDates = [];
    for (let i = 0; i < totalDays; i++) {
      allDates.push(addDays(startDay, i));
    }
    
    // 计算每个月的第一天及其位置
    const monthLabels = [];
    for (let month = 0; month < 12; month++) {
      const firstDayOfMonth = new Date(selectedYear, month, 1);
      // 如果这个月的第一天在日历范围内
      if (firstDayOfMonth >= startDay && firstDayOfMonth <= endDay) {
        const dayIndex = differenceInDays(firstDayOfMonth, startDay);
        const weekIndex = Math.floor(dayIndex / 7);
        monthLabels.push({
          label: formatMonthLabel(firstDayOfMonth),
          weekIndex: weekIndex
        });
      }
    }

    // 计算每个日期块的尺寸和间距
    const cellSize = 15; // 15px
    const cellGap = 3;   // 3px
    const cellWithGap = cellSize + cellGap;
    
    // 月份标签向右偏移量(像素)
    const monthLabelOffset = 48; // 向右偏移48像素
    
    return (
      <div className="relative">
        <div className="flex items-center mb-6">
          <h2 className="text-lg font-semibold mr-4">{t.eventsCalendar}</h2>
          <Select 
            value={selectedYear.toString()}
            onValueChange={(value) => setSelectedYear(Number(value))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder={t.selectYear} />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="overflow-x-auto pb-4">
          <div style={{ position: 'relative', paddingTop: '20px', minWidth: `${totalWeeks * cellWithGap}px` }}>
            {/* 月份标签 */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
              {monthLabels.map((month, i) => (
                <div 
                  key={`month-${i}`} 
                  className="text-xs text-gray-500 dark:text-gray-400 absolute"
                  style={{ left: `${month.weekIndex * cellWithGap + monthLabelOffset}px` }}
                >
                  {month.label}
                </div>
              ))}
            </div>
            
            {/* 星期标签和日历网格 */}
            <div className="flex">
              {/* 星期标签 */}
              <div className="flex flex-col pr-2">
                {t.weekdays.map((day, i) => (
                  <div 
                    key={`day-${i}`} 
                    className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end"
                    style={{ height: `${cellSize}px`, marginBottom: `${cellGap}px` }}
                  >
                    {i % 2 === 0 ? day : ''}
                  </div>
                ))}
              </div>
              
              {/* 日历网格 */}
              <div style={{ display: 'flex' }}>
                {Array.from({ length: totalWeeks }).map((_, weekIndex) => (
                  <div key={`week-${weekIndex}`} style={{ marginRight: `${cellGap}px` }}>
                    {Array.from({ length: 7 }).map((_, dayIndex) => {
                      const dateIndex = weekIndex * 7 + dayIndex;
                      const date = allDates[dateIndex];
                      const isCurrentYear = date.getFullYear() === selectedYear;
                      
                      const eventCount = isCurrentYear ? getEventCountForDay(date) : 0;
                      const colorClass = getColorIntensity(eventCount);
                      
                      return (
                        <div 
                          key={`cell-${weekIndex}-${dayIndex}`}
                          className={`rounded-sm ${isCurrentYear ? colorClass : 'bg-transparent'} cursor-pointer hover:ring-1 hover:ring-gray-400 dark:hover:ring-gray-500 transition-colors duration-200`}
                          style={{ 
                            width: `${cellSize}px`, 
                            height: `${cellSize}px`, 
                            marginBottom: `${cellGap}px` 
                          }}
                          title={isCurrentYear ? `${format(date, 'yyyy-MM-dd')}: ${eventCount} ${language === 'zh' ? '个事件' : 'events'}` : ''}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center mt-2 text-xs text-gray-600 dark:text-gray-300">
          <span className="mr-2">{t.less}</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800"></div>
            <div className="w-3 h-3 rounded-sm bg-emerald-100 dark:bg-emerald-900"></div>
            <div className="w-3 h-3 rounded-sm bg-emerald-300 dark:bg-emerald-700"></div>
            <div className="w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-600"></div>
            <div className="w-3 h-3 rounded-sm bg-emerald-700 dark:bg-emerald-500"></div>
          </div>
          <span className="ml-2">{t.more}</span>
        </div>
      </div>
    );
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-0">
        <CardTitle className="sr-only">{t.eventsCalendar}</CardTitle>
      </CardHeader>
      <CardContent>
        {renderCalendarGrid()}
      </CardContent>
    </Card>
  );
};

export default EventsCalendar;
