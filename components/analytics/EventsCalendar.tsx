import React, { useEffect, useState } from 'react';
import { format, startOfWeek, addDays, startOfYear, endOfYear, eachDayOfInterval, isSameDay, parseISO, getMonth } from 'date-fns';

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

  const getDaysInYear = (year: number) => {
    const start = startOfYear(new Date(year, 0, 1));
    const end = endOfYear(new Date(year, 0, 1));
    return eachDayOfInterval({ start, end });
  };

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

    const days = getDaysInYear(selectedYear);
    const firstDayOfYear = startOfYear(new Date(selectedYear, 0, 1));
    const firstDayOfGrid = startOfWeek(firstDayOfYear);
    
    const weeks = Math.ceil(days.length / 7) + 1;
    
    // 添加月份标签但不分隔
    const monthLabels = [];
    for (let i = 0; i < 12; i++) {
      const month = new Date(selectedYear, i, 1);
      const offset = Math.floor((new Date(selectedYear, i, 1).getTime() - firstDayOfGrid.getTime()) / (24 * 60 * 60 * 1000) / 7);
      monthLabels.push(
        <div 
          key={`month-${i}`} 
          className="text-xs text-gray-500" 
          style={{ gridColumn: offset + 1, gridRow: 1 }}
        >
          {format(month, 'MMM')}
        </div>
      );
    }
    
    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
      <div key={`weekday-${i}`} className="text-xs text-gray-500 h-3 flex items-center justify-end pr-2">
        {i % 2 === 0 ? day : ''}
      </div>
    ));
    
    const cells = [];
    for (let i = 0; i < weeks; i++) {
      for (let j = 0; j < 7; j++) {
        const date = addDays(firstDayOfGrid, i * 7 + j);
        const isCurrentYear = date.getFullYear() === selectedYear;
        
        if (isCurrentYear) {
          const eventCount = getEventCountForDay(date);
          const colorClass = getColorIntensity(eventCount);
          
          // 检查是否是月份的第一天
          const isFirstDayOfMonth = date.getDate() === 1;
          
          cells.push(
            <div 
              key={`cell-${i}-${j}`}
              className={`w-3 h-3 rounded-sm ${colorClass} cursor-pointer transition-colors duration-200 hover:ring-1 hover:ring-gray-400`}
              title={`${format(date, 'yyyy-MM-dd')}: ${eventCount} events`}
              style={{ gridColumn: i + 1, gridRow: j + 2 }}
            />
          );
        } else {
          cells.push(
            <div 
              key={`cell-${i}-${j}`}
              className="w-3 h-3"
              style={{ gridColumn: i + 1, gridRow: j + 2 }}
            />
          );
        }
      }
    }
    
    return (
      <div className="relative">
        <div className="flex items-center mb-4">
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
        
        <div className="overflow-x-auto pb-2">
          <div className="flex" style={{ minWidth: 'fit-content' }}>
            <div className="flex flex-col justify-around mt-6">
              {weekdayLabels}
            </div>
            <div className="grid grid-flow-col gap-1 auto-cols-max ml-2 relative">
              {monthLabels}
              {cells}
            </div>
          </div>
        </div>
        
        <div className="flex items-center mt-4 text-xs text-gray-600">
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
