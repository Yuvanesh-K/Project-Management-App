import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { ForumThread, ForumReply, User } from '../../types';
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Send, 
  Search, 
  Filter, 
  MessageCircle, 
  Clock, 
  User as UserIcon,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ForumModuleProps {
  projectId: string;
}

const ForumModule: React.FC<ForumModuleProps> = ({ projectId }) => {
  const { organization, user: currentUser } = useAuth();
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newThread, setNewThread] = useState({ title: '', content: '', category: 'General' });
  const [newReply, setNewReply] = useState('');

  useEffect(() => {
    if (!projectId) return;

    const q = query(collection(db, `projects/${projectId}/forumThreads`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setThreads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumThread)));
    });

    return () => unsubscribe();
  }, [projectId]);

  useEffect(() => {
    if (!selectedThread) {
      setReplies([]);
      return;
    }

    const q = query(collection(db, `projects/${projectId}/forumThreads/${selectedThread.id}/replies`), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReplies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumReply)));
    });

    return () => unsubscribe();
  }, [selectedThread, projectId]);

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !organization || !currentUser) return;

    try {
      await addDoc(collection(db, `projects/${projectId}/forumThreads`), {
        ...newThread,
        projectId,
        organizationId: organization.id,
        authorId: currentUser.uid,
        authorName: currentUser.displayName,
        authorPhoto: currentUser.photoURL,
        createdAt: serverTimestamp(),
        replyCount: 0,
      });
      toast.success('Thread created successfully!');
      setIsModalOpen(false);
      setNewThread({ title: '', content: '', category: 'General' });
    } catch (error) {
      toast.error('Failed to create thread');
    }
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThread || !newReply.trim() || !currentUser) return;

    try {
      await addDoc(collection(db, `projects/${projectId}/forumThreads/${selectedThread.id}/replies`), {
        content: newReply,
        authorId: currentUser.uid,
        authorName: currentUser.displayName,
        authorPhoto: currentUser.photoURL,
        createdAt: serverTimestamp(),
      });
      setNewReply('');
      toast.success('Reply posted!');
    } catch (error) {
      toast.error('Failed to post reply');
    }
  };

  const filteredThreads = threads.filter(thread => 
    thread.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    thread.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {!selectedThread ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search discussions..."
                  className="w-full pl-12 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 ml-auto"
              >
                <Plus size={18} />
                New Discussion
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredThreads.map((thread) => (
                <div 
                  key={thread.id} 
                  onClick={() => setSelectedThread(thread)}
                  className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full uppercase">{thread.category}</span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          {thread.createdAt ? format(thread.createdAt.toDate(), 'MMM d, yyyy') : ''}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{thread.title}</h4>
                      <p className="text-sm text-gray-500 line-clamp-2 mt-2">{thread.content}</p>
                    </div>
                    <div className="flex flex-col items-end gap-4 ml-6">
                      <div className="flex items-center gap-1 text-gray-400">
                        <MessageCircle size={18} />
                        <span className="text-sm font-bold">{thread.replyCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <img src={thread.authorPhoto || `https://ui-avatars.com/api/?name=${thread.authorName}`} className="w-6 h-6 rounded-full" alt="" />
                        <span className="text-xs font-medium text-gray-600">{thread.authorName}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredThreads.length === 0 && (
                <div className="py-20 text-center text-gray-400 italic bg-white rounded-3xl border border-gray-100">
                  No discussions yet. Start a new conversation!
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <button 
              onClick={() => setSelectedThread(null)}
              className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors"
            >
              <ChevronLeft size={18} />
              Back to Discussions
            </button>

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <img src={selectedThread.authorPhoto || `https://ui-avatars.com/api/?name=${selectedThread.authorName}`} className="w-10 h-10 rounded-full" alt="" />
                <div>
                  <h4 className="font-bold text-gray-900">{selectedThread.authorName}</h4>
                  <p className="text-xs text-gray-400">{selectedThread.createdAt ? format(selectedThread.createdAt.toDate(), 'MMM d, yyyy HH:mm') : ''}</p>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">{selectedThread.title}</h3>
              <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-wrap">
                {selectedThread.content}
              </div>
            </div>

            <div className="space-y-4 pl-8 border-l-2 border-gray-100">
              <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Replies ({replies.length})</h5>
              {replies.map((reply) => (
                <div key={reply.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <img src={reply.authorPhoto || `https://ui-avatars.com/api/?name=${reply.authorName}`} className="w-8 h-8 rounded-full" alt="" />
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">{reply.authorName}</h4>
                      <p className="text-[10px] text-gray-400">{reply.createdAt ? format(reply.createdAt.toDate(), 'MMM d, yyyy HH:mm') : ''}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{reply.content}</p>
                </div>
              ))}
              
              <form onSubmit={handlePostReply} className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm">
                <textarea 
                  required
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm mb-4"
                  placeholder="Write your reply..."
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                />
                <div className="flex justify-end">
                  <button 
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
                  >
                    <Send size={16} />
                    Post Reply
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 overflow-hidden"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Start New Discussion</h2>
              <form onSubmit={handleCreateThread} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Title</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="What's on your mind?"
                    value={newThread.title}
                    onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                  <select 
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={newThread.category}
                    onChange={(e) => setNewThread({ ...newThread, category: e.target.value })}
                  >
                    <option value="General">General</option>
                    <option value="Question">Question</option>
                    <option value="Announcement">Announcement</option>
                    <option value="Feedback">Feedback</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Content</label>
                  <textarea 
                    required
                    rows={5}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="Describe your discussion topic..."
                    value={newThread.content}
                    onChange={(e) => setNewThread({ ...newThread, content: e.target.value })}
                  />
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
                    Create Discussion
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

export default ForumModule;
