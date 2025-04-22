
import { useState } from 'react';
import { DocumentFile, ComparisonResult } from '@/lib/types';
import { parseDocument } from '@/lib/parsers';
import { analyzeDocuments, prepareInstructions } from '@/services/claude-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search } from 'lucide-react';

export function DocumentProcessor() {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [comparisonType, setComparisonType] = useState<string>('general');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('upload');

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

    try {
      // Parse all documents
      const parsedDocuments: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(Math.round((i / (files.length * 2)) * 100));
        
        try {
          const content = await parseDocument(file);
          parsedDocuments.push(content);
          
          // Update file status
          setFiles(prev => 
            prev.map(f => 
              f.id === file.id ? { ...f, content, parsed: true } : f
            )
          );
        } catch (error) {
          console.error(`Error parsing file ${file.name}:`, error);
          setFiles(prev => 
            prev.map(f => 
              f.id === file.id ? { ...f, parsed: false, parseError: 'Failed to parse' } : f
            )
          );
        }
      }

      setProgress(50);

      if (parsedDocuments.length === 0) {
        throw new Error('Could not parse any of the documents');
      }

      // Generate instructions based on comparison type
      const instructions = prepareInstructions(comparisonType);
      
      // Analyze documents
      setProgress(75);
      const analysisResults = await analyzeDocuments(parsedDocuments, instructions);
      
      setProgress(100);
      setResults(analysisResults);
      
      // Switch to results tab
      setActiveTab('results');
    } catch (error) {
      console.error('Error processing documents:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    setError(null);
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
                      <DocumentCard 
                        key={file.id} 
                        document={file} 
                        onClick={() => removeFile(file.id)}
                      />
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
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Analyze Documents
                    </>
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
                <p className="text-sm text-muted-foreground">
                  {progress < 50 
                    ? `Parsing documents (${Math.min(Math.round(progress * 2), 100)}%)`
                    : `Analyzing with Claude AI (${Math.min(Math.round((progress - 50) * 2), 100)}%)`
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="results" className="mt-6">
          {results ? (
            <AnalysisResults results={results} />
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
                Go to Upload
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
