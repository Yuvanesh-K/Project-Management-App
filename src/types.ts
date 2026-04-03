export type UserRole = 'owner' | 'admin' | 'manager' | 'member';
export type ProjectStatus = 'Not Started' | 'In Progress' | 'Completed' | 'On Hold';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type IssueStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type InvitationStatus = 'Pending' | 'Accepted' | 'Rejected';
export type SubtaskStatus = 'To Do' | 'Completed';
export type ProjectTab = 'Dashboard' | 'Tasks' | 'Issues' | 'Milestones' | 'Documents' | 'Time Logs' | 'Forums' | 'Users' | 'Settings';

export interface Organization {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  ownerId: string;
  createdAt: any;
}

export interface OrganizationSettings {
  id: string; // organizationId
  theme: 'light' | 'dark';
  primaryColor: string;
  layout: 'standard' | 'compact';
  enabledModules: {
    issues: boolean;
    timeLogs: boolean;
    forums: boolean;
    milestones: boolean;
    documents: boolean;
  };
  projectDefaults: {
    autoAssignOwner: boolean;
    defaultStatusId?: string;
    defaultPriority: TaskPriority;
    defaultVisibility: 'public' | 'private';
  };
  userManagement: {
    defaultInviteRole: UserRole;
    allowSelfRegistration: boolean;
    allowMembersToInvite: boolean;
  };
  taskFieldsVisibility: {
    priority: boolean;
    dueDate: boolean;
    tags: boolean;
    completionPercentage: boolean;
  };
  updatedAt: any;
}

export interface TaskStatusConfig {
  id: string;
  organizationId: string;
  name: string;
  color: string;
  type: 'Open' | 'InProgress' | 'Completed';
  order: number;
  createdAt: any;
}

export interface UserPreferences {
  uid: string;
  defaultView: 'List' | 'Kanban';
  timeFormat: '12h' | '24h';
  language: string;
  notifications: {
    email: boolean;
    inApp: boolean;
    events: {
      taskAssigned: boolean;
      statusChanged: boolean;
      dueDateReminder: boolean;
    };
  };
  updatedAt: any;
}

export interface UserOrganizationMapping {
  id: string;
  userId: string;
  organizationId: string;
  role: UserRole;
  joinedAt: any;
}

export interface Invitation {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: UserRole;
  status: InvitationStatus;
  token: string;
  invitedBy: string;
  createdAt: any;
}

export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  currentOrganizationId?: string;
  role?: UserRole; // Role in current organization
  status?: 'active' | 'inactive';
  lastActive?: any;
  createdAt: any;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  startDate?: any;
  dueDate?: any;
  status: ProjectStatus;
  members: string[];
  tags?: string[];
  ownerId: string;
  createdAt: any;
}

export interface Task {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  description?: string;
  assignedUserId?: string;
  priority: TaskPriority;
  statusId: string; // Reference to TaskStatusConfig
  completionPercentage: number;
  dueDate?: any;
  tags?: string[];
  isBilled: boolean;
  milestoneId?: string;
  createdAt: any;
}

export interface Subtask {
  id: string;
  taskId: string;
  name: string;
  status: SubtaskStatus;
  createdAt: any;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  dueDate?: any;
  status: 'Pending' | 'Completed';
  createdAt: any;
}

export interface Issue {
  id: string;
  projectId: string;
  taskId?: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  statusId: string; // Reference to TaskStatusConfig (or IssueStatusConfig)
  assignedUserId?: string;
  createdAt: any;
}

export interface Comment {
  id: string;
  targetId: string;
  targetType: 'task' | 'project';
  userId: string;
  content: string;
  createdAt: any;
}

export interface TimeLog {
  id: string;
  taskId: string;
  userId: string;
  hours: number;
  description?: string;
  date: any;
  createdAt: any;
}

export interface ActivityLog {
  id: string;
  targetId: string;
  targetType: string;
  userId: string;
  action: string;
  details?: string;
  createdAt: any;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  taskId?: string;
  name: string;
  url: string;
  type: string;
  userId: string;
  createdAt: any;
}

export interface ForumThread {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  content: string;
  createdAt: any;
}

export interface ForumReply {
  id: string;
  threadId: string;
  userId: string;
  content: string;
  createdAt: any;
}
