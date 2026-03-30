import React from 'react';
import { Group } from '../types';
import { Users, Plus, Search, Filter, MessageSquare, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GroupsProps {
  groups: Group[];
  onCreateGroup: () => void;
}

export function Groups({ groups, onCreateGroup }: GroupsProps) {
  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1a1c1c] tracking-tight mb-1 font-headline">Study Groups & Clubs</h1>
          <p className="text-gray-600 font-medium text-sm">Connect with your peers and collaborate on projects.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#004275]/20 outline-none transition-all" 
              placeholder="Search groups..." 
              type="text"
            />
          </div>
          <button className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <Filter className="w-5 h-5 text-gray-500" />
          </button>
          <button 
            onClick={onCreateGroup}
            className="bg-[#004275] hover:bg-[#005a9c] text-white px-6 py-2 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Create Group
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {groups.map((group) => (
            <GroupCard key={group.id} {...group} />
          ))}
        </AnimatePresence>
        
        {/* Mock groups if none exist */}
        {groups.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400">
              <Users className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-[#1a1c1c] mb-2">No groups yet</h3>
            <p className="text-gray-500 mb-8">Create your first study group to start collaborating!</p>
            <button 
              onClick={onCreateGroup}
              className="bg-[#004275] text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-[#005a9c] transition-all"
            >
              Create Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupCard({ name, description, members }: Partial<Group>) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 bg-[#004275]/5 rounded-xl flex items-center justify-center text-[#004275]">
          <Users className="w-6 h-6" />
        </div>
        <button className="p-1 text-gray-400 hover:text-gray-600">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
      <h3 className="text-lg font-bold text-[#1a1c1c] group-hover:text-[#004275] transition-colors font-headline mb-2">{name}</h3>
      <p className="text-sm text-gray-500 line-clamp-2 mb-6 font-medium leading-relaxed">{description}</p>
      
      <div className="flex items-center justify-between pt-5 border-t border-gray-100">
        <div className="flex -space-x-2">
          {members?.slice(0, 3).map((_, i) => (
            <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
              <img src={`https://picsum.photos/seed/${i + 10}/100/100`} alt="Member" className="w-full h-full object-cover" />
            </div>
          ))}
          {members && members.length > 3 && (
            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
              +{members.length - 3}
            </div>
          )}
        </div>
        <button className="flex items-center gap-2 text-[#004275] font-bold text-xs hover:underline">
          <MessageSquare className="w-4 h-4" />
          Chat
        </button>
      </div>
    </motion.div>
  );
}
