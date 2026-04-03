import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { Milestone, Task } from '../../types';
import { 
  Plus, 
  Flag, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Edit2, 
  ChevronDown, 
  ChevronRight,
  ListTodo
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { logActivity } from '../../lib/firestore-utils';

interface MilestoneManagerProps {
  projectId: string;
}

const MilestoneManager: React.FC<MilestoneManagerProps> = ({ projectId }) => {
  const { organization, user } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  
  const [newMilestone, setNewMilestone] = useState({ 
    name: '', 
    dueDate: '', 
    status: 'Pending' as 'Pending' | 'Completed'
  });

  useEffect(() => {
    if (!projectId) return;

    const q = query(collection(db, `projects/${projectId}/milestones`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMilestones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Milestone)));
    });

    const tasksQuery = query(collection(db, `projects/${projectId}/tasks`));
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });

    return () => {
      unsubscribe();
      unsubTasks();
    };
  }, [projectId]);

  const handleCreateOrUpdateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !organization) return;

    try {
      const milestoneData = {
        ...newMilestone,
        dueDate: newMilestone.dueDate ? new Date(newMilestone.dueDate) : null,
      };

      if (editingMilestone) {
        await updateDoc(doc(db, `projects/${projectId}/milestones`, editingMilestone.id), {
          ...milestoneData,
          updatedAt: serverTimestamp(),
        });

        await logActivity(
          organization.id,
          editingMilestone.id,
          'milestone',
          'Milestone Updated',
          `Milestone "${milestoneData.name}" was updated by ${user?.displayName || 'User'}`
        );

        toast.success('Milestone updated successfully!');
      } else {
        const docRef = await addDoc(collection(db, `projects/${projectId}/milestones`), {
          ...milestoneData,
          projectId,
          organizationId: organization.id,
          createdAt: serverTimestamp(),
        });

        await logActivity(
          organization.id,
          docRef.id,
          'milestone',
          'Milestone Created',
          `New milestone "${milestoneData.name}" was created by ${user?.displayName || 'User'}`
        );

        toast.success('Milestone created successfully!');
      }
      setIsModalOpen(false);
      setEditingMilestone(null);
      setNewMilestone({ name: '', dueDate: '', status: 'Pending' });
    } catch (error) {
      toast.error('Failed to save milestone');
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!organization) return;
    if (!window.confirm('Are you sure you want to delete this milestone?')) return;
    try {
      const milestoneToDelete = milestones.find(m => m.id === milestoneId);
      await deleteDoc(doc(db, `projects/${projectId}/milestones`, milestoneId));

      await logActivity(
        organization.id,
        milestoneId,
        'milestone',
        'Milestone Deleted',
        `Milestone "${milestoneToDelete?.name || milestoneId}" was deleted by ${user?.displayName || 'User'}`
      );

      toast.success('Milestone deleted');
    } catch (error) {
      toast.error('Failed to delete milestone');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Project Milestones</h3>
          <p className="text-sm text-gray-500">Track key project phases and their progress.</p>
        </div>
        <button 
          onClick={() => {
            setEditingMilestone(null);
            setNewMilestone({ name: '', dueDate: '', status: 'Pending' });
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
        >
          <Plus size={18} />
          Add Milestone
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {milestones.map((milestone) => (
          <MilestoneCard 
            key={milestone.id} 
            milestone={milestone} 
            tasks={tasks.filter(t => t.milestoneId === milestone.id)}
            onEdit={() => {
              setEditingMilestone(milestone);
              setNewMilestone({ 
                name: milestone.name, 
                dueDate: milestone.dueDate ? format(milestone.dueDate.toDate(), 'yyyy-MM-dd') : '', 
                status: milestone.status 
              });
              setIsModalOpen(true);
            }}
            onDelete={() => handleDeleteMilestone(milestone.id)}
          />
        ))}
        {milestones.length === 0 && (
          <div className="bg-white p-12 rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">
            No milestones defined for this project yet.
          </div>
        )}
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{editingMilestone ? 'Edit Milestone' : 'Add New Milestone'}</h2>
              <form onSubmit={handleCreateOrUpdateMilestone} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Milestone Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="e.g. Design Phase, MVP Release"
                    value={newMilestone.name}
                    onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Due Date</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={newMilestone.dueDate}
                    onChange={(e) => setNewMilestone({ ...newMilestone, dueDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
                  <select 
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={newMilestone.status}
                    onChange={(e) => setNewMilestone({ ...newMilestone, status: e.target.value as any })}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                  </select>
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
                    {editingMilestone ? 'Update Milestone' : 'Create Milestone'}
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

const MilestoneCard: React.FC<{ 
  milestone: Milestone; 
  tasks: Task[];
  onEdit: () => void;
  onDelete: () => void;
}> = ({ milestone, tasks, onEdit, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const completedTasks = tasks.filter(t => t.status === 'Done').length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className={`p-3 rounded-2xl ${milestone.status === 'Completed' ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}>
            <Flag size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h4 className="text-lg font-bold text-gray-900">{milestone.name}</h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${milestone.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {milestone.status}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock size={12} />
                Due: {milestone.dueDate ? format(milestone.dueDate.toDate(), 'MMM d, yyyy') : 'No date'}
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <ListTodo size={12} />
                {tasks.length} Tasks
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">{progress}%</p>
            <div className="w-24 bg-gray-100 h-1.5 rounded-full overflow-hidden mt-1">
              <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
            >
              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>
            <button onClick={onEdit} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
              <Edit2 size={18} />
            </button>
            <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-50 bg-gray-50/30 overflow-hidden"
          >
            <div className="p-6 space-y-3">
              <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Linked Tasks</h5>
              {tasks.length > 0 ? tasks.map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${task.status === 'Done' ? 'bg-green-500' : 'bg-amber-500'}`} />
                    <span className="text-sm font-medium text-gray-700">{task.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">{task.status}</span>
                </div>
              )) : (
                <p className="text-sm text-gray-400 italic">No tasks linked to this milestone.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MilestoneManager;
