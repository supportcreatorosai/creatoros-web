"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Video, Image as ImageIcon, MonitorPlay, X } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, subMonths, addMonths, parseISO } from "date-fns";

export type CalendarItem = {
  id: string;
  title: string;
  type: 'video' | 'image' | 'youtube';
  created_at: string;
  url?: string;
};

interface CalendarClientProps {
  items: CalendarItem[];
}

export default function CalendarClient({ items }: CalendarClientProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  // Calculate empty days before the 1st of the month
  const startDay = startOfMonth(currentDate).getDay();
  const emptyDaysBefore = Array.from({ length: startDay }).map((_, i) => i);

  // Group items by date string (YYYY-MM-DD)
  const itemsByDate = items.reduce((acc, item) => {
    const dateStr = format(parseISO(item.created_at), 'yyyy-MM-dd');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(item);
    return acc;
  }, {} as Record<string, CalendarItem[]>);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const openModalForDate = (date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-3 h-3 flex-shrink-0" />;
      case 'youtube': return <MonitorPlay className="w-3 h-3 flex-shrink-0" />;
      case 'image': return <ImageIcon className="w-3 h-3 flex-shrink-0" />;
      default: return <Video className="w-3 h-3 flex-shrink-0" />;
    }
  };

  const getColorClass = (type: string) => {
    switch (type) {
      case 'video': return "bg-blue-500/20 border-blue-500/30 text-blue-400 hover:bg-blue-500/30";
      case 'youtube': return "bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30";
      case 'image': return "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30";
      default: return "bg-gray-500/20 border-gray-500/30 text-gray-400";
    }
  };

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedItems = selectedDateStr ? (itemsByDate[selectedDateStr] || []) : [];

  return (
    <div className="min-h-[85vh] p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
            <CalendarDays className="w-7 h-7 text-cyan-500" />
            Content Calendar
          </h1>
          <p className="text-muted-foreground mt-1">View all your AI-generated content over time.</p>
        </div>
      </div>

      <div className="w-full max-w-7xl backdrop-blur-xl bg-background/40 border border-border/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col min-h-[600px]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] md:w-[800px] h-[150vw] md:h-[800px] max-w-[800px] max-h-[800px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex justify-between items-center mb-8 relative z-10">
          <h2 className="text-2xl font-bold">{format(currentDate, 'MMMM yyyy')}</h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrevMonth} className="p-2 rounded-xl border border-border/50 bg-background/50 hover:bg-background transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={handleToday} className="px-4 py-2 rounded-xl border border-border/50 bg-background/50 hover:bg-background transition-colors font-medium text-sm">
              Today
            </button>
            <button onClick={handleNextMonth} className="p-2 rounded-xl border border-border/50 bg-background/50 hover:bg-background transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-border/50 rounded-2xl overflow-hidden relative z-10 border border-border/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
            <div key={i} className="bg-background/80 p-4 text-center font-semibold text-sm">
              {day}
            </div>
          ))}
          
          {/* Empty cells before month start */}
          {emptyDaysBefore.map((_, i) => (
            <div key={`empty-${i}`} className="bg-background/20 min-h-[120px] p-2 opacity-30"></div>
          ))}

          {/* Actual days */}
          {daysInMonth.map((date, i) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayItems = itemsByDate[dateStr] || [];
            const isToday = isSameDay(date, new Date());

            return (
              <div 
                key={i} 
                onClick={() => openModalForDate(date)}
                className="bg-background/40 min-h-[120px] p-2 transition-colors hover:bg-background/60 cursor-pointer group"
              >
                <div className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-2 ${isToday ? 'bg-cyan-500 text-white' : 'group-hover:bg-foreground/5'}`}>
                  {format(date, 'd')}
                </div>
                
                <div className="space-y-1">
                  {dayItems.slice(0, 3).map((item, idx) => (
                    <div 
                      key={idx} 
                      className={`px-2 py-1 rounded border text-[10px] font-medium flex items-center gap-1 truncate ${getColorClass(item.type)}`}
                      title={item.title}
                    >
                      {getIcon(item.type)}
                      <span className="truncate">{item.title}</span>
                    </div>
                  ))}
                  {dayItems.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1 font-medium">
                      +{dayItems.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal for viewing day details */}
      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h3 className="text-xl font-bold">Content for {format(selectedDate, 'MMMM d, yyyy')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
              {selectedItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No content generated on this day.
                </div>
              ) : (
                selectedItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-background">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.type === 'youtube' ? 'bg-red-500/10 text-red-500' : item.type === 'video' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      {getIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate" title={item.title}>{item.title}</h4>
                      <p className="text-xs text-muted-foreground capitalize">{item.type} Generation</p>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-500 hover:underline mt-1 inline-block">
                          View {item.type === 'youtube' ? 'on YouTube' : 'File'}
                        </a>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(item.created_at), 'h:mm a')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
