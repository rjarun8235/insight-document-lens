/**
 * Document Processing Utilities
 * Provides helper functions for document processing in the TSV Global application
 */

import { 
  ParsedDocument, 
  ComparisonResult, 
  ProcessingOptions,
  TokenUsage
} from '@/types/app-types';
import { optimizedDocumentService } from '@/services/optimized-document-service';
import { extractionPrompt } from '@/templates/extraction-prompt';
import { validationPrompt } from '@/templates/validation-prompt';

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
 * @param documents Array of parsed documents to analyze
 * @param instruction Custom instruction for analysis
 * @param useCache Whether to use cached results if available
 * @returns Analysis result with comparison data and token usage
 */
export async function analyzeDocuments(
  documents: ParsedDocument[],
  instruction: string,
  useCache: boolean = true
): Promise<{ 
  result: ComparisonResult; 
  tokenUsage: TokenUsage
}> {
  // Process documents with the optimized document service
  const processingResult = await optimizedDocumentService.processDocuments(
    documents,
    'Logistics Documents',
    {
      skipValidation: false
    }
  );
  
  // Return the result in the expected format
  return {
    result: processingResult.result,
    tokenUsage: processingResult.totalTokenUsage
  };
}
