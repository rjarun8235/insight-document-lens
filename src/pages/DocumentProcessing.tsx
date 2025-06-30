/**
 * DocumentProcessing Page
 * 
 * A top-level page component that orchestrates the document processing workflow.
 * This page is responsible only for layout and component composition, with all
 * business logic delegated to the DocumentProcessingContext.
 * 
 * Responsibility: Owns page layout, routing, and component orchestration.
 * Delegates all business operations to DocumentProcessingContext.
 */

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { DocumentProcessingProvider, useDocumentProcessing } from '@/contexts/DocumentProcessingContext';
import DocumentUpload from '@/components/domain/DocumentUpload';
import ExtractionResults from '@/components/domain/ExtractionResults';
import VerificationReport from '@/components/domain/VerificationReport';

/**
 * Error Boundary component for catching and displaying errors
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Alert variant="destructive" className="my-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {this.state.error?.message || 'An unexpected error occurred'}
          </AlertDescription>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </Alert>
      );
    }

    return this.props.children;
  }
}

/**
 * DocumentProcessingContent Component
 * 
 * The main content of the document processing page.
 * Uses the DocumentProcessingContext for state and operations.
 */
const DocumentProcessingContent: React.FC = () => {
  // Get document processing context
  const { state, hasExtractionResults, hasVerificationReport } = useDocumentProcessing();
  
  // Local state for active tab
  const [activeTab, setActiveTab] = useState<string>('upload');

  // Update active tab based on processing state
  React.useEffect(() => {
    if (hasVerificationReport) {
      setActiveTab('verification');
    } else if (hasExtractionResults) {
      setActiveTab('results');
    }
  }, [hasExtractionResults, hasVerificationReport]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Document Processing</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger 
            value="results" 
            disabled={!hasExtractionResults}
          >
            Extraction Results
          </TabsTrigger>
          <TabsTrigger 
            value="verification" 
            disabled={!hasVerificationReport}
          >
            Verification Report
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload" className="pt-4">
          <ErrorBoundary>
            <DocumentUpload className="w-full" />
          </ErrorBoundary>
        </TabsContent>
        
        <TabsContent value="results" className="pt-4">
          <ErrorBoundary>
            <ExtractionResults className="w-full" />
          </ErrorBoundary>
        </TabsContent>
        
        <TabsContent value="verification" className="pt-4">
          <ErrorBoundary>
            <VerificationReport className="w-full" />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>
      
      {/* Error display */}
      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

/**
 * DocumentProcessing Page
 * 
 * The main page component that provides the DocumentProcessingContext
 * to all child components.
 */
const DocumentProcessing: React.FC = () => {
  return (
    <ErrorBoundary>
      <DocumentProcessingProvider>
        <DocumentProcessingContent />
      </DocumentProcessingProvider>
    </ErrorBoundary>
  );
};

export default DocumentProcessing;
