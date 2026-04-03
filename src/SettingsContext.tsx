import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, where, orderBy, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { OrganizationSettings, TaskStatusConfig, UserPreferences } from './types';

interface SettingsContextType {
  orgSettings: OrganizationSettings | null;
  taskStatuses: TaskStatusConfig[];
  issueStatuses: TaskStatusConfig[];
  userPreferences: UserPreferences | null;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, organization } = useAuth();
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null);
  const [taskStatuses, setTaskStatuses] = useState<TaskStatusConfig[]>([]);
  const [issueStatuses, setIssueStatuses] = useState<TaskStatusConfig[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !organization) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Org Settings
    const unsubOrgSettings = onSnapshot(doc(db, 'organizationSettings', organization.id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as OrganizationSettings;
        setOrgSettings({ id: snapshot.id, ...data });
        
        // Apply theme
        if (data.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        
        // Apply primary color
        document.documentElement.style.setProperty('--primary-color', data.primaryColor || '#4f46e5');
      } else {
        // Initialize default settings if not exists
        const defaultSettings: Partial<OrganizationSettings> = {
          theme: 'light',
          primaryColor: '#4f46e5',
          layout: 'standard',
          enabledModules: {
            issues: true,
            timeLogs: true,
            forums: true,
            milestones: true,
            documents: true,
          },
          projectDefaults: {
            autoAssignOwner: true,
            defaultPriority: 'Medium',
            defaultVisibility: 'private',
          },
          userManagement: {
            defaultInviteRole: 'member',
            allowSelfRegistration: true,
            allowMembersToInvite: false,
          },
          taskFieldsVisibility: {
            priority: true,
            dueDate: true,
            tags: true,
            completionPercentage: true,
          },
          updatedAt: serverTimestamp(),
        };
        setDoc(doc(db, 'organizationSettings', organization.id), defaultSettings);
      }
    });

    // 2. Task Statuses
    const q = query(
      collection(db, 'taskStatuses'),
      where('organizationId', '==', organization.id),
      orderBy('order', 'asc')
    );
    const unsubTaskStatuses = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setTaskStatuses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskStatusConfig)));
      } else {
        // Initialize default statuses
        const defaults = [
          { name: 'To Do', color: '#9ca3af', type: 'Open', order: 0 },
          { name: 'In Progress', color: '#f59e0b', type: 'InProgress', order: 1 },
          { name: 'Done', color: '#10b981', type: 'Completed', order: 2 },
        ];
        defaults.forEach((status) => {
          const ref = doc(collection(db, 'taskStatuses'));
          setDoc(ref, {
            ...status,
            organizationId: organization.id,
            createdAt: serverTimestamp(),
          });
        });
      }
    });

    // 2.5 Issue Statuses
    const issueQ = query(
      collection(db, 'issueStatuses'),
      where('organizationId', '==', organization.id),
      orderBy('order', 'asc')
    );
    const unsubIssueStatuses = onSnapshot(issueQ, (snapshot) => {
      if (!snapshot.empty) {
        setIssueStatuses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskStatusConfig)));
      } else {
        // Initialize default issue statuses
        const defaults = [
          { name: 'Open', color: '#ef4444', type: 'Open', order: 0 },
          { name: 'In Progress', color: '#f59e0b', type: 'InProgress', order: 1 },
          { name: 'Resolved', color: '#10b981', type: 'Completed', order: 2 },
          { name: 'Closed', color: '#6b7280', type: 'Completed', order: 3 },
        ];
        defaults.forEach((status) => {
          const ref = doc(collection(db, 'issueStatuses'));
          setDoc(ref, {
            ...status,
            organizationId: organization.id,
            createdAt: serverTimestamp(),
          });
        });
      }
    });

    // 3. User Preferences
    const unsubUserPrefs = onSnapshot(doc(db, 'userPreferences', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setUserPreferences({ uid: snapshot.id, ...snapshot.data() } as UserPreferences);
      } else {
        const defaultPrefs: Partial<UserPreferences> = {
          defaultView: 'List',
          timeFormat: '12h',
          language: 'en',
          notifications: {
            email: true,
            inApp: true,
            events: {
              taskAssigned: true,
              statusChanged: true,
              dueDateReminder: true,
            },
          },
          updatedAt: serverTimestamp(),
        };
        setDoc(doc(db, 'userPreferences', user.uid), defaultPrefs);
      }
      setLoading(false);
    });

    return () => {
      unsubOrgSettings();
      unsubTaskStatuses();
      unsubIssueStatuses();
      unsubUserPrefs();
    };
  }, [user, organization]);

  return (
    <SettingsContext.Provider value={{ orgSettings, taskStatuses, issueStatuses, userPreferences, loading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
