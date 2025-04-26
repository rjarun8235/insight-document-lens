import React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { DocumentFile, DocumentType, ParsedDocument } from '../lib/types';
import { getDocumentType } from '@/lib/parsers';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/custom-button';

// Constants for file upload limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const FILES_PER_PAGE = 6;

/**
 * Generate a simple ID based on filename and current timestamp
 * This avoids the need for external UUID library
 */
function generateDocumentId(fileName: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  // Clean the filename to use as part of the ID
  const cleanName = fileName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
  return `${cleanName}-${timestamp}-${randomSuffix}`;
}

interface FileUploadProps {
  onFilesSelected: (files: DocumentFile[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  showFileList?: boolean;
  maxFileSize?: number;
}

// Helper function to get file type icon element
const getFileTypeIcon = (type: DocumentType) => {
  switch (type) {
    case 'pdf':
      return <span className="h-6 w-6 flex items-center justify-center">📄</span>;
    case 'image':
      return <span className="h-6 w-6 flex items-center justify-center">🖼️</span>;
    case 'csv':
    case 'excel':
      return <span className="h-6 w-6 flex items-center justify-center">📊</span>;
    case 'doc':
    case 'txt' as DocumentType:
      return <span className="h-6 w-6 flex items-center justify-center">📝</span>;
    default:
      return <span className="h-6 w-6 flex items-center justify-center">📄</span>;
  }
};

// Helper to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export function FileUpload({
  onFilesSelected,
  disabled = false,
  maxFiles = 10,
  showFileList = true,
  maxFileSize = MAX_FILE_SIZE
}: FileUploadProps) {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  // Create a ref to access the file input element directly
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Calculate total pages
  const totalPages = Math.ceil(files.length / FILES_PER_PAGE);
  
  // Get current page of files
  const currentFiles = files.slice(
    (currentPage - 1) * FILES_PER_PAGE, 
    currentPage * FILES_PER_PAGE
  );

  // Reset error when disabled state changes
  useEffect(() => {
    if (disabled) {
      setError(null);
    }
  }, [disabled]);

  // Reset to first page when files change
  useEffect(() => {
    if (files.length > 0 && currentPage > Math.ceil(files.length / FILES_PER_PAGE)) {
      setCurrentPage(1);
    }
  }, [files, currentPage]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Clear any previous errors
    setError(null);

    // Filter out files that exceed the size limit
    const oversizedFiles = acceptedFiles.filter(file => file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(f => f.name).join(', ');
      setError(`Files exceeding ${formatFileSize(maxFileSize)} limit: ${fileNames}`);
      
      // Remove oversized files from accepted files
      acceptedFiles = acceptedFiles.filter(file => file.size <= maxFileSize);
      if (acceptedFiles.length === 0) return;
    }

    // Check if adding these files would exceed the maximum
    if (files.length + acceptedFiles.length > maxFiles) {
      setError(`Maximum of ${maxFiles} files allowed`);
      // Only add files up to the maximum
      acceptedFiles = acceptedFiles.slice(0, maxFiles - files.length);
      if (acceptedFiles.length === 0) return;
    }

    // Check for image and PDF files that might be too large for Claude
    const largeImageWarnings: string[] = [];
    acceptedFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        if (file.size > 2 * 1024 * 1024) { // 2MB
          largeImageWarnings.push(`${file.name} (${formatFileSize(file.size)}) may use significant tokens.`);
        }
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        if (file.size > 10 * 1024 * 1024) { // 10MB
          largeImageWarnings.push(`${file.name} (${formatFileSize(file.size)}) is a large PDF that may use significant tokens.`);
        }
      }
    });

    if (largeImageWarnings.length > 0) {
      console.warn("Large file warnings:", largeImageWarnings);
      // We don't block the upload, but we do warn the user
      setError(`Note: ${largeImageWarnings.join(' ')} These files will be optimized automatically.`);
    }

    const newDocumentFiles = acceptedFiles.map(file => ({
      id: generateDocumentId(file.name),
      name: file.name,
      type: getDocumentType(file),
      file,
      parsed: false,
      content: { text: '', documentType: getDocumentType(file) } as ParsedDocument
    }));

    setFiles(prev => [...prev, ...newDocumentFiles]);
    onFilesSelected(newDocumentFiles);
    
    // Navigate to the last page to show newly added files
    setTimeout(() => {
      const newTotalPages = Math.ceil((files.length + newDocumentFiles.length) / FILES_PER_PAGE);
      setCurrentPage(newTotalPages);
    }, 0);
  }, [onFilesSelected, files.length, maxFiles, maxFileSize]);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    disabled,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt', '.text']
    },
    maxFiles,
    maxSize: maxFileSize,
    onDragEnter: () => setDragOver(true),
    onDragLeave: () => setDragOver(false),
    onDropAccepted: () => setDragOver(false),
    onDropRejected: (fileRejections) => {
      setDragOver(false);
      // Handle file rejections (e.g., unsupported file types)
      if (fileRejections.length > 0) {
        const errors = fileRejections.map(rejection => {
          const error = rejection.errors[0];
          return `${rejection.file.name}: ${error.message}`;
        });
        setError(errors[0]); // Just show the first error for simplicity
      }
    },
    multiple: true,
    onDragOver: (event) => {
      event.preventDefault();
    },
    noClick: false,
    noKeyboard: false,
    noDrag: false,
    noDragEventsBubbling: false,
    useFsAccessApi: false,
    autoFocus: false,
    preventDropOnDocument: true
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
  };

  // Pagination controls
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
          isDragActive && !isDragReject && "border-primary bg-primary/5 scale-[1.02] shadow-md",
          isDragReject && "border-destructive bg-destructive/5",
          !isDragActive && !disabled && "border-gray-300 hover:border-primary/50 hover:bg-muted/50",
          disabled && "opacity-50 cursor-not-allowed bg-muted"
        )}
      >
        <input {...getInputProps()} ref={fileInputRef} />
        <div className="flex flex-col items-center justify-center space-y-3">
          {isDragReject ? (
            <span className="h-10 w-10 flex items-center justify-center text-destructive animate-pulse">⚠️</span>
          ) : isDragActive ? (
            <span className="h-10 w-10 flex items-center justify-center text-primary animate-bounce">⬆️</span>
          ) : (
            <div className="flex space-x-2">
              <span className="h-8 w-8 flex items-center justify-center">📄</span>
              <span className="h-8 w-8 flex items-center justify-center">🖼️</span>
              <span className="h-8 w-8 flex items-center justify-center">📊</span>
            </div>
          )}

          <h3 className="text-lg font-medium">
            {isDragReject ? (
              "Unsupported file type"
            ) : isDragActive ? (
              "Drop files to upload"
            ) : (
              "Drag & drop files here"
            )}
          </h3>

          <div className="max-w-md">
            <p className="text-sm text-muted-foreground">
              Supports PDF, images (JPG, PNG), CSV, Excel, Word documents, and text files (TXT)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Maximum {maxFiles} files allowed, {formatFileSize(maxFileSize)} per file
            </p>
          </div>

          <div className="flex space-x-2 mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={e => {
                e.stopPropagation();
                // Trigger the file input click event
                if (fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
              className="relative overflow-hidden group"
            >
              <span className="relative z-10">Browse files</span>
              <span className="absolute inset-0 bg-primary/10 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></span>
            </Button>
          </div>

          {error && (
            <div className="text-sm text-destructive flex items-center mt-2">
              <span className="h-4 w-4 mr-1 flex items-center justify-center">⚠️</span>
              {error}
            </div>
          )}
        </div>
      </div>

      {showFileList && files.length > 0 && (
        <div className="space-y-3 animate-in fade-in-50 duration-300">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Selected files ({files.length}/{maxFiles})</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFiles([]);
                setError(null);
              }}
              className="text-xs"
            >
              Clear all
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentFiles.map((file) => (
              <div
                key={file.id}
                className="border rounded-md p-3 flex items-center justify-between bg-background shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  {getFileTypeIcon(file.type)}
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.parsed
                        ? "Parsed"
                        : file.parseError
                          ? file.parseError
                          : "Ready for analysis"} • {formatFileSize(file.file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(file.id)}
                  className="h-8 w-8 opacity-50 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remove ${file.name}`}
                >
                  <span className="h-4 w-4 flex items-center justify-center">❌</span>
                </Button>
              </div>
             ))}
          </div>
          
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className="px-2 py-1"
              >
                <span>←</span>
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="px-2 py-1"
              >
                <span>→</span>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
