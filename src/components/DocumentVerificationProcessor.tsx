import React, { useEffect, useState } from 'react';
import { useDocumentVerification } from '../lib/document-verification-service';
import { DocumentVerificationReport } from './DocumentVerificationReport';
import { EnhancedExtractionResult } from '../lib/LLMExtractionService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';

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

  // Automatically trigger verification when sufficient extraction results are available.
  useEffect(() => {
    const successfulExtractions = extractionResults.filter(r => r.success);
    if (successfulExtractions.length > 1 && !isVerifying && !verificationReport && !hasTriggered) {
      verifyDocuments(successfulExtractions);
      setHasTriggered(true);
    }
  }, [extractionResults, isVerifying, verificationReport, hasTriggered, verifyDocuments]);

  const successfulExtractionsCount = extractionResults.filter(r => r.success).length;

  // Do not render the component if there are not enough documents to compare.
  if (successfulExtractionsCount < 2) {
    return null;
  }

  // Render loading state while verification is in progress.
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

  // Render error state if verification fails.
  if (verificationError) {
    return (
      <Alert variant="destructive" className="mt-8">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Verification Failed</AlertTitle>
        <AlertDescription>
          There was an error while verifying the documents: {verificationError}
        </AlertDescription>
      </Alert>
    );
  }

  // Render the verification report once it's available.
  if (verificationReport) {
    return (
        <div className="mt-8">
            <DocumentVerificationReport report={verificationReport} />
        </div>
    );
  }

  // Fallback state, typically not seen due to automatic triggering.
  return null;
};
