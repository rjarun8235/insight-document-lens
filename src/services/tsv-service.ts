/**
 * DocLens - Intelligent Document Analysis & Comparison
 * 
 * This service powers TSV Global's advanced document processing capabilities,
 * providing intelligent analysis and comparison of logistics documents.
 */

import OptimizedDocumentService from './optimized-document-service';
import { ParsedDocument, ComparisonResult, DocumentType } from '../lib/types';

// Underlying implementation using proprietary TSV Global AI technology
const optimizedService = new OptimizedDocumentService();

export default class DocLensService {
  /**
   * Process documents using the optimized document service
   */
  async processDocuments(
    documents: ParsedDocument[], 
    comparisonType: string = 'Logistics Documents',
    options: {
      showThinking?: boolean;
      useExtendedOutput?: boolean;
      skipValidation?: boolean;
    } = {}
  ): Promise<{
    result: ComparisonResult;
    stages: any;
    totalTokenUsage: {
      input: number;
      output: number;
      cost: number;
      cacheSavings?: number;
    };
  }> {
    console.log('🚀 Starting DocLens optimized document processing pipeline');
    
    // Process documents with the optimized service
    const result = await optimizedService.processDocuments(documents, comparisonType, options);
    
    // Adapt the result to match the expected types
    const adaptedResult = {
      result: result.result as ComparisonResult,
      stages: result.stages,
      totalTokenUsage: {
        input: result.totalTokenUsage.input,
        output: result.totalTokenUsage.output,
        cost: result.totalTokenUsage.cost,
        cacheSavings: result.totalTokenUsage.cacheSavings,
      },
    };

    // Return the adapted result
    return adaptedResult;
  }

  /**
   * Get the name of the DocLens AI agent
   * 
   * @returns Name of the AI agent
   */
  getAgentName(): string {
    return 'DocLens';
  }

  /**
   * Get the version of the DocLens AI agent
   * 
   * @returns Version string
   */
  getAgentVersion(): string {
    return '1.0.0';
  }
}
