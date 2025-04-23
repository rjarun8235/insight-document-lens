
import { useState } from 'react';
import { DocumentFile, ComparisonResult } from '@/lib/types';
import { parseDocument } from '@/lib/parsers';
import { analyzeDocuments, prepareInstructions } from '@/services/claude-service';
import { Button } from '@/components/ui/custom-button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { FileUpload } from './FileUpload';
import { AnalysisResults } from './AnalysisResults';
import { ProcessingError } from './ProcessingError';
import { DocumentCard } from './DocumentCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, Send } from 'lucide-react';

export function DocumentProcessor() {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [comparisonType, setComparisonType] = useState<string>('general');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [timeoutId, setTimeoutId] = useState<number | null>(null);
  const [results, setResults] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [followUpQuestion, setFollowUpQuestion] = useState<string>('');
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);

  // Store parsed documents for reuse with caching
  const [parsedDocuments, setParsedDocuments] = useState<(string | { image: File, text?: string })[]>([]);

  const handleFilesSelected = (newFiles: DocumentFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    setResults(null);
    setError(null);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
    setResults(null);
  };

  const handleProcess = async () => {
    if (files.length === 0) {
      setError('Please upload at least one document');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResults(null);
    setError(null);
    setProcessingStatus('Initializing document processing...');

    // Set a timeout to show a message if processing takes too long
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }

    const newTimeoutId = window.setTimeout(() => {
      setProcessingStatus('Processing is taking longer than expected. This might be due to large or complex documents. Please wait...');
    }, 15000); // 15 seconds

    setTimeoutId(newTimeoutId);

    try {
      // Parse all documents in parallel
      setProcessingStatus(`Processing ${files.length} documents in parallel...`);

      // Create an array to hold the parsed documents in the correct order
      const parsedDocuments: (string | { image: File, text?: string })[] = new Array(files.length);

      // Create an array of promises for parallel processing
      const parsePromises = files.map(async (file, index) => {
        try {
          setProgress(Math.round((index / files.length) * 25)); // Use first 25% of progress bar for starting processes

          // For PDFs, use vision capabilities directly without attempting text extraction
          if (file.type === 'pdf') {
            setProcessingStatus(`Processing PDF: ${file.name} with Claude vision`);
            const content = {
              image: file.file,
              text: `[PDF content from ${file.name} - Using Claude's vision capabilities to process this PDF]`
            };

            // Update file status for PDF
            setFiles(prev => {
              const updatedFiles = [...prev];
              const fileIndex = updatedFiles.findIndex(f => f.id === file.id);
              if (fileIndex !== -1) {
                updatedFiles[fileIndex] = {
                  ...updatedFiles[fileIndex],
                  content: content.text,
                  parsed: true
                };
              }
              return updatedFiles;
            });

            // Store the result in the correct position
            parsedDocuments[index] = content;
            return { success: true, index };
          }
          // For other file types, use normal parsing
          else {
            setProcessingStatus(`Parsing: ${file.name}`);
            const content = await parseDocument(file);

            // Update file status
            setFiles(prev => {
              const updatedFiles = [...prev];
              const fileIndex = updatedFiles.findIndex(f => f.id === file.id);
              if (fileIndex !== -1) {
                updatedFiles[fileIndex] = {
                  ...updatedFiles[fileIndex],
                  content: typeof content === 'string'
                    ? content
                    : content.text || 'Image file (will be processed by Claude vision)',
                  parsed: true
                };
              }
              return updatedFiles;
            });

            // Store the result in the correct position
            parsedDocuments[index] = content;
            return { success: true, index };
          }
        } catch (error) {
          console.error(`Error parsing file ${file.name}:`, error);

          // For non-PDF files that fail, mark as failed
          if (file.type !== 'pdf') {
            setFiles(prev => {
              const updatedFiles = [...prev];
              const fileIndex = updatedFiles.findIndex(f => f.id === file.id);
              if (fileIndex !== -1) {
                updatedFiles[fileIndex] = {
                  ...updatedFiles[fileIndex],
                  parsed: false,
                  parseError: 'Failed to parse'
                };
              }
              return updatedFiles;
            });
          }

          return { success: false, index };
        }
      });

      // Wait for all parsing operations to complete
      setProcessingStatus('Waiting for all documents to be processed...');
      await Promise.all(parsePromises);

      // Filter out any failed parsing attempts
      const validDocuments = parsedDocuments.filter(doc => doc !== undefined);

      setProgress(50);
      setProcessingStatus('All documents parsed. Preparing for analysis...');

      if (validDocuments.length === 0) {
        throw new Error('Could not parse any of the documents');
      }

      // Store parsed documents for reuse with caching
      setParsedDocuments([...validDocuments]);

      // Generate instructions based on comparison type
      const instructions = prepareInstructions(comparisonType);

      // Analyze documents
      setProgress(75);
      setProcessingStatus('Analyzing documents with Claude AI...');
      const analysisResults = await analyzeDocuments(validDocuments, instructions, true);

      setProgress(100);
      setProcessingStatus('Analysis complete!');
      setResults(analysisResults);

      // Switch to results tab
      setActiveTab('results');
    } catch (error) {
      console.error('Error processing documents:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        setTimeoutId(null);
      }
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    setError(null);
  };

  // Handle follow-up questions using cached documents
  const handleFollowUpQuestion = async () => {
    if (!followUpQuestion.trim() || parsedDocuments.length === 0) return;

    setIsAskingFollowUp(true);
    setError(null);

    try {
      // Create a custom instruction with the follow-up question
      const instruction = `Based on the previously analyzed documents, please answer this follow-up question: ${followUpQuestion}`;

      // Use the cached documents to answer the follow-up question
      const followUpResults = await analyzeDocuments(parsedDocuments, instruction, true);

      // Update results with the new analysis
      setResults(followUpResults);
      setFollowUpQuestion('');
    } catch (error) {
      console.error('Error processing follow-up question:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsAskingFollowUp(false);
    }
  };

  return (
    <div className="space-y-8">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Upload Documents</TabsTrigger>
          <TabsTrigger value="results" disabled={!results}>Analysis Results</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Document Comparison</CardTitle>
              <CardDescription>
                Upload documents to compare and analyze. Supported formats: PDF, Images, CSV, Excel, Word.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Comparison Type</label>
                <Select
                  value={comparisonType}
                  onValueChange={setComparisonType}
                  disabled={isProcessing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select comparison type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Documents</SelectItem>
                    <SelectItem value="contracts">Contracts</SelectItem>
                    <SelectItem value="invoices">Invoices</SelectItem>
                    <SelectItem value="packing-list">Packing Lists</SelectItem>
                    <SelectItem value="bill-of-entry">Bills of Entry</SelectItem>
                    <SelectItem value="resumes">Resumes</SelectItem>
                    <SelectItem value="reports">Reports</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <FileUpload
                onFilesSelected={handleFilesSelected}
                disabled={isProcessing}
              />

              {files.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3">Documents to Analyze</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {files.map((file) => (
                      <div key={file.id}>
                        <DocumentCard
                          document={file}
                          onClick={() => removeFile(file.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <ProcessingError message={error} onRetry={handleRetry} />
              )}

              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setFiles([])}
                  disabled={files.length === 0 || isProcessing}
                >
                  Clear All
                </Button>
                <Button
                  onClick={handleProcess}
                  disabled={files.length === 0 || isProcessing}
                  className="min-w-[120px]"
                >
                  {isProcessing ? (
                    <div className="flex items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Search className="mr-2 h-4 w-4" />
                      <span>Analyze Documents</span>
                    </div>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {isProcessing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Processing Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={progress} className="mb-3" />
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {progress < 50
                      ? `Parsing documents (${Math.min(Math.round(progress * 2), 100)}%)`
                      : `Analyzing with Claude AI (${Math.min(Math.round((progress - 50) * 2), 100)}%)`
                    }
                  </p>
                  {processingStatus && (
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-sm">{processingStatus}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          {results ? (
            <>
              <AnalysisResults results={results} />

              {/* Follow-up question section */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">Ask Follow-up Questions</CardTitle>
                  <CardDescription>
                    Ask additional questions about the documents without reprocessing them.
                    This uses prompt caching for faster responses.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Ask a follow-up question about these documents..."
                      value={followUpQuestion}
                      onChange={(e: { target: { value: string } }) => setFollowUpQuestion(e.target.value)}
                      disabled={isAskingFollowUp}
                      onKeyDown={(e: { key: string }) => e.key === 'Enter' && handleFollowUpQuestion()}
                      className="flex-1 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                    />
                    <Button
                      onClick={handleFollowUpQuestion}
                      disabled={!followUpQuestion.trim() || isAskingFollowUp}
                    >
                      {isAskingFollowUp ? (
                        <div className="flex items-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <span>Processing...</span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <Send className="mr-2 h-4 w-4" />
                          <span>Ask</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground">
                  <p>Using prompt caching to efficiently reuse document content.</p>
                </CardFooter>
              </Card>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium">No Analysis Results Yet</h3>
              <p className="text-muted-foreground mt-2 max-w-md">
                Upload and analyze documents to see the comparison results and insights here.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setActiveTab('upload')}
              >
                <span>Go to Upload</span>
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
