import { useState, useEffect } from 'react';
import { DocumentFile, ComparisonResult } from '@/lib/types';
import { FileUpload } from './FileUpload';
import { parseDocument } from '@/lib/parsers';
import { analyzeDocuments } from '@/services/claude-service';
import { Button } from '@/components/ui/custom-button';
import { ComparisonView } from './ComparisonView';
import { LoadingIndicator, LoadingOverlay } from './ui/loading-indicator';

export function DocumentProcessor() {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [parsedDocuments, setParsedDocuments] = useState<(string | { image: File, text?: string })[]>([]);
  const [comparisonType, setComparisonType] = useState<string>('verification');
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState<string>('');
  const [isAskingFollowUp, setIsAskingFollowUp] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [documentNames, setDocumentNames] = useState<string[]>([]);

  useEffect(() => {
    // Reset state when files change
    setParsedDocuments([]);
    setComparisonResult(null);
    setError(null);
    setFollowUpQuestion('');
    setProcessingProgress(0);
    
    // Update document names for display in comparison view
    if (files.length > 0) {
      setDocumentNames(files.map(file => file.name));
    }
  }, [files]);

  const handleFilesSelected = async (newFiles: DocumentFile[]) => {
    setFiles(prev => [...prev, ...newFiles]);
  };

  const parseFiles = async () => {
    setError(null);
    setIsProcessing(true);
    setProcessingProgress(0);
    
    try {
      const totalFiles = files.length;
      const parsed: (string | { image: File, text?: string })[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          // Update progress
          setProcessingProgress(Math.round((i / totalFiles) * 50)); // First 50% for parsing
          
          // Pass the DocumentFile object directly as expected by parseDocument
          const parsedContent = await parseDocument(file);
          parsed.push(parsedContent);
          
          // Update file status
          setFiles(prev => 
            prev.map(f => 
              f.id === file.id ? { ...f, parsed: true } : f
            )
          );
        } catch (err) {
          console.error(`Error parsing file ${file.name}:`, err);
          
          // Update file with error
          setFiles(prev => 
            prev.map(f => 
              f.id === file.id ? { ...f, parsed: false, parseError: 'Failed to parse' } : f
            )
          );
          
          // Add a placeholder for the failed file
          parsed.push(`[Failed to parse ${file.name}]`);
          
          // Don't throw here - continue with other files
        }
      }
      
      setParsedDocuments(parsed);
      return parsed;
    } catch (err) {
      console.error('Error parsing files:', err);
      setError('Failed to parse one or more files. Please try again or use different files.');
      throw err;
    }
  };

  const analyzeFiles = async (parsed: (string | { image: File, text?: string })[]) => {
    try {
      setProcessingProgress(50); // Parsing complete, now analyzing
      
      const result = await analyzeDocuments(parsed, comparisonType);
      setComparisonResult(result);
      setProcessingProgress(100);
      return result;
    } catch (err: any) {
      console.error('Error analyzing files:', err);
      setError(`Analysis failed: ${err.message || 'Unknown error occurred'}`);
      throw err;
    }
  };

  const handleCompare = async () => {
    if (files.length < 2) {
      setError('Please upload at least 2 files to compare');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setComparisonResult(null);
    
    try {
      const parsed = await parseFiles();
      await analyzeFiles(parsed);
    } catch (err) {
      // Error already set in the respective functions
      console.error('Comparison process failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAskFollowUp = async () => {
    if (!followUpQuestion.trim() || !comparisonResult) return;
    
    setIsAskingFollowUp(true);
    setError(null);
    
    try {
      // Prepare the follow-up instruction
      const followUpInstruction = `
        Based on the previous comparison of the documents, please answer the following question:
        ${followUpQuestion}
        
        Provide a clear and concise answer based only on the content of the documents.
      `;
      
      const result = await analyzeDocuments(parsedDocuments, followUpInstruction, false);
      setComparisonResult(result);
    } catch (err: any) {
      console.error('Error asking follow-up:', err);
      setError(`Failed to get answer: ${err.message || 'Unknown error occurred'}`);
    } finally {
      setIsAskingFollowUp(false);
      setFollowUpQuestion('');
    }
  };

  const handleRetry = () => {
    setError(null);
    setComparisonResult(null);
    setProcessingProgress(0);
  };

  const handleClearAll = () => {
    setFiles([]);
    setParsedDocuments([]);
    setComparisonResult(null);
    setError(null);
    setFollowUpQuestion('');
    setProcessingProgress(0);
    setDocumentNames([]);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Document Comparison</h2>
        <p className="text-muted-foreground">
          Upload documents to compare and analyze their content using AI.
        </p>
      </div>

      {!comparisonResult && (
        <div className="space-y-6">
          <FileUpload 
            onFilesSelected={handleFilesSelected} 
            disabled={isProcessing}
            maxFiles={5}
            maxFileSize={15 * 1024 * 1024} // 15MB
          />

          {files.length >= 2 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:w-1/2">
                  <label className="text-sm font-medium mb-1 block">Comparison Type</label>
                  <select
                    className="w-full p-2 border rounded-md bg-background"
                    value={comparisonType}
                    onChange={(e) => setComparisonType(e.target.value)}
                    disabled={isProcessing}
                  >
                    <option value="verification">Verification</option>
                    <option value="validation">Validation</option>
                    <option value="review">Review</option>
                    <option value="analysis">Analysis</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  onClick={handleClearAll}
                  disabled={isProcessing}
                >
                  Clear All
                </Button>
                <Button 
                  onClick={handleCompare}
                  disabled={isProcessing || files.length < 2}
                >
                  {isProcessing ? (
                    <div className="flex items-center space-x-2">
                      <LoadingIndicator size="sm" />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    'Compare Documents'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {isProcessing && (
        <LoadingOverlay 
          text={processingProgress < 50 ? "Parsing documents..." : "Analyzing with AI..."}
          showProgress={true}
          progress={processingProgress}
        />
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive rounded-md p-4">
          <div className="flex items-start space-x-3">
            <span className="text-destructive">⚠️</span>
            <div className="space-y-2">
              <p className="text-destructive font-medium">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRetry}
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}

      {comparisonResult && !isProcessing && (
        <div className="space-y-6 animate-in fade-in-50 duration-300">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Results</h3>
            <Button variant="outline" onClick={handleClearAll}>
              New Comparison
            </Button>
          </div>

          <ComparisonView result={comparisonResult} documentNames={documentNames} />

          <div className="border rounded-md p-4 space-y-3">
            <h4 className="font-medium">Ask a follow-up question</h4>
            <div className="flex space-x-2">
              <input
                type="text"
                className="flex-1 p-2 border rounded-md"
                placeholder="E.g., What are the key differences in the shipping dates?"
                value={followUpQuestion}
                onChange={(e) => setFollowUpQuestion(e.target.value)}
                disabled={isAskingFollowUp}
              />
              <Button 
                onClick={handleAskFollowUp}
                disabled={!followUpQuestion.trim() || isAskingFollowUp}
              >
                {isAskingFollowUp ? (
                  <div className="flex items-center space-x-2">
                    <LoadingIndicator size="sm" />
                    <span>Asking...</span>
                  </div>
                ) : (
                  'Ask'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
