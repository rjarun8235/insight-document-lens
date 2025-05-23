import React, { useState } from 'react';
import { ProcessedDocument } from './DocumentProcessingUpload';
import { useDocumentExtraction } from '../lib/LLMExtractionService';
import { LogisticsDocumentType } from '../lib/document-types';

interface DocumentExtractionProps {
  processedDocuments: ProcessedDocument[];
  onExtractionComplete?: (results: any[]) => void;
}

/**
 * Get a dynamic, engaging message based on extraction progress
 */
function getExtractionMessage(current: number, total: number): string {
  // Calculate progress percentage
  const progress = total > 0 ? (current / total) * 100 : 0;
  
  // Messages for different stages of extraction
  const startMessages = [
    "Our AI is analyzing your documents with advanced pattern recognition...",
    "Extracting data in a flash! This usually takes 1-2 minutes per document.",
    "DocLens AI is working its magic on your logistics documents...",
    "Sit tight! Our GenAI is carefully extracting key information...",
  ];
  
  const midMessages = [
    "Making good progress! The AI is identifying document-specific patterns...",
    "Looking good! We're validating extracted fields for accuracy...",
    "Almost halfway there! The AI is working through complex document formats...",
    "Processing nicely! We're normalizing extracted data for consistency...",
  ];
  
  const lateMessages = [
    "Nearly there! Calculating confidence scores for each extracted field...",
    "Final stretch! Performing quality checks on the extracted data...",
    "Just a moment more! Finalizing document type detection...",
    "Almost done! Preparing the extraction results for display...",
  ];
  
  // Select message based on progress
  if (progress < 33) {
    return startMessages[Math.floor(Math.random() * startMessages.length)];
  } else if (progress < 66) {
    return midMessages[Math.floor(Math.random() * midMessages.length)];
  } else {
    return lateMessages[Math.floor(Math.random() * lateMessages.length)];
  }
}

/**
 * Helper function to safely extract field values from potentially nested objects with confidence scores
 */
function getDisplayValue(obj: any): string {
  if (!obj) return '';
  if (typeof obj === 'object' && 'value' in obj) return obj.value || '';
  return String(obj);
}

export function DocumentExtraction({ processedDocuments, onExtractionComplete }: DocumentExtractionProps) {
  const [documentTypes, setDocumentTypes] = useState<Record<string, LogisticsDocumentType>>({});
  const { 
    extractDocuments, 
    isExtracting, 
    extractionResults, 
    currentProgress, 
    progressPercentage 
  } = useDocumentExtraction();

  // Only show documents that have been successfully parsed
  const validDocuments = processedDocuments.filter(doc => doc.parsed?.success);

  // Handle document type selection
  const handleDocumentTypeChange = (docId: string, type: LogisticsDocumentType) => {
    setDocumentTypes(prev => ({
      ...prev,
      [docId]: type
    }));
  };
  
  // Initialize document types from auto-detection results
  React.useEffect(() => {
    if (validDocuments.length > 0) {
      // Check if we've already initialized document types
      const hasInitializedTypes = validDocuments.some(doc => documentTypes[doc.id]);
      
      // Only set document types if they haven't been initialized yet
      if (!hasInitializedTypes) {
        const initialTypes: Record<string, LogisticsDocumentType> = {};
        validDocuments.forEach(doc => {
          // Use the auto-detected type if available, otherwise use 'unknown'
          initialTypes[doc.id] = doc.type !== 'unknown' ? doc.type : doc.suggestedDocType || 'unknown';
        });
        setDocumentTypes(initialTypes);
      }
    }
  }, [validDocuments, documentTypes]);

  // Start extraction process
  const handleStartExtraction = async () => {
    // Check if all documents have types assigned
    const unassignedDocs = validDocuments.filter(doc => !documentTypes[doc.id]);
    if (unassignedDocs.length > 0) {
      alert(`Please assign document types to all documents before extracting data.`);
      return;
    }

    // Prepare documents for extraction
    const docsForExtraction = validDocuments.map(doc => ({
      parsedFile: doc.parsed!,
      documentType: documentTypes[doc.id]
    }));

    try {
      const results = await extractDocuments(docsForExtraction);
      
      // Notify parent component
      if (onExtractionComplete) {
        onExtractionComplete(results);
      }
    } catch (error) {
      console.error('Extraction failed:', error);
      alert(`Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Document Data Extraction</h3>
        <button
          onClick={handleStartExtraction}
          disabled={isExtracting || validDocuments.length === 0}
          className={`px-4 py-2 rounded-md ${isExtracting || validDocuments.length === 0 ? 
            'bg-gray-300 text-gray-500 cursor-not-allowed' : 
            'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          {isExtracting ? 'Extracting...' : 'Extract Data'}
        </button>
      </div>

      {validDocuments.length === 0 ? (
        <div className="p-4 bg-yellow-50 rounded-lg text-yellow-700">
          No valid documents available for extraction. Please upload and process documents first.
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Assign document types to each processed document, then click "Extract Data" to extract structured information.
          </p>

          {/* Document Type Selection */}
          <div className="space-y-3">
            {validDocuments.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                <div className="flex items-center space-x-3">
                  <span className="text-green-500 text-xl">✅</span>
                  <div>
                    <h4 className="font-medium">{doc.name}</h4>
                    <p className="text-xs text-gray-500">
                      {doc.parsed?.metadata.fileFormat.toUpperCase()} • 
                      {doc.parsed?.metadata.processingMethod.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                <select
                  value={documentTypes[doc.id] || ''}
                  onChange={(e) => handleDocumentTypeChange(doc.id, e.target.value as LogisticsDocumentType)}
                  className="border rounded-md p-2 text-sm"
                  required
                >
                  <option value="" disabled>Select document type...</option>
                  <option value="invoice">Invoice</option>
                  <option value="air_waybill">Air Waybill (AWB)</option>
                  <option value="house_waybill">House Waybill (HAWB)</option>
                  <option value="bill_of_entry">Bill of Entry</option>
                  <option value="packing_list">Packing List</option>
                  <option value="delivery_note">Delivery Note</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extraction Progress */}
      {isExtracting && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="animate-spin text-blue-500 text-xl">⟳</div>
              <div>
                <h4 className="font-medium">Extracting Document Data</h4>
                <p className="text-sm text-blue-700">
                  {currentProgress.fileName ? (
                    <>Currently processing: <span className="font-medium">{currentProgress.fileName}</span></>
                  ) : (
                    <>Preparing documents...</>
                  )}
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Progress: {Math.round(progressPercentage)}%</span>
              <span>{currentProgress.current}/{currentProgress.total} documents</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {getExtractionMessage(currentProgress.current, currentProgress.total)}
            </p>
          </div>
        </div>
      )}

      {/* Extraction Results */}
      {extractionResults.length > 0 && !isExtracting && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-medium">Extraction Results</h3>
          
          <div className="space-y-3">
            {extractionResults.map((result, index) => (
              <div 
                key={index} 
                className={`border rounded-lg p-4 ${result.success ? 'border-green-200' : 'border-red-200'}`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`text-2xl ${result.success ? 'text-green-500' : 'text-red-500'}`}>
                    {result.success ? '✅' : '❌'}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium">{result.fileName}</h4>
                      <span className="text-xs text-gray-500">
                        {result.processingTime.toFixed(2)}s
                      </span>
                    </div>
                    
                    {result.success ? (
                      <div className="mt-2">
                        <p className="text-green-600 text-sm">
                          Successfully extracted data with {(result.data?.metadata.extractionConfidence || 0).toFixed(2)} confidence
                        </p>
                        
                        {/* Display document issues if any */}
                        {result.data?.metadata?.issues && result.data.metadata.issues.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-amber-600">Issues:</p>
                            <ul className="mt-1 text-xs text-amber-600 list-disc pl-4">
                              {result.data.metadata.issues.map((issue, idx) => (
                                <li key={idx}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Key extracted fields */}
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          {result.data?.identifiers?.invoiceNumber && (
                            <div>Invoice: <span className="font-medium">{getDisplayValue(result.data?.identifiers?.invoiceNumber)}</span></div>
                          )}
                          {result.data?.identifiers?.awbNumber && (
                            <div>AWB: <span className="font-medium">{getDisplayValue(result.data?.identifiers?.awbNumber)}</span></div>
                          )}
                          {result.data?.identifiers?.hawbNumber && (
                            <div>HAWB: <span className="font-medium">{getDisplayValue(result.data?.identifiers?.hawbNumber)}</span></div>
                          )}
                          {result.data?.parties?.shipper?.name && (
                            <div>Shipper: <span className="font-medium">{getDisplayValue(result.data?.parties?.shipper?.name)}</span></div>
                          )}
                          {result.data?.parties?.consignee?.name && (
                            <div>Consignee: <span className="font-medium">{getDisplayValue(result.data?.parties?.consignee?.name)}</span></div>
                          )}
                        </div>
                        
                        {/* View Full Data button */}
                        <button 
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          onClick={() => {
                            // Create a popup with the full extracted data
                            const popup = window.open('', '_blank', 'width=800,height=600');
                            if (popup) {
                              popup.document.write(`
                                <html>
                                  <head>
                                    <title>${result.fileName} - Extracted Data</title>
                                    <style>
                                      body { font-family: sans-serif; padding: 20px; }
                                      pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow: auto; }
                                    </style>
                                  </head>
                                  <body>
                                    <h2>${result.fileName}</h2>
                                    <p>Document Type: ${result.data?.metadata.documentType.toUpperCase()}</p>
                                    <p>Confidence: ${(result.data?.metadata.extractionConfidence || 0).toFixed(2)}</p>
                                    <h3>Extracted Data:</h3>
                                    <pre>${JSON.stringify(result.data, null, 2)}</pre>
                                  </body>
                                </html>
                              `);
                            }
                          }}
                        >
                          View Full Data
                        </button>
                      </div>
                    ) : (
                      <p className="text-red-600 text-sm mt-1">
                        Extraction failed: {result.error}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentExtraction;
