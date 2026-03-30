import React from 'react';
import { 
  Megaphone, 
  Star, 
  MessageSquare, 
  Bell, 
  CalendarDays, 
  Zap, 
  File, 
  Users,
  Loader2,
  Trash2,
  ChevronRight,
  Plus,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Course, Activity, Reminder, Event, Task } from '../types';

interface DashboardProps {
  user: any;
  userRole?: 'student' | 'admin';
  courses: Course[];
  activities: Activity[];
  reminders: Reminder[];
  events: Event[];
  tasks: Task[];
  loading: boolean;
  onJoinCourse: () => void;
  onCreateCourse: () => void;
  onDeleteReminder: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onToggleTask: (task: Task) => void;
}

export function Dashboard({ 
  user, 
  userRole,
  courses, 
  activities, 
  reminders, 
  events, 
  tasks,
  loading, 
  onJoinCourse, 
  onCreateCourse,
  onDeleteReminder,
  onDeleteTask,
  onToggleTask
}: DashboardProps) {
  const pendingTasks = tasks.filter(t => t.status === 'pending');

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-12 gap-10">
      {/* Left Content Area */}
      <div className="col-span-12 lg:col-span-8 space-y-12">
        {/* Welcome Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#1a1c1c] tracking-tight mb-1 font-headline">Course Dashboard</h1>
            <p className="text-gray-600 font-medium text-sm">Welcome back, {user.displayName?.split(' ')[0]}. You have <span className="text-[#004275] font-bold">{pendingTasks.length} tasks</span> pending today.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={onJoinCourse}
              className="flex-1 md:flex-none bg-white border border-[#004275] text-[#004275] hover:bg-[#004275]/5 px-7 py-3 rounded-xl font-bold text-sm shadow-sm transition-all duration-200 active:scale-95"
            >
              Join New Course
            </button>
            {userRole === 'admin' && (
              <button 
                onClick={onCreateCourse}
                className="flex-1 md:flex-none bg-[#004275] hover:bg-[#005a9c] text-white px-7 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 transform hover:-translate-y-0.5"
              >
                Create Course
              </button>
            )}
          </div>
        </header>

        {/* Course Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {courses.map((course) => (
              <CourseCard key={course.id} {...course} />
            ))}
          </AnimatePresence>
          {loading && courses.length === 0 && (
            <div className="col-span-full py-20 flex justify-center">
              <Loader2 className="w-8 h-8 text-[#004275] animate-spin" />
            </div>
          )}
        </section>

        {/* Tasks Section */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-[#1a1c1c] flex items-center gap-2 font-headline">
              My Tasks
              <span className="w-2 h-2 rounded-full bg-[#004275]"></span>
            </h2>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {tasks.length === 0 ? (
              <div className="p-10 text-center text-gray-400 font-medium">No tasks found. Create one to get started!</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {tasks.map((task) => (
                  <div key={task.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors group">
                    <button 
                      onClick={() => onToggleTask(task)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        task.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-[#004275]'
                      }`}
                    >
                      {task.status === 'completed' && <Plus className="w-4 h-4 rotate-45" />}
                    </button>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-[#1a1c1c]'}`}>
                        {task.title}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-0.5">
                        {task.courseId || 'General'} • Due {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <button 
                      onClick={() => onDeleteTask(task.id)}
                      className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Activity Feed */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-[#1a1c1c] flex items-center gap-2 font-headline">
              Recent Activity
              <span className="w-2 h-2 rounded-full bg-[#004275]"></span>
            </h2>
            <button className="text-[#004275] font-bold text-xs hover:underline uppercase tracking-tight">Mark all as read</button>
          </div>
          <div className="space-y-4">
            {activities.map((activity) => (
              <ActivityItem 
                key={activity.id}
                icon={activity.type === 'discussion' ? <MessageSquare className="w-5 h-5" /> : <Star className="w-5 h-5" />} 
                iconBg={activity.type === 'discussion' ? "bg-[#c9deff]" : "bg-[#ffdcc7]"}
                iconColor={activity.type === 'discussion' ? "text-[#4d627e]" : "text-[#311300]"}
                title={<>{activity.title} in <span className="text-[#004275] font-bold">{activity.courseId}</span></>}
                content={activity.content}
                time={new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " TODAY"}
                action={activity.type === 'discussion' ? "Reply" : "View Details"}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Right Sidebar */}
      <div className="col-span-12 lg:col-span-4 space-y-10">
        {/* Reminders Card */}
        <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-red-50 rounded-lg">
              <Bell className="text-[#ba1a1a] w-5 h-5 fill-[#ba1a1a]" />
            </div>
            <h3 className="font-black text-lg text-[#1a1c1c] tracking-tight font-headline">Reminders</h3>
          </div>
          <div className="space-y-4">
            {reminders.map((reminder) => (
              <ReminderItem 
                key={reminder.id}
                color={reminder.color} 
                title={reminder.title} 
                subtitle={reminder.subtitle}
                onDelete={() => onDeleteReminder(reminder.id)}
              />
            ))}
          </div>
        </div>

        {/* Upcoming Events Card */}
        <div className="bg-white p-7 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-blue-50 rounded-lg">
              <CalendarDays className="text-[#004275] w-5 h-5" />
            </div>
            <h3 className="font-black text-lg text-[#1a1c1c] tracking-tight font-headline">Upcoming</h3>
          </div>
          <div className="space-y-8">
            {events.map((event) => (
              <UpcomingEvent 
                key={event.id}
                date={event.date} 
                day={event.day} 
                month={event.month}
                title={event.title} 
                subtitle={event.subtitle}
                color={event.color}
                textColor={event.textColor}
              />
            ))}
          </div>
          <button className="w-full mt-10 py-3 text-xs font-black uppercase tracking-widest text-[#004275] hover:bg-[#004275] hover:text-white rounded-xl transition-all duration-300 border-2 border-[#004275]/20 hover:border-[#004275] active:scale-95">
            View Full Calendar
          </button>
        </div>

        {/* Quick Access */}
        <div className="bg-[#005a9c] p-7 rounded-2xl text-white shadow-xl shadow-blue-900/20">
          <h3 className="font-black text-lg mb-6 flex items-center gap-3 tracking-tight font-headline">
            <Zap className="w-6 h-6 fill-white" />
            Quick Access
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <QuickAccessItem icon={<File className="w-6 h-6" />} label="My Files" />
            <QuickAccessItem icon={<Users className="w-6 h-6" />} label="Clubs" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CourseCard({ title, instructor, section, grade, tag, color, image }: Course) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-xl transition-all duration-300 cursor-pointer"
    >
      <div className={`h-32 ${color} relative overflow-hidden`}>
        <img 
          className="w-full h-full object-cover mix-blend-overlay opacity-60 group-hover:scale-110 transition-transform duration-700" 
          src={image} 
          alt={title}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
        <div className="absolute bottom-3 left-4">
          <span className="bg-white/20 backdrop-blur-md text-white text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-md border border-white/20">
            {tag}
          </span>
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-lg font-bold text-[#1a1c1c] mb-1 group-hover:text-[#004275] transition-colors font-headline">{title}</h3>
        <p className="text-gray-500 text-xs mb-4 font-medium opacity-80">{section} • {instructor}</p>
        <div className="flex justify-between items-center pt-5 border-t border-gray-100">
          <div className="flex gap-4 text-gray-400">
            <Megaphone className="w-5 h-5 hover:text-[#004275] transition-colors" />
            <FileText className="w-5 h-5 hover:text-[#004275] transition-colors" />
            <MessageSquare className="w-5 h-5 hover:text-[#004275] transition-colors" />
          </div>
          <span className="text-xs font-bold text-[#004275] bg-[#004275]/5 px-2 py-1 rounded">{grade}</span>
        </div>
      </div>
    </motion.div>
  );
}

function ActivityItem({ icon, iconBg, iconColor, title, content, time, action }: { 
  icon: React.ReactNode, iconBg: string, iconColor: string, title: React.ReactNode, content: React.ReactNode, time: string, action: string 
}) {
  return (
    <div className="bg-white p-5 rounded-2xl flex gap-5 border border-gray-100 hover:border-[#004275]/20 hover:bg-gray-50/40 hover:shadow-md transition-all duration-200 cursor-pointer group">
      <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center ${iconColor} transition-transform group-hover:scale-105`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[15px] text-[#1a1c1c] leading-tight">{title}</p>
        <p className="text-sm text-gray-500 mt-1.5 italic font-medium">{content}</p>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{time}</span>
          <span className="w-1 h-1 rounded-full bg-gray-300"></span>
          <span className="text-[10px] text-[#004275] font-bold hover:underline">{action}</span>
        </div>
      </div>
    </div>
  );
}

function ReminderItem({ color, title, subtitle, onDelete }: { color: string, title: string, subtitle: string, onDelete: () => void }) {
  return (
    <div className="group flex items-start gap-4 p-4 rounded-xl bg-white hover:bg-gray-50 transition-all duration-200 cursor-pointer border border-transparent hover:border-gray-200 active:scale-[0.98]">
      <div className={`w-1.5 h-10 ${color} rounded-full group-hover:h-12 transition-all`}></div>
      <div className="flex-1">
        <p className="text-sm font-bold text-[#1a1c1c] group-hover:text-[#004275] transition-colors">{title}</p>
        <p className="text-xs text-gray-500 mt-1 font-medium opacity-80">{subtitle}</p>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <ChevronRight className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 group-hover:hidden" />
    </div>
  );
}

function UpcomingEvent({ date, day, month, title, subtitle, color, textColor }: { 
  date: string, day: string, month: string, title: string, subtitle: string, color: string, textColor: string 
}) {
  return (
    <div className="relative pl-2 border-l-2 border-gray-100 ml-6">
      <p className="absolute -left-[45px] top-0 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap rotate-[-90deg] origin-bottom-left -translate-y-2 opacity-60">
        {month}
      </p>
      <div className="flex items-center gap-5 group cursor-pointer hover:bg-gray-50/50 p-3 -ml-3 rounded-xl transition-all active:scale-[0.98]">
        <div className={`${color} w-14 h-14 rounded-2xl flex flex-col items-center justify-center ${textColor} group-hover:bg-[#004275] group-hover:text-white transition-all duration-300 shadow-sm group-hover:shadow-md`}>
          <span className="text-lg font-black leading-none">{date}</span>
          <span className="text-[9px] font-black uppercase tracking-tighter mt-1">{day}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-[#1a1c1c] group-hover:text-[#004275] transition-colors">{title}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function QuickAccessItem({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="bg-white/10 hover:bg-white/20 active:bg-white/30 p-4 rounded-xl text-center transition-all duration-200 border border-white/10 group active:scale-95 cursor-pointer">
      <span className="block mb-2 group-hover:scale-110 transition-transform flex justify-center">{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </div>
  );
}
