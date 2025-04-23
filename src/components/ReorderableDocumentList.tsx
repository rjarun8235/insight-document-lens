import { useState } from 'react';
import { DocumentFile } from '@/lib/types';
import { DocumentCard } from './DocumentCard';
// No longer using Button component
import { ArrowUp, ArrowDown, ChevronUp, ChevronDown } from 'lucide-react';

interface ReorderableDocumentListProps {
  documents: DocumentFile[];
  onReorder: (reorderedDocuments: DocumentFile[]) => void;
  onRemove: (id: string) => void;
  onRetry?: (id: string) => void;
  onSetPrimary?: (id: string) => void;
}

export function ReorderableDocumentList({
  documents,
  onReorder,
  onRemove,
  onRetry,
  onSetPrimary
}: ReorderableDocumentListProps) {
  const [primaryDocId, setPrimaryDocId] = useState<string | null>(
    documents.length > 0 ? documents[0].id : null
  );

  // Move a document up in the list
  const moveUp = (index: number) => {
    if (index <= 0) return;

    const items = Array.from(documents);
    const temp = items[index];
    items[index] = items[index - 1];
    items[index - 1] = temp;

    onReorder(items);
  };

  // Move a document down in the list
  const moveDown = (index: number) => {
    if (index >= documents.length - 1) return;

    const items = Array.from(documents);
    const temp = items[index];
    items[index] = items[index + 1];
    items[index + 1] = temp;

    onReorder(items);
  };

  // Handle setting a document as primary
  const handleSetPrimary = (id: string) => {
    setPrimaryDocId(id);
    if (onSetPrimary) {
      onSetPrimary(id);
    }
  };

  return (
    <div className="space-y-3">
      {documents.map((doc, index) => (
        <div
          key={doc.id}
          className={`relative transition-all duration-200 ${primaryDocId === doc.id ? 'ring-2 ring-primary ring-offset-2' : ''}`}
        >
          <div className="flex items-start">
            <div className="flex flex-col p-1 mr-1">
              <button
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className={`h-7 w-7 flex items-center justify-center rounded-md ${index === 0 ? 'opacity-30' : 'hover:bg-muted'}`}
                title="Move up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => moveDown(index)}
                disabled={index === documents.length - 1}
                className={`h-7 w-7 flex items-center justify-center rounded-md ${index === documents.length - 1 ? 'opacity-30' : 'hover:bg-muted'}`}
                title="Move down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1">
              <DocumentCard
                document={doc}
                onRetry={onRetry}
                onClick={() => {}}
              />
            </div>

            <div className="flex flex-col space-y-1 p-1">
              {onSetPrimary && primaryDocId !== doc.id && (
                <button
                  onClick={() => handleSetPrimary(doc.id)}
                  className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted"
                  title="Set as primary document"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => onRemove(doc.id)}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive"
                title="Remove document"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
          </div>

          {primaryDocId === doc.id && (
            <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-br-md">
              Primary
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
