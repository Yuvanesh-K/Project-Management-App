import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc, serverTimestamp, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { useSettings } from '../SettingsContext';
import { OrganizationSettings, TaskStatusConfig, UserPreferences, Invitation, UserRole, TaskPriority } from '../types';
import { 
  Settings, 
  User as UserIcon, 
  Bell, 
  Palette, 
  Layout, 
  Shield, 
  Users, 
  Plus, 
  Trash2, 
  GripVertical,
  Save,
  Mail,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Globe,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { logActivity } from '../lib/firestore-utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableStatusItemProps {
  status: TaskStatusConfig;
  onUpdate: (id: string, updates: Partial<TaskStatusConfig>) => void;
  onDelete: (id: string) => void;
}

const SortableStatusItem: React.FC<SortableStatusItemProps> = ({ status, onUpdate, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: status.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl group border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/30 transition-all"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
        <GripVertical size={18} className="text-gray-400" />
      </div>
      <input 
        type="color" 
        className="w-8 h-8 rounded-lg border-none bg-transparent cursor-pointer"
        value={status.color}
        onChange={(e) => onUpdate(status.id, { color: e.target.value })}
      />
      <input 
        type="text" 
        className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-gray-900 dark:text-gray-100"
        value={status.name}
        onChange={(e) => onUpdate(status.id, { name: e.target.value })}
      />
      <select 
        className="bg-white dark:bg-gray-900 border-none rounded-xl px-3 py-1 text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-gray-100"
        value={status.type}
        onChange={(e) => onUpdate(status.id, { type: e.target.value as any })}
      >
        <option value="Open">Open</option>
        <option value="InProgress">In Progress</option>
        <option value="Completed">Completed</option>
      </select>
      <button 
        onClick={() => onDelete(status.id)}
        className="p-2 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
};

const OrganizationSettingsView: React.FC = () => {
  const { user, organization, isOwner, isAdmin } = useAuth();
  const { orgSettings, taskStatuses, issueStatuses, userPreferences, loading } = useSettings();
  const [activeSection, setActiveSection] = useState('personal');
  const [isSaving, setIsSaving] = useState(false);
  
  // Local states for editing
  const [localOrgSettings, setLocalOrgSettings] = useState<OrganizationSettings | null>(null);
  const [localUserPrefs, setLocalUserPrefs] = useState<UserPreferences | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [newInvite, setNewInvite] = useState({ email: '', role: 'member' as UserRole });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (orgSettings) setLocalOrgSettings(orgSettings);
  }, [orgSettings]);

  // Apply theme and color changes instantly in UI
  useEffect(() => {
    if (!localOrgSettings) return;
    
    // Apply theme
    if (localOrgSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Apply primary color
    document.documentElement.style.setProperty('--primary-color', localOrgSettings.primaryColor || '#4f46e5');
  }, [localOrgSettings?.theme, localOrgSettings?.primaryColor]);

  useEffect(() => {
    if (userPreferences) setLocalUserPrefs(userPreferences);
  }, [userPreferences]);

  useEffect(() => {
    if (!organization) return;
    const q = query(collection(db, 'invitations'), where('organizationId', '==', organization.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInvitations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation)));
    });
    return unsubscribe;
  }, [organization]);

  const handleSaveOrgSettings = async () => {
    if (!organization || !localOrgSettings) return;
    setIsSaving(true);
    try {
      const { id, ...data } = localOrgSettings;
      await updateDoc(doc(db, 'organizationSettings', organization.id), {
        ...data,
        updatedAt: serverTimestamp()
      });
      
      await logActivity(
        organization.id,
        organization.id,
        'organization',
        'Organization Settings Updated',
        `Organization settings were updated by ${user?.displayName || 'Admin'}`
      );

      toast.success('Organization settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveUserPrefs = async () => {
    if (!user || !localUserPrefs) return;
    setIsSaving(true);
    try {
      const { uid, ...data } = localUserPrefs;
      await updateDoc(doc(db, 'userPreferences', user.uid), {
        ...data,
        updatedAt: serverTimestamp()
      });

      await logActivity(
        organization.id,
        user.uid,
        'user',
        'User Preferences Updated',
        `Personal preferences were updated by ${user.displayName}`
      );

      toast.success('Personal preferences saved');
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStatus = async () => {
    if (!organization || !user) return;
    try {
      const docRef = await addDoc(collection(db, 'taskStatuses'), {
        name: 'New Status',
        color: '#9ca3af',
        type: 'Open',
        order: taskStatuses.length,
        organizationId: organization.id,
        createdAt: serverTimestamp()
      });

      await logActivity(
        organization.id,
        docRef.id,
        'taskStatus',
        'Task Status Added',
        `New task status "New Status" was added by ${user.displayName}`
      );

      toast.success('Status added');
    } catch (error) {
      toast.error('Failed to add status');
    }
  };

  const handleUpdateStatus = async (id: string, updates: Partial<TaskStatusConfig>) => {
    if (!organization || !user) return;
    try {
      await updateDoc(doc(db, 'taskStatuses', id), updates);
      
      if (updates.name) {
        await logActivity(
          organization.id,
          id,
          'taskStatus',
          'Task Status Updated',
          `Task status was updated to "${updates.name}" by ${user.displayName}`
        );
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteStatus = async (id: string) => {
    if (!organization || !user) return;
    if (taskStatuses.length <= 1) {
      toast.error('You must have at least one status');
      return;
    }
    try {
      const statusToDelete = taskStatuses.find(s => s.id === id);
      await deleteDoc(doc(db, 'taskStatuses', id));

      await logActivity(
        organization.id,
        id,
        'taskStatus',
        'Task Status Deleted',
        `Task status "${statusToDelete?.name || id}" was deleted by ${user.displayName}`
      );

      toast.success('Status deleted');
    } catch (error) {
      toast.error('Failed to delete status');
    }
  };

  const handleAddIssueStatus = async () => {
    if (!organization || !user) return;
    try {
      const docRef = await addDoc(collection(db, 'issueStatuses'), {
        name: 'New Issue Status',
        color: '#ef4444',
        type: 'Open',
        order: issueStatuses.length,
        organizationId: organization.id,
        createdAt: serverTimestamp()
      });

      await logActivity(
        organization.id,
        docRef.id,
        'issueStatus',
        'Issue Status Added',
        `New issue status "New Issue Status" was added by ${user.displayName}`
      );

      toast.success('Issue status added');
    } catch (error) {
      toast.error('Failed to add status');
    }
  };

  const handleUpdateIssueStatus = async (id: string, updates: Partial<TaskStatusConfig>) => {
    if (!organization || !user) return;
    try {
      await updateDoc(doc(db, 'issueStatuses', id), updates);
      
      if (updates.name) {
        await logActivity(
          organization.id,
          id,
          'issueStatus',
          'Issue Status Updated',
          `Issue status was updated to "${updates.name}" by ${user.displayName}`
        );
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteIssueStatus = async (id: string) => {
    if (!organization || !user) return;
    if (issueStatuses.length <= 1) {
      toast.error('You must have at least one issue status');
      return;
    }
    try {
      const statusToDelete = issueStatuses.find(s => s.id === id);
      await deleteDoc(doc(db, 'issueStatuses', id));

      await logActivity(
        organization.id,
        id,
        'issueStatus',
        'Issue Status Deleted',
        `Issue status "${statusToDelete?.name || id}" was deleted by ${user.displayName}`
      );

      toast.success('Status deleted');
    } catch (error) {
      toast.error('Failed to delete status');
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !user) return;
    try {
      const docRef = await addDoc(collection(db, 'invitations'), {
        ...newInvite,
        organizationId: organization.id,
        organizationName: organization.name,
        status: 'Pending',
        invitedBy: user.uid,
        token: Math.random().toString(36).substring(2, 15),
        createdAt: serverTimestamp()
      });

      await logActivity(
        organization.id,
        docRef.id,
        'invitation',
        'User Invited',
        `Invitation sent to ${newInvite.email} by ${user.displayName}`
      );

      setNewInvite({ email: '', role: 'member' });
      toast.success('Invitation sent');
    } catch (error) {
      toast.error('Failed to send invitation');
    }
  };

  const handleResendInvite = async (invitation: Invitation) => {
    if (!organization || !user) return;
    try {
      await updateDoc(doc(db, 'invitations', invitation.id), {
        createdAt: serverTimestamp(),
        status: 'Pending'
      });

      await logActivity(
        organization.id,
        invitation.id,
        'invitation',
        'Invitation Resent',
        `Invitation to ${invitation.email} was resent by ${user.displayName}`
      );

      toast.success('Invitation resent');
    } catch (error) {
      toast.error('Failed to resend invitation');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      if (!organization?.id) {
        toast.error('Organization ID is missing');
        return;
      }

      const oldIndex = taskStatuses.findIndex((s) => s.id === active.id);
      const newIndex = taskStatuses.findIndex((s) => s.id === over.id);
      
      const newStatuses = arrayMove(taskStatuses, oldIndex, newIndex);
      
      try {
        const response = await fetch('/api/task-statuses/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            statuses: newStatuses,
            organizationId: organization.id
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || errorData.error || 'Failed to reorder');
        }
        toast.success('Status order updated');
      } catch (error) {
        console.error('Failed to save task status order:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to save status order');
      }
    }
  };

  const handleIssueDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      if (!organization?.id) {
        toast.error('Organization ID is missing');
        return;
      }

      const oldIndex = issueStatuses.findIndex((s) => s.id === active.id);
      const newIndex = issueStatuses.findIndex((s) => s.id === over.id);
      
      const newStatuses = arrayMove(issueStatuses, oldIndex, newIndex);
      
      try {
        const response = await fetch('/api/issue-statuses/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            statuses: newStatuses,
            organizationId: organization.id
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || errorData.error || 'Failed to reorder');
        }
        toast.success('Issue status order updated');
      } catch (error) {
        console.error('Failed to save issue status order:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to save status order');
      }
    }
  };

  const sections = [
    { id: 'personal', label: 'Personal Preferences', icon: UserIcon },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'customizations', label: 'Customizations', icon: Palette },
    { id: 'issue-tracker', label: 'Issue Tracker Settings', icon: AlertCircle },
    { id: 'project-config', label: 'Project Configuration', icon: Layout },
    { id: 'user-management', label: 'User Management', icon: Users },
    { id: 'application', label: 'Application Settings', icon: Settings },
  ];

  if (!localOrgSettings || !localUserPrefs) return <div className="p-8 text-center">Loading settings...</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-2">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeSection === section.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <section.icon size={18} />
              {section.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-3xl border border-gray-100 shadow-sm p-8">
          <AnimatePresence mode="wait">
            {activeSection === 'personal' && (
              <motion.div
                key="personal"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-gray-900">Personal Preferences</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Default View</label>
                    <select 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500"
                      value={localUserPrefs.defaultView}
                      onChange={(e) => setLocalUserPrefs({ ...localUserPrefs, defaultView: e.target.value as any })}
                    >
                      <option value="List">List View</option>
                      <option value="Kanban">Kanban Board</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Time Format</label>
                    <select 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500"
                      value={localUserPrefs.timeFormat}
                      onChange={(e) => setLocalUserPrefs({ ...localUserPrefs, timeFormat: e.target.value as any })}
                    >
                      <option value="12h">12 Hour (AM/PM)</option>
                      <option value="24h">24 Hour</option>
                    </select>
                  </div>
                </div>
                <button 
                  onClick={handleSaveUserPrefs}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  <Save size={18} />
                  Save Preferences
                </button>
              </motion.div>
            )}

            {activeSection === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div>
                      <p className="font-bold text-gray-900">Email Notifications</p>
                      <p className="text-xs text-gray-500">Receive updates via email</p>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                      checked={localUserPrefs.notifications.email}
                      onChange={(e) => setLocalUserPrefs({
                        ...localUserPrefs,
                        notifications: { ...localUserPrefs.notifications, email: e.target.checked }
                      })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div>
                      <p className="font-bold text-gray-900">In-App Notifications</p>
                      <p className="text-xs text-gray-500">Show notifications in the app</p>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                      checked={localUserPrefs.notifications.inApp}
                      onChange={(e) => setLocalUserPrefs({
                        ...localUserPrefs,
                        notifications: { ...localUserPrefs.notifications, inApp: e.target.checked }
                      })}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleSaveUserPrefs}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  <Save size={18} />
                  Save Preferences
                </button>
              </motion.div>
            )}

            {activeSection === 'customizations' && (
              <motion.div
                key="customizations"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Custom Task Statuses</h2>
                  <button 
                    onClick={handleAddStatus}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all"
                  >
                    <Plus size={18} />
                    Add Status
                  </button>
                </div>
                <div className="space-y-3">
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={taskStatuses.map(s => s.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {taskStatuses.map((status) => (
                        <SortableStatusItem 
                          key={status.id}
                          status={status}
                          onUpdate={handleUpdateStatus}
                          onDelete={handleDeleteStatus}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              </motion.div>
            )}

            {activeSection === 'issue-tracker' && (
              <motion.div
                key="issue-tracker"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900">Issue Tracker Settings</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                      <div>
                        <p className="font-bold text-gray-900">Enable Time Tracking</p>
                        <p className="text-xs text-gray-500">Allow users to log time on tasks</p>
                      </div>
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                        checked={localOrgSettings.enabledModules.timeLogs}
                        onChange={(e) => setLocalOrgSettings({
                          ...localOrgSettings,
                          enabledModules: { ...localOrgSettings.enabledModules, timeLogs: e.target.checked }
                        })}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Default Task Priority</label>
                        <select 
                          className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500"
                          value={localOrgSettings.projectDefaults.defaultPriority}
                          onChange={(e) => setLocalOrgSettings({
                            ...localOrgSettings,
                            projectDefaults: { ...localOrgSettings.projectDefaults, defaultPriority: e.target.value as TaskPriority }
                          })}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl h-full">
                        <div>
                          <p className="font-bold text-gray-900">Auto-assign to Creator</p>
                          <p className="text-xs text-gray-500">Assign new tasks to the user who creates them</p>
                        </div>
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                          checked={localOrgSettings.projectDefaults.autoAssignOwner}
                          onChange={(e) => setLocalOrgSettings({
                            ...localOrgSettings,
                            projectDefaults: { ...localOrgSettings.projectDefaults, autoAssignOwner: e.target.checked }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">Issue Statuses</h2>
                    <button 
                      onClick={handleAddIssueStatus}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-bold hover:bg-red-100 transition-all"
                    >
                      <Plus size={18} />
                      Add Issue Status
                    </button>
                  </div>
                  <div className="space-y-3">
                    <DndContext 
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleIssueDragEnd}
                    >
                      <SortableContext 
                        items={issueStatuses.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {issueStatuses.map((status) => (
                          <SortableStatusItem 
                            key={status.id}
                            status={status}
                            onUpdate={handleUpdateIssueStatus}
                            onDelete={handleDeleteIssueStatus}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>

                <button 
                  onClick={handleSaveOrgSettings}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  <Save size={18} />
                  Save Settings
                </button>
              </motion.div>
            )}

            {activeSection === 'project-config' && (
              <motion.div
                key="project-config"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-gray-900">Project Configuration</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Default Project Visibility</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setLocalOrgSettings({
                          ...localOrgSettings,
                          projectDefaults: { ...localOrgSettings.projectDefaults, defaultVisibility: 'private' }
                        })}
                        className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${localOrgSettings.projectDefaults.defaultVisibility === 'private' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-100 hover:border-gray-200 text-gray-500'}`}
                      >
                        <Lock size={20} />
                        <div className="text-left">
                          <p className="font-bold">Private</p>
                          <p className="text-[10px]">Invite only</p>
                        </div>
                      </button>
                      <button 
                        onClick={() => setLocalOrgSettings({
                          ...localOrgSettings,
                          projectDefaults: { ...localOrgSettings.projectDefaults, defaultVisibility: 'public' }
                        })}
                        className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${localOrgSettings.projectDefaults.defaultVisibility === 'public' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-100 hover:border-gray-200 text-gray-500'}`}
                      >
                        <Globe size={20} />
                        <div className="text-left">
                          <p className="font-bold">Public</p>
                          <p className="text-[10px]">Visible to all members</p>
                        </div>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div>
                      <p className="font-bold text-gray-900">Enable Milestones</p>
                      <p className="text-xs text-gray-500">Allow projects to have milestones</p>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                      checked={localOrgSettings.enabledModules.milestones}
                      onChange={(e) => setLocalOrgSettings({
                        ...localOrgSettings,
                        enabledModules: { ...localOrgSettings.enabledModules, milestones: e.target.checked }
                      })}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleSaveOrgSettings}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  <Save size={18} />
                  Save Settings
                </button>
              </motion.div>
            )}

            {activeSection === 'user-management' && (
              <motion.div
                key="user-management"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                      <div>
                        <p className="font-bold text-gray-900">Allow Members to Invite</p>
                        <p className="text-xs text-gray-500">Let regular members send invitations</p>
                      </div>
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                        checked={localOrgSettings.userManagement.allowMembersToInvite}
                        onChange={(e) => setLocalOrgSettings({
                          ...localOrgSettings,
                          userManagement: { ...localOrgSettings.userManagement, allowMembersToInvite: e.target.checked }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Default Invitation Role</label>
                      <select 
                        className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500"
                        value={localOrgSettings.userManagement.defaultInviteRole}
                        onChange={(e) => setLocalOrgSettings({
                          ...localOrgSettings,
                          userManagement: { ...localOrgSettings.userManagement, defaultInviteRole: e.target.value as UserRole }
                        })}
                      >
                        <option value="member">Member</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <button 
                    onClick={handleSaveOrgSettings}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    <Save size={18} />
                    Save Settings
                  </button>
                </div>

                <div className="space-y-6 pt-8 border-t border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Mail size={20} className="text-indigo-600" />
                    Pending Invitations
                  </h3>
                  <form onSubmit={handleSendInvite} className="flex gap-3">
                    <input 
                      required
                      type="email" 
                      placeholder="Enter email address"
                      className="flex-1 px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500"
                      value={newInvite.email}
                      onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                    />
                    <select 
                      className="px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                      value={newInvite.role}
                      onChange={(e) => setNewInvite({ ...newInvite, role: e.target.value as UserRole })}
                    >
                      <option value="member">Member</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button type="submit" className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all">
                      Invite
                    </button>
                  </form>
                  <div className="space-y-3">
                    {invitations.map(invite => (
                      <div key={invite.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                        <div>
                          <p className="font-bold text-gray-900">{invite.email}</p>
                          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">{invite.role}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleResendInvite(invite)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
                            title="Resend Invitation"
                          >
                            <RefreshCw size={16} />
                            Resend
                          </button>
                          <button 
                            onClick={async () => {
                              await deleteDoc(doc(db, 'invitations', invite.id));
                              toast.success('Invitation cancelled');
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Cancel Invitation"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {invitations.length === 0 && (
                      <p className="text-center text-gray-400 py-8 italic">No pending invitations.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === 'application' && (
              <motion.div
                key="application"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-gray-900">Application Settings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Theme</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => setLocalOrgSettings({ ...localOrgSettings, theme: 'light' })}
                        className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${localOrgSettings.theme === 'light' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-100 hover:border-gray-200 text-gray-500'}`}
                      >
                        <Eye size={20} />
                        <span className="font-bold">Light</span>
                      </button>
                      <button 
                        onClick={() => setLocalOrgSettings({ ...localOrgSettings, theme: 'dark' })}
                        className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${localOrgSettings.theme === 'dark' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-100 hover:border-gray-200 text-gray-500'}`}
                      >
                        <EyeOff size={20} />
                        <span className="font-bold">Dark</span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Primary Color</label>
                    <div className="flex flex-wrap gap-3">
                      {['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'].map(color => (
                        <button
                          key={color}
                          onClick={() => setLocalOrgSettings({ ...localOrgSettings, primaryColor: color })}
                          className={`w-10 h-10 rounded-full border-4 transition-all ${localOrgSettings.primaryColor === color ? 'border-white ring-2 ring-indigo-600' : 'border-transparent'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleSaveOrgSettings}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  <Save size={18} />
                  Save Settings
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default OrganizationSettingsView;
