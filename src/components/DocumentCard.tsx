import { DocumentFile } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/custom-button';
import { FileText, CheckCircle, XCircle, Image, FileSpreadsheet, File, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface DocumentCardProps {
  document: DocumentFile;
  onClick?: () => void;
  onRetry?: (id: string) => void;
  showPreview?: boolean;
}

export function DocumentCard({ document, onClick, onRetry, showPreview = true }: DocumentCardProps) {
  // Use type assertion to help TypeScript understand the structure
  const doc = document as {
    id: string;
    name: string;
    type: string;
    parsed: boolean;
    parseError?: string;
    parseProgress?: number;
    preview?: string;
    content?: string;
  };

  const { id, name, type, parsed, parseError, parseProgress, preview, content } = doc;
  const [showFullPreview, setShowFullPreview] = useState(false);

  // Determine if the document is currently being parsed
  const isParsing = parseProgress !== undefined && parseProgress > 0 && parseProgress < 100 && !parseError;

  // Determine icon color based on document status
  const getStatusColor = () => {
    if (parseError) return 'text-destructive';
    if (parsed) return 'text-green-500';
    if (isParsing) return 'text-amber-500';
    return 'text-primary';
  };

  // Get the icon component to display
  const getStatusIcon = () => {
    if (parseError) return (
      // @ts-ignore - Lucide icon is valid React node
      <XCircle className="h-5 w-5 text-destructive" />
    );
    if (parsed) return (
      // @ts-ignore - Lucide icon is valid React node
      <CheckCircle className="h-5 w-5 text-green-500" />
    );
    if (isParsing) return (
      // @ts-ignore - Lucide icon is valid React node
      <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
    );
    return null;
  };

  // Get the file type icon
  const getFileIcon = () => {
    switch (type) {
      case 'pdf':
        // @ts-ignore - Lucide icon is valid React node
        return <FileText className="h-8 w-8" />;
      case 'image':
        // @ts-ignore - Lucide icon is valid React node
        return <Image className="h-8 w-8" />;
      case 'csv':
      case 'excel':
        // @ts-ignore - Lucide icon is valid React node
        return <FileSpreadsheet className="h-8 w-8" />;
      case 'doc':
        // @ts-ignore - Lucide icon is valid React node
        return <File className="h-8 w-8" />;
      default:
        // @ts-ignore - Lucide icon is valid React node
        return <FileText className="h-8 w-8" />;
    }
  };

  // Get abbreviated file type label for display
  const getTypeLabel = () => {
    switch (type) {
      case 'pdf': return 'PDF';
      case 'csv': return 'CSV';
      case 'excel': return 'EXCEL';
      case 'doc': return 'DOC';
      case 'image': return 'IMAGE';
      default: return 'UNKNOWN';
    }
  };

  // Get preview text to display
  const getPreviewText = () => {
    if (!showPreview) return null;

    // Use explicit preview if available
    if (preview) {
      const displayText = showFullPreview ? preview : preview.substring(0, 100) + '...';
      return (
        <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <p className="line-clamp-3">{displayText}</p>
          {preview.length > 100 && (
            <button
              onClick={(e: any) => {
                e.stopPropagation();
                setShowFullPreview(!showFullPreview);
              }}
              className="text-xs text-primary hover:underline mt-1"
            >
              {showFullPreview ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      );
    }

    // Use content if available and no explicit preview
    if (content && typeof content === 'string') {
      const previewText = content.substring(0, 100) + '...';
      return (
        <div className="mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <p className="line-clamp-3">{previewText}</p>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className={`${cn(
        "transition-all hover:shadow-md",
        onClick && "cursor-pointer hover:scale-105"
      )}`}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-center space-x-3">
          <div className={`${cn("flex-shrink-0", getStatusColor())}`}>
            {getFileIcon()}
          </div>

          <div className="flex-grow min-w-0">
            <h3 className="font-medium text-sm truncate" title={name}>
              {name}
            </h3>
            <div className="flex items-center mt-1">
              <span className="text-xs px-2 py-0.5 bg-muted rounded-full">{getTypeLabel()}</span>
              {parseError && (
                <span className="ml-2 text-xs text-destructive truncate" title={parseError}>
                  {parseError}
                </span>
              )}
            </div>
          </div>

          <div className="flex-shrink-0">
            {getStatusIcon()}
          </div>
        </div>

        {/* Show progress bar if parsing */}
        {isParsing && (
          <div className="mt-3">
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-secondary">
              <div 
                className="h-full w-full flex-1 bg-primary transition-all"
                style={{ transform: `translateX(-${100 - (parseProgress || 0)}%)` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Parsing: {parseProgress}%
            </p>
          </div>
        )}

        {/* Show preview if available */}
        {getPreviewText()}
      </div>

      {/* Show retry button if there was an error and onRetry is provided */}
      {parseError && onRetry && (
        <div className="px-4 py-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(e: any) => {
              e.stopPropagation();
              onRetry(id);
            }}
          >
            <div className="flex items-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="12" 
                height="12" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="h-3 w-3 mr-2"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              <span>Retry</span>
            </div>
          </Button>
        </div>
      )}
    </div>
  );
}
