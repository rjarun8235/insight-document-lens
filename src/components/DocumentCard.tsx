
import { DocumentFile } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentCardProps {
  document: DocumentFile;
  onClick?: () => void;
}

export function DocumentCard({ document, onClick }: DocumentCardProps) {
  const { name, type, parsed, parseError } = document;
  
  // Determine icon color based on document status
  const getStatusColor = () => {
    if (parseError) return 'text-destructive';
    if (parsed) return 'text-green-500';
    return 'text-primary';
  };
  
  // Get the icon component to display
  const getStatusIcon = () => {
    if (parseError) return <XCircle className="h-5 w-5 text-destructive" />;
    if (parsed) return <CheckCircle className="h-5 w-5 text-green-500" />;
    return null;
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

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        onClick && "hover:scale-105"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center space-x-3">
        <div className={cn("flex-shrink-0", getStatusColor())}>
          <FileText className="h-8 w-8" />
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
      </CardContent>
    </Card>
  );
}
