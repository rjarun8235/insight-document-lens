/**
 * DocLens - Intelligent Document Analysis & Comparison
 * 
 * This service powers TSV Global's advanced document processing capabilities,
 * providing intelligent analysis and comparison of logistics documents.
 */

import OptimizedDocumentService from './optimized-document-service';
import { ParsedDocument, ComparisonResult, ProcessingOptions, ProcessingResult } from '../types/app-types';

// Underlying implementation using proprietary TSV Global AI technology
const optimizedService = new OptimizedDocumentService();

export default class DocLensService {
  /**
   * Process documents using the optimized document service
   */
  async processDocuments(
    documents: ParsedDocument[], 
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    console.log('🚀 Starting DocLens optimized document processing pipeline');
    
    // Process documents with the optimized service
    const result = await optimizedService.processDocuments(documents, options);
    
    // Return the result directly
    return result;
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
