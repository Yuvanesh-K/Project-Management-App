import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, deleteDoc, doc, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { useSettings } from '../../SettingsContext';
import { Task, TaskPriority, Subtask, Comment, TimeLog, User, Project, TaskStatusConfig } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestore-errors';
import { 
  Plus, 
  MoreVertical, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronRight,
  MessageSquare,
  Paperclip,
  History,
  Trash2,
  Edit2,
  CheckSquare,
  User as UserIcon,
  Tag as TagIcon,
  Circle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { logActivity } from '../../lib/firestore-utils';

interface TaskListProps {
  projectId: string;
}

const TaskList: React.FC<TaskListProps> = ({ projectId }) => {
  const { user, organization } = useAuth();
  const { orgSettings, taskStatuses } = useSettings();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [groupBy, setGroupBy] = useState<'status' | 'priority' | 'assignedUserId' | 'none'>('none');
  
  const [newTask, setNewTask] = useState({ 
    name: '', 
    description: '', 
    priority: orgSettings?.projectDefaults?.defaultPriority || 'Medium' as TaskPriority,
    statusId: '',
    assignedUserId: orgSettings?.projectDefaults?.autoAssignOwner ? user?.uid || '' : '',
    completionPercentage: 0,
    tags: [] as string[]
  });

  useEffect(() => {
    if (taskStatuses.length > 0 && !newTask.statusId) {
      setNewTask(prev => ({ 
        ...prev, 
        statusId: taskStatuses[0].id,
        priority: orgSettings?.projectDefaults?.defaultPriority || prev.priority,
        assignedUserId: prev.assignedUserId || (orgSettings?.projectDefaults?.autoAssignOwner ? user?.uid || '' : '')
      }));
    }
  }, [taskStatuses, orgSettings, user]);

  useEffect(() => {
    if (!projectId) return;

    const q = query(collection(db, `projects/${projectId}/tasks`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => handleFirestoreError(error, OperationType.GET, `projects/${projectId}/tasks`));

    const projectRef = doc(db, 'projects', projectId);
    const unsubProject = onSnapshot(projectRef, async (projectDoc) => {
      if (projectDoc.exists()) {
        const projectData = projectDoc.data() as Project;
        const memberIds = projectData.members || [];
        
        if (memberIds.length > 0) {
          const usersQuery = query(collection(db, 'users'), where('uid', 'in', memberIds.slice(0, 10)));
          const usersSnap = await getDocs(usersQuery);
          setProjectMembers(usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
        } else {
          setProjectMembers([]);
        }
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `projects/${projectId}`));

    return () => {
      unsubscribe();
      unsubProject();
    };
  }, [projectId, organization]);

  const handleCreateOrUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !organization) return;

    try {
      if (editingTask) {
        const taskRef = doc(db, 'projects', projectId, 'tasks', editingTask.id);
        await updateDoc(taskRef, {
          ...newTask,
          updatedAt: serverTimestamp(),
        });
        
        await logActivity(
          organization.id,
          editingTask.id,
          'task',
          'Task Updated',
          `Task "${newTask.name}" was updated by ${user?.displayName}`
        );

        toast.success('Task updated successfully!');
      } else {
        const docRef = await addDoc(collection(db, `projects/${projectId}/tasks`), {
          ...newTask,
          projectId,
          organizationId: organization.id,
          isBilled: false,
          createdAt: serverTimestamp(),
        });

        await logActivity(
          organization.id,
          docRef.id,
          'task',
          'Task Created',
          `Task "${newTask.name}" was created by ${user?.displayName}`
        );

        toast.success('Task created successfully!');
      }
      setIsModalOpen(false);
      setEditingTask(null);
      setNewTask({ name: '', description: '', priority: 'Medium', statusId: taskStatuses[0]?.id || '', assignedUserId: '', completionPercentage: 0, tags: [] });
    } catch (error) {
      toast.error('Failed to save task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteDoc(doc(db, `projects/${projectId}/tasks`, taskId));
      toast.success('Task deleted');
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'All' || task.statusId === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const groupedTasks = (): Record<string, Task[]> => {
    if (groupBy === 'none') return { 'All Tasks': filteredTasks };
    
    return filteredTasks.reduce((acc: Record<string, Task[]>, task) => {
      let key = '';
      if (groupBy === 'status') {
        const status = taskStatuses.find(s => s.id === task.statusId);
        key = status ? status.name : 'Unknown';
      }
      else if (groupBy === 'priority') key = task.priority;
      else if (groupBy === 'assignedUserId') {
        const user = projectMembers.find(m => m.uid === task.assignedUserId);
        key = user ? user.displayName : 'Unassigned';
      }
      
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {});
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search tasks..."
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
            {taskStatuses.map(status => (
              <option key={status.id} value={status.id}>{status.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 font-medium">Group by:</span>
          <select 
            className="bg-gray-50 border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
          >
            <option value="none">None</option>
            <option value="status">Status</option>
            <option value="priority">Priority</option>
            <option value="assignedUserId">Assigned User</option>
          </select>
        </div>

        <button 
          onClick={() => {
            setEditingTask(null);
            setNewTask({ name: '', description: '', priority: 'Medium', statusId: taskStatuses[0]?.id || '', assignedUserId: '', completionPercentage: 0, tags: [] });
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 ml-auto"
        >
          <Plus size={18} />
          Add Task
        </button>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedTasks()).map(([groupName, groupTasks]) => (
          <div key={groupName} className="space-y-4">
            {groupBy !== 'none' && (
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 px-2">
                <ChevronDown size={18} className="text-gray-400" />
                {groupName}
                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{groupTasks.length}</span>
              </h3>
            )}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Task Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Assignee</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {groupTasks.map((task) => (
                    <TaskRow 
                      key={task.id} 
                      task={task} 
                      projectId={projectId}
                      members={projectMembers}
                      statuses={taskStatuses}
                      onEdit={() => {
                        setEditingTask(task);
                        setNewTask({ 
                          name: task.name, 
                          description: task.description || '', 
                          priority: task.priority, 
                          statusId: task.statusId, 
                          assignedUserId: task.assignedUserId || '',
                          completionPercentage: task.completionPercentage || 0,
                          tags: task.tags || []
                        });
                        setIsModalOpen(true);
                      }}
                      onDelete={() => handleDeleteTask(task.id)}
                    />
                  ))}
                  {groupTasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">No tasks found in this group.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{editingTask ? 'Edit Task' : 'Add New Task'}</h2>
              <form onSubmit={handleCreateOrUpdateTask} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Task Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="Enter task name"
                      value={newTask.name}
                      onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                    <textarea 
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="What needs to be done?"
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Priority</label>
                    <select 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as TaskPriority })}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
                    <select 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={newTask.statusId}
                      onChange={(e) => setNewTask({ ...newTask, statusId: e.target.value })}
                    >
                      {taskStatuses.map(status => (
                        <option key={status.id} value={status.id}>{status.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Assignee</label>
                    <select 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={newTask.assignedUserId}
                      onChange={(e) => setNewTask({ ...newTask, assignedUserId: e.target.value })}
                    >
                      <option value="">Unassigned</option>
                      {projectMembers.map(m => (
                        <option key={m.uid} value={m.uid}>{m.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Progress ({newTask.completionPercentage}%)</label>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      step="5"
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-4"
                      value={newTask.completionPercentage}
                      onChange={(e) => setNewTask({ ...newTask, completionPercentage: parseInt(e.target.value) })}
                    />
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
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    {editingTask ? 'Update Task' : 'Create Task'}
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

const TaskRow: React.FC<{ 
  task: Task; 
  projectId: string; 
  members: User[];
  statuses: TaskStatusConfig[];
  onEdit: () => void;
  onDelete: () => void;
}> = ({ task, projectId, members, statuses, onEdit, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const assignee = members.find(m => m.uid === task.assignedUserId);
  const status = statuses.find(s => s.id === task.statusId);

  return (
    <>
      <tr className="hover:bg-gray-50/50 transition-colors group">
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <span className="text-sm font-bold text-gray-900">{task.name}</span>
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
            task.priority === 'High' ? 'bg-red-50 text-red-600' :
            task.priority === 'Critical' ? 'bg-red-600 text-white' :
            task.priority === 'Medium' ? 'bg-amber-50 text-amber-600' :
            'bg-blue-50 text-blue-600'
          }`}>
            {task.priority}
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
          <div className="flex items-center gap-3">
            <div className="flex-1 w-24 bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${task.completionPercentage === 100 ? 'bg-green-500' : 'bg-indigo-600'}`} 
                style={{ width: `${task.completionPercentage}%` }} 
              />
            </div>
            <span className="text-[10px] font-bold text-gray-500">{task.completionPercentage}%</span>
          </div>
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
      <AnimatePresence>
        {isExpanded && (
          <tr>
            <td colSpan={6} className="px-6 py-4 bg-gray-50/30">
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <TaskDetails taskId={task.id} projectId={projectId} />
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
};

const TaskDetails: React.FC<{ taskId: string; projectId: string }> = ({ taskId, projectId }) => {
  const [activeTab, setActiveTab] = useState<'subtasks' | 'comments' | 'timeLogs'>('subtasks');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [newInput, setNewInput] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const { user, organization } = useAuth();
  const { orgSettings } = useSettings();

  useEffect(() => {
    const unsubSubtasks = onSnapshot(query(collection(db, `projects/${projectId}/tasks/${taskId}/subtasks`), orderBy('createdAt', 'asc')), (snapshot) => {
      setSubtasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subtask)));
    });
    const unsubComments = onSnapshot(query(collection(db, `projects/${projectId}/tasks/${taskId}/comments`), orderBy('createdAt', 'desc')), (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
    });
    const unsubTimeLogs = onSnapshot(query(collection(db, `projects/${projectId}/tasks/${taskId}/timeLogs`), orderBy('createdAt', 'desc')), (snapshot) => {
      setTimeLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeLog)));
    });

    return () => {
      unsubSubtasks();
      unsubComments();
      unsubTimeLogs();
    };
  }, [taskId, projectId]);

  const updateTaskPercentage = async (currentSubtasks: Subtask[]) => {
    if (currentSubtasks.length === 0) return;
    const completed = currentSubtasks.filter(s => s.status === 'Completed').length;
    const percentage = Math.round((completed / currentSubtasks.length) * 100);
    await updateDoc(doc(db, `projects/${projectId}/tasks`, taskId), {
      completionPercentage: percentage
    });
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInput.trim()) return;
    try {
      await addDoc(collection(db, `projects/${projectId}/tasks/${taskId}/subtasks`), {
        name: newInput,
        status: 'To Do',
        createdAt: serverTimestamp()
      });

      await logActivity(
        organization.id,
        taskId,
        'task',
        'Subtask Added',
        `Subtask "${newInput}" was added to task by ${user?.displayName}`
      );

      setNewInput('');
      // Percentage will be updated by the onSnapshot listener if we wanted to be reactive, 
      // but for immediate feedback we can do it here or let the listener handle it.
    } catch (error) { toast.error('Failed to add subtask'); }
  };

  const toggleSubtask = async (subtask: Subtask) => {
    try {
      const newStatus = subtask.status === 'Completed' ? 'To Do' : 'Completed';
      await updateDoc(doc(db, `projects/${projectId}/tasks/${taskId}/subtasks`, subtask.id), {
        status: newStatus
      });
      
      await logActivity(
        organization.id,
        taskId,
        'task',
        'Subtask Updated',
        `Subtask "${subtask.name}" was marked as ${newStatus} by ${user?.displayName}`
      );

      const updatedSubtasks = subtasks.map(s => s.id === subtask.id ? { ...s, status: newStatus } : s);
      await updateTaskPercentage(updatedSubtasks);
    } catch (error) { toast.error('Failed to update subtask'); }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInput.trim() || !user) return;
    try {
      await addDoc(collection(db, `projects/${projectId}/tasks/${taskId}/comments`), {
        content: newInput,
        userId: user.uid,
        targetId: taskId,
        targetType: 'task',
        createdAt: serverTimestamp()
      });

      await logActivity(
        organization.id,
        taskId,
        'task',
        'Comment Added',
        `A comment was added to the task by ${user.displayName}`
      );

      setNewInput('');
    } catch (error) { toast.error('Failed to add comment'); }
  };

  const handleAddTimeLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const hours = parseFloat(newInput);
    if (isNaN(hours) || !user || !organization) return;
    try {
      await addDoc(collection(db, `projects/${projectId}/tasks/${taskId}/timeLogs`), {
        hours,
        description: newDescription,
        userId: user.uid,
        taskId,
        projectId,
        organizationId: organization.id,
        date: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      await logActivity(
        organization.id,
        taskId,
        'task',
        'Time Logged',
        `${hours} hours were logged on the task by ${user.displayName}${newDescription ? `: ${newDescription}` : ''}`
      );

      setNewInput('');
      setNewDescription('');
      toast.success('Time logged');
    } catch (error) { 
      console.error("Error logging time:", error);
      toast.error('Failed to log time'); 
    }
  };

  return (
    <div className="p-6 bg-white rounded-2xl border border-gray-100">
      <div className="flex gap-6 mb-6 border-b border-gray-50">
        <button 
          onClick={() => { setActiveTab('subtasks'); setNewInput(''); }}
          className={`pb-3 text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'subtasks' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <CheckSquare size={16} /> Subtasks ({subtasks.length})
        </button>
        <button 
          onClick={() => { setActiveTab('comments'); setNewInput(''); }}
          className={`pb-3 text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'comments' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <MessageSquare size={16} /> Comments ({comments.length})
        </button>
        {orgSettings?.enabledModules?.timeLogs && (
          <button 
            onClick={() => { setActiveTab('timeLogs'); setNewInput(''); }}
            className={`pb-3 text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'timeLogs' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <History size={16} /> Time Logs ({timeLogs.reduce((acc, l) => acc + l.hours, 0)}h)
          </button>
        )}
      </div>

      <div className="space-y-4">
        {activeTab === 'subtasks' && (
          <>
            <form onSubmit={handleAddSubtask} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Add a subtask..."
                className="flex-1 px-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                value={newInput}
                onChange={(e) => setNewInput(e.target.value)}
              />
              <button type="submit" className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all">
                <Plus size={18} />
              </button>
            </form>
            <div className="space-y-2">
              {subtasks.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg group">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleSubtask(s)}
                      className={`p-1 rounded-md transition-all ${s.status === 'Completed' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <span className={`text-sm ${s.status === 'Completed' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{s.name}</span>
                  </div>
                  <button 
                    onClick={async () => {
                      await deleteDoc(doc(db, `projects/${projectId}/tasks/${taskId}/subtasks`, s.id));
                      const remaining = subtasks.filter(sub => sub.id !== s.id);
                      updateTaskPercentage(remaining);
                    }}
                    className="p-1 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'comments' && (
          <>
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Write a comment..."
                className="flex-1 px-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                value={newInput}
                onChange={(e) => setNewInput(e.target.value)}
              />
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-bold">
                Post
              </button>
            </form>
            <div className="space-y-4">
              {comments.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                    {c.userId.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 bg-gray-50 p-3 rounded-2xl">
                    <p className="text-sm text-gray-700">{c.content}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{c.createdAt ? format(c.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'timeLogs' && (
          <>
            <form onSubmit={handleAddTimeLog} className="space-y-3">
              <div className="flex gap-2">
                <input 
                  type="number" 
                  step="0.5"
                  required
                  placeholder="Hours..."
                  className="w-24 px-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  value={newInput}
                  onChange={(e) => setNewInput(e.target.value)}
                />
                <input 
                  type="text" 
                  placeholder="What did you work on?"
                  className="flex-1 px-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-bold">
                  Log
                </button>
              </div>
            </form>
            <div className="space-y-2">
              {timeLogs.map(l => (
                <div key={l.id} className="p-3 bg-gray-50 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock size={16} className="text-gray-400" />
                      <span className="text-sm font-bold text-gray-700">{l.hours} hours</span>
                    </div>
                    <span className="text-[10px] text-gray-400">{l.createdAt ? format(l.createdAt.toDate(), 'MMM d, yyyy') : 'Just now'}</span>
                  </div>
                  {l.description && (
                    <p className="text-xs text-gray-500 pl-7">{l.description}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TaskList;
