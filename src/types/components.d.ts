declare module '@/components/FileUpload' {
  import { FC } from 'react';
  import { DocumentFile } from '@/lib/types';
  
  export interface FileUploadProps {
    onFilesSelected: (files: DocumentFile[]) => void;
    disabled?: boolean;
  }
  
  export const FileUpload: FC<FileUploadProps>;
}

declare module '@/components/AnalysisResults' {
  import { FC } from 'react';
  import { ComparisonResult } from '@/lib/types';
  
  export interface AnalysisResultsProps {
    results: ComparisonResult;
  }
  
  export const AnalysisResults: FC<AnalysisResultsProps>;
}

declare module '@/components/ProcessingError' {
  import { FC } from 'react';
  
  export interface ProcessingErrorProps {
    message: string;
    onRetry?: () => void;
  }
  
  export const ProcessingError: FC<ProcessingErrorProps>;
}

declare module '@/components/DocumentCard' {
  import { FC } from 'react';
  import { DocumentFile } from '@/lib/types';
  
  export interface DocumentCardProps {
    document: DocumentFile;
    onClick?: () => void;
  }
  
  export const DocumentCard: FC<DocumentCardProps>;
}
