/**
 * DocLens - Intelligent Document Analysis & Comparison
 * 
 * This service powers TSV Global's advanced document processing capabilities,
 * providing intelligent analysis and comparison of logistics documents.
 */

import TSVDocumentIntelligenceService from './multi-stage-claude-service';
import ClaudeService from './claude-service';
import { ParsedDocument, ComparisonResult } from '../lib/types';

// Underlying implementation using proprietary TSV Global AI technology
const multiStageService = new TSVDocumentIntelligenceService();
const baseService = new ClaudeService();

export default class DocLensService {
  /**
   * Process documents using DocLens advanced 3-stage pipeline
   * 
   * @param documents Array of parsed documents to process
   * @param comparisonType Type of comparison to perform
   * @param options Processing options
   * @returns Processing result with comparison data and metadata
   */
  async processDocuments(
    documents: ParsedDocument[],
    comparisonType: string,
    options: {
      skipValidation?: boolean;
      showThinking?: boolean;
      useExtendedOutput?: boolean;
    } = {}
  ) {
    console.log('🚀 Starting DocLens multi-stage document processing pipeline');
    return await multiStageService.processDocuments(documents, comparisonType, options);
  }

  /**
   * Analyze documents with a custom instruction
   * 
   * @param documents Array of parsed documents to analyze
   * @param instruction Custom instruction for analysis
   * @returns Analysis result with comparison data and token usage
   */
  async analyzeDocuments(
    documents: ParsedDocument[],
    instruction: string
  ): Promise<{ result: ComparisonResult; tokenUsage: { input: number; output: number; cost: number } }> {
    return await baseService.analyzeDocuments(documents, instruction);
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
