/**
 * Parallel Processor Component
 * 
 * A two-phase document processing component that:
 * 1. Extracts fields from each document in parallel
 * 2. Performs validation and comparison once all extractions are complete
 * 
 * Features:
 * - Visual progress tracking for both phases
 * - Individual document extraction status display
 * - Comprehensive field extraction from all document types
 * - Schema validation in separate step
 */

'use client';

import React, { useState } from 'react';
import { Button } from './ui/custom-button';
import { ComparisonView } from './ComparisonView';
import { FileUpload } from './FileUpload';
import { Spinner } from './ui/loading-spinner';
import { parallelDocumentService, ExtractedDocumentData } from '../services/parallel-document-service';
import { parseDocument } from '../lib/parsers';
import { DocumentFile, ParsedDocument } from '../lib/types';

export function ParallelProcessor() {
  // State for documents
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [parsedDocuments, setParsedDocuments] = useState<ParsedDocument[]>([]);
  const [documentNames, setDocumentNames] = useState<string[]>([]);
  // Map to store document IDs
  const [documentIds, setDocumentIds] = useState<{[index: number]: string}>({});
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPhase, setProcessingPhase] = useState<'idle' | 'extraction' | 'validation' | 'complete'>('idle');
  const [processingResult, setProcessingResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Extraction tracking
  const [extractedData, setExtractedData] = useState<ExtractedDocumentData[]>([]);
  const [extractionProgress, setExtractionProgress] = useState<{[docId: string]: 'pending' | 'processing' | 'complete' | 'error'}>({});
  
  /**
   * Handle file uploads
   */
  const handleUpload = async (files: DocumentFile[]) => {
    setDocumentFiles(files.map(f => f.file));
    setDocumentNames(files.map(f => f.name));
    setProcessingResult(null);
    setError(null);
    setExtractedData([]);
    setExtractionProgress({});
    setProcessingPhase('idle');
    
    try {
      // Parse the documents
      const parsed = await Promise.all(files.map(file => parseDocument(file)));
      setParsedDocuments(parsed);
      
      // Create document IDs and store them in our state
      const newDocIds: {[index: number]: string} = {};
      const progress: {[docId: string]: 'pending' | 'processing' | 'complete' | 'error'} = {};
      
      parsed.forEach((doc, index) => {
        // Generate a unique ID for each document using name and timestamp
        const docId = `${doc.name || files[index].name}-${Date.now()}-${index}`;
        newDocIds[index] = docId;
        progress[docId] = 'pending';
      });
      
      setDocumentIds(newDocIds);
      setExtractionProgress(progress);
    } catch (error) {
      console.error('Error parsing documents:', error);
      setError('Error parsing documents. Please try again with valid PDF or image files.');
    }
  };
  
  /**
   * Extract fields from documents in parallel
   */
  const extractDocuments = async () => {
    if (parsedDocuments.length === 0) return;
    
    setIsProcessing(true);
    setProcessingPhase('extraction');
    setExtractedData([]);
    setError(null);
    
    try {
      // Create a promise for each document extraction
      const extractionPromises = parsedDocuments.map(async (doc, index) => {
        // Get the document ID from our state
        const docId = documentIds[index];
        
        // Update progress for this document
        setExtractionProgress(prev => ({
          ...prev,
          [docId]: 'processing'
        }));
        
        try {
          // Extract fields from the document
          const result = await parallelDocumentService.extractDocumentFields(doc);
          
          // Update progress and extracted data
          setExtractionProgress(prev => ({
            ...prev,
            [docId]: 'complete'
          }));
          
          // Return the result
          return result;
        } catch (error) {
          console.error(`Error extracting fields from document ${doc.name}:`, error);
          
          // Update progress to show error
          setExtractionProgress(prev => ({
            ...prev,
            [docId]: 'error'
          }));
          
          // Rethrow to be caught by Promise.allSettled
          throw error;
        }
      });
      
      // Wait for all extraction promises to settle
      const results = await Promise.allSettled(extractionPromises);
      
      // Filter fulfilled results
      const extractedData = results
        .filter((result): result is PromiseFulfilledResult<ExtractedDocumentData> => result.status === 'fulfilled')
        .map(result => result.value);
      
      // Update state with extracted data
      setExtractedData(extractedData);
      
      // If any extractions failed, show error
      const failedCount = results.filter(result => result.status === 'rejected').length;
      if (failedCount > 0) {
        setError(`Failed to extract fields from ${failedCount} document(s). Proceeding with partial data.`);
      }
      
      // Proceed to validation only if we have at least one successful extraction
      if (extractedData.length > 0) {
        // Move to validation phase
        validateDocuments(extractedData);
      } else {
        // No successful extractions
        setIsProcessing(false);
        setProcessingPhase('idle');
        setError('Failed to extract fields from any documents. Please try again.');
      }
    } catch (error) {
      console.error('Error in extraction phase:', error);
      setIsProcessing(false);
      setProcessingPhase('idle');
      setError('An error occurred during extraction. Please try again.');
    }
  };
  
  /**
   * Validate and compare extracted data
   */
  const validateDocuments = async (extractedDataArray: ExtractedDocumentData[]) => {
    setProcessingPhase('validation');
    
    try {
      // Process all documents with the second phase of our parallel service
      // We call processDocuments with the already extracted data to validate and compare
      const combinedResult = {
        extractedData: extractedDataArray,
        documents: parsedDocuments
      };
      
      // Call the public API to process the validation phase
      const result = await parallelDocumentService.processValidationPhase(combinedResult);
      
      // Update state with result
      setProcessingResult(result);
      setProcessingPhase('complete');
    } catch (error) {
      console.error('Error in validation phase:', error);
      setError('An error occurred during validation. Please try again.');
      setProcessingPhase('idle');
    } finally {
      setIsProcessing(false);
    }
  };
  
  /**
   * Start the processing workflow
   */
  const processDocuments = async () => {
    if (parsedDocuments.length === 0) return;
    extractDocuments();
  };
  
  /**
   * Reset the processor state
   */
  const resetProcessor = () => {
    setDocumentFiles([]);
    setParsedDocuments([]);
    setDocumentNames([]);
    setDocumentIds({});
    setProcessingResult(null);
    setError(null);
    setExtractedData([]);
    setExtractionProgress({});
    setIsProcessing(false);
    setProcessingPhase('idle');
  };
  
  /**
   * Render a status badge
   */
  const renderStatusBadge = (status: 'pending' | 'processing' | 'complete' | 'error') => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">Pending</span>;
      case 'processing':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded-full flex items-center">
          <Spinner className="w-3 h-3 mr-1" />
          Processing
        </span>;
      case 'complete':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-600 rounded-full">Completed</span>;
      case 'error':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded-full">Error</span>;
      default:
        return null;
    }
  };
  
  return (
    <div className="container max-w-screen-xl mx-auto p-4">
      <div className="grid gap-6">
        {/* Document upload section */}
        <div className="shadow-md rounded-lg bg-white p-6">
          <h2 className="text-xl font-semibold mb-4">Document Processor</h2>
          <p className="text-sm text-gray-600 mb-4">
            Upload logistics documents to extract, validate, and compare fields across documents.
          </p>
          
          {/* Upload dropzone */}
          {documentFiles.length === 0 && (
            <div className="mb-6">
              <FileUpload onFilesSelected={handleUpload} />
            </div>
          )}
          
          {/* Uploaded files */}
          {documentFiles.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-medium mb-2">Uploaded Documents</h3>
              <ul className="space-y-2">
                {documentFiles.map((file, index) => (
                  <li key={index} className="flex items-center justify-between py-2 px-3 border rounded-md">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm truncate max-w-xs">{file.name}</span>
                      <span className="ml-2 text-xs text-gray-500">({Math.round(file.size / 1024)} KB)</span>
                    </div>
                    {documentIds[index] && extractionProgress[documentIds[index]] && (
                      renderStatusBadge(extractionProgress[documentIds[index]])
                    )}
                  </li>
                ))}
              </ul>
              
              <div className="mt-4 flex flex-wrap gap-2">
                {/* Process button */}
                {parsedDocuments.length > 0 && processingPhase === 'idle' && (
                  <Button
                    onClick={processDocuments}
                    disabled={isProcessing}
                  >
                    Process Documents
                  </Button>
                )}
                
                {/* Reset button */}
                <Button
                  variant="outline"
                  onClick={resetProcessor}
                  disabled={isProcessing}
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
          
          {/* Processing status */}
          {isProcessing && (
            <div className="bg-blue-50 p-4 rounded-md mb-4">
              <div className="flex items-center mb-2">
                <Spinner className="w-5 h-5 mr-2" />
                <h3 className="font-medium">
                  {processingPhase === 'extraction' ? 'Extracting document fields...' : 'Validating and comparing documents...'}
                </h3>
              </div>
              <div className="text-sm text-gray-600">
                {processingPhase === 'extraction' && (
                  <p>Extracting fields from each document in parallel. This may take a minute...</p>
                )}
                {processingPhase === 'validation' && (
                  <p>Validating extracted fields and generating comparison. Almost done...</p>
                )}
              </div>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>
        
        {/* Results section */}
        {processingPhase === 'complete' && processingResult && (
          <div className="shadow-md rounded-lg bg-white p-6">
            <h2 className="text-xl font-semibold mb-4">Processing Results</h2>
            <ComparisonView
              result={processingResult.result}
              documentNames={documentNames}
            />
          </div>
        )}
      </div>
    </div>
  );
}
