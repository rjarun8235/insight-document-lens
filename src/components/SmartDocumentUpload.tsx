import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '../lib/utils';
import { DocumentGuidance } from './DocumentGuidance';
import {
  LogisticsDocumentType,
  LogisticsDocumentFile,
  DOCUMENT_TYPE_GUIDANCE,
  analyzeDocument,
  convertFileToBase64,
  generateDocumentId
} from '../lib/document-types';

/**
 * Smart Document Upload Component
 * 
 * An enhanced document upload component that provides automatic detection
 * of document types. It includes guidance for users on document naming
 * conventions and content requirements.
 */
interface SmartDocumentUploadProps {
  onDocumentsChange?: (documents: LogisticsDocumentFile[]) => void;
  expectedDocuments?: LogisticsDocumentType[];
  maxFiles?: number;
}

export function SmartDocumentUpload({ 
  onDocumentsChange, 
  expectedDocuments = [],
  maxFiles = 10 
}: SmartDocumentUploadProps) {
  const [documents, setDocuments] = useState<LogisticsDocumentFile[]>([]);
  const [showGuidance, setShowGuidance] = useState(false);
  // Only using auto-detection mode now
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const processFiles = async (files: File[], forceType?: LogisticsDocumentType) => {
    setError(null);
    
    const processedDocs: LogisticsDocumentFile[] = [];
    
    for (const file of files) {
      let analysis;
      let documentType: LogisticsDocumentType;
      let confidence: number;
      
      if (forceType && forceType !== 'unknown') {
        // Manual type selection
        documentType = forceType;
        confidence = 1.0;
        analysis = { suggestedType: forceType, confidence: 1.0, matchedKeywords: [], suggestions: [] };
      } else {
        // Auto detection
        analysis = analyzeDocument(file.name);
        documentType = analysis.suggestedType;
        confidence = analysis.confidence;
      }
      
      // Convert to base64
      const base64 = await convertFileToBase64(file);
      
      // Detect file format
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      let fileFormat: 'pdf' | 'image' | 'excel' | 'word' | 'txt' | 'unknown' = 'unknown';
      if (['pdf'].includes(extension)) fileFormat = 'pdf';
      else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff'].includes(extension)) fileFormat = 'image';
      else if (['xls', 'xlsx'].includes(extension)) fileFormat = 'excel';
      else if (['doc', 'docx'].includes(extension)) fileFormat = 'word';
      else if (['txt'].includes(extension)) fileFormat = 'txt';
      
      const docFile: LogisticsDocumentFile = {
        id: generateDocumentId(file.name),
        name: file.name,
        file,
        type: documentType,
        fileFormat,
        size: file.size,
        base64,
        confidence,
        validationStatus: 'pending',
        suggestedDocType: analysis.suggestedType,
        issues: analysis.suggestions
      };
      
      processedDocs.push(docFile);
    }
    
    const updatedDocs = [...documents, ...processedDocs];
    setDocuments(updatedDocs);
    onDocumentsChange?.(updatedDocs);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Clear previous errors
    setError(null);
    
    // Collect all validation errors
    const errors = [];
    
    // Check if adding these files would exceed the maximum
    if (documents.length + acceptedFiles.length > maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`);
    }
    
    // Check for unsupported file types
    const unsupportedFiles = acceptedFiles.filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      return !extension || ![
        'pdf', 'jpg', 'jpeg', 'png', 'gif', 'tiff', 'tif', 'bmp', 'webp',
        'csv', 'xls', 'xlsx', 'doc', 'docx', 'txt'
      ].includes(extension);
    });
    
    if (unsupportedFiles.length > 0) {
      errors.push(`Unsupported file type(s): ${unsupportedFiles.map(f => f.name).join(', ')}`);
    }
    
    // If there are errors, display them and stop processing
    if (errors.length > 0) {
      setError(errors.join('\n'));
      return;
    }
    
    // Process the files
    processFiles(acceptedFiles);
  }, [documents, maxFiles]);

  const updateDocumentType = (id: string, newType: LogisticsDocumentType) => {
    const updatedDocs = documents.map(doc => 
      doc.id === id 
        ? { ...doc, type: newType, confidence: 1.0, issues: [] }
        : doc
    );
    
    setDocuments(updatedDocs);
    onDocumentsChange?.(updatedDocs);
  };

  const removeDocument = (id: string) => {
    const updatedDocs = documents.filter(doc => doc.id !== id);
    setDocuments(updatedDocs);
    onDocumentsChange?.(updatedDocs);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    // Add accessibility callbacks
    onDragEnter: () => {
      // Announce drag event for screen readers
      const liveRegion = document.getElementById('upload-live-region');
      if (liveRegion) {
        liveRegion.textContent = 'File is being dragged over the upload area';
      }
      setDragOver(true);
    },
    onDragLeave: () => {
      const liveRegion = document.getElementById('upload-live-region');
      if (liveRegion) {
        liveRegion.textContent = 'File has left the upload area';
      }
      setDragOver(false);
    },
    onDropAccepted: (files) => {
      const liveRegion = document.getElementById('upload-live-region');
      if (liveRegion) {
        liveRegion.textContent = `${files.length} file${files.length !== 1 ? 's' : ''} accepted for upload`;
      }
      setDragOver(false);
    },
    onDropRejected: (fileRejections) => {
      const liveRegion = document.getElementById('upload-live-region');
      if (liveRegion) {
        liveRegion.textContent = `${fileRejections.length} file${fileRejections.length !== 1 ? 's' : ''} rejected. Please check file types and try again.`;
      }
    },
    maxFiles,
    multiple: true,
    onDragOver: (event) => {
      event.preventDefault();
      setDragOver(true);
    }
  });

  return (
    <div className="space-y-6 w-full">
      {/* Help Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">💡</span>
            <div>
              <h4 className="font-medium text-blue-900">Smart Document Detection</h4>
              <p className="text-sm text-blue-700 mt-1">
                Name your files clearly for automatic type detection, or upload and manually select document types.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowGuidance(true)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            View Guidelines
          </button>
        </div>
      </div>

      {/* Accessibility: Screen reader announcements */}
      <div
        id="upload-live-region"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      ></div>

      {/* Auto-Detection Mode */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <span className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white flex items-center">
            <span>🔍 Auto-Detect</span>
          </span>
          <span className="text-sm text-gray-600">Documents will be automatically classified based on filename and content</span>
        </div>
      </div>

      {/* Dropzone */}
      <div 
        {...getRootProps()} 
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400",
          dragOver ? "border-blue-500 bg-blue-50" : ""
        )}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-4">
          <div className="text-4xl">📄</div>
          <div>
            <h3 className="text-lg font-semibold">Upload Documents</h3>
            <p className="text-gray-600 text-sm mt-2">
              System will auto-detect document types based on filename and content
            </p>
          </div>
          
          <div className="text-xs text-gray-500 space-y-1">
            <p>💡 <strong>Tip:</strong> Include keywords in filename for better detection:</p>
            <p>"Invoice_CD970077514.pdf", "HAWB_448765.pdf", "BillOfEntry_577.pdf"</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Documents List */}
      {documents.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium">Uploaded Documents ({documents.length})</h4>
          
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className="border rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <span className="text-2xl">
                      {DOCUMENT_TYPE_GUIDANCE[doc.type]?.icon || '📄'}
                    </span>
                    
                    <div className="flex-1">
                      <h5 className="font-medium">{doc.name}</h5>
                      <p className="text-xs text-gray-500">
                        {(doc.size / 1024 / 1024).toFixed(1)} MB • {doc.fileFormat.toUpperCase()}
                      </p>
                      
                      {/* Detection Results */}
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-600">Detected as:</span>
                          <select
                            value={doc.type}
                            onChange={(e) => updateDocumentType(doc.id, e.target.value as LogisticsDocumentType)}
                            className="text-xs border rounded px-2 py-1"
                          >
                            <option value="unknown">Unknown</option>
                            {Object.entries(DOCUMENT_TYPE_GUIDANCE).map(([type, guidance]) => (
                              <option key={type} value={type}>
                                {guidance.icon} {guidance.name}
                              </option>
                            ))}
                          </select>
                          
                          {doc.confidence !== undefined && (
                            <span className={cn(
                              "text-xs px-2 py-1 rounded",
                              doc.confidence > 0.8 ? "bg-green-100 text-green-700" :
                              doc.confidence > 0.5 ? "bg-yellow-100 text-yellow-700" :
                              "bg-red-100 text-red-700"
                            )}>
                              {Math.round(doc.confidence * 100)}% confident
                            </span>
                          )}
                        </div>
                        
                        {/* Issues/Suggestions */}
                        {doc.issues && doc.issues.length > 0 && (
                          <div className="text-xs text-amber-600 space-y-1">
                            {doc.issues.map((issue, idx) => (
                              <p key={idx}>⚠️ {issue}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => removeDocument(doc.id)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    ❌
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document Guidance Modal */}
      <DocumentGuidance 
        isVisible={showGuidance} 
        onClose={() => setShowGuidance(false)} 
      />
    </div>
  );
}

export default SmartDocumentUpload;
