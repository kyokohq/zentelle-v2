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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* GPA Summary */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-[#004275] p-8 rounded-3xl text-white shadow-xl shadow-blue-900/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white/10 rounded-lg">
                <Star className="w-6 h-6 fill-white" />
              </div>
              <h3 className="font-black text-lg tracking-tight font-headline">GPA Summary</h3>
            </div>
            <div className="flex items-end gap-3 mb-8">
              <span className="text-6xl font-black leading-none">3.82</span>
              <span className="text-blue-100/60 font-bold mb-1">/ 4.0</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-green-300">
              <TrendingUp className="w-4 h-4" />
              <span>+0.12 from last semester</span>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-black text-lg text-[#1a1c1c] mb-6 tracking-tight font-headline">Performance Highlights</h3>
            <div className="space-y-6">
              <HighlightItem label="Highest Grade" value="94%" course="World History" color="text-green-600" />
              <HighlightItem label="Lowest Grade" value="88%" course="AP Biology" color="text-orange-600" />
              <HighlightItem label="Credits Earned" value="18" course="Total" color="text-[#004275]" />
            </div>
          </div>
        </div>

        {/* Grades Table */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Course Name</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400">Instructor</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Grade</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Trend</th>
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
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {Math.random() > 0.5 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HighlightItem({ label, value, course, color }: { label: string, value: string, course: string, color: string }) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{label}</p>
        <p className="text-xs font-bold text-gray-600">{course}</p>
      </div>
      <span className={`text-xl font-black ${color}`}>{value}</span>
    </div>
  );
}
