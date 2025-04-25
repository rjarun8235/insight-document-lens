import { useState, useEffect } from 'react';
import { DocumentFile, ComparisonResult, ParsedDocument } from '../lib/types';
import { FileUpload } from './FileUpload';
import { parseDocument } from '../lib/parsers';
import ClaudeService from '../services/claude-service';
import { Button } from '../components/ui/custom-button';
import { ComparisonView } from './ComparisonView';
import { LoadingIndicator, LoadingOverlay } from './ui/loading-indicator';

// Initialize the Claude service
const claudeService = new ClaudeService();

export function DocumentProcessor() {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [parsedDocuments, setParsedDocuments] = useState<ParsedDocument[]>([]);
  const [comparisonType, setComparisonType] = useState<string>('verification');
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState<string>('');
  const [isAskingFollowUp, setIsAskingFollowUp] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [documentNames, setDocumentNames] = useState<string[]>([]);
  const [tokenUsage, setTokenUsage] = useState<{input: number, output: number, cost: number} | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');

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
    setProcessingStage('Preparing documents for processing...');
    
    try {
      const totalFiles = files.length;
      const parsed: ParsedDocument[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          // Update the file's parsing status
          setFiles(prev => prev.map(f => 
            f.id === file.id ? { ...f, parsed: false, parseProgress: 0, parseError: undefined } : f
          ));
          
          // Update processing stage
          setProcessingStage(`Processing document ${i + 1} of ${totalFiles}: ${file.name}`);
          
          // Parse the document
          const parsedContent: ParsedDocument = await parseDocument(file);
          
          // Add to parsed documents
          parsed.push(parsedContent);
          
          // Update the file's status
          setFiles(prev => prev.map(f => 
            f.id === file.id ? { 
              ...f, 
              parsed: true, 
              parseProgress: 100,
              content: parsedContent,
              preview: parsedContent.text || 'Document processed successfully'
            } : f
          ));
          
          // Update progress
          setProcessingProgress(Math.round(((i + 1) / totalFiles) * 50)); // First 50% is parsing
        } catch (err) {
          console.error(`Error parsing file ${file.name}:`, err);
          
          // Update the file's error status
          setFiles(prev => prev.map(f => 
            f.id === file.id ? { ...f, parsed: false, parseError: err instanceof Error ? err.message : 'Unknown error' } : f
          ));
          
          // Don't add to parsed documents
          setError(`Error parsing file ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
      
      setParsedDocuments(parsed);
      return parsed;
    } catch (err) {
      console.error('Error parsing files:', err);
      setError(`Error parsing files: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return [];
    } finally {
      setIsProcessing(false);
    }
  };

  const processDocuments = async () => {
    if (parsedDocuments.length < 2) {
      setError('Please upload at least two documents for comparison.');
      return;
    }
    
    try {
      setIsProcessing(true);
      setError(null);
      setProcessingProgress(25); // Start processing
      
      // Get document names for better display in the comparison
      const docNames = files.map(file => file.name);
      setDocumentNames(docNames);
      
      // Parse any remaining documents
      const parsed = [...parsedDocuments];
      
      // Update progress
      setProcessingProgress(50); // Parsing complete, now analyzing
      
      // Get the comparison type instruction
      const response = await claudeService.analyzeDocuments(parsed, getComparisonInstruction());
      
      // Extract the result and token usage
      const { result, tokenUsage } = response;
      
      // Update state with the comparison result
      setComparisonResult(result);
      setTokenUsage(tokenUsage);
      setProcessingProgress(100); // Processing complete
    } catch (error) {
      console.error('Error processing documents:', error);
      setError(`Error processing documents: ${error.message}`);
      setProcessingProgress(0); // Reset progress on error
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeFiles = async (parsed: ParsedDocument[]) => {
    try {
      setProcessingProgress(50); // Parsing complete, now analyzing
      
      // Get the comparison type instruction
      const response = await claudeService.analyzeDocuments(parsed, getComparisonInstruction());
      
      // Extract the result and token usage
      const { result, tokenUsage } = response;
      
      setComparisonResult(result);
      setTokenUsage(tokenUsage);
      setProcessingProgress(100);
      return result;
    } catch (err) {
      console.error('Error analyzing files:', err);
      setError(`Error analyzing files: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw err;
    }
  };

  // Get the comparison instruction based on the selected type
  const getComparisonInstruction = () => {
    switch (comparisonType) {
      case 'verification':
        return 'Verify the accuracy and completeness of these documents. Identify any discrepancies or missing information.';
      case 'validation':
        return 'Validate these documents against standard requirements. Check for compliance with expected formats and required fields.';
      case 'logistics':
        return 'Compare these logistics documents (packing lists, invoices, bills of entry, etc.). Identify discrepancies in quantities, prices, dates, and other key information.';
      case 'contracts':
        return 'Compare these contract documents. Identify differences in terms, conditions, dates, parties involved, and obligations.';
      case 'financial':
        return 'Compare these financial documents. Identify differences in amounts, dates, accounts, and other financial details.';
      default:
        return 'Compare these documents and identify key differences and similarities.';
    }
  };

  const handleCompare = async () => {
    if (files.length < 2) {
      setError('Please upload at least two documents for comparison.');
      return;
    }
    
    setError(null);
    setIsProcessing(true);
    setProcessingStage('Starting document comparison...');
    
    try {
      // First parse the files
      const parsed = await parseFiles();
      
      // Check if we have enough parsed documents
      if (parsed.length < 2) {
        setError('Please upload at least two valid documents for comparison.');
        setIsProcessing(false);
        return;
      }
      
      // Set document names for better display in the comparison
      const docNames = files.map(file => file.name);
      setDocumentNames(docNames);
      
      // Update progress
      setProcessingProgress(50); // Parsing complete, now analyzing
      setProcessingStage('Documents processed. Analyzing with Claude AI...');
      
      // Get the comparison type instruction
      const response = await claudeService.analyzeDocuments(parsed, getComparisonInstruction());
      
      // Extract the result and token usage
      const { result, tokenUsage } = response;
      
      // Update state with the comparison result
      setComparisonResult(result);
      setTokenUsage(tokenUsage);
      setProcessingProgress(100); // Processing complete
      setProcessingStage('Analysis complete!');
    } catch (err) {
      console.error('Comparison process failed:', err);
      setError(`Comparison failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setProcessingProgress(0);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingStage('');
      }, 1000); // Show the "Analysis complete" message for 1 second before hiding
    }
  };

  const handleAskFollowUp = async () => {
    if (!followUpQuestion.trim() || !comparisonResult) {
      return;
    }
    
    setIsAskingFollowUp(true);
    setError(null);
    setProcessingStage('Processing your follow-up question...');
    
    try {
      // Create a new instruction with the follow-up question
      const instruction = `Based on the previous comparison of documents, please answer this follow-up question: ${followUpQuestion}`;
      
      // Use the same documents but with the new instruction
      const response = await claudeService.analyzeDocuments(parsedDocuments, instruction);
      
      // Extract the result and token usage
      const { result, tokenUsage } = response;
      
      setComparisonResult(result);
      setTokenUsage(tokenUsage);
      setFollowUpQuestion('');
      setProcessingStage('Follow-up question answered!');
    } catch (err) {
      console.error('Error asking follow-up:', err);
      setError(`Error asking follow-up: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTimeout(() => {
        setIsAskingFollowUp(false);
        setProcessingStage('');
      }, 1000);
    }
  };

  return (
    <div className="document-processor space-y-8">
      {/* File Upload Section */}
      <div className="file-upload-section">
        <FileUpload onFilesSelected={handleFilesSelected} />
        
        <div className="mt-4">
          <div className="flex items-center space-x-2 mb-3">
            <h3 className="text-lg font-medium">Comparison Type:</h3>
            <select 
              value={comparisonType}
              onChange={(e) => setComparisonType(e.target.value)}
              className="px-3 py-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="verification">Verification</option>
              <option value="validation">Validation</option>
              <option value="logistics">Logistics</option>
              <option value="contracts">Contracts</option>
              <option value="financial">Financial</option>
            </select>
          </div>
          
          <Button 
            onClick={handleCompare}
            disabled={isProcessing || files.length === 0}
            className="w-full md:w-auto"
          >
            {isProcessing ? 'Processing...' : 'Compare Documents'}
          </Button>
        </div>
        
        {/* Processing Status */}
        {isProcessing && (
          <LoadingOverlay 
            text={processingStage || 'Processing documents...'} 
            showProgress={true}
            progress={processingProgress} 
          />
        )}
        
        {/* Follow-up Question Loading */}
        {isAskingFollowUp && (
          <LoadingOverlay 
            text={processingStage || 'Processing your follow-up question...'} 
            showProgress={false}
          />
        )}
        
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        )}
        
        {/* Results Display */}
        {comparisonResult && (
          <div className="results-section">
            <ComparisonView result={comparisonResult} documentNames={documentNames} />
            
            {/* Token Usage Information */}
            {tokenUsage && (
              <div className="mt-4 p-3 bg-gray-50 border rounded-md text-sm">
                <h4 className="font-medium mb-1">API Usage Information</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-gray-600">Input Tokens</p>
                    <p className="font-medium">{tokenUsage.input.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Output Tokens</p>
                    <p className="font-medium">{tokenUsage.output.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Estimated Cost</p>
                    <p className="font-medium">${tokenUsage.cost.toFixed(6)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Cost estimate based on Claude 3.7 Sonnet pricing ($3 per million tokens).
                </p>
              </div>
            )}
            
            {/* Follow-up Question Section */}
            <div className="mt-8 border-t pt-6">
              <h3 className="text-lg font-medium mb-2">Ask a Follow-up Question</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={followUpQuestion}
                  onChange={(e) => setFollowUpQuestion(e.target.value)}
                  placeholder="Ask a question about the comparison..."
                  className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isAskingFollowUp}
                />
                <Button 
                  onClick={handleAskFollowUp}
                  disabled={!followUpQuestion.trim() || isAskingFollowUp}
                >
                  {isAskingFollowUp ? <LoadingIndicator size="sm" /> : 'Ask'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
