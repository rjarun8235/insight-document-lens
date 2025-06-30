import React, { useState, useRef } from 'react';
import { SmartDocumentUpload } from './SmartDocumentUpload';
import { LogisticsDocumentFile } from '../lib/document-types';
import { FileParser, useFileParsing, ParsedFileResult } from '../lib/FileParser';
import { formatFileSize } from '../lib/FileParser';
import { DocumentExtraction } from './DocumentExtraction';

/**
 * DocumentProcessingUpload Component
 * 
 * Enhanced document upload component that combines smart document type detection
 * with file parsing capabilities for various document formats.
 */
interface DocumentProcessingUploadProps {
  onProcessedDocuments?: (documents: ProcessedDocument[]) => void;
}

export interface ProcessedDocument extends LogisticsDocumentFile {
  parsed?: ParsedFileResult;
  extraction?: any; // Extraction results from LLM
}

export function DocumentProcessingUpload({ onProcessedDocuments }: DocumentProcessingUploadProps) {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [processingStage, setProcessingStage] = useState<'upload' | 'parsing' | 'extraction'>('upload');
  const [extractionResults, setExtractionResults] = useState<any[]>([]);
  const { parseFiles, isParsing, progress, currentFileName, cancelProcessing } = useFileParsing();

  const handleDocumentsChange = async (docs: LogisticsDocumentFile[]) => {
    // Store the documents initially
    const initialDocs = docs.map(doc => ({ ...doc })) as ProcessedDocument[];
    setDocuments(initialDocs);
    setProcessingStage('parsing');
    
    if (docs.length > 0) {
      try {
        // Extract the File objects from the documents
        const files = docs.map(doc => doc.file);
        
        // Parse the files
        const parsedResults = await parseFiles(files);
        
        // Combine the original documents with their parsed results
        const processedDocs = docs.map((doc, index) => {
          return {
            ...doc,
            parsed: parsedResults[index]
          } as ProcessedDocument;
        });
        
        // Update state with processed documents
        setDocuments(processedDocs);
        
        // Notify parent component
        if (onProcessedDocuments) {
          onProcessedDocuments(processedDocs);
        }
        
        // Move to extraction stage if there are successfully parsed documents
        if (processedDocs.some(doc => doc.parsed?.success)) {
          setProcessingStage('extraction');
        }
        
      } catch (error) {
        console.error('Error processing documents:', error);
      }
    }
  };
  
  // Handle extraction results
  const handleExtractionComplete = (results: any[]) => {
    setExtractionResults(results);
    
    // Notify parent component with combined results
    if (onProcessedDocuments) {
      const enhancedDocs = documents.map(doc => {
        const extractionResult = results.find(r => r.fileName === doc.name);
        return {
          ...doc,
          extraction: extractionResult
        };
      });
      onProcessedDocuments(enhancedDocs);
    }
  };

  return (
    <div className="space-y-6">
      {/* Smart Document Upload Component */}
      {processingStage === 'upload' && (
        <SmartDocumentUpload onDocumentsChange={handleDocumentsChange} />
      )}
      
      {/* Processing Status */}
      {processingStage === 'parsing' && isParsing && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="animate-spin text-blue-500 text-xl">⟳</div>
              <div>
                <h4 className="font-medium">Processing Documents</h4>
                <p className="text-sm text-blue-700">
                  {currentFileName ? (
                    <>Currently processing: <span className="font-medium">{currentFileName}</span></>
                  ) : (
                    <>Preparing files...</>
                  )}
                </p>
              </div>
            </div>
            
            <button
              onClick={cancelProcessing}
              className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              aria-label="Cancel processing"
            >
              Stop
            </button>
          </div>
          
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Progress: {Math.round(progress)}%</span>
              <span>{documents.filter(d => d.parsed).length}/{documents.length} files</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}
      
      {/* Processing Results - Hidden to avoid redundancy with Document Extraction section */}
      {processingStage === 'parsing' && !isParsing && documents.length > 0 && documents.some(doc => doc.parsed) && (
        <div className="mt-6">
          {/* Document processing complete notification */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <div className="text-green-500 mr-3">✅</div>
              <div>
                <h3 className="font-medium text-green-800">Documents Processed Successfully</h3>
                <p className="text-sm text-green-700">
                  {documents.filter(doc => doc.parsed?.success).length} of {documents.length} documents were processed successfully.
                  {documents.some(doc => !doc.parsed?.success) && 
                    ` ${documents.filter(doc => !doc.parsed?.success).length} document(s) had processing issues.`
                  }
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Proceed to the Document Data Extraction section above to extract structured information.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Document Extraction Component */}
      {processingStage === 'extraction' && documents.some(doc => doc.parsed?.success) && (
        <DocumentExtraction 
          processedDocuments={documents} 
          onExtractionComplete={handleExtractionComplete} 
        />
      )}
    </div>
  );
}

export default DocumentProcessingUpload;
