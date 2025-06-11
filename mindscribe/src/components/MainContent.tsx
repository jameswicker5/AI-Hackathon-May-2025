import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import FileUpload from './FileUpload';
import { Document } from './AppLayout';

interface MainContentProps {
  onFileUpload: (files: Document[]) => void;
  activeDocumentId: string | null;
  documents: Document[];
}

const MainContent: React.FC<MainContentProps> = ({ onFileUpload, activeDocumentId, documents }) => {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="p-4 border-b flex justify-between items-center">
        <h1 className="text-xl font-semibold">Document Explorer</h1>
        <div className="flex items-center gap-2">
          <Link to="/profile">
            <Button variant="ghost" size="icon" className="rounded-full" title="User Profile">
              <UserRound className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6">
        {documents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <FileUpload onFileUpload={onFileUpload} />
          </div>
        ) : (
          <div>
            {/* Show document content based on activeDocumentId */}
            {activeDocumentId ? (
              <div>
                {documents.find(doc => doc.id === activeDocumentId)?.name}
              </div>
            ) : (
              <div className="text-center text-gray-500">
                Select a document from the sidebar
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MainContent;
