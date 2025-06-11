import React, { useState, useEffect } from 'react';
import { Search, FileText, FileImage, File, X, CircleCheck, AlertCircle, Loader } from 'lucide-react';
import { Document } from './AppLayout';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

interface DocumentSidebarProps {
  documents: Document[];
  activeDocumentId: string | null;
  onDocumentSelect: (id: string) => void;
}

const DocumentSidebar: React.FC<DocumentSidebarProps> = ({
  documents,
  activeDocumentId,
  onDocumentSelect
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchedFiles, setFetchedFiles] = useState<Document[]>([]);

  useEffect(() => {
    // Fetch files from backend
    fetch('http://localhost:3000/files-list')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setFetchedFiles(data);
      })
      .catch(() => {});
  }, []);

  // Merge fetched files and current documents, avoiding duplicates by name
  const allDocuments = [
    ...fetchedFiles.filter(f => !documents.some(d => d.name === f.name)),
    ...documents
  ];

  const filteredDocuments = allDocuments.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDocumentIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) return <FileImage className="h-5 w-5 text-blue-500" />;
    if (["mp4", "webm", "ogg", "mov"].includes(ext)) return <File className="h-5 w-5 text-green-500" />; // Optionally use a video icon
    if (["mp3", "wav", "m4a"].includes(ext)) return <File className="h-5 w-5 text-purple-500" />; // Optionally use an audio icon
    if (["pdf"].includes(ext)) return <FileText className="h-5 w-5 text-red-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const getStatusIcon = (status: Document['status']) => {
    switch (status) {
      case 'processing':
        return <Loader className="h-4 w-4 text-amber-500 animate-spin" />;
      case 'ready':
        return <CircleCheck className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (date?: Date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-xl text-kg-neutral mb-3">Knowledge Base</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search documents..."
            className="pl-8 bg-gray-50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-9 w-9"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-2">
        {filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <File className="h-12 w-12 text-gray-300 mb-2" />
            <p className="text-gray-500">
              {documents.length === 0
                ? "No documents uploaded yet"
                : "No documents match your search"}
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {filteredDocuments.map((doc, idx) => (
              <li key={doc.id || idx}>
                <button
                  className={cn(
                    "w-full text-left p-2 rounded-md flex items-start hover:bg-gray-100 transition-colors",
                    activeDocumentId === doc.id ? "bg-gray-100" : ""
                  )}
                  onClick={() => onDocumentSelect(doc.id)}
                >
                  <div className="mr-3 mt-0.5">{getDocumentIcon(doc.name)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="font-medium truncate text-sm">{doc.name}</p>
                      <div className="ml-2 mt-0.5 flex-shrink-0">
                        {getStatusIcon(doc.status)}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{formatFileSize(doc.size)}</span>
                      <span>{formatDate(doc.uploadedAt)}</span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className="p-3 text-xs text-center text-gray-500 border-t border-gray-200">
        <p>KnowledgeGraph RAG System</p>
      </div>
    </div>
  );
};

export default DocumentSidebar;
