/**
 * Document Processing Context
 * 
 * This context serves as the central state management and business logic orchestration
 * for the document processing application. It owns all application state and business
 * operations, integrating with the service layer and providing a clear API for UI components.
 * 
 * Responsibility: Owns state management, business operations, and service integration.
 * Components should only consume state and dispatch actions, with no business logic.
 */

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { 
  ClaudeApiService, 
  ClaudeApiError 
} from '../lib/services/claude-api.service';
import { 
  DocumentExtractorService, 
  DocumentFile,
  ExtractionResult,
  EnhancedExtractionResult,
  ExtractionOptions
} from '../lib/services/document-extractor.service';
import {
  DocumentVerificationService,
  DocumentVerificationReport,
  VerificationOptions
} from '../lib/services/document-verification.service';
import { LogisticsDocumentType } from '../lib/document-types';

// ===== TYPE DEFINITIONS =====

/**
 * Represents a processed document with its extraction result
 */
export interface ProcessedDocument {
  id: string;
  file: File;
  name: string;
  documentType: LogisticsDocumentType;
  content?: string;
  extraction?: EnhancedExtractionResult;
  isProcessing: boolean;
  error?: string;
}

/**
 * Represents the progress of a document processing operation
 */
export interface ProcessingProgress {
  current: number;
  total: number;
  fileName: string;
  status: 'idle' | 'processing' | 'complete' | 'error';
}

/**
 * Represents the state of the document processing context
 */
export interface DocumentProcessingState {
  // Document state
  documents: ProcessedDocument[];
  selectedDocumentIds: string[];
  
  // Processing state
  isExtracting: boolean;
  isVerifying: boolean;
  currentProgress: ProcessingProgress;
  
  // Results
  extractionResults: EnhancedExtractionResult[];
  verificationReport: DocumentVerificationReport | null;
  
  // UI state
  showJsonOutput: boolean;
  activeTab: 'results' | 'comparison' | 'validation' | 'performance' | 'expert-verification';
  
  // Error state
  error: string | null;
}

/**
 * Action types for the document processing reducer
 */
export type DocumentProcessingAction =
  | { type: 'ADD_DOCUMENTS'; payload: { files: File[]; documentTypes?: Record<string, LogisticsDocumentType> } }
  | { type: 'REMOVE_DOCUMENT'; payload: { id: string } }
  | { type: 'UPDATE_DOCUMENT_TYPE'; payload: { id: string; documentType: LogisticsDocumentType } }
  | { type: 'SELECT_DOCUMENTS'; payload: { ids: string[] } }
  | { type: 'SET_DOCUMENT_CONTENT'; payload: { id: string; content: string } }
  | { type: 'SET_EXTRACTION_RESULT'; payload: { id: string; result: EnhancedExtractionResult } }
  | { type: 'SET_EXTRACTION_RESULTS'; payload: { results: EnhancedExtractionResult[] } }
  | { type: 'SET_VERIFICATION_REPORT'; payload: { report: DocumentVerificationReport } }
  | { type: 'SET_EXTRACTING'; payload: { isExtracting: boolean } }
  | { type: 'SET_VERIFYING'; payload: { isVerifying: boolean } }
  | { type: 'SET_PROGRESS'; payload: { progress: ProcessingProgress } }
  | { type: 'SET_SHOW_JSON'; payload: { show: boolean } }
  | { type: 'SET_ACTIVE_TAB'; payload: { tab: DocumentProcessingState['activeTab'] } }
  | { type: 'SET_ERROR'; payload: { error: string | null } }
  | { type: 'RESET_STATE' };

/**
 * Context interface exposed to consumers
 */
export interface DocumentProcessingContextType {
  // State
  state: DocumentProcessingState;
  
  // Document operations
  addDocuments: (files: File[], documentTypes?: Record<string, LogisticsDocumentType>) => void;
  removeDocument: (id: string) => void;
  updateDocumentType: (id: string, documentType: LogisticsDocumentType) => void;
  selectDocuments: (ids: string[]) => void;
  
  // Processing operations
  extractDocuments: (options?: ExtractionOptions) => Promise<EnhancedExtractionResult[]>;
  verifyDocuments: (options?: VerificationOptions) => Promise<DocumentVerificationReport>;
  
  // UI operations
  setShowJsonOutput: (show: boolean) => void;
  setActiveTab: (tab: DocumentProcessingState['activeTab']) => void;
  
  // Error handling
  setError: (error: string | null) => void;
  resetState: () => void;
  
  // Computed properties
  isComplete: boolean;
  progressPercentage: number;
  hasDocuments: boolean;
  hasExtractionResults: boolean;
  hasVerificationReport: boolean;
  selectedDocuments: ProcessedDocument[];
}

// ===== INITIAL STATE =====

/**
 * Initial state for the document processing context
 */
const initialState: DocumentProcessingState = {
  documents: [],
  selectedDocumentIds: [],
  isExtracting: false,
  isVerifying: false,
  currentProgress: {
    current: 0,
    total: 0,
    fileName: '',
    status: 'idle'
  },
  extractionResults: [],
  verificationReport: null,
  showJsonOutput: false,
  activeTab: 'results',
  error: null
};

// ===== REDUCER =====

/**
 * Reducer function for the document processing context
 */
const documentProcessingReducer = (
  state: DocumentProcessingState,
  action: DocumentProcessingAction
): DocumentProcessingState => {
  switch (action.type) {
    case 'ADD_DOCUMENTS': {
      const { files, documentTypes = {} } = action.payload;
      
      // Create new document objects
      const newDocuments: ProcessedDocument[] = files.map(file => {
        const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        return {
          id,
          file,
          name: file.name,
          documentType: documentTypes[file.name] || 'unknown',
          isProcessing: false,
          error: undefined
        };
      });
      
      return {
        ...state,
        documents: [...state.documents, ...newDocuments],
        selectedDocumentIds: [...state.selectedDocumentIds, ...newDocuments.map(doc => doc.id)]
      };
    }
    
    case 'REMOVE_DOCUMENT': {
      const { id } = action.payload;
      
      return {
        ...state,
        documents: state.documents.filter(doc => doc.id !== id),
        selectedDocumentIds: state.selectedDocumentIds.filter(docId => docId !== id),
        extractionResults: state.extractionResults.filter(
          result => !state.documents.find(doc => doc.id === id && doc.name === result.fileName)
        )
      };
    }
    
    case 'UPDATE_DOCUMENT_TYPE': {
      const { id, documentType } = action.payload;
      
      return {
        ...state,
        documents: state.documents.map(doc =>
          doc.id === id
            ? { ...doc, documentType }
            : doc
        )
      };
    }
    
    case 'SELECT_DOCUMENTS': {
      const { ids } = action.payload;
      
      return {
        ...state,
        selectedDocumentIds: ids
      };
    }
    
    case 'SET_DOCUMENT_CONTENT': {
      const { id, content } = action.payload;
      
      return {
        ...state,
        documents: state.documents.map(doc =>
          doc.id === id
            ? { ...doc, content }
            : doc
        )
      };
    }
    
    case 'SET_EXTRACTION_RESULT': {
      const { id, result } = action.payload;
      
      // Update the document with the extraction result
      const updatedDocuments = state.documents.map(doc =>
        doc.id === id
          ? { 
              ...doc, 
              extraction: result,
              isProcessing: false,
              error: result.success ? undefined : result.error?.message
            }
          : doc
      );
      
      // Update or add the extraction result in the results array
      let updatedResults = [...state.extractionResults];
      const existingIndex = updatedResults.findIndex(
        r => r.fileName === result.fileName
      );
      
      if (existingIndex >= 0) {
        updatedResults[existingIndex] = result;
      } else {
        updatedResults.push(result);
      }
      
      return {
        ...state,
        documents: updatedDocuments,
        extractionResults: updatedResults
      };
    }
    
    case 'SET_EXTRACTION_RESULTS': {
      const { results } = action.payload;
      
      // Update all documents with their extraction results
      const updatedDocuments = state.documents.map(doc => {
        const result = results.find(r => r.fileName === doc.name);
        
        if (result) {
          return {
            ...doc,
            extraction: result,
            isProcessing: false,
            error: result.success ? undefined : result.error?.message
          };
        }
        
        return doc;
      });
      
      return {
        ...state,
        documents: updatedDocuments,
        extractionResults: results
      };
    }
    
    case 'SET_VERIFICATION_REPORT': {
      const { report } = action.payload;
      
      return {
        ...state,
        verificationReport: report,
        activeTab: 'expert-verification'
      };
    }
    
    case 'SET_EXTRACTING': {
      const { isExtracting } = action.payload;
      
      // If starting extraction, update progress
      if (isExtracting) {
        return {
          ...state,
          isExtracting,
          currentProgress: {
            current: 0,
            total: state.selectedDocumentIds.length,
            fileName: '',
            status: 'processing'
          },
          // Mark selected documents as processing
          documents: state.documents.map(doc =>
            state.selectedDocumentIds.includes(doc.id)
              ? { ...doc, isProcessing: true, error: undefined }
              : doc
          )
        };
      }
      
      // If finishing extraction, update progress
      return {
        ...state,
        isExtracting,
        currentProgress: {
          ...state.currentProgress,
          status: state.currentProgress.current === state.currentProgress.total
            ? 'complete'
            : 'error'
        }
      };
    }
    
    case 'SET_VERIFYING': {
      const { isVerifying } = action.payload;
      
      return {
        ...state,
        isVerifying
      };
    }
    
    case 'SET_PROGRESS': {
      const { progress } = action.payload;
      
      return {
        ...state,
        currentProgress: progress
      };
    }
    
    case 'SET_SHOW_JSON': {
      const { show } = action.payload;
      
      return {
        ...state,
        showJsonOutput: show
      };
    }
    
    case 'SET_ACTIVE_TAB': {
      const { tab } = action.payload;
      
      return {
        ...state,
        activeTab: tab
      };
    }
    
    case 'SET_ERROR': {
      const { error } = action.payload;
      
      return {
        ...state,
        error
      };
    }
    
    case 'RESET_STATE': {
      return {
        ...initialState
      };
    }
    
    default:
      return state;
  }
};

// ===== CONTEXT CREATION =====

/**
 * Create the document processing context
 */
const DocumentProcessingContext = createContext<DocumentProcessingContextType | undefined>(undefined);

/**
 * Provider component for the document processing context
 */
export const DocumentProcessingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize services
  const claudeApiService = new ClaudeApiService();
  const documentExtractorService = new DocumentExtractorService(claudeApiService);
  const documentVerificationService = new DocumentVerificationService(claudeApiService);
  
  // Set up state with reducer
  const [state, dispatch] = useReducer(documentProcessingReducer, initialState);
  
  // Error handling effect
  useEffect(() => {
    if (state.error) {
      console.error('Document processing error:', state.error);
      
      // Clear error after 5 seconds
      const timer = setTimeout(() => {
        dispatch({ type: 'SET_ERROR', payload: { error: null } });
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [state.error]);
  
  // ===== ACTION DISPATCHERS =====
  
  /**
   * Adds documents to the context
   */
  const addDocuments = (
    files: File[],
    documentTypes: Record<string, LogisticsDocumentType> = {}
  ) => {
    dispatch({
      type: 'ADD_DOCUMENTS',
      payload: { files, documentTypes }
    });
    
    // Automatically read file contents
    files.forEach(async (file) => {
      try {
        const content = await readFileAsText(file);
        const id = state.documents.find(doc => doc.name === file.name)?.id;
        
        if (id) {
          dispatch({
            type: 'SET_DOCUMENT_CONTENT',
            payload: { id, content }
          });
        }
      } catch (error) {
        console.error(`Error reading file ${file.name}:`, error);
        dispatch({
          type: 'SET_ERROR',
          payload: { error: `Error reading file ${file.name}: ${error instanceof Error ? error.message : String(error)}` }
        });
      }
    });
  };
  
  /**
   * Removes a document from the context
   */
  const removeDocument = (id: string) => {
    dispatch({
      type: 'REMOVE_DOCUMENT',
      payload: { id }
    });
  };
  
  /**
   * Updates a document's type
   */
  const updateDocumentType = (id: string, documentType: LogisticsDocumentType) => {
    dispatch({
      type: 'UPDATE_DOCUMENT_TYPE',
      payload: { id, documentType }
    });
  };
  
  /**
   * Selects documents for processing
   */
  const selectDocuments = (ids: string[]) => {
    dispatch({
      type: 'SELECT_DOCUMENTS',
      payload: { ids }
    });
  };
  
  /**
   * Extracts data from selected documents
   */
  const extractDocuments = async (
    options: ExtractionOptions = {}
  ): Promise<EnhancedExtractionResult[]> => {
    try {
      // Set extracting state
      dispatch({ type: 'SET_EXTRACTING', payload: { isExtracting: true } });
      
      // Get selected documents
      const selectedDocuments = state.documents.filter(
        doc => state.selectedDocumentIds.includes(doc.id)
      );
      
      if (selectedDocuments.length === 0) {
        throw new Error('No documents selected for extraction');
      }
      
      // Process each document
      const results: EnhancedExtractionResult[] = [];
      
      for (let i = 0; i < selectedDocuments.length; i++) {
        const doc = selectedDocuments[i];
        
        // Update progress
        dispatch({
          type: 'SET_PROGRESS',
          payload: {
            progress: {
              current: i,
              total: selectedDocuments.length,
              fileName: doc.name,
              status: 'processing'
            }
          }
        });
        
        // Skip if no content
        if (!doc.content) {
          console.warn(`Document ${doc.name} has no content, skipping extraction`);
          continue;
        }
        
        // Create document file for extraction
        const documentFile: DocumentFile = {
          id: doc.id,
          name: doc.name,
          content: doc.content,
          documentType: doc.documentType,
          mimeType: doc.file.type,
          size: doc.file.size
        };
        
        // Extract data
        try {
          const result = await documentExtractorService.extractFromDocument(
            documentFile,
            options
          );
          
          // Update document with result
          dispatch({
            type: 'SET_EXTRACTION_RESULT',
            payload: { id: doc.id, result }
          });
          
          results.push(result);
        } catch (error) {
          console.error(`Error extracting data from ${doc.name}:`, error);
          
          // Create error result
          const errorResult: EnhancedExtractionResult = {
            success: false,
            error: {
              message: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`
            },
            fileName: doc.name,
            documentType: doc.documentType
          };
          
          // Update document with error result
          dispatch({
            type: 'SET_EXTRACTION_RESULT',
            payload: { id: doc.id, result: errorResult }
          });
          
          results.push(errorResult);
        }
      }
      
      // Update progress to complete
      dispatch({
        type: 'SET_PROGRESS',
        payload: {
          progress: {
            current: selectedDocuments.length,
            total: selectedDocuments.length,
            fileName: '',
            status: 'complete'
          }
        }
      });
      
      // Set extraction results
      dispatch({
        type: 'SET_EXTRACTION_RESULTS',
        payload: { results }
      });
      
      return results;
    } catch (error) {
      console.error('Document extraction failed:', error);
      
      // Set error state
      dispatch({
        type: 'SET_ERROR',
        payload: { error: `Extraction failed: ${error instanceof Error ? error.message : String(error)}` }
      });
      
      // Update progress to error
      dispatch({
        type: 'SET_PROGRESS',
        payload: {
          progress: {
            ...state.currentProgress,
            status: 'error'
          }
        }
      });
      
      return [];
    } finally {
      // Reset extracting state
      dispatch({ type: 'SET_EXTRACTING', payload: { isExtracting: false } });
    }
  };
  
  /**
   * Verifies extracted documents
   */
  const verifyDocuments = async (
    options: VerificationOptions = {}
  ): Promise<DocumentVerificationReport> => {
    try {
      // Set verifying state
      dispatch({ type: 'SET_VERIFYING', payload: { isVerifying: true } });
      
      // Get extraction results
      const results = state.extractionResults.filter(result => result.success);
      
      if (results.length === 0) {
        throw new Error('No successful extraction results to verify');
      }
      
      if (results.length < 2) {
        throw new Error('At least two successful extractions are required for verification');
      }
      
      // Verify documents
      const report = await documentVerificationService.verifyDocuments(
        results,
        options
      );
      
      // Set verification report
      dispatch({
        type: 'SET_VERIFICATION_REPORT',
        payload: { report }
      });
      
      return report;
    } catch (error) {
      console.error('Document verification failed:', error);
      
      // Set error state
      dispatch({
        type: 'SET_ERROR',
        payload: { error: `Verification failed: ${error instanceof Error ? error.message : String(error)}` }
      });
      
      // Create minimal error report
      const errorReport: DocumentVerificationReport = {
        summary: {
          shipmentIdentifier: 'unknown',
          documentCount: state.extractionResults.length,
          documentTypes: state.extractionResults.map(r => r.documentType || 'unknown'),
          consistencyScore: 0,
          riskAssessment: 'high',
          expertSummary: `Verification failed: ${error instanceof Error ? error.message : String(error)}`
        },
        discrepancies: [],
        insights: [{
          title: 'Verification Error',
          description: `The verification process encountered an error: ${error instanceof Error ? error.message : String(error)}`,
          category: 'operational',
          severity: 'critical'
        }],
        recommendations: [{
          action: 'Review documents manually and retry verification',
          priority: 'high',
          reasoning: 'Automated verification failed and requires manual intervention'
        }],
        metadata: {
          analysisTimestamp: new Date().toISOString(),
          processingTime: 0
        }
      };
      
      // Set verification report
      dispatch({
        type: 'SET_VERIFICATION_REPORT',
        payload: { report: errorReport }
      });
      
      return errorReport;
    } finally {
      // Reset verifying state
      dispatch({ type: 'SET_VERIFYING', payload: { isVerifying: false } });
    }
  };
  
  /**
   * Sets the show JSON output flag
   */
  const setShowJsonOutput = (show: boolean) => {
    dispatch({
      type: 'SET_SHOW_JSON',
      payload: { show }
    });
  };
  
  /**
   * Sets the active tab
   */
  const setActiveTab = (tab: DocumentProcessingState['activeTab']) => {
    dispatch({
      type: 'SET_ACTIVE_TAB',
      payload: { tab }
    });
  };
  
  /**
   * Sets the error state
   */
  const setError = (error: string | null) => {
    dispatch({
      type: 'SET_ERROR',
      payload: { error }
    });
  };
  
  /**
   * Resets the state
   */
  const resetState = () => {
    dispatch({ type: 'RESET_STATE' });
  };
  
  // ===== COMPUTED PROPERTIES =====
  
  /**
   * Whether the extraction is complete
   */
  const isComplete = state.currentProgress.current === state.currentProgress.total && 
                     state.currentProgress.total > 0 &&
                     state.currentProgress.status === 'complete';
  
  /**
   * The progress percentage
   */
  const progressPercentage = state.currentProgress.total > 0
    ? (state.currentProgress.current / state.currentProgress.total) * 100
    : 0;
  
  /**
   * Whether there are documents
   */
  const hasDocuments = state.documents.length > 0;
  
  /**
   * Whether there are extraction results
   */
  const hasExtractionResults = state.extractionResults.length > 0;
  
  /**
   * Whether there is a verification report
   */
  const hasVerificationReport = state.verificationReport !== null;
  
  /**
   * The selected documents
   */
  const selectedDocuments = state.documents.filter(
    doc => state.selectedDocumentIds.includes(doc.id)
  );
  
  // ===== CONTEXT VALUE =====
  
  /**
   * The context value
   */
  const contextValue: DocumentProcessingContextType = {
    state,
    addDocuments,
    removeDocument,
    updateDocumentType,
    selectDocuments,
    extractDocuments,
    verifyDocuments,
    setShowJsonOutput,
    setActiveTab,
    setError,
    resetState,
    isComplete,
    progressPercentage,
    hasDocuments,
    hasExtractionResults,
    hasVerificationReport,
    selectedDocuments
  };
  
  return (
    <DocumentProcessingContext.Provider value={contextValue}>
      {children}
    </DocumentProcessingContext.Provider>
  );
};

// ===== HELPER FUNCTIONS =====

/**
 * Reads a file as text
 */
const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsText(file);
  });
};

// ===== CUSTOM HOOK =====

/**
 * Custom hook for consuming the document processing context
 */
export const useDocumentProcessing = (): DocumentProcessingContextType => {
  const context = useContext(DocumentProcessingContext);
  
  if (!context) {
    throw new Error('useDocumentProcessing must be used within a DocumentProcessingProvider');
  }
  
  return context;
};

export default DocumentProcessingContext;
