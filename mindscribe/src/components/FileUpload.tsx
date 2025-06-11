import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, File, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  onFileUpload: (files: File[]) => void;
}

interface FileWithPreview extends File {
  preview?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const { toast } = useToast();
  
  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Filter for supported file types
    const validFiles = acceptedFiles.filter(file => {
      const isValid =
        file.type === 'application/pdf' ||
        file.type === 'text/plain' ||
        file.type === 'text/markdown' ||
        file.name.endsWith('.md') ||
        file.type.startsWith('image/') ||
        file.type.startsWith('video/') ||
        file.type.startsWith('audio/');

      if (!isValid) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported file type. Please upload PDFs, text, markdown, image, video, or audio files.`,
          variant: "destructive",
        });
      }

      return isValid;
    });

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  }, [toast]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
      'video/*': ['.mp4', '.webm', '.ogg', '.mov'],
      'audio/*': ['.mp3', '.wav', '.ogg', '.m4a']
    }
  });
  
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one file to upload.",
        variant: "destructive",
      });
      return;
    }

    await uploadFilesToMinio(files)

    onFileUpload(files);
    setFiles([]);
  };
  
  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    if (type.startsWith('image/')) {
      return <File className="h-8 w-8 text-blue-500" />; // Optionally use an image icon
    }
    if (type.startsWith('video/')) {
      return <File className="h-8 w-8 text-green-500" />; // Optionally use a video icon
    }
    if (type.startsWith('audio/')) {
      return <File className="h-8 w-8 text-purple-500" />; // Optionally use an audio icon
    }
    return <File className="h-8 w-8 text-gray-500" />;
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const uploadFilesToMinio = async (files: File[]) => {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await fetch('http://localhost:3000/upload', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) throw new Error('Upload failed');
        toast({ title: 'Upload successful', description: `${file.name} uploaded.` });
      } catch (error) {
        toast({ title: 'Upload failed', description: `${file.name}: ${error}`, variant: 'destructive' });
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-kg-neutral mb-2">Upload Documents</h2>
        <p className="text-gray-500">
          Add Image, Video, Audio, PDF, TXT, or MD files to build your knowledge graph. The system will process your documents,
          extract concepts, and create relationships between them.
        </p>
      </div>
      
      <div 
        {...getRootProps()} 
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors",
          isDragActive ? "border-kg-primary bg-kg-primary/5" : "border-gray-300"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          <UploadCloud className={cn(
            "h-12 w-12 mb-4",
            isDragActive ? "text-kg-primary" : "text-gray-400"
          )} />
          
          <p className="font-medium mb-1">
            {isDragActive
              ? "Drop your documents here"
              : "Drag and drop documents here"
            }
          </p>
          <p className="text-sm text-gray-500 mb-3">or click to browse files</p>
          <p className="text-xs text-gray-500">
            Supported formats: PDF, TXT, MD, Images (JPG, PNG, GIF, BMP, WEBP), Video (MP4, WEBM, OGG, MOV), Audio (MP3, WAV, OGG, M4A)
          </p>
        </div>
      </div>
      
      {files.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-3">Selected Files ({files.length})</h3>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div 
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-white rounded-md border"
              >
                <div className="flex items-center">
                  {getFileIcon(file.type)}
                  <div className="ml-3">
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  className="h-8 w-8 text-gray-500 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          <div className="mt-4 flex justify-end">
            <Button
              variant="default"
              onClick={handleUpload}
              className="bg-kg-primary hover:bg-kg-primary/90"
            >
              Process {files.length} file{files.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}
      
      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mt-4">
        <div className="flex">
          <Info className="h-5 w-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-amber-800 mb-1">How processing works</h4>
            <span className="text-sm text-amber-700">
              When you upload documents, the system will:
              <ol className="list-decimal ml-5 mt-2 space-y-1">
                <li>Extract text from your documents</li>
                <li>Identify key concepts and entities</li>
                <li>Create a knowledge graph with relationships</li>
                <li>Generate embeddings for semantic search</li>
              </ol>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
