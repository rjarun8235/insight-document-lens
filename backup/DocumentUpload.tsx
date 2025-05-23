import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { DocumentFile, DocumentType } from '../lib/types';
import { cn } from '../lib/utils';

// Constants for file upload limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

/**
 * Generate a simple ID based on filename and current timestamp
 */
function generateDocumentId(fileName: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  // Clean the filename to use as part of the ID
  const cleanName = fileName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
  return `${cleanName}-${timestamp}-${randomSuffix}`;
}

/**
 * Helper function to get file type icon element
 */
const getFileTypeIcon = (type: DocumentType) => {
  switch (type) {
    case 'pdf':
      return <span className="h-6 w-6 flex items-center justify-center">📄</span>;
    case 'image':
      return <span className="h-6 w-6 flex items-center justify-center">🖼️</span>;
    case 'csv':
    case 'excel':
    case 'xls':
    case 'xlsx':
      return <span className="h-6 w-6 flex items-center justify-center">📊</span>;
    case 'doc':
    case 'docx':
      return <span className="h-6 w-6 flex items-center justify-center">📝</span>;
    case 'ppt':
    case 'pptx':
      return <span className="h-6 w-6 flex items-center justify-center">🎭</span>;
    case 'txt':
    case 'rtf':
    case 'xml':
    case 'json':
    case 'html':
      return <span className="h-6 w-6 flex items-center justify-center">📝</span>;
    case 'zip':
      return <span className="h-6 w-6 flex items-center justify-center">🗜️</span>;
    default:
      return <span className="h-6 w-6 flex items-center justify-center">📄</span>;
  }
};

/**
 * Helper to format file size
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

/**
 * Detect document type from file extension
 */
const detectDocumentType = (filename: string): DocumentType => {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  if (['pdf'].includes(extension)) return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'].includes(extension)) return 'image';
  if (['csv'].includes(extension)) return 'csv';
  if (['xls', 'xlsx'].includes(extension)) return 'excel';
  if (['doc', 'docx'].includes(extension)) return 'doc';
  if (['ppt', 'pptx'].includes(extension)) return 'ppt';
  if (['txt'].includes(extension)) return 'txt';
  if (['rtf'].includes(extension)) return 'rtf';
  if (['xml'].includes(extension)) return 'xml';
  if (['json'].includes(extension)) return 'json';
  if (['html', 'htm'].includes(extension)) return 'html';
  if (['zip'].includes(extension)) return 'zip';
  
  return 'unknown';
};

interface DocumentUploadProps {
  onFilesSelected?: (files: DocumentFile[]) => void;
}

export function DocumentUpload({ onFilesSelected }: DocumentUploadProps) {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Clear any previous errors
    setError(null);

    // Check if adding these files would exceed the maximum
    if (files.length + acceptedFiles.length > MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed`);
      // Only add files up to the maximum
      acceptedFiles = acceptedFiles.slice(0, MAX_FILES - files.length);
      if (acceptedFiles.length === 0) return;
    }

    // Filter out files that exceed the size limit
    const oversizedFiles = acceptedFiles.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(f => f.name).join(', ');
      setError(`Files exceeding ${formatFileSize(MAX_FILE_SIZE)} limit: ${fileNames}`);
      
      // Remove oversized files from accepted files
      acceptedFiles = acceptedFiles.filter(file => file.size <= MAX_FILE_SIZE);
      if (acceptedFiles.length === 0) return;
    }

    // Process accepted files
    const newDocumentFiles = acceptedFiles.map(file => {
      const type = detectDocumentType(file.name);
      return {
        id: generateDocumentId(file.name),
        name: file.name,
        type,
        file,
        parsed: false,
        parseProgress: 0
      } as DocumentFile;
    });

    // Update state with new files
    const updatedFiles = [...files, ...newDocumentFiles];
    setFiles(updatedFiles);

    // Notify parent component
    if (onFilesSelected) {
      onFilesSelected(updatedFiles);
    }
  }, [files, onFilesSelected]);

  const removeFile = (id: string) => {
    const updatedFiles = files.filter(file => file.id !== id);
    setFiles(updatedFiles);
    
    // Notify parent component
    if (onFilesSelected) {
      onFilesSelected(updatedFiles);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt'],
      'application/rtf': ['.rtf'],
      'application/xml': ['.xml'],
      'application/json': ['.json'],
      'text/html': ['.html', '.htm'],
      'application/zip': ['.zip']
    },
    maxFiles: MAX_FILES,
    onDragEnter: () => setDragOver(true),
    onDragLeave: () => setDragOver(false),
    onDropAccepted: () => setDragOver(false),
  });

  return (
    <div className="space-y-4 w-full">
      {/* Upload area */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          "hover:border-primary/50 hover:bg-primary/5",
          dragOver || isDragActive ? "border-primary bg-primary/5" : "border-gray-200"
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-2">
            <span className="text-2xl">📄</span>
          </div>
          
          <h3 className="text-lg font-medium">Drag & drop files here</h3>
          
          <p className="text-sm text-gray-500 max-w-md">
            Upload documents for analysis. Supported formats: PDF, Images, Office documents, 
            Text files, and more.
          </p>
          
          <p className="text-xs text-gray-400">
            Maximum {MAX_FILES} files allowed, {formatFileSize(MAX_FILE_SIZE)} per file
          </p>
          
          <button
            type="button"
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            onClick={e => e.stopPropagation()}
          >
            Browse files
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-500 flex items-center mt-4">
            <span className="h-4 w-4 mr-1 flex items-center justify-center">⚠️</span>
            {error}
          </div>
        )}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-4 animate-in fade-in-50 duration-300">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Selected files ({files.length}/{MAX_FILES})</h4>
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => {
                setFiles([]);
                setError(null);
                if (onFilesSelected) onFilesSelected([]);
              }}
            >
              Clear all
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {files.map((file) => (
              <div
                key={file.id}
                className="border rounded-md p-3 flex items-center justify-between bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  {getFileTypeIcon(file.type)}
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.file.size)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="h-8 w-8 opacity-50 hover:opacity-100 hover:text-red-500"
                  aria-label={`Remove ${file.name}`}
                >
                  <span className="h-4 w-4 flex items-center justify-center">❌</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
