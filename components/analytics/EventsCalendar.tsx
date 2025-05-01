import React, { useEffect, useState } from 'react';
import { format, startOfWeek, addDays, startOfYear, endOfYear, isSameDay, parseISO, getDay, differenceInDays } from 'date-fns';

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

const EventsCalendar: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  useEffect(() => {
    const storedEvents = localStorage.getItem('calendar-events');
    if (storedEvents) {
      const parsedEvents = JSON.parse(storedEvents) as CalendarEvent[];
      setEvents(parsedEvents);
      
      // 计算所有有事件的年份
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
      
      // 如果有事件年份，默认选择最近的年份
      if (sortedYears.length > 0) {
        const currentYear = new Date().getFullYear();
        // 找到当前年份或者最近的年份
        const closestYear = sortedYears.reduce((prev, curr) => 
          Math.abs(curr - currentYear) < Math.abs(prev - currentYear) ? curr : prev
        );
        setSelectedYear(closestYear);
      }
    }
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
    if (count === 0) return 'bg-gray-100';
    if (count === 1) return 'bg-green-100';
    if (count === 2) return 'bg-green-300';
    if (count === 3) return 'bg-green-500';
    return 'bg-green-700';
  };

  const renderCalendarGrid = () => {
    if (availableYears.length === 0) {
      return <div className="text-gray-500">No events found</div>;
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
          label: format(firstDayOfMonth, 'MMM'),
          weekIndex: weekIndex
        });
      }
    }

    // 计算每个日期块的尺寸和间距
    const cellSize = 15; // 15px
    const cellGap = 3;   // 3px
    const cellWithGap = cellSize + cellGap;
    
    // 月份标签向右偏移量（像素）
    const monthLabelOffset = 4; // 向右偏移4像素
    
    return (
      <div className="relative">
        <div className="flex items-center mb-6">
          <h2 className="text-lg font-semibold mr-4">Events Calendar</h2>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-2 py-1 bg-gray-100 rounded-md text-sm border border-gray-300"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        
        <div className="overflow-x-auto pb-4">
          <div style={{ position: 'relative', paddingTop: '20px', minWidth: `${totalWeeks * cellWithGap}px` }}>
            {/* 月份标签 */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
              {monthLabels.map((month, i) => (
                <div 
                  key={`month-${i}`} 
                  className="text-xs text-gray-500 absolute"
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
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                  <div 
                    key={`day-${i}`} 
                    className="text-xs text-gray-500 flex items-center justify-end"
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
                          className={`rounded-sm ${isCurrentYear ? colorClass : 'bg-transparent'} cursor-pointer hover:ring-1 hover:ring-gray-400 transition-colors duration-200`}
                          style={{ 
                            width: `${cellSize}px`, 
                            height: `${cellSize}px`, 
                            marginBottom: `${cellGap}px` 
                          }}
                          title={isCurrentYear ? `${format(date, 'yyyy-MM-dd')}: ${eventCount} events` : ''}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center mt-2 text-xs text-gray-600">
          <span className="mr-2">Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded-sm bg-gray-100"></div>
            <div className="w-3 h-3 rounded-sm bg-green-100"></div>
            <div className="w-3 h-3 rounded-sm bg-green-300"></div>
            <div className="w-3 h-3 rounded-sm bg-green-500"></div>
            <div className="w-3 h-3 rounded-sm bg-green-700"></div>
          </div>
          <span className="ml-2">More</span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      {renderCalendarGrid()}
    </div>
  );
};

export default EventsCalendar;
