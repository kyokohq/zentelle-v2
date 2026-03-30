import React from 'react';
import { FileText, Download, Search, Filter, ExternalLink, BookOpen, Video, FileCode, Plus } from 'lucide-react';
import { Resource } from '../types';

interface ResourcesProps {
  resources: Resource[];
  onUploadResource: () => void;
}

export function Resources({ resources, onUploadResource }: ResourcesProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="w-5 h-5" />;
      case 'pdf': return <FileText className="w-5 h-5" />;
      case 'link': return <ExternalLink className="w-5 h-5" />;
      default: return <FileCode className="w-5 h-5" />;
    }
  };

  const getColor = (category: string) => {
    switch (category) {
      case 'Science': return 'bg-blue-50 text-blue-600';
      case 'Math': return 'bg-green-50 text-green-600';
      case 'Humanities': return 'bg-orange-50 text-orange-600';
      case 'Language': return 'bg-purple-50 text-purple-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1a1c1c] tracking-tight mb-1 font-headline">Educational Resources</h1>
          <p className="text-gray-600 font-medium text-sm">Access study materials, lecture notes, and helpful links.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all" 
              placeholder="Search resources..." 
              type="text"
            />
          </div>
          <button className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <Filter className="w-5 h-5 text-gray-500" />
          </button>
          <button 
            onClick={onUploadResource}
            className="bg-[#004275] hover:bg-[#005a9c] text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Upload Resource
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Categories Sidebar */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="font-black text-lg text-[#1a1c1c] mb-6 tracking-tight font-headline">Categories</h3>
            <div className="space-y-2">
              <CategoryItem label="All Resources" count={resources.length} active />
              <CategoryItem label="Science" count={resources.filter(r => r.category === 'Science').length} />
              <CategoryItem label="Humanities" count={resources.filter(r => r.category === 'Humanities').length} />
              <CategoryItem label="Math" count={resources.filter(r => r.category === 'Math').length} />
              <CategoryItem label="Language" count={resources.filter(r => r.category === 'Language').length} />
            </div>
          </div>

          <div className="bg-[#004275] p-8 rounded-3xl text-white shadow-xl shadow-blue-900/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white/10 rounded-lg">
                <BookOpen className="w-6 h-6 fill-white" />
              </div>
              <h3 className="font-black text-lg tracking-tight font-headline">Library Access</h3>
            </div>
            <p className="text-blue-100/80 text-sm mb-8 leading-relaxed">Access over 10,000+ digital books and academic journals through our partner libraries.</p>
            <button className="w-full py-3 bg-white text-[#004275] rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
              Open Digital Library
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Resources List */}
        <div className="lg:col-span-2 space-y-4">
          {resources.length === 0 ? (
            <div className="bg-white p-20 rounded-3xl border border-gray-100 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                <FileText className="w-8 h-8" />
              </div>
              <p className="text-gray-500 font-medium">No resources uploaded yet.</p>
            </div>
          ) : (
            resources.map((resource) => (
              <a 
                key={resource.id} 
                href={resource.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white p-5 rounded-2xl flex items-center gap-6 border border-gray-100 hover:border-[#004275]/20 hover:bg-gray-50/40 hover:shadow-md transition-all duration-200 cursor-pointer group"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${getColor(resource.category)} transition-transform group-hover:scale-105`}>
                  {getIcon(resource.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-[#1a1c1c] group-hover:text-[#004275] transition-colors">{resource.title}</h3>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded">{resource.type}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                    <span>{resource.category}</span>
                  </div>
                </div>
                <button className="p-3 text-gray-400 hover:text-[#004275] hover:bg-[#004275]/5 rounded-xl transition-all">
                  <Download className="w-5 h-5" />
                </button>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryItem({ label, count, active = false }: { label: string, count: number, active?: boolean }) {
  return (
    <button className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all ${
      active ? 'bg-[#004275]/5 text-[#004275] font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 font-medium'
    }`}>
      <span>{label}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full ${active ? 'bg-[#004275] text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
    </button>
  );
}
