import React, { useEffect, useState } from 'react';
import { format, startOfWeek, addDays, startOfYear, endOfYear, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';

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
  const [year, setYear] = useState<number>(new Date().getFullYear());
  
  useEffect(() => {
    const storedEvents = localStorage.getItem('calendar-events');
    if (storedEvents) {
      setEvents(JSON.parse(storedEvents));
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
    const days = getDaysInYear(year);
    const firstDayOfYear = startOfYear(new Date(year, 0, 1));
    const firstDayOfGrid = startOfWeek(firstDayOfYear);
    
    const weeks = Math.ceil(days.length / 7) + 1;
    
    const rows = [];
    
    const monthLabels = [];
    for (let i = 0; i < 12; i++) {
      const month = new Date(year, i, 1);
      const offset = Math.floor((new Date(year, i, 1).getTime() - firstDayOfGrid.getTime()) / (24 * 60 * 60 * 1000) / 7);
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
        const isCurrentYear = date.getFullYear() === year;
        
        if (isCurrentYear) {
          const eventCount = getEventCountForDay(date);
          const colorClass = getColorIntensity(eventCount);
          
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
          <h2 className="text-lg font-semibold mr-4">{year} Contribution Calendar</h2>
          <button 
            onClick={() => setYear(year - 1)}
            className="px-2 py-1 bg-gray-200 rounded-md mr-2 text-sm hover:bg-gray-300"
          >
            Prev
          </button>
          <button 
            onClick={() => setYear(year + 1)}
            className="px-2 py-1 bg-gray-200 rounded-md text-sm hover:bg-gray-300"
          >
            Next
          </button>
        </div>
        
        <div className="flex">
          <div className="flex flex-col justify-around mt-6">
            {weekdayLabels}
          </div>
          <div className="grid grid-flow-col gap-1 auto-cols-max ml-2 relative">
            {monthLabels}
            {cells}
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
