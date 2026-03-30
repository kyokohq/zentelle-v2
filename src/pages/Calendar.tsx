import React from 'react';
import { Event } from '../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

interface CalendarProps {
  events: Event[];
  onAddEvent: () => void;
}

export function Calendar({ events, onAddEvent }: CalendarProps) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const date = new Date();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-[#1a1c1c] tracking-tight mb-1 font-headline">Calendar</h1>
          <p className="text-gray-600 font-medium text-sm">Manage your academic schedule and deadlines.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1">
            <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-gray-500" /></button>
            <span className="px-4 font-bold text-[#004275]">{month} {year}</span>
            <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-gray-500" /></button>
          </div>
          <button 
            onClick={onAddEvent}
            className="bg-[#004275] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-[#005a9c] transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <div className="grid grid-cols-7 gap-4 mb-8">
            {days.map(day => (
              <div key={day} className="text-center text-xs font-black uppercase tracking-widest text-gray-400">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-4">
            {/* Simple mock calendar grid */}
            {Array.from({ length: 31 }).map((_, i) => {
              const dayNum = i + 1;
              const hasEvent = events.some(e => e.date === dayNum.toString());
              return (
                <div 
                  key={i} 
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative cursor-pointer transition-all hover:bg-gray-50 border-2 ${
                    hasEvent ? 'border-[#004275]/20 bg-[#004275]/5' : 'border-transparent'
                  }`}
                >
                  <span className={`text-sm font-bold ${hasEvent ? 'text-[#004275]' : 'text-gray-700'}`}>{dayNum}</span>
                  {hasEvent && <div className="w-1 h-1 rounded-full bg-[#004275] mt-1"></div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Event List */}
        <div className="space-y-8">
          <h2 className="text-xl font-bold text-[#1a1c1c] flex items-center gap-2 font-headline">
            Upcoming Events
            <span className="w-2 h-2 rounded-full bg-[#004275]"></span>
          </h2>
          <div className="space-y-6">
            {events.map((event) => (
              <div key={event.id} className="flex gap-6 group cursor-pointer">
                <div className={`${event.color} w-16 h-16 rounded-2xl flex flex-col items-center justify-center ${event.textColor} shadow-sm group-hover:shadow-md transition-all`}>
                  <span className="text-xl font-black leading-none">{event.date}</span>
                  <span className="text-[10px] font-black uppercase tracking-tighter mt-1">{event.day}</span>
                </div>
                <div className="flex-1 py-1">
                  <p className="text-sm font-bold text-[#1a1c1c] group-hover:text-[#004275] transition-colors">{event.title}</p>
                  <p className="text-xs text-gray-500 mt-1 font-medium">{event.subtitle}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{event.month}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                    <span className="text-[10px] text-[#004275] font-bold">Details</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
