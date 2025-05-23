/**
 * Document Processing Utilities
 * Provides helper functions for document processing in the TSV Global application
 * Updated with improved prompts and extraction handling
 */

import { 
  ParsedDocument, 
  ComparisonResult, 
  ProcessingOptions,
  TokenUsage
} from '../types/app-types';
import { parallelDocumentService } from '../services/parallel-document-service';
import { enhancedExtractionPrompt } from '../templates/enhanced-extraction-prompt';
import { enhancedValidationPrompt } from '../templates/enhanced-validation-prompt';

/**
 * Prepare instructions for document processing based on comparison type
 * Updated to use the enhanced prompt templates
 * 
 * @param comparisonType The type of comparison to perform
 * @returns Formatted instructions for the AI model
 */
export function prepareInstructions(comparisonType: string, documentCount: number = 1): string {
  // Default to logistics documents if not specified
  if (!comparisonType) {
    comparisonType = 'Logistics Documents';
  }
  
  // For logistics documents, use the enhanced extraction prompt template
  if (comparisonType.toLowerCase().includes('logistics')) {
    return enhancedExtractionPrompt(documentCount.toString(), 'logistics');
  }
  
  // For validation, use the validation prompt template
  if (comparisonType.toLowerCase().includes('validation')) {
    // Create a placeholder for extracted data since we don't have actual data at this point
    const placeholderData = [{ documentName: 'Document 1', extractedFields: {} }];
    return enhancedValidationPrompt(placeholderData);
  }
  
  // Default case - use a generic instruction
  return `
    You are a document analysis specialist for TSV Global. 
    Please analyze the provided documents and extract key information.
    Focus on identifying discrepancies and important details.
  `;
}

/**
 * Analyze documents using the parallel document service
 * Updated to handle improved extraction and validation response formats
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
    console.log(`Analyzing ${documents.length} documents with instruction: ${instruction.substring(0, 100)}...`);
    
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
    
    // Process documents with the improved parallel service
    const result = await parallelDocumentService.processDocuments(parsedDocs);
    
    console.log(`Analysis complete with ${result.result.tables?.length || 0} tables generated`);
    
    // Return the analysis result
    return {
      result: result.result,
      tokenUsage: result.tokenUsage,
      thinkingProcess: result.thinkingProcess
    };
  } catch (error) {
    console.error('Error analyzing documents:', error);
    
    // Create a minimal result with error information
    const errorResult: ComparisonResult = {
      tables: [],
      summary: `Error analyzing documents: ${error instanceof Error ? error.message : 'Unknown error'}`,
      validation: 'Validation could not be completed due to an error',
      analysis: 'Analysis could not be completed due to an error'
    };
    
    // Return basic error result with minimal token usage
    return {
      result: errorResult,
      tokenUsage: {
        input: 0,
        output: 0,
        cost: 0
      }
    };
  }
}

/**
 * Extract specific fields from document comparison results
 * Helps normalize field access across different document types
 * 
 * @param result The comparison result from analysis
 * @param fieldName The field name to extract
 * @returns Array of values for the field from all documents
 */
export function extractFieldFromResults(result: ComparisonResult, fieldName: string): string[] {
  // Check if there are any tables
  if (!result.tables || result.tables.length === 0) {
    return [];
  }
  
  // Try to find a table with field comparison
  const fieldTable = result.tables.find(table => 
    table.title?.includes('Field') || 
    table.headers?.includes('Field')
  );
  
  if (!fieldTable) {
    return [];
  }
  
  // Find the field name in the rows
  const fieldRow = fieldTable.rows.find(row => 
    row[0]?.toLowerCase() === fieldName.toLowerCase() ||
    row[0]?.toLowerCase().includes(fieldName.toLowerCase())
  );
  
  if (!fieldRow) {
    return [];
  }
  
  // Return all values except the first column (field name) and last column (if it's a status)
  const values = fieldRow.slice(1);
  
  // Remove the last column if it's a status column
  if (fieldTable.headers?.at(-1)?.toLowerCase().includes('status')) {
    return values.slice(0, -1);
  }
  
  return values;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}