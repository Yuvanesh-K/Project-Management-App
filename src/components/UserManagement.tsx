import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, getDocs, getDoc, collectionGroup } from 'firebase/firestore';
import { db } from '../firebase';
import { UserOrganizationMapping, Invitation, UserRole, User, Project, Task, TimeLog, ActivityLog } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, Mail, Trash2, Shield, Loader2, Search, Filter, 
  MoreVertical, X, CheckCircle2, AlertCircle, Clock, 
  Briefcase, CheckSquare, History, User as UserIcon,
  ChevronRight, Calendar, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { logActivity } from '../lib/firestore-utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

const UserManagement: React.FC = () => {
  const { organization, role: currentUserRole, user: currentUser } = useAuth();
  const [mappings, setMappings] = useState<UserOrganizationMapping[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, User>>({});
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'users' | 'invitations'>('users');
  
  // User Details Modal State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<{
    projects: Project[];
    tasks: Task[];
    timeLogs: TimeLog[];
    activities: ActivityLog[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!organization) return;

    const projectsQuery = query(
      collection(db, 'projects'),
      where('organizationId', '==', organization.id)
    );

    const unsubProjects = onSnapshot(projectsQuery, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    const invitesQuery = query(
      collection(db, 'invitations'),
      where('organizationId', '==', organization.id)
    );

    const unsubInvites = onSnapshot(invitesQuery, (snapshot) => {
      setInvitations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'invitations');
    });

    const membersQuery = query(
      collection(db, 'userOrganizationMappings'),
      where('organizationId', '==', organization.id)
    );

    const unsubMembers = onSnapshot(membersQuery, (snapshot) => {
      const mappingData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserOrganizationMapping));
      setMappings(mappingData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'userOrganizationMappings');
    });

    return () => {
      unsubProjects();
      unsubInvites();
      unsubMembers();
    };
  }, [organization?.id]);

  // Fetch user profiles for mappings
  useEffect(() => {
    const fetchMissingProfiles = async () => {
      const missingUserIds = mappings
        .map(m => m.userId)
        .filter(id => !userProfiles[id]);

      if (missingUserIds.length === 0) return;

      // Fetch in batches of 30 (Firestore 'in' limit)
      const batches = [];
      for (let i = 0; i < missingUserIds.length; i += 30) {
        batches.push(missingUserIds.slice(i, i + 30));
      }

      const newProfiles: Record<string, User> = { ...userProfiles };
      let changed = false;

      for (const batch of batches) {
        try {
          const usersQuery = query(collection(db, 'users'), where('uid', 'in', batch));
          const usersSnap = await getDocs(usersQuery);
          
          // Mark all in batch as "processed" even if not found to avoid infinite loops
          batch.forEach(id => {
            if (!newProfiles[id]) {
              // Placeholder for not found users to prevent re-fetching
              newProfiles[id] = { uid: id, displayName: 'Unknown User', email: '', createdAt: null } as any;
              changed = true;
            }
          });

          usersSnap.docs.forEach(doc => {
            newProfiles[doc.id] = { uid: doc.id, ...doc.data() } as User;
            changed = true;
          });
        } catch (error) {
          console.error("Error fetching user profiles:", error);
        }
      }

      if (changed) {
        setUserProfiles(prev => ({ ...prev, ...newProfiles }));
      }
    };

    fetchMissingProfiles();
  }, [mappings]); // Only depend on mappings

  const members = React.useMemo(() => {
    const projectCountMap: Record<string, number> = {};
    projects.forEach(p => {
      (p.members || []).forEach(uid => {
        projectCountMap[uid] = (projectCountMap[uid] || 0) + 1;
      });
    });

    return mappings.map(mapping => ({
      ...mapping,
      userProfile: userProfiles[mapping.userId],
      projectCount: projectCountMap[mapping.userId] || 0
    }));
  }, [mappings, userProfiles, projects]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !currentUser) return;
    
    setIsInviting(true);
    try {
      const response = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteName,
          email: inviteEmail,
          organizationId: organization.id,
          organizationName: organization.name,
          invitedBy: currentUser.uid,
          invitedByName: currentUser.displayName
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      setInviteEmail('');
      setInviteName('');
      
      if (data.emailSent) {
        toast.success(`Invitation sent successfully to ${inviteEmail}`);
      } else {
        toast.warning(`Invitation saved, but email delivery failed. Please share the link manually.`);
      }
      
      await logActivity(
        organization.id,
        inviteEmail,
        'user',
        'User Invited',
        `Invitation sent to ${inviteName} (${inviteEmail}) by ${currentUser.displayName}`
      );

      if (data.inviteLink) {
        console.log("Invite Link (for testing):", data.inviteLink);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    if (!organization || !currentUser) return;
    try {
      const response = await fetch(`/api/organization/members/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: organization.id,
          role: newRole,
          adminId: currentUser.uid
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update role');
      }

      const updatedUser = userProfiles[userId];
      await logActivity(
        organization.id,
        userId,
        'user',
        'Role Updated',
        `Role for ${updatedUser?.displayName || userId} updated to ${newRole} by ${currentUser.displayName}`
      );

      toast.success('Role updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: 'active' | 'inactive') => {
    if (!organization || !currentUser) return;
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
      
      const updatedUser = userProfiles[userId];
      await logActivity(
        organization.id,
        userId,
        'user',
        'User Status Updated',
        `User ${updatedUser?.displayName || userId} was ${newStatus === 'active' ? 'activated' : 'deactivated'} by ${currentUser.displayName}`
      );

      toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleRemoveMember = async (mappingId: string, userId: string) => {
    if (userId === currentUser?.uid) {
      toast.error('You cannot remove yourself');
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'userOrganizationMappings', mappingId));
      
      const removedUser = userProfiles[userId];
      await logActivity(
        organization.id,
        userId,
        'user',
        'User Removed',
        `User ${removedUser?.displayName || userId} was removed from the organization by ${currentUser.displayName}`
      );

      toast.success('Member removed from organization');
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await deleteDoc(doc(db, 'invitations', inviteId));
      toast.info('Invitation cancelled');
    } catch (error) {
      toast.error('Failed to cancel invitation');
    }
  };

  const handleResendInvite = async (invite: Invitation) => {
    if (!organization || !currentUser) return;
    
    try {
      const response = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: invite.name || 'Team Member',
          email: invite.email,
          organizationId: organization.id,
          organizationName: organization.name,
          invitedBy: currentUser.uid,
          invitedByName: currentUser.displayName
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend invitation');
      }

      if (data.emailSent) {
        toast.success('Invitation resent successfully');
      } else {
        toast.warning('Invitation updated, but email delivery failed. Please share the link manually.');
      }

      await logActivity(
        organization.id,
        invite.email,
        'user',
        'Invitation Resent',
        `Invitation to ${invite.name || invite.email} was resent by ${currentUser.displayName}`
      );

      toast.success('Invitation resent successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend invitation');
    }
  };

  const fetchUserDetails = async (user: User) => {
    setSelectedUser(user);
    setLoadingDetails(true);
    try {
      // Fetch user's projects
      const userProjects = projects.filter(p => p.members.includes(user.uid));
      
      // Fetch user's tasks across all projects in this organization
      const tasksQuery = query(
        collectionGroup(db, 'tasks'),
        where('organizationId', '==', organization?.id),
        where('assignedUserId', '==', user.uid)
      );
      const tasksSnap = await getDocs(tasksQuery);
      const userTasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      
      // Fetch time logs
      const logsQuery = query(
        collectionGroup(db, 'timeLogs'),
        where('organizationId', '==', organization?.id),
        where('userId', '==', user.uid)
      );
      const logsSnap = await getDocs(logsQuery);
      const userLogs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeLog));
      
      // Fetch activity logs
      const activityQuery = query(
        collection(db, 'activityLogs'),
        where('userId', '==', user.uid),
        where('organizationId', '==', organization?.id)
      );
      const activitySnap = await getDocs(activityQuery);
      const userActivities = activitySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));

      setUserDetails({
        projects: userProjects,
        tasks: userTasks,
        timeLogs: userLogs,
        activities: userActivities
      });
    } catch (error) {
      toast.error('Failed to fetch user details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleToggleProject = async (projectId: string, isMember: boolean) => {
    if (!selectedUser) return;
    try {
      const projectRef = doc(db, 'projects', projectId);
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      let newMembers = [...project.members];
      if (isMember) {
        newMembers = newMembers.filter(uid => uid !== selectedUser.uid);
      } else {
        newMembers.push(selectedUser.uid);
      }

      await updateDoc(projectRef, { members: newMembers });
      
      // Update local state for immediate feedback
      if (userDetails) {
        const updatedProjects = isMember 
          ? userDetails.projects.filter(p => p.id !== projectId)
          : [...userDetails.projects, project];
        setUserDetails({ ...userDetails, projects: updatedProjects });
      }
      
      toast.success(isMember ? 'Removed from project' : 'Assigned to project');
    } catch (error) {
      toast.error('Failed to update project assignment');
    }
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = (m.userProfile?.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (m.userProfile?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'All' || m.role === filterRole;
    const matchesStatus = filterStatus === 'All' || (m.userProfile?.status || 'active') === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  const canManage = currentUserRole === 'admin' || currentUserRole === 'owner';

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">User Management</h1>
          <p className="text-gray-500 mt-1">Control access, roles, and permissions for your team.</p>
        </div>
        
        {canManage && (
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-2xl border border-gray-100 shadow-sm flex">
              <button 
                onClick={() => setActiveTab('users')}
                className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Users
              </button>
              <button 
                onClick={() => setActiveTab('invitations')}
                className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === 'invitations' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Invitations
                {invitations.filter(i => i.status === 'Pending').length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {invitations.filter(i => i.status === 'Pending').length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </header>

      {activeTab === 'users' ? (
        <div className="space-y-6">
          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text"
                placeholder="Search by name or email..."
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-2xl">
                <Shield size={16} className="text-gray-400" />
                <select 
                  className="bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-700 outline-none cursor-pointer"
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                >
                  <option value="All">All Roles</option>
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="member">Member</option>
                </select>
              </div>

              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-2xl">
                <CheckCircle2 size={16} className="text-gray-400" />
                <select 
                  className="bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-700 outline-none cursor-pointer"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="All">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            {canManage && (
              <button 
                onClick={() => setActiveTab('invitations')}
                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
              >
                <UserPlus size={18} />
                Invite User
              </button>
            )}
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-gray-400">User</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-gray-400">Role</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-gray-400">Status</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-gray-400">Projects</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-gray-400">Last Active</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-gray-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div 
                          className="flex items-center gap-4 cursor-pointer"
                          onClick={() => member.userProfile && fetchUserDetails(member.userProfile)}
                        >
                          {member.userProfile?.photoURL ? (
                            <img src={member.userProfile.photoURL} className="w-10 h-10 rounded-xl object-cover" alt="" />
                          ) : (
                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
                              {(member.userProfile?.displayName || 'U').charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                              {member.userProfile?.displayName || 'Unknown User'}
                            </p>
                            <p className="text-xs text-gray-400">{member.userProfile?.email || 'No email'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                          member.role === 'owner' ? 'bg-purple-100 text-purple-600' :
                          member.role === 'admin' ? 'bg-indigo-100 text-indigo-600' :
                          member.role === 'manager' ? 'bg-emerald-100 text-emerald-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            (member.userProfile?.status || 'active') === 'active' ? 'bg-emerald-500' : 'bg-gray-300'
                          }`} />
                          <span className="text-sm font-medium text-gray-600 capitalize">
                            {member.userProfile?.status || 'active'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Briefcase size={14} />
                          <span className="text-sm font-bold">{member.projectCount}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-500">
                          {member.userProfile?.lastActive && typeof member.userProfile.lastActive.toDate === 'function'
                            ? format(member.userProfile.lastActive.toDate(), 'MMM d, h:mm a')
                            : 'Never'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canManage && member.role !== 'owner' && (
                            <>
                              <select 
                                className="text-xs font-bold bg-gray-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none py-1 px-2 cursor-pointer"
                                value={member.role}
                                onChange={(e) => handleUpdateRole(member.userId, e.target.value as UserRole)}
                              >
                                <option value="member">Member</option>
                                <option value="manager">Manager</option>
                                <option value="admin">Admin</option>
                              </select>
                              
                              <button 
                                onClick={() => handleUpdateStatus(member.userId, (member.userProfile?.status || 'active') === 'active' ? 'inactive' : 'active')}
                                className={`p-2 rounded-lg transition-all ${
                                  (member.userProfile?.status || 'active') === 'active' 
                                    ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' 
                                    : 'text-emerald-500 hover:bg-emerald-50'
                                }`}
                                title={(member.userProfile?.status || 'active') === 'active' ? 'Deactivate User' : 'Activate User'}
                              >
                                { (member.userProfile?.status || 'active') === 'active' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} /> }
                              </button>

                              <button 
                                onClick={() => handleRemoveMember(member.id!, member.userId)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Remove from Organization"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => member.userProfile && fetchUserDetails(member.userProfile)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View Details"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredMembers.length === 0 && (
              <div className="p-20 text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search size={32} className="text-gray-200" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">No users found</h3>
                <p className="text-gray-400 mt-2">Try adjusting your search or filters.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Invite Form */}
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm sticky top-8">
              <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
                <Mail size={24} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Invite New Member</h2>
              <p className="text-gray-500 mb-8">Send an invitation to join your organization.</p>
              
              <form onSubmit={handleInvite} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-black uppercase tracking-wider text-gray-400">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      required
                      type="text"
                      placeholder="John Doe"
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black uppercase tracking-wider text-gray-400">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      required
                      type="email"
                      placeholder="colleague@company.com"
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <p className="text-xs text-indigo-600 font-bold">
                    Note: New members are automatically assigned the "Member" role. You can update their role after they join.
                  </p>
                </div>

                <button 
                  disabled={isInviting}
                  type="submit"
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                >
                  {isInviting ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
                  Send Invitation
                </button>
              </form>
            </div>
          </div>

          {/* Invitations List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Pending Invitations</h2>
                <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold">
                  {invitations.filter(i => i.status === 'Pending').length} Total
                </span>
              </div>
              
              <div className="divide-y divide-gray-50">
                {invitations.length > 0 ? (
                  invitations.map((invite) => (
                    <div key={invite.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                          <Mail size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{invite.email}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[10px] font-bold uppercase tracking-wider">
                              {invite.role}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              invite.status === 'Pending' ? 'bg-amber-50 text-amber-600' :
                              invite.status === 'Accepted' ? 'bg-emerald-50 text-emerald-600' :
                              'bg-red-50 text-red-600'
                            }`}>
                              {invite.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-gray-400">Sent on</p>
                          <p className="text-sm font-bold text-gray-600">
                            {invite.createdAt && typeof invite.createdAt.toDate === 'function' ? format(invite.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {invite.status === 'Pending' && (
                            <button 
                              onClick={() => handleResendInvite(invite)}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Resend Invitation"
                            >
                              <History size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => handleCancelInvite(invite.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Cancel Invitation"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-20 text-center">
                    <Mail size={48} className="mx-auto text-gray-200 mb-4" />
                    <h3 className="text-xl font-bold text-gray-900">No invitations found</h3>
                    <p className="text-gray-400 mt-2">Invite your team members to get started.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-6">
                  {selectedUser.photoURL ? (
                    <img src={selectedUser.photoURL} className="w-20 h-20 rounded-3xl object-cover shadow-lg" alt="" />
                  ) : (
                    <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-indigo-200">
                      {selectedUser.displayName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">{selectedUser.displayName}</h2>
                    <p className="text-gray-500 font-medium">{selectedUser.email}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full text-xs font-black uppercase tracking-widest">
                        {members.find(m => m.userId === selectedUser.uid)?.role || 'Member'}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold">
                        <Clock size={14} />
                        Last active: {selectedUser.lastActive && typeof selectedUser.lastActive.toDate === 'function' ? format(selectedUser.lastActive.toDate(), 'MMM d, h:mm a') : 'Never'}
                      </div>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedUser(null);
                    setUserDetails(null);
                  }}
                  className="p-3 bg-white text-gray-400 hover:text-gray-900 rounded-2xl border border-gray-100 shadow-sm transition-all"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {loadingDetails ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Loader2 className="animate-spin text-indigo-600" size={40} />
                    <p className="text-gray-400 font-bold animate-pulse">Fetching user insights...</p>
                  </div>
                ) : userDetails ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Projects & Tasks */}
                    <div className="space-y-8">
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <Briefcase size={20} className="text-indigo-600" />
                            Project Assignments
                          </h3>
                        </div>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {projects.map(project => {
                            const isMember = project.members.includes(selectedUser.uid);
                            return (
                              <div key={project.id} className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between group hover:bg-indigo-50 transition-all">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 font-bold shadow-sm">
                                    {project.name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{project.name}</p>
                                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{project.status}</p>
                                  </div>
                                </div>
                                {canManage ? (
                                  <button
                                    onClick={() => handleToggleProject(project.id, isMember)}
                                    className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                      isMember 
                                        ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100'
                                    }`}
                                  >
                                    {isMember ? 'Remove' : 'Assign'}
                                  </button>
                                ) : (
                                  isMember && <CheckCircle2 size={18} className="text-emerald-500" />
                                )}
                              </div>
                            );
                          })}
                          {projects.length === 0 && (
                            <p className="text-sm text-gray-400 italic p-4 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                              No projects in organization.
                            </p>
                          )}
                        </div>
                      </section>

                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <CheckSquare size={20} className="text-indigo-600" />
                            Active Tasks
                          </h3>
                          <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                            {userDetails.tasks.filter(t => t.status !== 'Done').length}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {userDetails.tasks.filter(t => t.status !== 'Done').map(task => (
                            <div key={task.id} className="p-4 border border-gray-100 rounded-2xl space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="font-bold text-gray-900">{task.name}</p>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase ${
                                  task.priority === 'High' ? 'bg-red-50 text-red-600' :
                                  task.priority === 'Medium' ? 'bg-amber-50 text-amber-600' :
                                  'bg-emerald-50 text-emerald-600'
                                }`}>
                                  {task.priority}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold">
                                <span>{projects.find(p => p.id === task.projectId)?.name}</span>
                                <span>{task.completionPercentage}% Complete</span>
                              </div>
                              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-indigo-600 transition-all duration-500"
                                  style={{ width: `${task.completionPercentage}%` }}
                                />
                              </div>
                            </div>
                          ))}
                          {userDetails.tasks.filter(t => t.status !== 'Done').length === 0 && (
                            <p className="text-sm text-gray-400 italic p-4 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                              No active tasks.
                            </p>
                          )}
                        </div>
                      </section>
                    </div>

                    {/* Time Logs & Activity */}
                    <div className="space-y-8">
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <Clock size={20} className="text-indigo-600" />
                            Time Tracking
                          </h3>
                          <div className="text-right">
                            <p className="text-2xl font-black text-indigo-600">
                              {userDetails.timeLogs.reduce((acc, log) => acc + log.hours, 0).toFixed(1)}
                            </p>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Total Hours</p>
                          </div>
                        </div>
                        <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                          {userDetails.timeLogs.map(log => (
                            <div key={log.id} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                              <div>
                                <p className="text-sm font-bold text-gray-800">{log.description || 'Work session'}</p>
                                <p className="text-[10px] text-gray-400">{log.date && typeof log.date.toDate === 'function' ? format(log.date.toDate(), 'MMM d, yyyy') : 'N/A'}</p>
                              </div>
                              <span className="text-sm font-black text-indigo-600">{log.hours}h</span>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <History size={20} className="text-indigo-600" />
                            Recent Activity
                          </h3>
                        </div>
                        <div className="space-y-4">
                          {userDetails.activities.slice(0, 5).map(activity => (
                            <div key={activity.id} className="flex gap-3 relative">
                              <div className="w-8 h-8 bg-white border border-gray-100 rounded-full flex items-center justify-center text-indigo-600 shadow-sm z-10">
                                <UserIcon size={14} />
                              </div>
                              <div className="flex-1 pb-4 border-b border-gray-50">
                                <p className="text-sm text-gray-700">
                                  <span className="font-bold">{activity.action}</span> {activity.details}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  {activity.createdAt && typeof activity.createdAt.toDate === 'function' ? format(activity.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                                </p>
                              </div>
                            </div>
                          ))}
                          {userDetails.activities.length === 0 && (
                            <p className="text-sm text-gray-400 italic p-4 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                              No recent activity.
                            </p>
                          )}
                        </div>
                      </section>
                    </div>
                  </div>
                ) : null}
              </div>
              
              <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-3">
                <button 
                  onClick={() => {
                    setSelectedUser(null);
                    setUserDetails(null);
                  }}
                  className="px-8 py-3 bg-white text-gray-600 font-bold rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all"
                >
                  Close
                </button>
                {canManage && selectedUser?.uid !== currentUser?.uid && (
                  <button 
                    onClick={() => {
                      const mapping = members.find(m => m.userId === selectedUser?.uid);
                      if (mapping) handleRemoveMember(mapping.id!, selectedUser!.uid);
                    }}
                    className="px-8 py-3 bg-red-50 text-red-600 font-bold rounded-2xl border border-red-100 hover:bg-red-100 transition-all flex items-center gap-2"
                  >
                    <Trash2 size={18} />
                    Remove from Org
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagement;
