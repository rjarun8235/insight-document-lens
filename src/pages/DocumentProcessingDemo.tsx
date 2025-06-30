import React, { useState, useEffect } from 'react';
import { DocumentProcessingProvider, useDocumentProcessing } from '../contexts/DocumentProcessingContext';
import DocumentUpload from '../components/domain/DocumentUpload';
import ExtractionResults from '../components/domain/ExtractionResults';
import VerificationReport from '../components/domain/VerificationReport';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Download, 
  FileText, 
  BarChart3, 
  CheckCircle, 
  GitCompare, 
  Shield, 
  AlertCircle,
  FileSearch,
  RefreshCw
} from 'lucide-react';
import { QueryClientProvider } from '../components/providers/QueryClientProvider';

/**
 * DocumentProcessingContent Component
 * 
 * The main content of the document processing page.
 * Uses the DocumentProcessingContext for state and operations.
 */
const DocumentProcessingContent = () => {
  // Get document processing context
  const {
    state,
    verifyDocuments,
    hasExtractionResults,
    hasVerificationReport,
    extractDocuments
  } = useDocumentProcessing();
  
  // Local state
  const [showJsonOutput, setShowJsonOutput] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');

  // Update active tab based on processing state
  useEffect(() => {
    if (hasVerificationReport) {
      setActiveTab('verification');
    } else if (hasExtractionResults) {
      setActiveTab('results');
    }
  }, [hasExtractionResults, hasVerificationReport]);

  // Check if we can verify documents (need at least 2 successful extractions)
  const canVerify = state.extractionResults.filter(r => r.success).length >= 2;

  // Handle verify button click
  const handleVerifyClick = async () => {
    await verifyDocuments({ detailedAnalysis: true });
    setActiveTab('verification');
  };

  // Handle export
  const handleExport = (format: 'json' | 'csv' | 'pdf') => {
    alert(`Export to ${format.toUpperCase()} would happen here`);
    // In a real implementation, this would call a method from a utility
    // or the context to handle the export
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Document Processing Pipeline</h1>
        <p className="text-gray-600">
          Upload logistics documents to extract structured data using AI-powered document processing.
        </p>
      </div>

      {/* Document Upload Component */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <DocumentUpload />
      </div>

      {/* Enhanced Results Section with Verification */}
      {hasExtractionResults && (
        <div className="bg-white rounded-lg shadow-md">
          {/* Header with Export Options */}
          <div className="border-b p-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-green-500" />
                Document Analysis Complete
              </h2>
              
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
                    <Download className="w-4 h-4 mr-1" />
                    JSON
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                    <Download className="w-4 h-4 mr-1" />
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                    <Download className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                </div>
                
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
                <div className="font-bold text-blue-600">{state.documents.length}</div>
                <div className="text-blue-700">Documents Processed</div>
              </div>
              <div className="text-center p-2 bg-green-50 rounded">
                <div className="font-bold text-green-600">
                  {state.extractionResults.filter(r => r.success).length}
                </div>
                <div className="text-green-700">Successfully Extracted</div>
              </div>
              <div className="text-center p-2 bg-yellow-50 rounded">
                <div className="font-bold text-yellow-600">
                  {hasVerificationReport ? 'Enhanced' : 'Basic'}
                </div>
                <div className="text-yellow-700">Validation Level</div>
              </div>
              <div className="text-center p-2 bg-purple-50 rounded">
                <div className="font-bold text-purple-600">
                  {Math.round(state.extractionResults.reduce((sum, r) => sum + (r.processingTimeMs || 0), 0) / 1000)}s
                </div>
                <div className="text-purple-700">Total Processing Time</div>
              </div>
            </div>

            {/* Verification Button - NEW! */}
            {canVerify && !hasVerificationReport && (
              <div className="mt-6 flex justify-center">
                <Button 
                  onClick={handleVerifyClick}
                  disabled={state.isVerifying}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {state.isVerifying ? (
                    <>
                      <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                      Generating Executive Insights...
                    </>
                  ) : (
                    <>
                      <FileSearch className="h-5 w-5 mr-2" />
                      Generate Executive Insights
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Tabbed Content Area */}
          <div className="p-6">
            {showJsonOutput ? (
              // JSON Output View
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="font-medium mb-3">Raw JSON Output</h3>
                <pre className="overflow-auto max-h-[600px] text-xs">
                  {JSON.stringify(state.extractionResults, null, 2)}
                </pre>
              </div>
            ) : (
              // Enhanced Tabbed Interface
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="results" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Extraction Results
                  </TabsTrigger>
                  <TabsTrigger 
                    value="verification" 
                    className="flex items-center gap-2"
                    disabled={!hasVerificationReport}
                  >
                    <Shield className="w-4 h-4" />
                    Executive Insights
                  </TabsTrigger>
                  <TabsTrigger 
                    value="comparison" 
                    className="flex items-center gap-2"
                    disabled={!canVerify}
                  >
                    <GitCompare className="w-4 h-4" />
                    Document Comparison
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="results" className="mt-6">
                  <ExtractionResults />
                </TabsContent>

                <TabsContent value="verification" className="mt-6">
                  <VerificationReport />
                </TabsContent>

                <TabsContent value="comparison" className="mt-6">
                  {hasVerificationReport ? (
                    <div className="space-y-6">
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h3 className="text-lg font-medium text-blue-700 mb-2">Field Comparison Matrix</h3>
                        <p className="text-blue-600">
                          The detailed field comparison is now available in the "Executive Insights" tab with enhanced analytics and actionable recommendations.
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => setActiveTab('verification')}
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          View Executive Insights
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Shield className="w-12 h-12 text-blue-400 mb-4" />
                      <h3 className="text-xl font-medium mb-2">Generate Executive Insights</h3>
                      <p className="text-gray-500 text-center max-w-md mb-6">
                        Click the "Generate Executive Insights" button to analyze your documents and view the detailed comparison matrix with business intelligence.
                      </p>
                      <Button 
                        onClick={handleVerifyClick}
                        disabled={state.isVerifying || !canVerify}
                      >
                        {state.isVerifying ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <FileSearch className="h-4 w-4 mr-2" />
                            Generate Executive Insights
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {state.error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

/**
 * DocumentProcessingDemo Page
 * 
 * The main page component that provides the DocumentProcessingContext
 * to all child components.
 */
export function DocumentProcessingDemo() {
  return (
    <QueryClientProvider>
      <DocumentProcessingProvider>
        <DocumentProcessingContent />
      </DocumentProcessingProvider>
    </QueryClientProvider>
  );
}

export default DocumentProcessingDemo;
