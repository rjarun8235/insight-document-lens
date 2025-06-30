/**
 * Document Extractor Service
 * 
 * A dedicated service for extracting structured data from documents using Claude AI.
 * This service is independent of React and UI components, providing a clean
 * interface for document extraction operations.
 */

import { ClaudeApiService, ClaudeApiError } from './claude-api.service';
import { LogisticsDocumentType } from '../document-types';
import { 
  DOCUMENT_SPECIFIC_PROMPTS,
  normalizeFieldValue,
  preprocessDocumentContent
} from '../document-patterns';

// Import templates
import { EnhancedLogisticsPrompt, EnhancedPromptContext } from '../../templates/enhanced-logistics-prompt';

/**
 * Represents a document file with its content and metadata
 */
export interface DocumentFile {
  id: string;
  name: string;
  content: string;
  documentType: LogisticsDocumentType;
  mimeType?: string;
  size?: number;
}

/**
 * Represents extraction metadata
 */
export interface ExtractionMetadata {
  documentType: LogisticsDocumentType;
  extractionConfidence: number;
  criticalFields: string[];
  missingFields: string[];
  issues: string[];
  processingTimeMs?: number;
}

/**
 * Represents the result of a document extraction operation
 */
export interface ExtractionResult {
  success: boolean;
  data?: {
    metadata: ExtractionMetadata;
    identifiers?: Record<string, any>;
    parties?: Record<string, any>;
    shipment?: Record<string, any>;
    goods?: Record<string, any>;
    financial?: Record<string, any>;
    customs?: Record<string, any>;
    dates?: Record<string, any>;
    [key: string]: any;
  };
  error?: {
    message: string;
    details?: any;
  };
  rawExtraction?: string;
}

/**
 * Represents an enhanced extraction result with validation data
 */
export interface EnhancedExtractionResult extends ExtractionResult {
  fileName?: string;
  documentType?: LogisticsDocumentType;
  businessRuleValidation?: any;
  documentQuality?: any;
  hsnValidation?: any;
  crossValidation?: any;
  processingTimeMs?: number;
}

/**
 * Represents extraction options
 */
export interface ExtractionOptions {
  temperature?: number;
  maxTokens?: number;
  enhancedExtraction?: boolean;
  includeRawResponse?: boolean;
  validateResults?: boolean;
}

/**
 * Simple validation result interface
 */
interface ValidationResult {
  missingFields: string[];
  issues: string[];
}

/**
 * Service for extracting structured data from documents
 */
export class DocumentExtractorService {
  private claudeApiService: ClaudeApiService;
  
  /**
   * Creates a new instance of the DocumentExtractorService
   * 
   * @param claudeApiService - The Claude API service to use
   */
  constructor(claudeApiService?: ClaudeApiService) {
    this.claudeApiService = claudeApiService || new ClaudeApiService();
  }

  /**
   * Extracts data from a document
   * 
   * @param document - The document to extract data from
   * @param options - Options for the extraction
   * @returns The extraction result
   */
  async extractFromDocument(
    document: DocumentFile,
    options: ExtractionOptions = {}
  ): Promise<EnhancedExtractionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Extracting data from ${document.name} (${document.documentType})...`);
      
      // Preprocess document content
      const processedContent = preprocessDocumentContent(document.content, document.documentType);
      
      // Build the extraction prompt
      const prompt = this.buildExtractionPrompt(document.documentType, processedContent, options);
      
      // Send the prompt to Claude
      const claudeResponse = await this.claudeApiService.sendExtractionRequest(
        prompt,
        {
          temperature: options.temperature || 0.1,
          max_tokens: options.maxTokens || 4000
        }
      );
      
      // Extract the response text
      const responseText = this.claudeApiService.extractTextContent(claudeResponse);
      
      // Parse the extraction result
      const extractionResult = this.parseExtractionResult(responseText, document);
      
      // Add processing time to metadata
      if (extractionResult.success && extractionResult.data && extractionResult.data.metadata) {
        extractionResult.data.metadata.processingTimeMs = Date.now() - startTime;
      }
      
      // Add raw extraction if requested
      if (options.includeRawResponse) {
        extractionResult.rawExtraction = responseText;
      }
      
      // Validate the extraction result if requested
      if (options.validateResults && extractionResult.success && extractionResult.data) {
        this.validateExtractionResult(extractionResult, document.documentType);
      }
      
      // Add file name and document type to the result
      const enhancedResult: EnhancedExtractionResult = {
        ...extractionResult,
        fileName: document.name,
        documentType: document.documentType,
        processingTimeMs: Date.now() - startTime
      };
      
      console.log(`✅ Extraction complete for ${document.name}`);
      return enhancedResult;
      
    } catch (error) {
      console.error(`❌ Extraction failed for ${document.name}:`, error);
      
      // Handle different error types
      if (error instanceof ClaudeApiError) {
        return {
          success: false,
          error: {
            message: `Claude API error: ${error.message}`,
            details: error.details
          },
          fileName: document.name,
          documentType: document.documentType
        };
      }
      
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error)
        },
        fileName: document.name,
        documentType: document.documentType
      };
    }
  }

  /**
   * Extracts data from multiple documents
   * 
   * @param documents - The documents to extract data from
   * @param options - Options for the extraction
   * @returns The extraction results
   */
  async extractFromMultipleDocuments(
    documents: DocumentFile[],
    options: ExtractionOptions = {}
  ): Promise<EnhancedExtractionResult[]> {
    console.log(`🔍 Extracting data from ${documents.length} documents...`);
    
    const results: EnhancedExtractionResult[] = [];
    
    for (const document of documents) {
      const result = await this.extractFromDocument(document, options);
      results.push(result);
    }
    
    console.log(`✅ Extraction complete for ${documents.length} documents`);
    return results;
  }

  /**
   * Builds an extraction prompt for a document
   * 
   * @param documentType - The type of document
   * @param content - The document content
   * @param options - Options for the extraction
   * @returns The extraction prompt
   */
  private buildExtractionPrompt(
    documentType: LogisticsDocumentType,
    content: string,
    options: ExtractionOptions
  ): string {
    // Use enhanced extraction if requested
    if (options.enhancedExtraction) {
      const promptContext: EnhancedPromptContext = {
        documentType,
        expectedFields: this.getCriticalFieldsForType(documentType)
      };
      
      return EnhancedLogisticsPrompt.generatePrompt(promptContext);
    }
    
    // Use standard extraction prompt
    const basePrompt = `
You are an expert logistics document analyzer. Extract the following information from this ${documentType} document in a structured JSON format.

DOCUMENT CONTENT:
${content}

INSTRUCTIONS:
1. Extract all relevant fields based on the document type.
2. Format the response as a valid JSON object.
3. Use null for missing values, don't make up information.
4. Normalize values where appropriate (dates, numbers, etc.).
5. Include a metadata section with extraction confidence.

RESPONSE FORMAT:
{
  "metadata": {
    "documentType": "${documentType}",
    "extractionConfidence": 0.95,
    "criticalFields": ["field1", "field2"],
    "missingFields": [],
    "issues": []
  },
  // Document-specific fields will go here
}
`;

    // Add document-specific prompt instructions
    const specificPrompt = DOCUMENT_SPECIFIC_PROMPTS[documentType] || '';
    
    return `${basePrompt}\n\n${specificPrompt}`;
  }

  /**
   * Parses an extraction result from Claude
   * 
   * @param responseText - The response text from Claude
   * @param document - The document that was extracted
   * @returns The parsed extraction result
   */
  private parseExtractionResult(
    responseText: string,
    document: DocumentFile
  ): ExtractionResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                        responseText.match(/```\n([\s\S]*?)\n```/) ||
                        responseText.match(/{[\s\S]*}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in the response');
      }
      
      const jsonContent = jsonMatch[0].startsWith('{') ? jsonMatch[0] : jsonMatch[1];
      const extractedData = JSON.parse(jsonContent);
      
      // Ensure metadata exists
      if (!extractedData.metadata) {
        extractedData.metadata = {
          documentType: document.documentType,
          extractionConfidence: 0.5,
          criticalFields: [],
          missingFields: [],
          issues: ['Metadata was missing in extraction result']
        };
      } else {
        // Ensure document type is set correctly
        extractedData.metadata.documentType = document.documentType;
      }
      
      // Normalize field values
      this.normalizeExtractionData(extractedData);
      
      return {
        success: true,
        data: extractedData
      };
      
    } catch (error) {
      console.error('Failed to parse extraction result:', error);
      
      return {
        success: false,
        error: {
          message: 'Failed to parse extraction result',
          details: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Normalizes extraction data
   * 
   * @param data - The data to normalize
   */
  private normalizeExtractionData(data: any): void {
    if (!data) return;
    
    // Recursively normalize object values
    Object.keys(data).forEach(key => {
      if (typeof data[key] === 'object' && data[key] !== null) {
        this.normalizeExtractionData(data[key]);
      } else {
        data[key] = normalizeFieldValue(key, data[key]);
      }
    });
  }

  /**
   * Simple validation function to check for required fields
   * 
   * @param data - The data to validate
   * @param requiredFields - The required fields
   * @returns Validation result with missing fields and issues
   */
  private validateData(data: any, requiredFields: string[]): ValidationResult {
    const missingFields: string[] = [];
    const issues: string[] = [];
    
    // Check for missing required fields
    requiredFields.forEach(field => {
      const fieldParts = field.split('.');
      let currentObj = data;
      
      // Navigate through nested objects
      for (let i = 0; i < fieldParts.length; i++) {
        const part = fieldParts[i];
        
        if (!currentObj || !currentObj[part]) {
          missingFields.push(field);
          issues.push(`Missing required field: ${field}`);
          break;
        }
        
        currentObj = currentObj[part];
      }
    });
    
    return { missingFields, issues };
  }

  /**
   * Validates an extraction result
   * 
   * @param result - The result to validate
   * @param documentType - The type of document
   */
  private validateExtractionResult(
    result: ExtractionResult,
    documentType: LogisticsDocumentType
  ): void {
    if (!result.success || !result.data) return;
    
    // Get critical fields for the document type
    const criticalFields = this.getCriticalFieldsForType(documentType);
    result.data.metadata.criticalFields = criticalFields;
    
    // Validate document type data
    const validationResult = this.validateData(result.data, criticalFields);
    
    // Update metadata with validation results
    result.data.metadata.missingFields = validationResult.missingFields;
    result.data.metadata.issues = validationResult.issues;
    
    // Calculate confidence score
    result.data.metadata.extractionConfidence = this.calculateConfidenceScore(result.data);
  }

  /**
   * Gets critical fields for a document type
   * 
   * @param documentType - The type of document
   * @returns The critical fields
   */
  getCriticalFieldsForType(documentType: LogisticsDocumentType): string[] {
    const criticalFieldsMap: Record<string, string[]> = {
      'invoice': ['invoiceNumber', 'invoiceDate', 'totalAmount', 'seller', 'buyer'],
      'air_waybill': ['awbNumber', 'origin', 'destination', 'shipper', 'consignee', 'goodsDescription'],
      'house_waybill': ['hawbNumber', 'origin', 'destination', 'shipper', 'consignee', 'goodsDescription'],
      'bill_of_entry': ['beNumber', 'importerName', 'importerCode', 'assessableValue', 'totalDuty'],
      'packing_list': ['invoiceNumber', 'packageCount', 'grossWeight', 'netWeight'],
      'delivery_note': ['deliveryNumber', 'customerName', 'deliveryDate', 'items'],
      'unknown': []
    };
    
    return criticalFieldsMap[documentType] || [];
  }

  /**
   * Calculates a confidence score for an extraction result
   * 
   * @param data - The extraction data
   * @returns The confidence score
   */
  calculateConfidenceScore(data: any): number {
    if (!data || !data.metadata) return 0;
    
    const { criticalFields = [], missingFields = [] } = data.metadata;
    
    // If there are no critical fields, return a default score
    if (criticalFields.length === 0) return 0.5;
    
    // Calculate how many critical fields are present
    const missingCriticalFields = missingFields.filter(field => 
      criticalFields.includes(field)
    );
    
    const presentCriticalFields = criticalFields.length - missingCriticalFields.length;
    const criticalFieldScore = presentCriticalFields / criticalFields.length;
    
    // Adjust score based on issues
    const issues = data.metadata.issues || [];
    const issuesPenalty = issues.length * 0.05;
    
    // Calculate final score
    let finalScore = criticalFieldScore - issuesPenalty;
    
    // Ensure score is between 0 and 1
    finalScore = Math.max(0, Math.min(1, finalScore));
    
    return finalScore;
  }
}
