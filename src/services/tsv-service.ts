/**
 * DocLens - Intelligent Document Analysis & Comparison
 * 
 * This service powers TSV Global's advanced document processing capabilities,
 * providing intelligent analysis and comparison of logistics documents.
 */

import TSVDocumentIntelligenceService from './multi-stage-claude-service';
import ClaudeService from './claude-service';
import { ParsedDocument, ComparisonResult, DocumentType } from '../lib/types';

// Underlying implementation using proprietary TSV Global AI technology
const multiStageService = new TSVDocumentIntelligenceService();
const baseService = new ClaudeService();

export default class DocLensService {
  /**
   * Detect the appropriate comparison type based on document types
   */
  async detectComparisonType(documents: ParsedDocument[]): Promise<string> {
    // Extract document types
    const types = documents.map(doc => doc.type || 'unknown');
    
    // Check for specific document type combinations
    const hasInvoice = types.some(type => type.toLowerCase().includes('invoice'));
    const hasBOL = types.some(type => 
      type.toLowerCase().includes('bill of lading') || 
      type.toLowerCase().includes('bol')
    );
    const hasPackingList = types.some(type => type.toLowerCase().includes('packing list'));
    const hasPO = types.some(type => 
      type.toLowerCase().includes('purchase order') || 
      type.toLowerCase().includes('po')
    );
    
    // Determine comparison type based on document combinations
    if (hasInvoice && hasBOL) {
      return 'Invoice-BOL';
    } else if (hasInvoice && hasPackingList) {
      return 'Invoice-PackingList';
    } else if (hasInvoice && hasPO) {
      return 'Invoice-PO';
    } else if (hasBOL && hasPackingList) {
      return 'BOL-PackingList';
    } else if (hasBOL && hasPO) {
      return 'BOL-PO';
    } else if (hasPackingList && hasPO) {
      return 'PackingList-PO';
    }
    
    // Default to generic comparison if no specific type is detected
    return 'Logistics Documents';
  }

  /**
   * Process documents using the multi-stage Claude service
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
    console.log('🚀 Starting DocLens multi-stage document processing pipeline');
    
    // Process documents with the multi-stage service
    const result = await multiStageService.processDocuments(documents, comparisonType, options);
    
    // Return the result with properly structured token usage
    return {
      result: result.result,
      stages: result.stages,
      totalTokenUsage: result.totalTokenUsage
    };
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
