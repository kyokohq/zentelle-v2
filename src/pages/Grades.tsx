import React from 'react';
import { Course } from '../types';
import { Star, TrendingUp, TrendingDown, Minus, Search, Filter } from 'lucide-react';

interface GradesProps {
  courses: Course[];
}

export function Grades({ courses }: GradesProps) {
  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-[#1a1c1c] tracking-tight mb-1 font-headline">Grades</h1>
          <p className="text-gray-600 font-medium text-sm">Track your academic performance across all courses.</p>
        </div>
        <div className="flex gap-3">
          <button className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <Search className="w-5 h-5 text-gray-500" />
          </button>
          <button className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <Filter className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-10">
        {/* Grades Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Course Name</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Instructor</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${course.color}`}></div>
                      <span className="font-bold text-[#1a1c1c] group-hover:text-[#004275] transition-colors">{course.title}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm text-gray-500 font-medium">{course.instructor}</td>
                  <td className="px-8 py-6 text-center">
                    <span className="text-sm font-black text-[#004275] bg-[#004275]/5 px-3 py-1.5 rounded-lg">{course.grade}</span>
                  </td>
                </tr>
              ))}
              {courses.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-8 py-12 text-center text-gray-400 font-medium italic">
                    No grades recorded yet. Enroll in courses to see your grades here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
