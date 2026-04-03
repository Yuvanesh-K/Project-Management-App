import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { useSettings } from '../../SettingsContext';
import { Task, ActivityLog, TaskStatusConfig } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  BarChart2, 
  Activity,
  TrendingUp
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { format } from 'date-fns';

interface ProjectDashboardProps {
  projectId: string;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ projectId }) => {
  const { organization } = useAuth();
  const { taskStatuses } = useSettings();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization) return;

    const tasksQuery = query(collection(db, `projects/${projectId}/tasks`));
    const activitiesQuery = query(
      collection(db, 'activityLogs'),
      where('organizationId', '==', organization.id),
      where('targetId', '==', projectId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, `projects/${projectId}/tasks`));

    const unsubActivities = onSnapshot(activitiesQuery, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'activityLogs'));

    return () => {
      unsubTasks();
      unsubActivities();
    };
  }, [projectId, organization]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading dashboard data...</div>;

  const totalTasks = tasks.length;
  
  // Find statuses that are considered "Completed"
  const completedStatusIds = taskStatuses.filter(s => s.type === 'Completed').map(s => s.id);
  const completedTasks = tasks.filter(t => completedStatusIds.includes(t.statusId)).length;
  const pendingTasks = totalTasks - completedTasks;
  const overdueTasks = tasks.filter(t => !completedStatusIds.includes(t.statusId) && t.dueDate && t.dueDate.toDate() < new Date()).length;

  const statusData = taskStatuses.map(status => ({
    name: status.name,
    value: tasks.filter(t => t.statusId === status.id).length,
    color: status.color
  })).filter(d => d.value > 0);

  const priorityData = [
    { name: 'Low', value: tasks.filter(t => t.priority === 'Low').length, color: '#3b82f6' },
    { name: 'Medium', value: tasks.filter(t => t.priority === 'Medium').length, color: '#f59e0b' },
    { name: 'High', value: tasks.filter(t => t.priority === 'High').length, color: '#ef4444' },
    { name: 'Critical', value: tasks.filter(t => t.priority === 'Critical').length, color: '#000000' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Tasks" 
          value={totalTasks} 
          icon={<BarChart2 size={20} />} 
          color="bg-indigo-50 text-indigo-600" 
        />
        <StatCard 
          title="Completed" 
          value={completedTasks} 
          icon={<CheckCircle2 size={20} />} 
          color="bg-green-50 text-green-600" 
        />
        <StatCard 
          title="Pending" 
          value={pendingTasks} 
          icon={<Clock size={20} />} 
          color="bg-amber-50 text-amber-600" 
        />
        <StatCard 
          title="Overdue" 
          value={overdueTasks} 
          icon={<AlertCircle size={20} />} 
          color="bg-red-50 text-red-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Task Status Distribution</h3>
          <div className="h-64">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">No task data available</div>
            )}
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {statusData.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-sm text-gray-500">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Task Priority</h3>
          <div className="h-64">
            {priorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">No task data available</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <Activity size={24} className="text-indigo-600" />
          <h3 className="text-xl font-bold text-gray-900">Recent Activity</h3>
        </div>
        <div className="space-y-6">
          {activities.length > 0 ? activities.map((activity) => (
            <div key={activity.id} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <TrendingUp size={18} className="text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">
                  <span className="font-bold">User</span> {activity.action} <span className="font-bold">{activity.targetType}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {activity.details} • {activity.createdAt ? format(activity.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                </p>
              </div>
            </div>
          )) : (
            <div className="text-center py-8 text-gray-400">No recent activity found.</div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2 rounded-xl ${color}`}>
        {icon}
      </div>
      <span className="text-sm font-bold text-gray-500">{title}</span>
    </div>
    <p className="text-3xl font-bold text-gray-900">{value}</p>
  </div>
);

export default ProjectDashboard;
