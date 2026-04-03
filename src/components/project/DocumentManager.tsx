import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { ProjectDocument } from '../../types';
import { 
  Plus, 
  File, 
  Trash2, 
  Download, 
  Search, 
  Filter, 
  FileText, 
  Image as ImageIcon, 
  FileCode, 
  FileArchive,
  MoreVertical,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DocumentManagerProps {
  projectId: string;
}

const DocumentManager: React.FC<DocumentManagerProps> = ({ projectId }) => {
  const { organization, user: currentUser } = useAuth();
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('All');

  const [newDoc, setNewDoc] = useState({ 
    name: '', 
    url: '', 
    type: 'PDF' as any,
    size: 0
  });

  useEffect(() => {
    if (!projectId) return;

    const q = query(collection(db, `projects/${projectId}/documents`), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectDocument)));
    });

    return () => unsubscribe();
  }, [projectId]);

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !organization || !currentUser) return;

    try {
      await addDoc(collection(db, `projects/${projectId}/documents`), {
        ...newDoc,
        projectId,
        organizationId: organization.id,
        uploadedBy: currentUser.uid,
        uploadedByName: currentUser.displayName,
        createdAt: serverTimestamp(),
      });
      toast.success('Document added successfully!');
      setIsModalOpen(false);
      setNewDoc({ name: '', url: '', type: 'PDF', size: 0 });
    } catch (error) {
      toast.error('Failed to add document');
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteDoc(doc(db, `projects/${projectId}/documents`, docId));
      toast.success('Document deleted');
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'All' || doc.type === filterType;
    return matchesSearch && matchesType;
  });

  const getFileIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'PDF': return <FileText className="text-red-500" size={24} />;
      case 'DOC':
      case 'DOCX': return <FileText className="text-blue-500" size={24} />;
      case 'XLS':
      case 'XLSX': return <FileText className="text-green-500" size={24} />;
      case 'JPG':
      case 'PNG':
      case 'GIF': return <ImageIcon className="text-purple-500" size={24} />;
      case 'ZIP':
      case 'RAR': return <FileArchive className="text-amber-500" size={24} />;
      case 'JS':
      case 'TS':
      case 'HTML':
      case 'CSS': return <FileCode className="text-indigo-500" size={24} />;
      default: return <File className="text-gray-500" size={24} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Search documents..."
            className="w-full pl-12 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-400" />
          <select 
            className="bg-gray-50 border-none rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="All">All Types</option>
            <option value="PDF">PDF</option>
            <option value="DOCX">Word</option>
            <option value="XLSX">Excel</option>
            <option value="JPG">Images</option>
            <option value="ZIP">Archives</option>
          </select>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 ml-auto"
        >
          <Plus size={18} />
          Upload Document
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDocs.map((doc) => (
          <motion.div 
            key={doc.id} 
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group relative"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-indigo-50 transition-colors">
                {getFileIcon(doc.type)}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a 
                  href={doc.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                >
                  <ExternalLink size={18} />
                </a>
                <button 
                  onClick={() => handleDeleteDocument(doc.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            
            <h4 className="text-sm font-bold text-gray-900 truncate mb-1">{doc.name}</h4>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{doc.type} • {(doc.size / 1024).toFixed(1)} KB</span>
              <span className="text-[10px] text-gray-400">{doc.createdAt ? format(doc.createdAt.toDate(), 'MMM d, yyyy') : ''}</span>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                {doc.uploadedByName?.charAt(0) || 'U'}
              </div>
              <span className="text-[10px] text-gray-500">Uploaded by {doc.uploadedByName || 'Unknown'}</span>
            </div>
          </motion.div>
        ))}
        {filteredDocs.length === 0 && (
          <div className="col-span-full py-20 text-center text-gray-400 italic">
            No documents found. Upload your first project file.
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Document</h2>
              <form onSubmit={handleCreateDocument} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Document Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="e.g. Project Proposal"
                    value={newDoc.name}
                    onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Document URL</label>
                  <input 
                    required
                    type="url" 
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="https://example.com/file.pdf"
                    value={newDoc.url}
                    onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">File Type</label>
                    <select 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={newDoc.type}
                      onChange={(e) => setNewDoc({ ...newDoc, type: e.target.value as any })}
                    >
                      <option value="PDF">PDF</option>
                      <option value="DOCX">Word</option>
                      <option value="XLSX">Excel</option>
                      <option value="JPG">Image</option>
                      <option value="ZIP">Archive</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">File Size (KB)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="1024"
                      value={newDoc.size || ''}
                      onChange={(e) => setNewDoc({ ...newDoc, size: parseInt(e.target.value) * 1024 })}
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
                    Add Document
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

export default DocumentManager;
