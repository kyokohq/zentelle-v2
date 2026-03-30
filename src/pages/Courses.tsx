import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Course } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Megaphone, FileText, MessageSquare, Plus, Search, Filter } from 'lucide-react';

interface CoursesProps {
  courses: Course[];
  userRole?: 'student' | 'admin';
  onJoinCourse: () => void;
  onCreateCourse: () => void;
}

export function Courses({ courses, userRole, onJoinCourse, onCreateCourse }: CoursesProps) {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1a1c1c] tracking-tight mb-1 font-headline">My Courses</h1>
          <p className="text-gray-600 font-medium text-sm">You are currently enrolled in {courses.length} courses.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all" 
              placeholder="Filter courses..." 
              type="text"
            />
          </div>
          <button className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <Filter className="w-5 h-5 text-gray-500" />
          </button>
          <button 
            onClick={onJoinCourse}
            className="bg-white border border-[#004275] text-[#004275] hover:bg-[#004275]/5 px-6 py-2 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Join Course
          </button>
          {userRole === 'admin' && (
            <button 
              onClick={onCreateCourse}
              className="bg-[#004275] hover:bg-[#005a9c] text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Create Course
            </button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {courses.map((course) => (
            <CourseCard key={course.id} {...course} onNavigate={(tab) => navigate(`/courses/${course.id}`, { state: { activeTab: tab } })} />
          ))}
        </AnimatePresence>
      </section>

      {courses.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No courses found</h3>
          <p className="text-gray-500 max-w-xs mx-auto mt-2">Join your first course to start managing your academic life with Zentelle.</p>
          <button 
            onClick={onJoinCourse}
            className="mt-6 text-[#004275] font-bold hover:underline"
          >
            Join a course now
          </button>
        </div>
      )}
    </div>
  );
}

interface CourseCardProps extends Course {
  onNavigate: (tab?: string) => void;
}

function CourseCard({ id, title, instructor, section, grade, tag, color, image, onNavigate }: CourseCardProps) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      onClick={() => onNavigate()}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-xl transition-all duration-300 cursor-pointer"
    >
      <div className={`h-40 ${color} relative overflow-hidden`}>
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
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-[#1a1c1c] group-hover:text-[#004275] transition-colors font-headline leading-tight">{title}</h3>
          <span className="text-xs font-bold text-[#004275] bg-[#004275]/5 px-2 py-1 rounded">{grade}</span>
        </div>
        <p className="text-gray-500 text-xs mb-6 font-medium opacity-80">{section} • {instructor}</p>
        
        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100">
          <button 
            onClick={(e) => { e.stopPropagation(); onNavigate('updates'); }}
            className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 rounded-lg transition-colors group/btn"
          >
            <Megaphone className="w-4 h-4 text-gray-400 group-hover/btn:text-[#004275]" />
            <span className="text-[10px] font-bold text-gray-400 group-hover/btn:text-[#004275]">Updates</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onNavigate('files'); }}
            className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 rounded-lg transition-colors group/btn"
          >
            <FileText className="w-4 h-4 text-gray-400 group-hover/btn:text-[#004275]" />
            <span className="text-[10px] font-bold text-gray-400 group-hover/btn:text-[#004275]">Files</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onNavigate('chat'); }}
            className="flex flex-col items-center gap-1 p-2 hover:bg-gray-50 rounded-lg transition-colors group/btn"
          >
            <MessageSquare className="w-4 h-4 text-gray-400 group-hover/btn:text-[#004275]" />
            <span className="text-[10px] font-bold text-gray-400 group-hover/btn:text-[#004275]">Chat</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
