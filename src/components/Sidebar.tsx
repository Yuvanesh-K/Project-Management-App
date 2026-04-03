import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase, 
  CheckSquare, 
  BarChart2, 
  Users, 
  Settings, 
  LogOut,
  ChevronRight,
  Building2,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { motion } from 'motion/react';

const Sidebar: React.FC = () => {
  const { user, organization, role, logout } = useAuth();

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Projects', icon: Briefcase, path: '/projects' },
    { name: 'My Tasks', icon: CheckSquare, path: '/my-tasks' },
    { name: 'All Tasks', icon: CheckSquare, path: '/tasks' },
    { name: 'Reports', icon: BarChart2, path: '/reports' },
    { name: 'Collaborations', icon: Users, path: '/collaborations' },
  ];

  // Admin/Owner only items
  if (role === 'admin' || role === 'owner') {
    navItems.push(
      { name: 'Team Management', icon: ShieldCheck, path: '/team' },
      { name: 'Organization Settings', icon: Settings, path: '/settings' }
    );
  }

  return (
    <div className="h-screen w-64 bg-white border-r border-gray-200 flex flex-col fixed left-0 top-0 z-50">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-100">
            P
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">ProTrack</span>
        </div>

        {organization && (
          <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-600 border border-indigo-100">
              <Building2 size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Organization</p>
              <p className="text-sm font-bold text-gray-900 truncate">{organization.name}</p>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
              ${isActive 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
            `}
          >
            <item.icon size={20} className="transition-transform group-hover:scale-110" />
            <span className="font-medium">{item.name}</span>
            {item.path === '/projects' && (
              <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-4 py-3 mb-4">
          <img 
            src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}`} 
            alt="Avatar" 
            className="w-10 h-10 rounded-full border-2 border-indigo-100"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{user?.displayName}</p>
            <p className="text-xs text-gray-500 truncate capitalize font-medium">{role}</p>
          </div>
        </div>
        
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
