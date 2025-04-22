
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { DocumentFile, DocumentType } from '@/lib/types';
import { getDocumentType } from '@/lib/parsers';
import { cn } from '@/lib/utils';
import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface FileUploadProps {
  onFilesSelected: (files: DocumentFile[]) => void;
  disabled?: boolean;
}

export function FileUpload({ onFilesSelected, disabled = false }: FileUploadProps) {
  const [files, setFiles] = useState<DocumentFile[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newDocumentFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      name: file.name,
      type: getDocumentType(file),
      file,
      parsed: false
    }));

    setFiles(prev => [...prev, ...newDocumentFiles]);
    onFilesSelected(newDocumentFiles);
  }, [onFilesSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
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
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-2">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-medium">
            {isDragActive ? "Drop files here" : "Drag & drop files"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Supports PDF, images, CSV, Excel, and Word documents
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={e => e.stopPropagation()}
            className="mt-2"
          >
            Browse files
          </Button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Selected files ({files.length})</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {files.map((file) => (
              <Card key={file.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium truncate max-w-[150px]">{file.name}</p>
                    <p className="text-xs text-muted-foreground uppercase">{file.type}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(file.id)}
                  className="h-8 w-8"
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
