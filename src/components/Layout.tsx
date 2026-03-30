import React from 'react';
import { 
  Bell, 
  Mail, 
  Search, 
  Megaphone, 
  Calendar, 
  Star, 
  ClipboardCheck, 
  LogOut,
  Zap,
  File,
  Users,
  Plus
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut, User as FirebaseUser } from 'firebase/auth';

interface LayoutProps {
  user: FirebaseUser;
  children: React.ReactNode;
  onAddTask: () => void;
}

export function Layout({ user, children, onAddTask }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f9f9]">
      {/* Top Navigation */}
      <nav className="fixed top-0 w-full flex justify-between items-center px-6 h-16 bg-[#004275] z-50 shadow-lg shadow-blue-900/10">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-2xl font-black text-white tracking-tight cursor-pointer font-headline">Zentelle</Link>
          <div className="hidden md:flex gap-1">
            <NavLink to="/" active={location.pathname === '/'}>Home</NavLink>
            <NavLink to="/courses" active={location.pathname === '/courses'}>Courses</NavLink>
            <NavLink to="/groups" active={location.pathname === '/groups'}>Groups</NavLink>
            <NavLink to="/resources" active={location.pathname === '/resources'}>Resources</NavLink>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block mr-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 w-4 h-4" />
            <input 
              className="bg-white/10 border-none rounded-full py-1.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-white/30 w-64 placeholder:text-white/50 text-white transition-all outline-none" 
              placeholder="Search courses, people..." 
              type="text"
            />
          </div>
          <button className="p-2.5 hover:bg-white/15 active:bg-white/20 rounded-full transition-all text-white relative">
            <Mail className="w-5 h-5" />
          </button>
          <button className="p-2.5 hover:bg-white/15 active:bg-white/20 rounded-full transition-all text-white relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#ba1a1a] rounded-full border-2 border-[#004275]"></span>
          </button>
          <div className="relative group ml-2">
            <button className="ring-2 ring-white/10 hover:ring-white/30 rounded-full transition-all overflow-hidden active:scale-95">
              <img 
                alt="User Profile" 
                className="w-9 h-9 object-cover" 
                src={user.photoURL || "https://picsum.photos/seed/user/100/100"}
                referrerPolicy="no-referrer"
              />
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100 mb-2">
                <p className="text-sm font-bold truncate">{user.displayName}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 pt-20 bg-white border-r border-gray-200 z-40">
        <div className="px-8 mb-8 mt-4">
          <h2 className="text-[#004275] font-bold text-lg leading-tight font-headline">Zentelle Dashboard</h2>
          <p className="text-gray-500 text-xs font-medium opacity-70">Academic Year 2024</p>
        </div>
        <nav className="flex flex-col gap-1 pr-4">
          <SidebarLink to="/" icon={<Megaphone className="w-5 h-5" />} label="Updates" active={location.pathname === '/'} />
          <SidebarLink to="/calendar" icon={<Calendar className="w-5 h-5" />} label="Calendar" active={location.pathname === '/calendar'} />
          <SidebarLink to="/grades" icon={<Star className="w-5 h-5" />} label="Grades" active={location.pathname === '/grades'} />
          <SidebarLink to="/attendance" icon={<ClipboardCheck className="w-5 h-5" />} label="Attendance" active={location.pathname === '/attendance'} />
        </nav>

        {/* Quick Access in Sidebar for Mobile/Small Screens */}
        <div className="mt-10 px-6">
           <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 px-2">Quick Access</h3>
           <div className="space-y-2">
              <QuickAccessLink to="/files" icon={<File className="w-4 h-4" />} label="My Files" />
              <QuickAccessLink to="/clubs" icon={<Users className="w-4 h-4" />} label="Clubs" />
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 pt-24 px-10 pb-16 min-h-screen">
        {children}
      </main>

      {/* Floating Action Button */}
      <button 
        onClick={onAddTask}
        className="fixed bottom-10 right-10 w-16 h-16 bg-gradient-to-br from-[#004275] to-[#005a9c] text-white rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 hover:-translate-y-2 hover:rotate-3 active:scale-90 active:rotate-0 transition-all duration-300 z-50 group"
      >
        <Plus className="w-9 h-9 group-hover:rotate-90 transition-transform duration-500" />
        <span className="absolute right-full mr-4 px-3 py-1.5 bg-[#2f3131] text-[#f1f1f1] text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-white/10">
          Create Task
        </span>
      </button>
    </div>
  );
}

function NavLink({ to, children, active }: { to: string, children: React.ReactNode, active: boolean }) {
  return (
    <Link 
      to={to} 
      className={`relative px-4 py-2 font-bold transition-all duration-200 rounded-lg ${
        active ? 'text-white bg-white/10' : 'text-blue-100/80 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
      {active && <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-white"></span>}
    </Link>
  );
}

function SidebarLink({ to, icon, label, active }: { to: string, icon: React.ReactNode, label: string, active: boolean }) {
  return (
    <Link 
      to={to}
      className={`flex items-center gap-3 rounded-r-full pl-8 py-3.5 transition-all group active:scale-[0.98] ${
        active 
          ? 'text-[#004275] bg-[#004275]/5 border-l-4 border-[#004275] font-semibold' 
          : 'text-gray-500 hover:text-[#004275] hover:bg-gray-100'
      }`} 
    >
      <span className="transition-transform group-hover:scale-110">{icon}</span>
      <span className={active ? '' : 'font-medium'}>{label}</span>
    </Link>
  );
}

function QuickAccessLink({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  return (
    <Link 
      to={to}
      className="flex items-center gap-3 px-3 py-2 text-gray-500 hover:text-[#004275] hover:bg-gray-100 rounded-lg transition-all text-sm font-medium group"
    >
      <span className="group-hover:scale-110 transition-transform">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
