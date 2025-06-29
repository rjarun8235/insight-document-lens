import React, { useState } from 'react';
import { DocumentProcessingUpload, ProcessedDocument } from '../components/DocumentProcessingUpload';
import { QueryClientProvider } from '../components/providers/QueryClientProvider';
import { ValidationResults } from '../components/ValidationResults';
import { PerformanceDashboard } from '../components/PerformanceDashboard';
import { DocumentComparisonResults } from '../components/DocumentComparisonResults';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportExporter } from '../lib/report-exporter';
import { DocumentFieldComparator } from '../lib/document-field-comparator';
import { Download, FileText, BarChart3, CheckCircle, GitCompare } from 'lucide-react';
import type { EnhancedExtractionResult } from '../lib/LLMExtractionService';

export function DocumentProcessingDemo() {
  const [processedDocuments, setProcessedDocuments] = useState<ProcessedDocument[]>([]);
  const [showJsonOutput, setShowJsonOutput] = useState(false);
  const [activeTab, setActiveTab] = useState<'results' | 'comparison' | 'validation' | 'performance'>('results');
  const [documentComparison, setDocumentComparison] = useState(null);

  const handleProcessedDocuments = (docs: ProcessedDocument[]) => {
    console.log('Documents processed:', docs);
    setProcessedDocuments(docs);
  };

  // Convert ProcessedDocument[] to EnhancedExtractionResult[] for validation components
  const getExtractionResults = (): EnhancedExtractionResult[] => {
    const results = processedDocuments
      .filter(doc => doc.extraction?.success)
      .map(doc => doc.extraction as EnhancedExtractionResult);
    
    // Debug logging to check if validation data is present
    console.log('🔍 DEBUG: Extraction results:', results);
    console.log('🔍 DEBUG: Has validation data:', results.some(r => r.businessRuleValidation || r.documentQuality || r.hsnValidation));
    
    return results;
  };

  const handleExportReport = (format: 'json' | 'csv' | 'pdf') => {
    const results = getExtractionResults();
    ReportExporter.exportValidationResults(results, format);
  };

  const hasValidationData = () => {
    const results = getExtractionResults();
    const hasValidation = results.some(r => r.businessRuleValidation || r.documentQuality || r.hsnValidation);
    console.log('🔍 DEBUG: hasValidationData() =', hasValidation);
    return hasValidation;
  };

  const hasMultipleDocuments = () => {
    return processedDocuments.filter(doc => doc.extraction?.success).length > 1;
  };

  const getDocumentComparison = () => {
    if (!hasMultipleDocuments()) return null;
    
    // Generate comparison report from processed documents
    const successfulDocs = processedDocuments.filter(doc => doc.extraction?.success);
    const documentsForComparison = successfulDocs.map(doc => ({
      name: doc.name,
      type: doc.documentType,
      data: doc.extraction.data
    }));

    if (documentsForComparison.length > 1) {
      return DocumentFieldComparator.compareDocuments(documentsForComparison);
    }
    return null;
  };

  const handleExportComparison = (format: 'text' | 'html' | 'json') => {
    const comparison = getDocumentComparison();
    if (comparison) {
      const reportContent = DocumentFieldComparator.generateSummaryReport(comparison, format);
      const blob = new Blob([reportContent], { 
        type: format === 'html' ? 'text/html' : format === 'json' ? 'application/json' : 'text/plain' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-comparison-report.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <QueryClientProvider>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Document Processing Pipeline</h1>
          <p className="text-gray-600">
            Upload logistics documents to extract structured data using AI-powered document processing.
          </p>
        </div>

        {/* Document Processing Component */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <DocumentProcessingUpload onProcessedDocuments={handleProcessedDocuments} />
        </div>

        {/* Enhanced Results Section with Validation */}
        {processedDocuments.length > 0 && processedDocuments.some(doc => doc.extraction?.success) && (
          <div className="bg-white rounded-lg shadow-md">
            {/* Header with Export Options */}
            <div className="border-b p-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  Document Analysis Complete
                </h2>
                
                <div className="flex items-center gap-2">
                  {hasValidationData() && (
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleExportReport('json')}>
                        <Download className="w-4 h-4 mr-1" />
                        JSON
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleExportReport('csv')}>
                        <Download className="w-4 h-4 mr-1" />
                        CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleExportReport('pdf')}>
                        <Download className="w-4 h-4 mr-1" />
                        PDF
                      </Button>
                    </div>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowJsonOutput(!showJsonOutput)}
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    {showJsonOutput ? 'Hide JSON' : 'Show JSON'}
                  </Button>
                </div>
              </div>
              
              {/* Results Summary */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center p-2 bg-blue-50 rounded">
                  <div className="font-bold text-blue-600">{processedDocuments.length}</div>
                  <div className="text-blue-700">Documents Processed</div>
                </div>
                <div className="text-center p-2 bg-green-50 rounded">
                  <div className="font-bold text-green-600">
                    {processedDocuments.filter(doc => doc.extraction?.success).length}
                  </div>
                  <div className="text-green-700">Successfully Extracted</div>
                </div>
                <div className="text-center p-2 bg-yellow-50 rounded">
                  <div className="font-bold text-yellow-600">
                    {hasValidationData() ? 'Enhanced' : 'Basic'}
                  </div>
                  <div className="text-yellow-700">Validation Level</div>
                </div>
                <div className="text-center p-2 bg-purple-50 rounded">
                  <div className="font-bold text-purple-600">
                    {Math.round(getExtractionResults().reduce((sum, r) => sum + r.processingTime, 0))}s
                  </div>
                  <div className="text-purple-700">Total Processing Time</div>
                </div>
              </div>
            </div>

            {/* Tabbed Content Area */}
            <div className="p-6">
              {showJsonOutput ? (
                // JSON Output View
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="font-medium mb-3">Raw JSON Output</h3>
                  <pre className="overflow-auto max-h-[600px] text-xs">
                    {JSON.stringify(
                      processedDocuments
                        .filter(doc => doc.extraction?.success)
                        .map(doc => {
                          console.log('🔍 DEBUG: Individual extraction result:', doc.extraction);
                          return {
                            fileName: doc.name,
                            documentType: doc.extraction?.data?.metadata.documentType,
                            confidence: doc.extraction?.data?.metadata.extractionConfidence,
                            hasValidation: !!(doc.extraction?.businessRuleValidation || doc.extraction?.documentQuality || doc.extraction?.hsnValidation),
                            validation: {
                              businessRules: doc.extraction?.businessRuleValidation,
                              documentQuality: doc.extraction?.documentQuality,
                              hsnValidation: doc.extraction?.hsnValidation,
                              enhancedFields: doc.extraction?.enhancedFields
                            },
                            data: doc.extraction?.data,
                            fullExtraction: doc.extraction  // Include full extraction for debugging
                          };
                        }), 
                      null, 
                      2
                    )}
                  </pre>
                </div>
              ) : (
                // Enhanced Tabbed Interface
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
                  <TabsList className={`grid w-full ${hasMultipleDocuments() ? 'grid-cols-4' : hasValidationData() ? 'grid-cols-3' : 'grid-cols-1'}`}>
                    <TabsTrigger value="results" className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Extraction Results
                    </TabsTrigger>
                    {hasMultipleDocuments() && (
                      <TabsTrigger value="comparison" className="flex items-center gap-2">
                        <GitCompare className="w-4 h-4" />
                        Document Comparison
                      </TabsTrigger>
                    )}
                    {hasValidationData() && (
                      <TabsTrigger value="validation" className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Validation Analysis
                      </TabsTrigger>
                    )}
                    {hasValidationData() && (
                      <TabsTrigger value="performance" className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Performance Dashboard
                      </TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="results" className="mt-6">
                    {/* Original Summary View */}
                    <div className="space-y-6">
                      {processedDocuments
                        .filter(doc => doc.extraction?.success)
                        .map((doc, index) => {
                          const data = doc.extraction?.data;
                          return (
                            <div key={index} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h3 className="font-medium text-lg">{doc.name}</h3>
                                  <p className="text-sm text-gray-500">
                                    {data?.metadata.documentType.replace('_', ' ').toUpperCase()} • 
                                    Confidence: {(data?.metadata.extractionConfidence || 0).toFixed(2)}
                                  </p>
                                </div>
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                  Extracted
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Identifiers */}
                                <div className="bg-gray-50 p-3 rounded">
                                  <h4 className="font-medium mb-2 text-gray-700">Document Identifiers</h4>
                                  <div className="space-y-1 text-sm">
                                    {data?.identifiers.invoiceNumber && (
                                      <p>Invoice Number: <span className="font-medium">{data.identifiers.invoiceNumber}</span></p>
                                    )}
                                    {data?.identifiers.customerPO && (
                                      <p>Customer PO: <span className="font-medium">{data.identifiers.customerPO}</span></p>
                                    )}
                                    {data?.identifiers.shipmentID && (
                                      <p>Shipment ID: <span className="font-medium">{data.identifiers.shipmentID}</span></p>
                                    )}
                                    {data?.identifiers.awbNumber && (
                                      <p>AWB Number: <span className="font-medium">{data.identifiers.awbNumber}</span></p>
                                    )}
                                    {data?.identifiers.hawbNumber && (
                                      <p>HAWB Number: <span className="font-medium">{data.identifiers.hawbNumber}</span></p>
                                    )}
                                  </div>
                                </div>

                                {/* Parties */}
                                <div className="bg-gray-50 p-3 rounded">
                                  <h4 className="font-medium mb-2 text-gray-700">Parties</h4>
                                  <div className="space-y-2 text-sm">
                                    {data?.parties.shipper.name && (
                                      <div>
                                        <p className="font-medium">Shipper:</p>
                                        <p>{data.parties.shipper.name}</p>
                                        {data.parties.shipper.country && (
                                          <p className="text-gray-500">{data.parties.shipper.country}</p>
                                        )}
                                      </div>
                                    )}
                                    {data?.parties.consignee.name && (
                                      <div>
                                        <p className="font-medium">Consignee:</p>
                                        <p>{data.parties.consignee.name}</p>
                                        {data.parties.consignee.country && (
                                          <p className="text-gray-500">{data.parties.consignee.country}</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Shipment Details */}
                                <div className="bg-gray-50 p-3 rounded">
                                  <h4 className="font-medium mb-2 text-gray-700">Shipment Details</h4>
                                  <div className="space-y-1 text-sm">
                                    {data?.shipment.packageCount?.value && (
                                      <p>Packages: <span className="font-medium">
                                        {data.shipment.packageCount.value} {data.shipment.packageCount.unit || ''}
                                      </span></p>
                                    )}
                                    {data?.shipment.grossWeight?.value && (
                                      <p>Gross Weight: <span className="font-medium">
                                        {data.shipment.grossWeight.value} {data.shipment.grossWeight.unit || ''}
                                      </span></p>
                                    )}
                                    {data?.shipment.netWeight?.value && (
                                      <p>Net Weight: <span className="font-medium">
                                        {data.shipment.netWeight.value} {data.shipment.netWeight.unit || ''}
                                      </span></p>
                                    )}
                                    {data?.shipment.dimensions && (
                                      <p>Dimensions: <span className="font-medium">{data.shipment.dimensions}</span></p>
                                    )}
                                  </div>
                                </div>

                                {/* Commercial Details */}
                                <div className="bg-gray-50 p-3 rounded">
                                  <h4 className="font-medium mb-2 text-gray-700">Commercial Details</h4>
                                  <div className="space-y-1 text-sm">
                                    {data?.commercial.invoiceValue?.amount && (
                                      <p>Invoice Value: <span className="font-medium">
                                        {data.commercial.invoiceValue.amount} {data.commercial.invoiceValue.currency || ''}
                                      </span></p>
                                    )}
                                    {data?.commercial.terms && (
                                      <p>Terms: <span className="font-medium">{data.commercial.terms}</span></p>
                                    )}
                                    {data?.product.description && (
                                      <p>Product: <span className="font-medium">{data.product.description}</span></p>
                                    )}
                                    {data?.product.hsnCode && (
                                      <p>HSN Code: <span className="font-medium">{data.product.hsnCode}</span></p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  </TabsContent>

                  {hasMultipleDocuments() && (
                    <TabsContent value="comparison" className="mt-6">
                      {(() => {
                        const comparison = getDocumentComparison();
                        return comparison ? (
                          <DocumentComparisonResults 
                            comparisonReport={comparison}
                            onExportReport={handleExportComparison}
                          />
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-gray-500">No comparison data available</p>
                          </div>
                        );
                      })()}
                    </TabsContent>
                  )}

                  {hasValidationData() && (
                    <TabsContent value="validation" className="mt-6">
                      <ValidationResults results={getExtractionResults()} />
                    </TabsContent>
                  )}

                  {hasValidationData() && (
                    <TabsContent value="performance" className="mt-6">
                      <PerformanceDashboard 
                        results={getExtractionResults()} 
                        onRefresh={() => window.location.reload()}
                      />
                    </TabsContent>
                  )}
                </Tabs>
              )}
            </div>
          </div>
        )}
      </div>
    </QueryClientProvider>
  );
}

export default DocumentProcessingDemo;
