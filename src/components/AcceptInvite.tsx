import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

const AcceptInvite: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user, login, loading: authLoading, switchOrganization } = useAuth();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Invalid invitation link. No token provided.');
      return;
    }

    if (!authLoading && user && status === 'idle') {
      handleAccept();
    }
  }, [token, user, authLoading, status]);

  const handleAccept = async () => {
    if (!token || !user) return;
    
    setStatus('loading');
    try {
      const response = await fetch(`/api/invitations/accept?token=${token}&userId=${user.uid}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation');
      }

      setOrgName(data.organizationName);
      setStatus('success');
      
      // Switch to the new organization in context
      if (data.organizationId) {
        await switchOrganization(data.organizationId);
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message);
    }
  };

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-indigo-600 mx-auto" size={48} />
          <p className="text-gray-500 font-bold">Processing your invitation...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[40px] shadow-xl max-w-md w-full text-center space-y-6"
        >
          <div className="w-16 h-16 bg-indigo-100 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Authentication Required</h1>
          <p className="text-gray-500">You need to be logged in to accept this invitation. Please sign in with your Google account.</p>
          <button 
            onClick={login}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
          >
            Sign in to Continue
          </button>
        </motion.div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-[40px] shadow-xl max-w-md w-full text-center space-y-6"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto shadow-inner">
            <CheckCircle2 size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-gray-900">Welcome!</h1>
            <p className="text-gray-500">
              You have successfully joined <span className="font-bold text-indigo-600">{orgName}</span>.
            </p>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
          >
            Go to Dashboard
            <ArrowRight size={20} />
          </button>
        </motion.div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[40px] shadow-xl max-w-md w-full text-center space-y-6"
        >
          <div className="w-16 h-16 bg-red-100 rounded-3xl flex items-center justify-center text-red-600 mx-auto">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Invitation Error</h1>
          <p className="text-gray-500">{error || 'Something went wrong while processing your invitation.'}</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
          >
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  return null;
};

export default AcceptInvite;
