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
      
      {/* Processing Results */}
      {processingStage === 'parsing' && !isParsing && documents.length > 0 && documents.some(doc => doc.parsed) && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-medium">Processed Documents</h3>
          
          {/* Sort documents: successful first, then failed, then pending */}
          <div className="space-y-3">
            {documents
              .slice()
              .sort((a, b) => {
                // First priority: processed vs not processed
                if (a.parsed && !b.parsed) return -1;
                if (!a.parsed && b.parsed) return 1;
                
                // Second priority: success vs failure
                if (a.parsed?.success && !b.parsed?.success) return -1;
                if (!a.parsed?.success && b.parsed?.success) return 1;
                
                // Third priority: alphabetical by name
                return a.name.localeCompare(b.name);
              })
              .map((doc) => (
                <div 
                  key={doc.id} 
                  className={`border rounded-lg p-4 bg-white ${
                    doc.parsed?.success ? 'border-green-200' : 
                    doc.parsed ? 'border-red-200' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`text-2xl ${
                      doc.parsed?.success ? 'text-green-500' : 
                      doc.parsed ? 'text-red-500' : 'text-gray-400'
                    }`}>
                      {doc.parsed?.success ? '✅' : doc.parsed ? '❌' : '⏳'}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-medium">{doc.name}</h4>
                        <span className="text-xs text-gray-500">
                          {formatFileSize(doc.file.size)}
                        </span>
                      </div>
                      
                      {doc.parsed && (
                        <div className="mt-2 text-sm">
                          <p className={`${doc.parsed.success ? 'text-green-600' : 'text-red-600'}`}>
                            {doc.parsed.success 
                              ? `Successfully processed as ${doc.parsed.metadata.fileFormat.toUpperCase()}` 
                              : `Processing failed: ${doc.parsed.error || 'Unknown error'}`}
                          </p>
                          
                          <p className="text-gray-500 text-xs mt-1">
                            Method: {doc.parsed.metadata.processingMethod.replace('_', ' ')} • 
                            Time: {doc.parsed.metadata.processingTime.toFixed(2)}s
                          </p>
                          
                          {doc.parsed.success && (
                            <div className="mt-2">
                              {/* File metadata */}
                              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                {doc.parsed.metadata.charCount && (
                                  <div>Characters: {doc.parsed.metadata.charCount.toLocaleString()}</div>
                                )}
                                {doc.parsed.metadata.wordCount && (
                                  <div>Words: {doc.parsed.metadata.wordCount.toLocaleString()}</div>
                                )}
                                {doc.parsed.metadata.lineCount && (
                                  <div>Lines: {doc.parsed.metadata.lineCount.toLocaleString()}</div>
                                )}
                                {doc.parsed.metadata.sheets && doc.parsed.metadata.sheets.length > 0 && (
                                  <div>Sheets: {doc.parsed.metadata.sheets.length}</div>
                                )}
                              </div>
                              
                              {/* Content preview */}
                              <div className="p-2 bg-gray-50 rounded text-xs font-mono overflow-hidden border border-gray-200">
                                <p className="truncate">
                                  {doc.parsed.content 
                                    ? `${doc.parsed.content.substring(0, 150)}${doc.parsed.content.length > 150 ? '...' : ''}` 
                                    : doc.parsed.base64 
                                      ? `Base64 encoded (${Math.round(doc.parsed.base64.length / 1024)} KB)` 
                                      : 'No content extracted'}
                                </p>
                              </div>
                              
                              {/* View full content button */}
                              <button 
                                className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                onClick={() => {
                                  // Create a popup with the full content
                                  const popup = window.open('', '_blank', 'width=800,height=600');
                                  if (popup) {
                                    popup.document.write(`
                                      <html>
                                        <head>
                                          <title>${doc.name} - Content Preview</title>
                                          <style>
                                            body { font-family: sans-serif; padding: 20px; }
                                            pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow: auto; }
                                          </style>
                                        </head>
                                        <body>
                                          <h2>${doc.name}</h2>
                                          <p>Format: ${doc.parsed.metadata.fileFormat.toUpperCase()}</p>
                                          <pre>${doc.parsed.content || 'Binary content (not displayed)'}</pre>
                                        </body>
                                      </html>
                                    `);
                                  }
                                }}
                              >
                                View Full Content
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            }
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
