/**
 * DocLens Service
 * Main entry point for document processing in the TSV Global application
 */

import { 
  ParsedDocument, 
  ComparisonResult,
  ProcessingOptions,
  ProcessingResult
} from '../types/app-types';
import { optimizedDocumentService } from './optimized-document-service';

/**
 * DocLens Service
 * Provides a simplified interface for document processing
 */
export class DocLensService {
  /**
   * Process documents using the optimized document processing pipeline
   */
  async processDocuments(
    documents: ParsedDocument[], 
    comparisonType: string, 
    options: ProcessingOptions
  ): Promise<ProcessingResult> {
    console.log('🚀 Starting DocLens document processing pipeline');
    
    // Process documents with the optimized document service
    return await optimizedDocumentService.processDocuments(documents, comparisonType, options);
  }
}

// Export a singleton instance
export default new DocLensService();
