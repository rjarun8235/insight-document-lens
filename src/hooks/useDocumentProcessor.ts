import React, { useState, useRef, useCallback } from 'react';
import { DocumentFile as LibDocumentFile, ComparisonResult as LibComparisonResult, ComparisonTable as LibComparisonTable } from '@/lib/types';
import { parseDocument } from '@/lib/parsers';
import { analyzeDocuments, prepareInstructions } from '@/utils/document-utils';
import { workerService } from '@/services/worker-service';
import { getDocumentType } from '@/lib/parsers';
import { TokenUsage, ParsedDocument, ComparisonResult as AppComparisonResult, ComparisonTable as AppComparisonTable } from '@/types/app-types';

// Define document processing states
export type ProcessingStatus = 'idle' | 'parsing' | 'analyzing' | 'complete' | 'error';

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

// Extended DocumentFile interface with UI-specific properties
interface ExtendedDocumentFile extends Omit<LibDocumentFile, 'content'> {
  content?: string | ParsedDocument;
  parseProgress?: number;
  preview?: string;
  parseError?: string;
  metadata?: any;
  parsed?: boolean;
}

// Analysis result type that matches what's returned by analyzeDocuments
interface AnalysisResultWithTokens {
  result: LibComparisonResult;
  tokenUsage: TokenUsage;
}

// Create a document file from a File object
function createDocumentFile(file: File): ExtendedDocumentFile {
  return {
    id: generateDocumentId(file.name),
    name: file.name,
    type: getDocumentType(file),
    file: file,
    parsed: false
  };
}

// Create a wrapper for analyzeDocuments to handle type conversions
async function analyzeDocumentsWithTypeConversion(
  docs: ParsedDocument[], 
  instructions: string, 
  options: { isFollowUp: boolean, skipValidation: boolean, comparisonType: string }
): Promise<AnalysisResultWithTokens> {
  // Call the original analyzeDocuments function with proper options
  const result = await analyzeDocuments(docs as any, instructions, options);
  
  // Return the result in the expected format
  return {
    result: result.result as LibComparisonResult,
    tokenUsage: result.tokenUsage
  };
}

export interface DocumentProcessorState {
  files: ExtendedDocumentFile[];
  results: AnalysisResultWithTokens | null;
  status: ProcessingStatus;
  progress: number;
  processingStatus: string;
  error: string | null;
  activeTab: string;
}

export function useDocumentProcessor() {
  // State
  const [state, setState] = useState<DocumentProcessorState>({
    files: [],
    results: null,
    status: 'idle',
    progress: 0,
    processingStatus: '',
    error: null,
    activeTab: 'upload'
  });

  // Refs
  const timeoutIdRef = useRef<number | null>(null);
  const [parsedDocuments, setParsedDocuments] = useState<ParsedDocument[]>([]);
  const workerSupportedRef = useRef<boolean>(workerService.isSupported());
  
  // Function to safely update parsedDocuments state
  const updateParsedDocuments = useCallback((docs: ParsedDocument[]) => {
    setParsedDocuments(docs);
  }, []);

  // Add files
  const addFiles = useCallback((newFiles: File[]) => {
    const documentFiles: ExtendedDocumentFile[] = newFiles.map(file => createDocumentFile(file));

    setState(prev => ({
      ...prev,
      files: [...prev.files, ...documentFiles],
      results: null,
      error: null
    }));
  }, []);

  // Remove file
  const removeFile = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter(file => file.id !== id),
      results: null
    }));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setState(prev => ({
      ...prev,
      files: [],
      results: null
    }));
  }, []);

  // Set comparison type
  const [comparisonType, setComparisonType] = useState<string>('general');

  // Process documents
  const processDocuments = useCallback(async (customInstructions?: string) => {
    if (state.files.length === 0) {
      setState(prev => ({
        ...prev,
        error: 'Please add at least one document to analyze'
      }));
      return;
    }

    try {
      // Reset state
      setState(prev => ({
        ...prev,
        status: 'parsing',
        progress: 0,
        processingStatus: 'Parsing documents...',
        error: null
      }));

      // Create an array to hold parsing promises
      const parsePromises = state.files.map((file, index) => {
        // Update progress for this file
        setState(prev => {
          const updatedFiles = [...prev.files];
          const fileIndex = updatedFiles.findIndex(f => f.id === file.id);
          if (fileIndex !== -1) {
            updatedFiles[fileIndex] = {
              ...updatedFiles[fileIndex],
              parseProgress: 0
            };
          }
          return { ...prev, files: updatedFiles };
        });

        // Return a promise for parsing this file - use a simple anonymous function
        return (async () => {
          try {
            if (!file.file) {
              throw new Error('File is missing');
            }

            let content: ParsedDocument;

            // For PDFs, use vision capabilities directly
            if (file.type === 'pdf') {
              content = {
                content: `[PDF content from ${file.name} - Using Claude's vision capabilities to process this PDF]`,
                name: file.name,
                file: file.file,
                type: 'pdf'
              } as ParsedDocument;

              // Update file status for PDF
              setState(prev => {
                const updatedFiles = [...prev.files];
                const fileIndex = updatedFiles.findIndex(f => f.id === file.id);

                if (fileIndex !== -1) {
                  updatedFiles[fileIndex] = {
                    ...updatedFiles[fileIndex],
                    content: content.content,
                    parsed: true,
                    parseProgress: 100
                  };
                }
                return { ...prev, files: updatedFiles };
              });
            } else {
              // For other file types, use the parser
              const parsedContent = await parseDocument(file.file as any);
              
              // Convert the parsed content to ParsedDocument format
              if (typeof parsedContent === 'string') {
                content = { 
                  content: parsedContent, 
                  name: file.name,
                  type: file.type 
                };
              } else {
                content = { 
                  content: parsedContent.text || '', 
                  name: file.name,
                  image: parsedContent.image,
                  type: file.type 
                };
              }

              // Update file status for other file types
              setState(prev => {
                const updatedFiles = [...prev.files];
                const fileIndex = updatedFiles.findIndex(f => f.id === file.id);
                if (fileIndex !== -1) {
                  updatedFiles[fileIndex] = {
                    ...updatedFiles[fileIndex],
                    content: content,
                    parsed: true,
                    parseProgress: 100
                  };
                }
                return { ...prev, files: updatedFiles };
              });
            }

            // Store the result in the correct position to maintain order
            setParsedDocuments(prev => [...prev.slice(0, index), content, ...prev.slice(index + 1)]);
            return { success: true, index };
          } catch (error) {
            console.error(`Error parsing file ${file.name}:`, error);
            
            // Update file status with error
            setState(prev => {
              const updatedFiles = [...prev.files];
              const fileIndex = updatedFiles.findIndex(f => f.id === file.id);
              if (fileIndex !== -1) {
                updatedFiles[fileIndex] = {
                  ...updatedFiles[fileIndex],
                  parseError: error instanceof Error ? error.message : String(error),
                  parsed: false,
                  parseProgress: 0
                };
              }
              return { ...prev, files: updatedFiles };
            });
            
            return { success: false, index };
          }
        })();
      });

      // Wait for all parsing to complete
      const results = await Promise.all(parsePromises);

      // Filter out any failed parsing attempts and compact the array
      const validParsedDocuments = parsedDocuments.filter(doc => doc !== undefined);

      // Update progress to 50%
      setState(prev => ({
        ...prev,
        progress: 50,
        processingStatus: 'Parsing complete, analyzing documents...'
      }));

      // If no documents were successfully parsed, throw an error
      if (validParsedDocuments.length === 0) {
        throw new Error('No documents could be parsed successfully');
      }

      // Prepare instructions for analysis
      const instructions = customInstructions || prepareInstructions('Logistics Documents');

      // Update state to analyzing
      setState(prev => ({
        ...prev,
        status: 'analyzing',
        progress: 75,
        processingStatus: 'Analyzing documents with Claude AI...'
      }));

      const analysisResults = await analyzeDocumentsWithTypeConversion(validParsedDocuments, instructions, {
        isFollowUp: true,
        skipValidation: false,
        comparisonType: 'logistics'
      });

      // Complete
      setState(prev => ({
        ...prev,
        status: 'complete',
        progress: 100,
        processingStatus: 'Analysis complete!',
        results: analysisResults,
        activeTab: 'results',
        error: null
      }));

      // Return the results
      return analysisResults;
    } catch (error) {
      console.error('Error processing documents:', error);

      // Set error state
      setState(prev => ({
        ...prev,
        status: 'error',
        progress: 0,
        processingStatus: 'Error processing documents',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));

      return null;
    } finally {
      // Clear any timeouts
      if (timeoutIdRef.current !== null) {
        clearTimeout(timeoutIdRef.current);
        (timeoutIdRef as { current: number | null }).current = null;
      }
    }
  }, [state.files, parsedDocuments, prepareInstructions]);

  // Retry parsing a specific file
  const retryFile = useCallback(async (fileId: string) => {
    const file = state.files.find(f => f.id === fileId);
    if (!file || !file.file) return;

    // Update file status
    setState(prev => ({
      ...prev,
      processingStatus: `Retrying ${file.name}...`
    }));

    try {
      // Parse the file using the appropriate parser based on file type
      let content: ParsedDocument;
      
      if (file.type === 'pdf') {
        content = {
          content: `[PDF content from ${file.name} - Using Claude's vision capabilities to process this PDF]`,
          name: file.name,
          file: file.file,
          type: 'pdf'
        } as ParsedDocument;
      } else {
        // For other file types, use the parser
        const parsedContent = await parseDocument(file.file as any);
        
        // Convert the parsed content to ParsedDocument format
        if (typeof parsedContent === 'string') {
          content = { 
            content: parsedContent, 
            name: file.name,
            type: file.type 
          };
        } else {
          content = { 
            content: parsedContent.text || '', 
            name: file.name,
            image: parsedContent.image,
            type: file.type 
          };
        }
      }

      // Update file status
      setState(prev => {
        const updatedFiles = [...prev.files];
        const fileIndex = updatedFiles.findIndex(f => f.id === fileId);
        if (fileIndex !== -1) {
          updatedFiles[fileIndex] = {
            ...updatedFiles[fileIndex],
            content: content,
            parsed: true,
            parseProgress: 100,
            parseError: undefined
          };
        }
        return { ...prev, files: updatedFiles };
      });

      // Update parsed documents
      setParsedDocuments(prev => {
        const fileIndex = state.files.findIndex(f => f.id === fileId);
        if (fileIndex !== -1) {
          return [...prev.slice(0, fileIndex), content, ...prev.slice(fileIndex + 1)];
        }
        return prev;
      });

      return true;
    } catch (error) {
      console.error(`Error retrying file ${file.name}:`, error);
      
      // Update file status with error
      setState(prev => {
        const updatedFiles = [...prev.files];
        const fileIndex = updatedFiles.findIndex(f => f.id === fileId);
        if (fileIndex !== -1) {
          updatedFiles[fileIndex] = {
            ...updatedFiles[fileIndex],
            parseError: error instanceof Error ? error.message : String(error),
            parsed: false,
            parseProgress: 0
          };
        }
        return { ...prev, files: updatedFiles };
      });
      
      return false;
    }
  }, [state.files]);

  // Ask follow-up question
  const [followUpQuestion, setFollowUpQuestion] = useState<string>('');
  const [isAskingFollowUp, setIsAskingFollowUp] = useState<boolean>(false);

  const askFollowUpQuestion = useCallback(async () => {
    if (!followUpQuestion.trim() || parsedDocuments.length === 0) return;

    setIsAskingFollowUp(true);
    setState(prev => ({ ...prev, error: null }));

    try {
      // Create a custom instruction with the follow-up question
      const instruction = `Based on the previously analyzed documents, please answer this follow-up question: ${followUpQuestion}`;

      // Use the cached documents to answer the follow-up question
      const followUpResults = await analyzeDocumentsWithTypeConversion(parsedDocuments, instruction, {
        isFollowUp: true,
        skipValidation: false,
        comparisonType: 'logistics'
      });

      // Update results with the new analysis
      setState(prev => ({ ...prev, results: followUpResults }));
      setFollowUpQuestion('');
    } catch (error) {
      console.error('Error processing follow-up question:', error);

      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }));
    } finally {
      setIsAskingFollowUp(false);
    }
  }, [followUpQuestion, parsedDocuments]);

  // Set active tab
  const setActiveTab = useCallback((tab: string) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    state,
    comparisonType,
    setComparisonType,
    addFiles,
    removeFile,
    clearFiles,
    processDocuments,
    retryFile,
    followUpQuestion,
    setFollowUpQuestion,
    isAskingFollowUp,
    askFollowUpQuestion,
    setActiveTab,
    clearError,
    isWorkerSupported: workerSupportedRef.current
  };
}
