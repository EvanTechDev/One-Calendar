import React, { useEffect, useState } from 'react';
import { format, startOfWeek, addDays, startOfYear, endOfYear, eachDayOfInterval, isSameDay, parseISO, getDay } from 'date-fns';

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
    
    const startDate = startOfYear(new Date(selectedYear, 0, 1));
    const endDate = endOfYear(new Date(selectedYear, 11, 31));
    
    const calendarStart = startOfWeek(startDate);

    const calendarDays = [];
    let currentDate = calendarStart;

    const endCalendarDate = addDays(endDate, 6 - getDay(endDate));

    const monthLabels = [];
    let currentMonth = -1;

    const totalWeeks = Math.ceil((endCalendarDate.getTime() - calendarStart.getTime()) / (7 * 24 * 60 * 60 * 1000));

    const weeks = [];
    for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
      const weekDays = [];
      
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        if (currentDate.getDate() === 1 || (weekIndex === 0 && dayIndex === 0 && currentDate.getMonth() !== currentMonth)) {
          currentMonth = currentDate.getMonth();
          monthLabels.push({
            month: format(currentDate, 'MMM'),
            weekIndex: weekIndex
          });
        }
        
        const isCurrentYear = currentDate.getFullYear() === selectedYear;
        const eventCount = isCurrentYear ? getEventCountForDay(currentDate) : 0;
        const colorClass = isCurrentYear ? getColorIntensity(eventCount) : '';
        
        weekDays.push({
          date: new Date(currentDate),
          isCurrentYear,
          eventCount,
          colorClass
        });
        
        currentDate = addDays(currentDate, 1);
      }
      
      weeks.push(weekDays);
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
          <div className="flex min-w-max">
            <div className="flex flex-col justify-around mt-8 pr-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                <div key={`weekday-${i}`} className="text-xs text-gray-500 h-3 flex items-center justify-end">
                  {i % 2 === 0 ? day : ''}
                </div>
              ))}
            </div>
            
            <div>
              <div className="flex h-6 items-end mb-2">
                {monthLabels.map((label, i) => (
                  <div 
                    key={`month-${i}`} 
                    className="text-xs text-gray-500"
                    style={{ 
                      marginLeft: i === 0 ? 0 : `${(label.weekIndex - monthLabels[i-1].weekIndex - 1) * 16}px`
                    }}
                  >
                    {label.month}
                  </div>
                ))}
              </div>

              <div className="flex">
                {weeks.map((week, weekIndex) => (
                  <div key={`week-${weekIndex}`} className="flex flex-col">
                    {week.map((day, dayIndex) => (
                      <div 
                        key={`day-${weekIndex}-${dayIndex}`} 
                        className={`w-3 h-3 mb-1 rounded-sm ${day.isCurrentYear ? day.colorClass : 'opacity-0'} cursor-pointer transition-colors duration-200 hover:ring-1 hover:ring-gray-400`}
                        title={day.isCurrentYear ? `${format(day.date, 'yyyy-MM-dd')}: ${day.eventCount} events` : ''}
                      />
                    ))}
                  </div>
                ))}
              </div>
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
