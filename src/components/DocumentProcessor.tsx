import { useState, useEffect } from 'react';
import { DocumentFile, ComparisonResult, ParsedDocument } from '../lib/types';
import { FileUpload } from './FileUpload';
import { parseDocument } from '../lib/parsers';
import DocLensService from '../services/tsv-service';
import { Button } from '../components/ui/custom-button';
import { ComparisonView } from './ComparisonView';
import { LoadingIndicator } from './ui/loading-indicator';
import ModernLoading from './ui/modern-loading';
import Header from './Header';

// Initialize the DocLens service
const docLensService = new DocLensService();

// Available comparison types
const comparisonTypes = [
  { value: 'logistics', label: 'Logistics (General)' },
  { value: 'invoice-po', label: 'Invoice vs Purchase Order' },
  { value: 'bl-invoice', label: 'Bill of Lading vs Invoice' },
  { value: 'bl-packinglist', label: 'Bill of Lading vs Packing List' },
  { value: 'invoice-packinglist', label: 'Invoice vs Packing List' },
  { value: 'verification', label: 'Document Verification' },
  { value: 'validation', label: 'Document Validation' }
];

// Processing modes
const processingModes = [
  { value: 'advanced', label: 'Advanced 3-Stage Pipeline' }
];

export function DocumentProcessor() {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [parsedDocuments, setParsedDocuments] = useState<ParsedDocument[]>([]);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpQuestion, setFollowUpQuestion] = useState<string>('');
  const [isAskingFollowUp, setIsAskingFollowUp] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [documentNames, setDocumentNames] = useState<string[]>([]);
  const [tokenUsage, setTokenUsage] = useState<{input: number, output: number, cost: number} | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [comparisonType, setComparisonType] = useState<string>('logistics');
  const [processingMode, setProcessingMode] = useState<string>('advanced');
  const [showThinking, setShowThinking] = useState<boolean>(true);
  const [thinkingProcess, setThinkingProcess] = useState<string | null>(null);
  const [stageResults, setStageResults] = useState<any | null>(null);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [stageProgress, setStageProgress] = useState<number>(0);
  const [result, setResult] = useState<any | null>(null);

  // Auto-detect appropriate comparison type based on file types
  useEffect(() => {
    if (files.length >= 2) {
      // Get file names for simple detection
      const fileNames = files.map(file => file.name.toLowerCase());
      
      // Check for common document type patterns
      const hasInvoice = fileNames.some(name => name.includes('invoice'));
      const hasPO = fileNames.some(name => name.includes('po') || name.includes('purchase') || name.includes('order'));
      const hasBL = fileNames.some(name => name.includes('bl') || name.includes('bill') || name.includes('lading'));
      const hasPackingList = fileNames.some(name => name.includes('pack') || name.includes('packing'));
      
      // Set appropriate comparison type automatically
      if (hasInvoice && hasPO) {
        setComparisonType('invoice-po');
      } else if (hasBL && hasInvoice) {
        setComparisonType('bl-invoice');
      } else if (hasBL && hasPackingList) {
        setComparisonType('bl-packinglist');
      } else if (hasInvoice && hasPackingList) {
        setComparisonType('invoice-packinglist');
      } else {
        // Default to general logistics comparison
        setComparisonType('logistics');
      }
    }
  }, [files]);

  useEffect(() => {
    // Reset state when files change
    setParsedDocuments([]);
    setComparisonResult(null);
    setError(null);
    setFollowUpQuestion('');
    setProcessingProgress(0);
    setThinkingProcess(null);
    setStageResults(null);
    
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
          setProcessingProgress(Math.round(((i + 1) / totalFiles) * 25)); // First 25% is parsing
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
    }
  };

  /**
   * Process documents and generate comparison
   */
  const processDocuments = async () => {
    if (files.length < 2) {
      setError('Please upload at least two documents to compare');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setComparisonResult(null);
    setThinkingProcess(null);
    setCurrentStage('extraction');
    setStageProgress(0);

    try {
      // First parse the files to get ParsedDocument objects
      const parsed = await Promise.all(files.map(file => parseDocument(file)));
      
      // Create a new instance of the DocLens service
      const service = new DocLensService();
      
      // Use the default comparison type
      const detectedType = 'logistics';
      setComparisonType(detectedType);
      
      // Process the documents with the DocLens service
      const result = await service.processDocuments(
        parsed,
        detectedType,
        {
          showThinking,
          useExtendedOutput: processingMode === 'advanced'
        }
      );
      
      // Update state with the results
      setComparisonResult(result.result);
      setResult(result); // Store the full result including stages and token usage
      setTokenUsage(result.totalTokenUsage);
      setThinkingProcess(result.stages?.validation?.thinkingProcess || null);
      setStageResults(result.stages);
      
      setIsProcessing(false);
      setProcessingProgress(100);
      
      return result;
    } catch (error) {
      console.error('Error processing documents:', error);
      setError(`Error processing documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
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
    setThinkingProcess(null);
    setStageResults(null);
    
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
      
      // Process based on selected mode
      if (processingMode === 'advanced') {
        // Advanced 3-stage processing
        const useValidation = true;
        
        // Call the processDocuments function
        await processDocuments();
      }
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
      const response = await docLensService.analyzeDocuments(parsedDocuments, instruction);
      
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

  const renderTokenUsage = () => {
    if (!result || !result.totalTokenUsage) return null;
    
    const { input, output, cost, cacheSavings } = result.totalTokenUsage;
    
    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-md text-sm">
        <h3 className="font-semibold mb-2">Processing Metrics</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="font-medium">Input Tokens:</span> {input.toLocaleString()}
          </div>
          <div>
            <span className="font-medium">Output Tokens:</span> {output.toLocaleString()}
          </div>
          <div>
            <span className="font-medium">Total Cost:</span> ${cost.toFixed(6)}
          </div>
          {cacheSavings > 0 && (
            <div className="text-green-600">
              <span className="font-medium">Cache Savings:</span> ${cacheSavings.toFixed(6)} (90% discount)
            </div>
          )}
        </div>
        {result.stages?.extraction?.tokenUsage?.cacheSavings > 0 && (
          <div className="mt-2 text-xs text-green-700">
            <span className="font-medium">✓ Prompt Caching:</span> Enabled (90% cost reduction on cached content)
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="document-processor space-y-8">
      <Header />
      {/* File Upload Section */}
      <div className="file-upload-section">
        <FileUpload onFilesSelected={handleFilesSelected} />
        
        {/* Advanced Options */}
        <div className="mt-4 p-3 border border-gray-200 rounded-md bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Processing Options:</h3>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="show-thinking"
              checked={showThinking}
              onChange={(e) => setShowThinking(e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              disabled={isProcessing}
            />
            <label htmlFor="show-thinking" className="ml-2 block text-sm text-gray-700">
              Show thinking process (uses extended thinking)
            </label>
          </div>
        </div>
        
        {/* Compare Button */}
        <div className="mt-4">
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
          <ModernLoading 
            text={processingStage || 'Processing documents with DocLens AI...'} 
            showProgress={true}
            progress={processingProgress} 
          />
        )}
        
        {/* Follow-up Question Loading */}
        {isAskingFollowUp && (
          <ModernLoading 
            text={processingStage || 'Analyzing your follow-up question...'} 
            showProgress={false}
            progress={50} 
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
          <div className="results-section" id="results-section">
            <ComparisonView result={comparisonResult} documentNames={documentNames} />
            
            {/* Thinking Process */}
            {thinkingProcess && (
              <div className="mt-4 bg-gray-50 p-4 rounded-md border border-gray-200">
                <h3 className="flex items-center text-md font-medium text-gray-800 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                  </svg>
                  AI Reasoning Process
                </h3>
                <div className="bg-white p-3 rounded border border-gray-200 max-h-96 overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap">{thinkingProcess}</pre>
                </div>
              </div>
            )}
            
            {/* Stage Results Display */}
            {stageResults && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Multi-Stage Processing Results</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Stage 1: Extraction */}
                  <div className="p-3 border rounded-md">
                    <h4 className="font-medium text-sm mb-1 flex items-center">
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium mr-2 px-2 py-0.5 rounded">Stage 1</span>
                      Extraction
                    </h4>
                    <div className="text-sm">
                      <p><span className="font-medium">Input Tokens:</span> {stageResults.extraction.tokenUsage.input.toLocaleString()}</p>
                      <p><span className="font-medium">Output Tokens:</span> {stageResults.extraction.tokenUsage.output.toLocaleString()}</p>
                      <p><span className="font-medium">Cost:</span> ${stageResults.extraction.tokenUsage.cost.toFixed(6)}</p>
                      <p><span className="font-medium">Fields Extracted:</span> {Object.keys(stageResults.extraction.extractedFields || {}).length}</p>
                    </div>
                  </div>
                  
                  {/* Stage 2: Analysis */}
                  <div className="p-3 border rounded-md">
                    <h4 className="font-medium text-sm mb-1 flex items-center">
                      <span className="bg-green-100 text-green-800 text-xs font-medium mr-2 px-2 py-0.5 rounded">Stage 2</span>
                      Analysis
                    </h4>
                    <div className="text-sm">
                      <p><span className="font-medium">Input Tokens:</span> {stageResults.analysis.tokenUsage.input.toLocaleString()}</p>
                      <p><span className="font-medium">Output Tokens:</span> {stageResults.analysis.tokenUsage.output.toLocaleString()}</p>
                      <p><span className="font-medium">Cost:</span> ${stageResults.analysis.tokenUsage.cost.toFixed(6)}</p>
                      <p><span className="font-medium">Tables Generated:</span> {stageResults.analysis.comparisonResult.tables?.length || 0}</p>
                    </div>
                  </div>
                  
                  {/* Stage 3: Validation */}
                  <div className="p-3 border rounded-md">
                    <h4 className="font-medium text-sm mb-1 flex items-center">
                      <span className="bg-purple-100 text-purple-800 text-xs font-medium mr-2 px-2 py-0.5 rounded">Stage 3</span>
                      Validation
                    </h4>
                    <div className="text-sm">
                      <p><span className="font-medium">Input Tokens:</span> {stageResults.validation.tokenUsage.input.toLocaleString()}</p>
                      <p><span className="font-medium">Output Tokens:</span> {stageResults.validation.tokenUsage.output.toLocaleString()}</p>
                      <p><span className="font-medium">Cost:</span> ${stageResults.validation.tokenUsage.cost.toFixed(6)}</p>
                      <p><span className="font-medium">Confidence:</span> {(stageResults.validation.confidence * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Token Usage Information */}
            {renderTokenUsage()}
            
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
