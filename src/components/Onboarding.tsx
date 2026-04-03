import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, Check, X, Loader2 } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Invitation } from '../types';
import { toast } from 'sonner';

import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

const Onboarding: React.FC = () => {
  const { user, createOrganization, switchOrganization, logout } = useAuth();
  const [step, setStep] = useState<'choice' | 'create' | 'join'>('choice');
  const [orgName, setOrgName] = useState('');
  const [orgDesc, setOrgDesc] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.email) return;

    const q = query(
      collection(db, 'invitations'),
      where('email', '==', user.email),
      where('status', '==', 'Pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInvitations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invitation)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'invitations');
    });

    return () => unsubscribe();
  }, [user?.email]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createOrganization(orgName, orgDesc);
      toast.success('Organization created successfully!');
    } catch (error) {
      toast.error('Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (invite: Invitation) => {
    if (!user) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Create mapping
      const mappingRef = doc(db, 'userOrganizationMappings', `${user.uid}_${invite.organizationId}`);
      batch.set(mappingRef, {
        userId: user.uid,
        organizationId: invite.organizationId,
        role: invite.role,
        joinedAt: serverTimestamp(),
      });

      // 2. Update user's current org
      const userRef = doc(db, 'users', user.uid);
      batch.update(userRef, {
        currentOrganizationId: invite.organizationId
      });

      // 3. Update invitation status
      const inviteRef = doc(db, 'invitations', invite.id);
      batch.update(inviteRef, {
        status: 'Accepted'
      });

      await batch.commit();
      
      // Switch context
      await switchOrganization(invite.organizationId);
      toast.success(`Joined ${invite.organizationName}!`);
    } catch (error) {
      toast.error('Failed to join organization');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectInvite = async (inviteId: string) => {
    try {
      await setDoc(doc(db, 'invitations', inviteId), { status: 'Rejected' }, { merge: true });
      toast.info('Invitation rejected');
    } catch (error) {
      toast.error('Failed to reject invitation');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-gray-100 p-10"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6 shadow-lg shadow-indigo-200">
            P
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome, {user?.displayName}</h1>
          <p className="text-gray-500">To get started, you need to be part of an organization.</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'choice' && (
            <motion.div 
              key="choice"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 gap-4"
            >
              <button 
                onClick={() => setStep('create')}
                className="group flex items-center gap-6 p-6 bg-white border-2 border-gray-100 rounded-3xl hover:border-indigo-600 hover:bg-indigo-50/50 transition-all text-left"
              >
                <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Plus size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Create a new organization</h3>
                  <p className="text-sm text-gray-500">Start fresh and invite your team members.</p>
                </div>
              </button>

              <button 
                onClick={() => setStep('join')}
                className="group flex items-center gap-6 p-6 bg-white border-2 border-gray-100 rounded-3xl hover:border-indigo-600 hover:bg-indigo-50/50 transition-all text-left"
              >
                <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Users size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Join an existing organization</h3>
                  <p className="text-sm text-gray-500">Check for pending invitations from your team.</p>
                </div>
              </button>
              
              <button 
                onClick={logout}
                className="mt-6 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Sign out
              </button>
            </motion.div>
          )}

          {step === 'create' && (
            <motion.div 
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <form onSubmit={handleCreate} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Organization Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all text-lg"
                    placeholder="e.g. Acme Corp"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Description (Optional)</label>
                  <textarea 
                    rows={3}
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="What does your organization do?"
                    value={orgDesc}
                    onChange={(e) => setOrgDesc(e.target.value)}
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setStep('choice')}
                    className="flex-1 px-6 py-4 border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all"
                  >
                    Back
                  </button>
                  <button 
                    disabled={loading}
                    type="submit"
                    className="flex-1 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Create Organization'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 'join' && (
            <motion.div 
              key="join"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4">Pending Invitations</h3>
              
              {invitations.length > 0 ? (
                <div className="space-y-4">
                  {invitations.map((invite) => (
                    <div key={invite.id} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900">{invite.organizationName}</h4>
                        <p className="text-xs text-gray-500 capitalize">Role: {invite.role}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleAcceptInvite(invite)}
                          disabled={loading}
                          className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all"
                        >
                          <Check size={20} />
                        </button>
                        <button 
                          onClick={() => handleRejectInvite(invite.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <Users size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No invitations found for {user?.email}.</p>
                  <p className="text-sm text-gray-400 mt-2">Please ask your admin to invite you.</p>
                </div>
              )}

              <button 
                onClick={() => setStep('choice')}
                className="w-full px-6 py-4 border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all"
              >
                Back
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Onboarding;
