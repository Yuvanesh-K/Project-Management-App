import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { useSettings } from '../SettingsContext';
import { Project, User, ProjectTab } from '../types';
import { 
  LayoutDashboard, 
  CheckSquare, 
  AlertCircle, 
  Flag, 
  FileText, 
  Clock, 
  MessageSquare, 
  Users, 
  Settings,
  Calendar,
  Tag,
  ChevronRight,
  Trash2,
  Edit2,
  Plus,
  MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { logActivity } from '../lib/firestore-utils';

// Import sub-modules
import ProjectDashboard from './project/ProjectDashboard';
import TaskList from './project/TaskList';
import IssueTracker from './project/IssueTracker';
import MilestoneManager from './project/MilestoneManager';
import DocumentManager from './project/DocumentManager';
import TimeLogList from './project/TimeLogList';
import ForumModule from './project/ForumModule';

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, organization, role } = useAuth();
  const { orgSettings } = useSettings();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<ProjectTab>('Dashboard');
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (!projectId || !organization) return;

    const unsubscribe = onSnapshot(doc(db, 'projects', projectId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Project;
        // Enforce organization isolation
        if (data.organizationId !== organization.id) {
          toast.error('Project not found in this organization');
          navigate('/projects');
          return;
        }
        setProject({ id: snapshot.id, ...data });
      } else {
        // If the project was deleted, redirect
        navigate('/projects');
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching project:", error);
      toast.error('Failed to load project details');
      setIsLoading(false);
    });

    const membersQuery = query(collection(db, 'users'), where('currentOrganizationId', '==', organization.id));
    const unsubMembers = onSnapshot(membersQuery, (snapshot) => {
      setProjectMembers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
    });

    return () => {
      unsubscribe();
      unsubMembers();
    };
  }, [projectId, organization, navigate]);

  const handleDeleteProject = async () => {
    if (!project || !user) return;
    
    setIsDeleting(true);
    try {
      // Check for tasks first to provide better feedback
      const tasksQuery = query(collection(db, `projects/${project.id}/tasks`));
      const tasksSnapshot = await getDocs(tasksQuery);
      
      if (!tasksSnapshot.empty) {
        toast.error(`Cannot delete project. There are still ${tasksSnapshot.size} tasks remaining.`);
        setIsDeleting(false);
        return;
      }

      await deleteDoc(doc(db, 'projects', project.id));
      
      await logActivity(
        organization.id,
        project.id,
        'project',
        'Project Deleted',
        `Project "${project.name}" was deleted by ${user.displayName}`
      );

      toast.success('Project deleted successfully');
      navigate('/projects');
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error('Failed to delete project. You may not have permission or there was a network error.');
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const canDelete = role === 'owner' || role === 'admin' || project?.ownerId === user?.uid;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) return null;

  const tabs: { id: ProjectTab; icon: any; label: string; enabled?: boolean }[] = [
    { id: 'Dashboard', icon: LayoutDashboard, label: 'Dashboard', enabled: true },
    { id: 'Tasks', icon: CheckSquare, label: 'Tasks', enabled: true },
    { id: 'Issues', icon: AlertCircle, label: 'Issues', enabled: orgSettings?.enabledModules?.issues },
    { id: 'Milestones', icon: Flag, label: 'Milestones', enabled: orgSettings?.enabledModules?.milestones },
    { id: 'Documents', icon: FileText, label: 'Documents', enabled: orgSettings?.enabledModules?.documents },
    { id: 'Time Logs', icon: Clock, label: 'Time Logs', enabled: orgSettings?.enabledModules?.timeLogs },
    { id: 'Forums', icon: MessageSquare, label: 'Forums', enabled: orgSettings?.enabledModules?.forums },
    { id: 'Users', icon: Users, label: 'Team', enabled: true },
    { id: 'Settings', icon: Settings, label: 'Settings', enabled: true },
  ];

  const visibleTabs = tabs.filter(t => t.enabled !== false);

  return (
    <div className="space-y-8 pb-20">
      {/* Project Header */}
      <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -mr-32 -mt-32 blur-3xl -z-10" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm font-bold text-indigo-600 uppercase tracking-widest">
              <span>Projects</span>
              <ChevronRight size={14} />
              <span>{project.name}</span>
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">{project.name}</h1>
            <p className="text-gray-500 max-w-2xl leading-relaxed">{project.description}</p>
            
            <div className="flex flex-wrap gap-6 pt-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Calendar size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Due Date</p>
                  <p className="text-sm font-bold text-gray-900">
                    {project.dueDate ? format(project.dueDate.toDate(), 'MMM d, yyyy') : 'No due date'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Tag size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</p>
                  <p className="text-sm font-bold text-gray-900">{project.status}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                  <Users size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Team Size</p>
                  <p className="text-sm font-bold text-gray-900">{project.members?.length || 0} Members</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all">
              <Edit2 size={20} />
            </button>
            {canDelete && (
              <button 
                onClick={() => setIsDeleteModalOpen(true)}
                className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 overflow-hidden"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-6">
                <Trash2 size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Delete Project?</h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-gray-900">{project?.name}</span>? 
                This action cannot be undone and all associated data will be lost.
              </p>
              <div className="flex gap-4">
                <button 
                  disabled={isDeleting}
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  disabled={isDeleting}
                  onClick={handleDeleteProject}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-3xl border border-gray-100 shadow-sm overflow-x-auto no-scrollbar">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-indigo-600'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'Dashboard' && <ProjectDashboard projectId={project.id} />}
        {activeTab === 'Tasks' && <TaskList projectId={project.id} />}
        {activeTab === 'Issues' && <IssueTracker projectId={project.id} />}
        {activeTab === 'Milestones' && <MilestoneManager projectId={project.id} />}
        {activeTab === 'Documents' && <DocumentManager projectId={project.id} />}
        {activeTab === 'Time Logs' && <TimeLogList projectId={project.id} />}
        {activeTab === 'Forums' && <ForumModule projectId={project.id} />}
        
        {activeTab === 'Users' && (
          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-gray-900">Project Team</h3>
              <button className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100">
                <Plus size={20} />
                Add Member
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projectMembers.map((member) => (
                <div key={member.uid} className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-transparent hover:border-indigo-100 hover:bg-white transition-all group">
                  <img 
                    src={member.photoURL || `https://ui-avatars.com/api/?name=${member.displayName}`} 
                    className="w-12 h-12 rounded-2xl object-cover shadow-sm"
                    alt={member.displayName}
                  />
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900">{member.displayName}</h4>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                  <button className="p-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Settings' && (
          <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
            <h3 className="text-2xl font-black text-gray-900 mb-8">Project Settings</h3>
            <div className="space-y-6 max-w-2xl">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Project Name</label>
                <input 
                  type="text" 
                  defaultValue={project.name}
                  className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                <textarea 
                  rows={4}
                  defaultValue={project.description}
                  className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
                  <select 
                    defaultValue={project.status}
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Due Date</label>
                  <input 
                    type="date" 
                    defaultValue={project.dueDate ? format(project.dueDate.toDate(), 'yyyy-MM-dd') : ''}
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
              <div className="pt-4">
                <button className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ProjectDetail;
