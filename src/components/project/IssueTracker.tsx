import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { useSettings } from '../../SettingsContext';
import { Issue, TaskPriority, User, Task, TaskStatusConfig } from '../../types';
import { 
  Plus, 
  AlertCircle, 
  Search, 
  Filter, 
  Trash2, 
  Edit2, 
  MessageSquare,
  CheckCircle2,
  Clock,
  User as UserIcon,
  Circle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { logActivity } from '../../lib/firestore-utils';

interface IssueTrackerProps {
  projectId: string;
}

const IssueTracker: React.FC<IssueTrackerProps> = ({ projectId }) => {
  const { organization, user: currentUser } = useAuth();
  const { issueStatuses } = useSettings();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  const [newIssue, setNewIssue] = useState({ 
    title: '', 
    description: '', 
    priority: 'Medium' as TaskPriority,
    statusId: '',
    assignedUserId: '',
    taskId: ''
  });

  useEffect(() => {
    if (issueStatuses.length > 0 && !newIssue.statusId) {
      setNewIssue(prev => ({ ...prev, statusId: issueStatuses[0].id }));
    }
  }, [issueStatuses]);

  useEffect(() => {
    if (!projectId) return;

    const q = query(collection(db, `projects/${projectId}/issues`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIssues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Issue)));
    });

    const tasksQuery = query(collection(db, `projects/${projectId}/tasks`));
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });

    const membersQuery = query(collection(db, 'users'), where('currentOrganizationId', '==', organization?.id));
    const unsubMembers = onSnapshot(membersQuery, (snapshot) => {
      setProjectMembers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
    });

    return () => {
      unsubscribe();
      unsubTasks();
      unsubMembers();
    };
  }, [projectId, organization]);

  const handleCreateOrUpdateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !organization) return;

    try {
      if (editingIssue) {
        await updateDoc(doc(db, `projects/${projectId}/issues`, editingIssue.id), {
          ...newIssue,
          updatedAt: serverTimestamp(),
        });

        await logActivity(
          organization.id,
          editingIssue.id,
          'issue',
          'Issue Updated',
          `Issue "${newIssue.title}" was updated by ${currentUser?.displayName}`
        );

        toast.success('Issue updated successfully!');
      } else {
        const docRef = await addDoc(collection(db, `projects/${projectId}/issues`), {
          ...newIssue,
          projectId,
          organizationId: organization.id,
          createdAt: serverTimestamp(),
        });

        await logActivity(
          organization.id,
          docRef.id,
          'issue',
          'Issue Reported',
          `New issue "${newIssue.title}" was reported by ${currentUser?.displayName}`
        );

        toast.success('Issue reported successfully!');
      }
      setIsModalOpen(false);
      setEditingIssue(null);
      setNewIssue({ title: '', description: '', priority: 'Medium', statusId: issueStatuses[0]?.id || '', assignedUserId: '', taskId: '' });
    } catch (error) {
      toast.error('Failed to save issue');
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    if (!organization || !currentUser) return;
    if (!window.confirm('Are you sure you want to delete this issue?')) return;
    try {
      const issueToDelete = issues.find(i => i.id === issueId);
      await deleteDoc(doc(db, `projects/${projectId}/issues`, issueId));

      await logActivity(
        organization.id,
        issueId,
        'issue',
        'Issue Deleted',
        `Issue "${issueToDelete?.title || issueId}" was deleted by ${currentUser.displayName}`
      );

      toast.success('Issue deleted');
    } catch (error) {
      toast.error('Failed to delete issue');
    }
  };

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         issue.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'All' || issue.statusId === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search issues..."
            className="w-full pl-12 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-400" />
          <select 
            className="bg-gray-50 border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="All">All Status</option>
            {issueStatuses.map(status => (
              <option key={status.id} value={status.id}>{status.name}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={() => {
            setEditingIssue(null);
            setNewIssue({ title: '', description: '', priority: 'Medium', statusId: issueStatuses[0]?.id || '', assignedUserId: '', taskId: '' });
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all flex items-center gap-2 ml-auto"
        >
          <Plus size={18} />
          Report Issue
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Issue Title</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Assignee</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Linked Task</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredIssues.map((issue) => (
              <IssueRow 
                key={issue.id} 
                issue={issue} 
                members={projectMembers}
                tasks={tasks}
                statuses={issueStatuses}
                onEdit={() => {
                  setEditingIssue(issue);
                  setNewIssue({ 
                    title: issue.title, 
                    description: issue.description || '', 
                    priority: issue.priority, 
                    statusId: issue.statusId || '', 
                    assignedUserId: issue.assignedUserId || '',
                    taskId: issue.taskId || ''
                  });
                  setIsModalOpen(true);
                }}
                onDelete={() => handleDeleteIssue(issue.id)}
              />
            ))}
            {filteredIssues.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">No issues found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{editingIssue ? 'Edit Issue' : 'Report New Issue'}</h2>
              <form onSubmit={handleCreateOrUpdateIssue} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Title</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="Enter issue title"
                      value={newIssue.title}
                      onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                    <textarea 
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="Describe the issue..."
                      value={newIssue.description}
                      onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Priority</label>
                    <select 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={newIssue.priority}
                      onChange={(e) => setNewIssue({ ...newIssue, priority: e.target.value as TaskPriority })}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
                    <select 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={newIssue.statusId}
                      onChange={(e) => setNewIssue({ ...newIssue, statusId: e.target.value })}
                    >
                      {issueStatuses.map(status => (
                        <option key={status.id} value={status.id}>{status.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Assignee</label>
                    <select 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={newIssue.assignedUserId}
                      onChange={(e) => setNewIssue({ ...newIssue, assignedUserId: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {projectMembers.map(m => (
                        <option key={m.uid} value={m.uid}>{m.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Linked Task</label>
                    <select 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={newIssue.taskId}
                      onChange={(e) => setNewIssue({ ...newIssue, taskId: e.target.value })}
                    >
                      <option value="">No Task Linked</option>
                      {tasks.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                  >
                    {editingIssue ? 'Update Issue' : 'Report Issue'}
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

const IssueRow: React.FC<{ 
  issue: Issue; 
  members: User[];
  tasks: Task[];
  statuses: TaskStatusConfig[];
  onEdit: () => void;
  onDelete: () => void;
}> = ({ issue, members, tasks, statuses, onEdit, onDelete }) => {
  const assignee = members.find(m => m.uid === issue.assignedUserId);
  const task = tasks.find(t => t.id === issue.taskId);
  const status = statuses.find(s => s.id === issue.statusId);

  return (
    <tr className="hover:bg-gray-50/50 transition-colors group">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500" />
          <span className="text-sm font-bold text-gray-900">{issue.title}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <Circle size={8} fill={status?.color || '#9ca3af'} className="text-transparent" />
          <span className="text-xs font-bold text-gray-700">{status?.name || 'Unknown'}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          issue.priority === 'High' ? 'bg-red-50 text-red-600' :
          issue.priority === 'Medium' ? 'bg-amber-50 text-amber-600' :
          'bg-blue-50 text-blue-600'
        }`}>
          {issue.priority}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {assignee ? (
            <>
              <img src={assignee.photoURL || `https://ui-avatars.com/api/?name=${assignee.displayName}`} className="w-6 h-6 rounded-full" alt="" />
              <span className="text-xs font-medium text-gray-600">{assignee.displayName}</span>
            </>
          ) : (
            <span className="text-xs text-gray-400 italic">Unassigned</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        {task ? (
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{task.name}</span>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
            <Edit2 size={16} />
          </button>
          <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default IssueTracker;
