import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, collectionGroup } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { TimeLog, Task, User } from '../../types';
import { 
  Clock, 
  User as UserIcon, 
  Calendar, 
  Search, 
  Filter, 
  FileText,
  TrendingUp
} from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';

interface TimeLogListProps {
  projectId: string;
}

const TimeLogList: React.FC<TimeLogListProps> = ({ projectId }) => {
  const { organization } = useAuth();
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!projectId || !organization) return;

    // Use collectionGroup to get all time logs across all tasks in this project
    const logsQuery = query(
      collectionGroup(db, 'timeLogs'),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );

    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as TimeLog));
      setTimeLogs(logs);
    });

    const usersQuery = query(collection(db, 'users'), where('currentOrganizationId', '==', organization?.id));
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
    });

    // Also fetch tasks to show task names
    const tasksQuery = query(collection(db, `projects/${projectId}/tasks`));
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });

    return () => {
      unsubLogs();
      unsubUsers();
      unsubTasks();
    };
  }, [projectId, organization]);

  const totalHours = timeLogs.reduce((acc, log) => acc + (log.hours || 0), 0).toFixed(1);

  const filteredLogs = timeLogs.filter(log => {
    const task = tasks.find(t => t.id === log.taskId);
    return log.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
           task?.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Time Logged</p>
            <h4 className="text-2xl font-bold text-gray-900">{totalHours} <span className="text-sm font-normal text-gray-500">hours</span></h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-600 rounded-2xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Entries</p>
            <h4 className="text-2xl font-bold text-gray-900">{timeLogs.length} <span className="text-sm font-normal text-gray-500">logs</span></h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Members</p>
            <h4 className="text-2xl font-bold text-gray-900">{new Set(timeLogs.map(l => l.userId)).size} <span className="text-sm font-normal text-gray-500">users</span></h4>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search logs..."
            className="w-full pl-12 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Task</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredLogs.map((log) => {
              const user = users.find(u => u.uid === log.userId);
              const task = tasks.find(t => t.id === log.taskId);
              return (
                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{log.createdAt && typeof log.createdAt.toDate === 'function' ? format(log.createdAt.toDate(), 'MMM d, yyyy') : ''}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}`} className="w-6 h-6 rounded-full" alt="" />
                      <span className="text-xs font-medium text-gray-700">{user?.displayName || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{task?.name || 'Unknown Task'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-600 truncate max-w-xs">{log.description}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-gray-900">{(log.hours || 0).toFixed(1)}h</span>
                  </td>
                </tr>
              );
            })}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No time logs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TimeLogList;
