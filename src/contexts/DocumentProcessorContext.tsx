import React, { createContext, useContext, ReactNode } from 'react';
import { useDocumentProcessor } from '@/hooks/useDocumentProcessor';
import { DocumentFile, ComparisonResult } from '@/lib/types';

// Define the context type
interface DocumentProcessorContextType {
  // State
  files: DocumentFile[];
  results: ComparisonResult | null;
  status: string;
  progress: number;
  processingStatus: string;
  error: string | null;
  activeTab: string;
  comparisonType: string;
  followUpQuestion: string;
  isAskingFollowUp: boolean;
  isWorkerSupported: boolean;
  
  // Actions
  setComparisonType: (type: string) => void;
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  processDocuments: () => Promise<void>;
  retryFile: (id: string) => Promise<void>;
  setFollowUpQuestion: (question: string) => void;
  askFollowUpQuestion: () => Promise<void>;
  setActiveTab: (tab: string) => void;
  clearError: () => void;
}

// Create the context
const DocumentProcessorContext = createContext<DocumentProcessorContextType | undefined>(undefined);

// Provider component
export function DocumentProcessorProvider({ children }: { children: ReactNode }) {
  const processor = useDocumentProcessor();
  
  return (
    <DocumentProcessorContext.Provider
      value={{
        // State
        files: processor.state.files,
        results: processor.state.results,
        status: processor.state.status,
        progress: processor.state.progress,
        processingStatus: processor.state.processingStatus,
        error: processor.state.error,
        activeTab: processor.state.activeTab,
        comparisonType: processor.comparisonType,
        followUpQuestion: processor.followUpQuestion,
        isAskingFollowUp: processor.isAskingFollowUp,
        isWorkerSupported: processor.isWorkerSupported,
        
        // Actions
        setComparisonType: processor.setComparisonType,
        addFiles: processor.addFiles,
        removeFile: processor.removeFile,
        clearFiles: processor.clearFiles,
        processDocuments: processor.processDocuments,
        retryFile: processor.retryFile,
        setFollowUpQuestion: processor.setFollowUpQuestion,
        askFollowUpQuestion: processor.askFollowUpQuestion,
        setActiveTab: processor.setActiveTab,
        clearError: processor.clearError,
      }}
    >
      {children}
    </DocumentProcessorContext.Provider>
  );
}

// Custom hook to use the document processor context
export function useDocumentProcessorContext() {
  const context = useContext(DocumentProcessorContext);
  
  if (context === undefined) {
    throw new Error('useDocumentProcessorContext must be used within a DocumentProcessorProvider');
  }
  
  return context;
}
