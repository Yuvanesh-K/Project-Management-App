import React, { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs,
  limit,
  orderBy,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { useSettings } from '../SettingsContext';
import { Project, Task, ActivityLog, ProjectStatus } from '../types';
import { 
  Briefcase, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Users as UsersIcon,
  Plus,
  Lock,
  Globe
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { logActivity } from '../lib/firestore-utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface DashboardProps {
  onSelectProject: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onSelectProject }) => {
  const { user, organization } = useAuth();
  const { orgSettings, taskStatuses } = useSettings();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    status: 'Not Started' as ProjectStatus,
    visibility: 'private' as 'public' | 'private'
  });

  useEffect(() => {
    if (orgSettings) {
      setNewProject(prev => ({ ...prev, visibility: orgSettings.projectDefaults.defaultVisibility }));
    }
  }, [orgSettings]);

  useEffect(() => {
    if (!user || !organization) return;

    const projectsQuery = query(
      collection(db, 'projects'),
      where('organizationId', '==', organization.id),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    const activitiesQuery = query(
      collection(db, 'activityLogs'),
      where('organizationId', '==', organization.id),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribeActivities = onSnapshot(activitiesQuery, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activityLogs');
    });

    // Fetch tasks for all projects in this organization
    const fetchTasks = async () => {
      const allTasks: Task[] = [];
      const projectsSnapshot = await getDocs(projectsQuery);
      
      for (const projectDoc of projectsSnapshot.docs) {
        const tasksSnapshot = await getDocs(collection(db, `projects/${projectDoc.id}/tasks`));
        allTasks.push(...tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
      }
      setTasks(allTasks);
      setLoading(false);
    };

    fetchTasks();

    return () => {
      unsubscribeProjects();
      unsubscribeActivities();
    };
  }, [user, organization]);

  const stats = [
    { name: 'Active Projects', value: projects.length, icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Total Tasks', value: tasks.length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { name: 'Pending Tasks', value: tasks.filter(t => t.status !== 'Done').length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { name: 'Issues', value: 0, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  const taskStatusData = taskStatuses.map(status => ({
    name: status.name,
    value: tasks.filter(t => t.statusId === status.id).length
  }));

  const COLORS = taskStatuses.map(s => s.color || '#6366f1');

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !organization) return;

    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        ...newProject,
        organizationId: organization.id,
        ownerId: user.uid,
        members: [user.uid],
        createdAt: serverTimestamp(),
      });
      
      await logActivity(
        organization.id,
        docRef.id,
        'project',
        'Project Created',
        `Project "${newProject.name}" was created by ${user.displayName}`
      );

      setIsProjectModalOpen(false);
      setNewProject({ name: '', description: '', status: 'Not Started', visibility: orgSettings?.projectDefaults?.defaultVisibility || 'private' });
      toast.success('Project created successfully!');
    } catch (error) {
      toast.error('Failed to create project');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back, {user?.displayName}. Here's what's happening in <span className="font-bold text-indigo-600">{organization?.name}</span>.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Export Report
          </button>
          <button 
            onClick={() => setIsProjectModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center gap-2"
          >
            <Plus size={18} />
            New Project
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <TrendingUp size={16} className="text-green-500" />
            </div>
            <p className="text-sm font-medium text-gray-500">{stat.name}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Task Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskStatusData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Status Overview</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={taskStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {taskStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-3">
            {taskStatusData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                  <span className="text-sm text-gray-600">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h3>
          <div className="space-y-6">
            {activities.length > 0 ? activities.map((activity) => (
              <div key={activity.id} className="flex gap-4">
                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 shrink-0">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="text-sm text-gray-900 font-medium">
                    <span className="font-bold">{activity.action}</span> {activity.details}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {activity.createdAt?.toDate ? format(activity.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                  </p>
                </div>
              </div>
            )) : (
              <p className="text-gray-500 text-center py-8">No recent activity</p>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Active Projects</h3>
          <div className="space-y-4">
            {projects.slice(0, 5).map((project) => (
              <div 
                key={project.id} 
                onClick={() => onSelectProject(project.id)}
                className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
                    {project.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{project.name}</h4>
                    <p className="text-xs text-gray-500">{project.members.length} members</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    project.status === 'Completed' ? 'bg-green-100 text-green-700' :
                    project.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {project.status}
                  </span>
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <p className="text-gray-500 text-center py-8">No active projects</p>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {isProjectModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProjectModalOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 overflow-hidden"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Project</h2>
              <form onSubmit={handleCreateProject} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Project Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="Enter project name"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                  <textarea 
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="What is this project about?"
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Visibility</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      type="button"
                      onClick={() => setNewProject({ ...newProject, visibility: 'private' })}
                      className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${newProject.visibility === 'private' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-100 hover:border-gray-200 text-gray-500'}`}
                    >
                      <Lock size={20} />
                      <span className="font-bold">Private</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewProject({ ...newProject, visibility: 'public' })}
                      className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${newProject.visibility === 'public' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-100 hover:border-gray-200 text-gray-500'}`}
                    >
                      <Globe size={20} />
                      <span className="font-bold">Public</span>
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsProjectModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Create Project
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
