import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, collectionGroup } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { useSettings } from '../SettingsContext';
import { Task, TaskPriority } from '../types';
import { Plus, MoreVertical, Clock, AlertCircle, CheckCircle2, Search, Filter, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface TaskBoardProps {
  projectId?: string;
  myTasksOnly?: boolean;
}

const TaskBoard: React.FC<TaskBoardProps> = ({ projectId, myTasksOnly }) => {
  const { user, organization } = useAuth();
  const { taskStatuses, orgSettings } = useSettings();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ 
    name: '', 
    description: '', 
    priority: orgSettings?.projectDefaults?.defaultPriority || 'Medium' as TaskPriority,
    statusId: '',
    assignedUserId: orgSettings?.projectDefaults?.autoAssignOwner ? user?.uid || '' : '',
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
    if (!organization) return;

    let q;
    if (projectId) {
      q = query(collection(db, `projects/${projectId}/tasks`));
    } else if (myTasksOnly) {
      q = query(
        collectionGroup(db, 'tasks'),
        where('organizationId', '==', organization.id),
        where('assignedUserId', '==', user?.uid)
      );
    } else {
      q = query(
        collectionGroup(db, 'tasks'),
        where('organizationId', '==', organization.id)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });

    return () => unsubscribe();
  }, [projectId, organization]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !organization) return;

    try {
      await addDoc(collection(db, `projects/${projectId}/tasks`), {
        ...newTask,
        projectId,
        organizationId: organization.id,
        completionPercentage: 0,
        isBilled: false,
        createdAt: serverTimestamp(),
      });
      setIsModalOpen(false);
      setNewTask({ name: '', description: '', priority: 'Medium', statusId: taskStatuses[0]?.id || '' });
      toast.success('Task created successfully!');
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const updateTaskStatus = async (task: Task, newStatusId: string) => {
    if (!task.projectId || !task.id) return;
    try {
      await updateDoc(doc(db, `projects/${task.projectId}/tasks`, task.id), {
        statusId: newStatusId
      });
      toast.success('Status updated');
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error('Failed to update task');
    }
  };

  return (
    <div className="space-y-6">
      {!projectId && (
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              {myTasksOnly ? 'My Tasks' : 'All Tasks'}
            </h1>
            <p className="text-gray-500 mt-1">
              {myTasksOnly 
                ? 'Tasks assigned specifically to you.' 
                : 'Manage tasks across all projects in your organization.'}
            </p>
          </div>
        </header>
      )}

      <div className="flex gap-4 items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search tasks..."
            className="w-full pl-12 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
          />
        </div>
        <button className="p-2 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">
          <Filter size={20} />
        </button>
        {projectId && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            Add Task
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-x-auto pb-4">
        {taskStatuses.map((status) => (
          <div key={status.id} className="flex flex-col gap-4 min-w-[300px]">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Circle size={12} fill={status.color} className="text-transparent" />
                <h3 className="font-bold text-gray-900">{status.name}</h3>
                <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {tasks.filter(t => t.statusId === status.id).length}
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-[500px] bg-gray-100/50 rounded-3xl p-4 space-y-4">
              {tasks.filter(t => t.statusId === status.id).map((task) => (
                <motion.div
                  layout
                  key={task.id}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      task.priority === 'High' ? 'bg-red-50 text-red-600' :
                      task.priority === 'Critical' ? 'bg-red-600 text-white' :
                      task.priority === 'Medium' ? 'bg-amber-50 text-amber-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {task.priority}
                    </span>
                    <button className="p-1 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical size={14} />
                    </button>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-2">{task.name}</h4>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-4">{task.description}</p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <div className="flex -space-x-1">
                      <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-200" />
                    </div>
                    <div className="flex items-center gap-2">
                      {status.type !== 'Completed' && (
                        <div className="flex gap-1">
                          {taskStatuses.filter(s => s.id !== status.id).slice(0, 2).map(nextStatus => (
                            <button 
                              key={nextStatus.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateTaskStatus(task, nextStatus.id);
                              }}
                              className="p-1.5 bg-gray-50 text-gray-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                              title={`Move to ${nextStatus.name}`}
                            >
                              <CheckCircle2 size={14} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
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
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 overflow-hidden"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Task</h2>
              <form onSubmit={handleCreateTask} className="space-y-6">
                <div>
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
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                  <textarea 
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="What needs to be done?"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                    Add Task
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

export default TaskBoard;
