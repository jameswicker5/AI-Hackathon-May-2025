import React, { useState } from 'react';
import DocumentSidebar from './DocumentSidebar';
import MainContent from './MainContent';
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  status: 'processing' | 'ready' | 'error';
}

const AppLayout: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  
  const handleFileUpload = (newDocs: Document[]) => {
    setDocuments(prev => [...prev, ...newDocs]);
    if (newDocs.length > 0 && !activeDocumentId) {
      setActiveDocumentId(newDocs[0].id);
    }
    console.log(documents);
  };

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-kg-bg">
        {/* Mobile sidebar toggle */}
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={toggleSidebar}
            className="bg-white shadow-md"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Sidebar */}
        <div className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed lg:relative lg:translate-x-0 z-40 h-full w-80 transform transition-transform duration-200 ease-in-out`}>
          <DocumentSidebar 
            documents={documents} 
            activeDocumentId={activeDocumentId}
            onDocumentSelect={(id) => setActiveDocumentId(id)}
          />
        </div>
        
        {/* Main content area */}
        <div className="flex-1 overflow-hidden">
          <MainContent 
            onFileUpload={handleFileUpload}
            activeDocumentId={activeDocumentId}
            documents={documents}
          />
        </div>
        
        {/* Overlay for mobile when sidebar is open */}
        {sidebarOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
            onClick={toggleSidebar}
          />
        )}
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
