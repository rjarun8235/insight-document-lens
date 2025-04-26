/**
 * Document Processing Utilities
 * Provides helper functions for document processing in the TSV Global application
 */

import { 
  ParsedDocument, 
  ComparisonResult, 
  ProcessingOptions,
  TokenUsage
} from '../types/app-types';
import OptimizedDocumentService from '../services/optimized-document-service';
import { extractionPrompt } from '../templates/extraction-prompt';
import { validationPrompt } from '../templates/validation-prompt';

/**
 * Prepare instructions for document processing based on comparison type
 * 
 * @param comparisonType The type of comparison to perform
 * @returns Formatted instructions for the AI model
 */
export function prepareInstructions(comparisonType: string): string {
  // Default to logistics documents if not specified
  if (!comparisonType) {
    comparisonType = 'Logistics Documents';
  }
  
  // For logistics documents, use the extraction prompt template
  if (comparisonType.toLowerCase().includes('logistics')) {
    return extractionPrompt;
  }
  
  // For validation, use the validation prompt template
  if (comparisonType.toLowerCase().includes('validation')) {
    return validationPrompt;
  }
  
  // Default case - use a generic instruction
  return `
    You are a document analysis specialist for TSV Global. 
    Please analyze the provided documents and extract key information.
    Focus on identifying discrepancies and important details.
  `;
}

/**
 * Analyze documents using the optimized document service
 * 
 * @param documents Array of document content strings or parsed documents
 * @param instruction Custom instruction for analysis
 * @param options Processing options like comparison type
 * @returns Analysis result with comparison data and token usage
 */
export async function analyzeDocuments(
  documents: string[] | ParsedDocument[],
  instruction: string,
  options: ProcessingOptions = {}
): Promise<{
  result: ComparisonResult;
  tokenUsage: TokenUsage;
  thinkingProcess?: string;
}> {
  try {
    // Convert string content to ParsedDocument objects if needed
    const parsedDocs: ParsedDocument[] = documents.map((doc, index) => {
      if (typeof doc === 'string') {
        return {
          content: doc,
          name: `Document ${index + 1}`,
          type: 'text/plain'
        };
      }
      return doc;
    });
    
    // Create optimized document service instance
    const documentService = new OptimizedDocumentService();
    
    // Process documents with instruction as comparisonType
    const result = await documentService.processDocuments(parsedDocs, {
      ...options,
      comparisonType: instruction
    });
    
    // Return the analysis result
    return {
      result: result.result,
      tokenUsage: result.tokenUsage,
      thinkingProcess: result.thinkingProcess
    };
  } catch (error) {
    console.error('Error analyzing documents:', error);
    throw new Error(`Failed to analyze documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
