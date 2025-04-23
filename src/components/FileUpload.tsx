
import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { DocumentFile, DocumentType } from '@/lib/types';
import { getDocumentType } from '@/lib/parsers';
import { cn } from '@/lib/utils';
import { FileText, X, Upload, File, FileSpreadsheet, Image, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { v4 as uuidv4 } from 'uuid';

interface FileUploadProps {
  onFilesSelected: (files: DocumentFile[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  showFileList?: boolean;
}

// Helper function to get file type icon
const getFileTypeIcon = (type: DocumentType) => {
  switch (type) {
    case 'pdf':
      return <FileText className="h-6 w-6" />;
    case 'image':
      return <Image className="h-6 w-6" />;
    case 'csv':
    case 'excel':
      return <FileSpreadsheet className="h-6 w-6" />;
    case 'doc':
      return <File className="h-6 w-6" />;
    default:
      return <FileText className="h-6 w-6" />;
  }
};

export function FileUpload({
  onFilesSelected,
  disabled = false,
  maxFiles = 10,
  showFileList = true
}: FileUploadProps) {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset error when disabled state changes
  useEffect(() => {
    if (disabled) {
      setError(null);
    }
  }, [disabled]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Clear any previous errors
    setError(null);

    // Check if adding these files would exceed the maximum
    if (files.length + acceptedFiles.length > maxFiles) {
      setError(`Maximum of ${maxFiles} files allowed`);
      // Only add files up to the maximum
      acceptedFiles = acceptedFiles.slice(0, maxFiles - files.length);
      if (acceptedFiles.length === 0) return;
    }

    const newDocumentFiles = acceptedFiles.map(file => ({
      id: uuidv4(),
      name: file.name,
      type: getDocumentType(file),
      file,
      parsed: false
    }));

    setFiles(prev => [...prev, ...newDocumentFiles]);
    onFilesSelected(newDocumentFiles);
  }, [onFilesSelected, files.length, maxFiles]);

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
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxFiles,
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
    }
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
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
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-3">
          {isDragReject ? (
            <AlertCircle className="h-10 w-10 text-destructive animate-pulse" />
          ) : isDragActive ? (
            <Upload className="h-10 w-10 text-primary animate-bounce" />
          ) : (
            <div className="flex space-x-2">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <Image className="h-8 w-8 text-muted-foreground" />
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
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
              Supports PDF, images (JPG, PNG), CSV, Excel, and Word documents
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Maximum {maxFiles} files allowed
            </p>
          </div>

          <div className="flex space-x-2 mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={e => e.stopPropagation()}
              className="relative overflow-hidden group"
            >
              <span className="relative z-10">Browse files</span>
              <span className="absolute inset-0 bg-primary/10 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300"></span>
            </Button>
          </div>

          {error && (
            <div className="text-sm text-destructive flex items-center mt-2">
              <AlertCircle className="h-4 w-4 mr-1" />
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
            {files.map((file) => (
              <Card
                key={file.id}
                className="p-3 flex items-center justify-between hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center space-x-2">
                  <div className="text-primary">
                    {getFileTypeIcon(file.type)}
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[150px]" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase">
                      {file.type} · {Math.round(file.file.size / 1024)} KB
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
                  <X className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
