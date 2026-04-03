import React from 'react';
import { MessageSquare, Users, Hash, Send } from 'lucide-react';
import { useAuth } from '../AuthContext';

const Collaborations: React.FC = () => {
  const { organization } = useAuth();
  const channels = [
    { name: 'general', icon: Hash },
    { name: 'design-team', icon: Hash },
    { name: 'development', icon: Hash },
    { name: 'marketing', icon: Hash },
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Collaboration</h1>
          <p className="text-gray-500 mt-1">Connect with your team in {organization?.name}.</p>
        </div>
      </header>

      <div className="flex-1 flex gap-8 min-h-0">
        <div className="w-64 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex-1 overflow-y-auto">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <MessageSquare size={18} className="text-indigo-600" />
            Channels
          </h3>
          <nav className="space-y-1">
            {channels.map((channel) => (
              <button 
                key={channel.name}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              >
                <channel.icon size={16} />
                {channel.name}
              </button>
            ))}
          </nav>

          <h3 className="text-lg font-bold text-gray-900 mt-8 mb-6 flex items-center gap-2">
            <Users size={18} className="text-indigo-600" />
            Direct Messages
          </h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-full bg-gray-200" />
                <span className="text-sm font-medium text-gray-600">Team Member {i}</span>
                <div className="w-2 h-2 rounded-full bg-green-500 ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <header className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Hash size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">general</h2>
              <p className="text-xs text-gray-500">General discussion for the whole team</p>
            </div>
          </div>
          <button className="p-2 text-gray-400 hover:text-gray-600">
            <Users size={20} />
          </button>
        </header>

        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 shrink-0" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-gray-900">Project Manager</span>
                <span className="text-[10px] text-gray-400">10:45 AM</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl rounded-tl-none text-sm text-gray-600 max-w-lg">
                Hey team! Just wanted to check in on the progress of the new dashboard design. How's it coming along?
              </div>
            </div>
          </div>

          <div className="flex gap-4 flex-row-reverse">
            <div className="w-10 h-10 rounded-full bg-green-100 shrink-0" />
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-gray-400">10:48 AM</span>
                <span className="text-sm font-bold text-gray-900">Lead Designer</span>
              </div>
              <div className="bg-indigo-600 p-4 rounded-2xl rounded-tr-none text-sm text-white max-w-lg">
                It's going great! We've just finished the initial wireframes and are starting on the high-fidelity mockups now.
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-50">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Type a message..."
              className="w-full pl-6 pr-16 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
            />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};

export default Collaborations;
