import React, { useEffect, useState } from 'react';
import { useDocumentVerification } from '../lib/document-verification-service';
import { DocumentVerificationReport } from './DocumentVerificationReport';
import { EnhancedExtractionResult } from '../lib/LLMExtractionService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, PlayCircle, Bug } from 'lucide-react';

interface DocumentVerificationProcessorProps {
  extractionResults: Array<EnhancedExtractionResult & { fileName: string }>;
}

/**
 * A component that orchestrates the document verification process.
 * It triggers verification, shows loading/error states, and renders the final report.
 */
export const DocumentVerificationProcessor: React.FC<DocumentVerificationProcessorProps> = ({ extractionResults }) => {
  const {
    isVerifying,
    verificationReport,
    verificationError,
    verifyDocuments,
  } = useDocumentVerification();

  const [hasTriggered, setHasTriggered] = useState(false);
  const [showDebug, setShowDebug] = useState(true);

  // Automatically trigger verification when sufficient extraction results are available.
  useEffect(() => {
    console.log('[VerificationProcessor] useEffect triggered. Dependencies:', {
      extractionResultsCount: extractionResults.length,
      isVerifying,
      verificationReportExists: !!verificationReport,
      hasTriggered,
    });
    const successfulExtractions = extractionResults.filter(r => r.success);
    if (successfulExtractions.length > 1 && !isVerifying && !verificationReport && !hasTriggered) {
      console.log(`[VerificationProcessor] Auto-triggering verification...`);
      verifyDocuments(successfulExtractions);
      setHasTriggered(true);
    }
  }, [extractionResults, isVerifying, verificationReport, hasTriggered, verifyDocuments]);

  const handleManualVerification = () => {
    console.log(`[VerificationProcessor] Manual verification triggered.`);
    const successfulExtractions = extractionResults.filter(r => r.success);
    if (successfulExtractions.length > 1) {
      verifyDocuments(successfulExtractions);
      setHasTriggered(true);
    } else {
      console.warn('[VerificationProcessor] Manual trigger clicked, but not enough successful extractions.');
    }
  };

  const successfulExtractionsCount = extractionResults.filter(r => r.success).length;
  const successfulExtractions = extractionResults.filter(r => r.success);
  const failedExtractions      = extractionResults.filter(r => !r.success);

  const DebugView = () => (
    <Card className="mt-4 bg-gray-50 border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Debug Information</span>
          <Button variant="ghost" size="sm" onClick={() => setShowDebug(false)}>Close</Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-60">
          {JSON.stringify({
            isVerifying,
            hasTriggered,
            verificationError,
            reportExists: !!verificationReport,
            successfulExtractionsCount,
            extractionResults: extractionResults.map(r => ({ fileName: r.fileName, success: r.success })),
          }, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );

  const renderContent = () => {
    /* ------------------------------------------------------------
     * 0. Not enough successful docs – can’t verify
     * ---------------------------------------------------------- */
    if (successfulExtractionsCount < 2) {
        return (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Verification Pending</AlertTitle>
            <AlertDescription>
              At least two documents must be successfully extracted to run cross-document verification.
            </AlertDescription>
          </Alert>
        );
      }
    
      /* ------------------------------------------------------------
       * 1. Show warning if any documents failed to extract
       * ---------------------------------------------------------- */
      const failedWarning =
        failedExtractions.length > 0 ? (
          <Alert variant="warning" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {failedExtractions.length} document
              {failedExtractions.length > 1 ? 's' : ''} failed to extract
            </AlertTitle>
            <AlertDescription className="text-xs mt-1">
              {failedExtractions.map((d) => d.fileName).join(', ')}
            </AlertDescription>
          </Alert>
        ) : null;

      if (isVerifying) {
        return (
          <Card className="mt-8">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center p-12 space-y-4 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                <h3 className="text-xl font-semibold">Running Cross-Document Verification...</h3>
                <p className="text-muted-foreground">
                  Our AI is analyzing all documents for discrepancies, insights, and compliance issues.
                  <br />
                  This may take a moment.
                </p>
              </div>
            </CardContent>
          </Card>
        );
      }
    
      if (verificationError) {
        return (
          <Alert variant="destructive" className="mt-8">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Verification Failed</AlertTitle>
            <AlertDescription className="flex flex-col gap-4">
              <span>There was an error while verifying the documents: {verificationError}</span>
              <Button variant="secondary" onClick={handleManualVerification} className="w-fit">
                Retry Verification
              </Button>
            </AlertDescription>
          </Alert>
        );
      }
    
      if (verificationReport) {
        return (
            <div className="mt-8">
                {failedWarning}
                <DocumentVerificationReport report={verificationReport} />
            </div>
        );
      }
    
      // Fallback UI: Ready to verify
      return (
        <Card className="mt-8 text-center">
          <CardContent className="pt-6 p-12">
            <PlayCircle className="mx-auto h-12 w-12 text-green-600 mb-4" />
            <h3 className="text-xl font-semibold">Verification Ready</h3>
            <p className="text-muted-foreground mb-6">
              Cross-document verification is ready to run on {successfulExtractionsCount} documents.
            </p>
            <Button onClick={handleManualVerification}>
              Start Verification
            </Button>
            {/* list successful docs */}
            <div className="mt-6 space-y-1 text-xs text-muted-foreground">
              {successfulExtractions.map((d) => (
                <div key={d.fileName}>✔ {d.fileName}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
  }

  return (
    <div>
        {renderContent()}
        {showDebug ? (
            <DebugView />
        ) : (
            <Button variant="outline" size="sm" onClick={() => setShowDebug(true)} className="mt-4 flex items-center gap-2">
                <Bug className="h-4 w-4" /> Show Debug Info
            </Button>
        )}
    </div>
  )
};
