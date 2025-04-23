import { useState, useRef, useCallback } from 'react';
import { DocumentFile, ComparisonResult } from '@/lib/types';
import { parseDocument } from '@/lib/parsers';
import { analyzeDocuments, prepareInstructions } from '@/services/claude-service';
import { workerService } from '@/services/worker-service';
import { v4 as uuidv4 } from 'uuid';
import { getDocumentType } from '@/lib/parsers';

// Define document processing states
export type ProcessingStatus = 'idle' | 'parsing' | 'analyzing' | 'complete' | 'error';

export interface DocumentProcessorState {
  files: DocumentFile[];
  results: ComparisonResult | null;
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
  const parsedDocumentsRef = useRef<(string | { image: File, text?: string })[]>([]);
  const workerSupportedRef = useRef<boolean>(workerService.isSupported());

  // Add files
  const addFiles = useCallback((newFiles: File[]) => {
    const documentFiles: DocumentFile[] = newFiles.map(file => ({
      id: uuidv4(),
      name: file.name,
      type: getDocumentType(file),
      file,
      parsed: false
    }));

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
  const processDocuments = useCallback(async () => {
    if (state.files.length === 0) {
      setState(prev => ({
        ...prev,
        error: 'Please upload at least one document'
      }));
      return;
    }

    // Reset state
    setState(prev => ({
      ...prev,
      status: 'parsing',
      progress: 0,
      processingStatus: 'Initializing document processing...',
      results: null,
      error: null
    }));

    // Set timeout for long-running processes
    if (timeoutIdRef.current) {
      window.clearTimeout(timeoutIdRef.current);
    }

    timeoutIdRef.current = window.setTimeout(() => {
      setState(prev => ({
        ...prev,
        processingStatus: 'Processing is taking longer than expected. This might be due to large or complex documents. Please wait...'
      }));
    }, 15000);

    try {
      // Parse all documents in parallel
      const parsedDocuments: (string | { image: File, text?: string })[] = new Array(state.files.length);
      const totalFiles = state.files.length;

      setState(prev => ({
        ...prev,
        processingStatus: `Processing ${totalFiles} documents in parallel...`
      }));

      // Create an array of promises for parallel processing
      const parsePromises = state.files.map(async (file, index) => {
        try {
          setState(prev => {
            const updatedFiles = [...prev.files];
            const fileIndex = updatedFiles.findIndex(f => f.id === file.id);
            if (fileIndex !== -1) {
              updatedFiles[fileIndex] = {
                ...updatedFiles[fileIndex],
                parseProgress: 10,
              };
            }
            return {
              ...prev,
              files: updatedFiles,
              processingStatus: `Started processing: ${file.name}`
            };
          });

          let content: string | { image: File, text?: string };

          // For PDFs, use vision capabilities directly
          if (file.type === 'pdf') {
            content = {
              image: file.file,
              text: `[PDF content from ${file.name} - Using Claude's vision capabilities to process this PDF]`
            };

            // Update file status for PDF
            setState(prev => {
              const updatedFiles = [...prev.files];
              const fileIndex = updatedFiles.findIndex(f => f.id === file.id);

              if (fileIndex !== -1) {
                updatedFiles[fileIndex] = {
                  ...updatedFiles[fileIndex],
                  content: content.text,
                  parsed: true,
                  parseProgress: 100
                };
              }

              return {
                ...prev,
                files: updatedFiles,
                processingStatus: `Processed PDF: ${file.name} using Claude vision`
              };
            });
          }
          // For other file types, use workers or main thread parsing
          else {
            // Use Web Workers for supported file types if available
            if (workerSupportedRef.current && ['csv', 'excel'].includes(file.type)) {
              content = await new Promise((resolve, reject) => {
                workerService.parseDocument(
                  file,
                  (progress, metadata) => {
                    // Update file-specific progress
                    setState(prev => {
                      const updatedFiles = [...prev.files];
                      const fileIndex = updatedFiles.findIndex(f => f.id === file.id);
                      if (fileIndex !== -1) {
                        updatedFiles[fileIndex] = {
                          ...updatedFiles[fileIndex],
                          parseProgress: progress,
                          metadata
                        };
                      }
                      return {
                        ...prev,
                        files: updatedFiles,
                        processingStatus: `Processing multiple files... ${file.name}: ${progress}%`
                      };
                    });
                  },
                  (preview) => {
                    // Update file with preview
                    setState(prev => {
                      const updatedFiles = [...prev.files];
                      const fileIndex = updatedFiles.findIndex(f => f.id === file.id);
                      if (fileIndex !== -1) {
                        updatedFiles[fileIndex] = {
                          ...updatedFiles[fileIndex],
                          preview
                        };
                      }
                      return { ...prev, files: updatedFiles };
                    });
                  },
                  (result) => resolve(result),
                  (error, needsFallback) => reject(new Error(error))
                );
              });
            } else {
              // Use main thread parsing for unsupported types or if workers aren't available
              content = await parseDocument(file);
            }

            // Update file status
            setState(prev => {
              const updatedFiles = [...prev.files];
              const fileIndex = updatedFiles.findIndex(f => f.id === file.id);

              if (fileIndex !== -1) {
                updatedFiles[fileIndex] = {
                  ...updatedFiles[fileIndex],
                  content: typeof content === 'string'
                    ? content
                    : content.text || 'Image file (will be processed by Claude vision)',
                  parsed: true,
                  parseProgress: 100
                };
              }

              return { ...prev, files: updatedFiles };
            });
          }

          // Store the result in the correct position to maintain order
          parsedDocuments[index] = content;
          return { success: true, index };
        } catch (error) {
          console.error(`Error parsing file ${file.name}:`, error);

          // For non-PDF files that fail, mark as failed
          if (file.type !== 'pdf') {
            setState(prev => {
              const updatedFiles = [...prev.files];
              const fileIndex = updatedFiles.findIndex(f => f.id === file.id);

              if (fileIndex !== -1) {
                updatedFiles[fileIndex] = {
                  ...updatedFiles[fileIndex],
                  parsed: false,
                  parseError: 'Failed to parse',
                  parseProgress: 0
                };
              }

              return { ...prev, files: updatedFiles };
            });
          }

          // Return failure status
          return { success: false, index };
        }
      });

      // Wait for all parsing operations to complete
      const results = await Promise.all(parsePromises);

      // Filter out any failed parsing attempts and compact the array
      const validParsedDocuments = parsedDocuments.filter(doc => doc !== undefined);

      // Update progress to 50%
      setState(prev => ({
        ...prev,
        progress: 50,
        processingStatus: 'All documents parsed. Preparing for analysis...'
      }));

      if (validParsedDocuments.length === 0) {
        throw new Error('Could not parse any of the documents');
      }

      // Store parsed documents for reuse with caching
      parsedDocumentsRef.current = validParsedDocuments;

      // Generate instructions based on comparison type
      const instructions = prepareInstructions(comparisonType);

      // Analyze documents
      setState(prev => ({
        ...prev,
        status: 'analyzing',
        progress: 75,
        processingStatus: 'Analyzing documents with Claude AI...'
      }));

      const analysisResults = await analyzeDocuments(validParsedDocuments, instructions, true);

      // Complete
      setState(prev => ({
        ...prev,
        status: 'complete',
        progress: 100,
        processingStatus: 'Analysis complete!',
        results: analysisResults,
        activeTab: 'results'
      }));

    } catch (error) {
      console.error('Error processing documents:', error);

      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }));
    } finally {
      // Clear timeout
      if (timeoutIdRef.current) {
        window.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }

      // Terminate any remaining workers
      workerService.terminateAll();
    }
  }, [state.files, comparisonType]);

  // Retry parsing a specific file
  const retryFile = useCallback(async (fileId: string) => {
    const file = state.files.find(f => f.id === fileId);
    if (!file) return;

    setState(prev => ({
      ...prev,
      processingStatus: `Retrying ${file.name}...`,
      error: null
    }));

    try {
      const content = await parseDocument(file);

      // Update file status
      setState(prev => {
        const updatedFiles = [...prev.files];
        const fileIndex = updatedFiles.findIndex(f => f.id === fileId);

        if (fileIndex !== -1) {
          updatedFiles[fileIndex] = {
            ...updatedFiles[fileIndex],
            content: typeof content === 'string'
              ? content
              : content.text || 'Image/PDF file (will be processed by Claude vision)',
            parsed: true,
            parseError: undefined,
            parseProgress: 100
          };
        }

        return { ...prev, files: updatedFiles };
      });
    } catch (error) {
      console.error(`Error retrying file ${file.name}:`, error);

      setState(prev => {
        const updatedFiles = [...prev.files];
        const fileIndex = updatedFiles.findIndex(f => f.id === fileId);

        if (fileIndex !== -1) {
          updatedFiles[fileIndex] = {
            ...updatedFiles[fileIndex],
            parseError: 'Failed to parse on retry'
          };
        }

        return { ...prev, files: updatedFiles };
      });
    }
  }, [state.files]);

  // Ask follow-up question
  const [followUpQuestion, setFollowUpQuestion] = useState<string>('');
  const [isAskingFollowUp, setIsAskingFollowUp] = useState<boolean>(false);

  const askFollowUpQuestion = useCallback(async () => {
    if (!followUpQuestion.trim() || parsedDocumentsRef.current.length === 0) return;

    setIsAskingFollowUp(true);
    setState(prev => ({ ...prev, error: null }));

    try {
      // Create a custom instruction with the follow-up question
      const instruction = `Based on the previously analyzed documents, please answer this follow-up question: ${followUpQuestion}`;

      // Use the cached documents to answer the follow-up question
      const followUpResults = await analyzeDocuments(parsedDocumentsRef.current, instruction, true);

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
  }, [followUpQuestion]);

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
