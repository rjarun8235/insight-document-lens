/**
 * Optimized Document Service
 * Processes each document independently and then performs validation as a separate step
 * Implements strict compliance and accuracy standards for logistics document verification
 */

import { 
  ParsedDocument, 
  ComparisonResult,
  ProcessingOptions,
  ProcessingResult,
  TokenUsage,
  ContentBlock,
  ExtractionResult,
  ValidationResult
} from '../types/app-types';
import { ClaudeApiService, MODELS } from '../api/claude-api';
import { extractionPrompt } from '../templates/extraction-prompt';

interface DocumentExtractionResult {
  documentName: string;
  documentType: string;
  extractedFields: Record<string, any>;
  tokenUsage: TokenUsage;
}

/**
 * Optimized Document Service
 * 
 * This service provides an optimized approach to document processing by:
 * 1. Processing each document independently for extraction
 * 2. Performing a consolidated validation of all extracted data
 */
export default class OptimizedDocumentService {
  private claudeApi: ClaudeApiService;
  
  constructor() {
    this.claudeApi = new ClaudeApiService();
  }

  /**
   * Process multiple documents by extracting data from each independently
   * and then validating them together
   */
  public async processDocuments(
    documents: ParsedDocument[],
    comparisonType: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    console.log('🚀 Starting optimized document processing pipeline');
    console.log(`📄 Processing ${documents.length} documents with comparison type: ${comparisonType}`);
    
    try {
      // Step 1: Extract data from each document independently
      console.log('🔍 Step 1: Extracting data from documents independently');
      const extractionResults: DocumentExtractionResult[] = [];
      
      // Process each document in sequence
      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];
        console.log(`Processing document ${i + 1}/${documents.length}: ${document.name}`);
        
        const result = await this.extractDocumentData(document);
        extractionResults.push(result);
      }
      
      console.log('✅ Step 1 complete: Data extraction');
      
      // Step 2: Validate all extracted data together
      console.log('🔍 Step 2: Validating extracted data');
      const validationResult: ValidationResult = await this.validateExtractedData(
        documents,
        extractionResults,
        comparisonType
      );
      
      console.log('✅ Step 2 complete: Data validation');
      
      // Calculate total token usage
      const totalTokenUsage = this.calculateTotalTokenUsage(
        extractionResults.map(r => r.tokenUsage),
        validationResult.tokenUsage
      );
      
      return {
        result: validationResult.result,
        stages: {
          extraction: {
            result: {
              documentData: extractionResults.map(r => ({
                documentName: r.documentName,
                documentType: r.documentType,
                extractedFields: r.extractedFields
              })),
              documentTypes: extractionResults.map(r => r.documentType),
              extractedFields: extractionResults.reduce((acc, r) => {
                Object.entries(r.extractedFields).forEach(([key, value]) => {
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(value);
                });
                return acc;
              }, {} as Record<string, any[]>)
            },
            tokenUsage: totalTokenUsage
          },
          analysis: {
            result: {
              discrepancies: [],
              corrections: [],
              tables: [] // Add the required tables property
            },
            tokenUsage: {
              input: 0,
              output: 0,
              cost: 0,
              cacheSavings: undefined
            }
          },
          validation: validationResult
        },
        totalTokenUsage
      };
    } catch (error) {
      console.error('Error processing documents:', error);
      throw new Error(`Failed to process documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Extract data from a single document
   */
  private async extractDocumentData(document: ParsedDocument): Promise<DocumentExtractionResult> {
    try {
      // Prepare content blocks for the extraction stage
      const contentBlocks: ContentBlock[] = [];
      
      // Add the document content block
      if (document.type === 'application/pdf' && document.base64Data) {
        // Add PDF as document content block with prompt caching
        contentBlocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: document.base64Data.replace(/^data:application\/pdf;base64,/, '')
          },
          cache_control: { type: 'ephemeral' } // Enable prompt caching for PDF documents
        });
      } else if (document.content) {
        // Add text content block for non-PDF documents
        contentBlocks.push({
          type: 'text',
          text: document.content
        });
      }
      
      // Add the extraction instructions
      contentBlocks.push({
        type: 'text',
        text: extractionPrompt
      });
      
      // Configure API parameters for extraction stage
      const apiParams = {
        model: MODELS.EXTRACTION.name,
        max_tokens: MODELS.EXTRACTION.maxTokens,
        messages: [
          {
            role: 'user',
            content: contentBlocks
          }
        ]
      };
      
      // Call Claude API for extraction
      console.log(`Calling Claude API (${MODELS.EXTRACTION.name}) for document extraction...`);
      const extractionResponse = await this.claudeApi.callApi(apiParams);
      console.log(`Received response from Claude API, processing extraction results...`);
      
      // Process the extraction result
      const extractionText = extractionResponse.content?.[0]?.text || '';
      console.log(`Claude extraction response preview: ${extractionText.substring(0, 100)}...`);
      
      // Parse the JSON response
      let extractedData;
      try {
        // Look for JSON in the response
        const jsonMatch = extractionText.match(/```json\n([\s\S]*?)\n```/) || 
                          extractionText.match(/{[\s\S]*}/);
        
        if (jsonMatch) {
          const jsonString = jsonMatch[1] || jsonMatch[0];
          console.log(`Attempting to parse JSON: ${jsonString.substring(0, 100)}...`);
          extractedData = JSON.parse(jsonString);
        } else {
          throw new Error('No JSON found in extraction response');
        }
      } catch (parseError) {
        console.error('Error parsing extraction JSON:', parseError);
        throw new Error(`Failed to parse extraction result: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }
      
      // Calculate token usage cost
      const tokenUsage = this.calculateTokenUsageCost(extractionResponse.usage, MODELS.EXTRACTION);
      
      // Determine document type
      const documentType = extractedData.documentType || this.guessDocumentType(document.name);
      
      return {
        documentName: document.name,
        documentType,
        extractedFields: extractedData.extractedFields || {},
        tokenUsage
      };
    } catch (error) {
      console.error(`Error extracting data from document ${document.name}:`, error);
      throw new Error(`Failed to extract data from document ${document.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Validate all extracted data together
   */
  private async validateExtractedData(
    documents: ParsedDocument[],
    extractionResults: DocumentExtractionResult[],
    comparisonType: string
  ): Promise<ValidationResult> {
    try {
      // Prepare content blocks for the validation stage
      const contentBlocks: ContentBlock[] = [];
      
      // Add a summary of each document's extracted data
      // This avoids sending the full document content again
      extractionResults.forEach((result, index) => {
        contentBlocks.push({
          type: 'text',
          text: `Document ${index + 1}: ${result.documentName} (${result.documentType})\n\n${JSON.stringify(result.extractedFields, null, 2)}`
        });
      });
      
      // Add the validation instructions
      contentBlocks.push({
        type: 'text',
        text: `
You are a document validation specialist for TSV Global, a logistics company. Your task is to validate and compare the extracted data from the provided logistics documents.

TASK:
1. Validate the extracted data for accuracy and completeness
2. Compare the documents to identify any discrepancies or inconsistencies
3. Verify that all required fields are present and correctly formatted
4. Provide a confidence score for the overall validation (0-100%)

Document Type: ${comparisonType}

IMPORTANT: Structure your response as follows:

1. VALIDATION SUMMARY:
   - Provide a clear, concise summary of your validation
   - Include a confidence score (0-100%)
   - List any corrections needed

2. COMPARISON TABLE:
   - Create a well-structured markdown table comparing key fields across documents
   - Highlight any discrepancies or inconsistencies
   - Use ✅ for matching fields and ❌ for mismatches

Focus on the following key logistics fields:
- Consignee and Shipper information
- Document numbers and dates
- Item descriptions and quantities
- Weights and measurements
- Delivery terms and payment terms
- Container/shipment details
- Origin and destination information

Your validation is critical for ensuring accurate logistics processing and compliance.
`
      });
      
      // Configure API parameters for validation stage
      const apiParams = {
        model: MODELS.VALIDATION.name,
        max_tokens: MODELS.VALIDATION.maxTokens,
        messages: [
          {
            role: 'user',
            content: contentBlocks
          }
        ]
      };
      
      // Call Claude API for validation
      console.log(`Calling Claude API (${MODELS.VALIDATION.name}) for validation...`);
      const validationResponse = await this.claudeApi.callApi(apiParams);
      console.log(`Received response from Claude API, processing validation results...`);
      
      // Process the validation result
      const validationText = validationResponse.content?.[0]?.text || '';
      
      // Process the validation text into a structured format
      const comparisonResult = this.processValidationResponse(validationText);
      
      // Calculate token usage cost
      const tokenUsage = this.calculateTokenUsageCost(validationResponse.usage, MODELS.VALIDATION);
      
      return {
        result: comparisonResult,
        confidenceScore: comparisonResult.confidenceScore || 0,
        isValid: (comparisonResult.confidenceScore || 0) >= 70,
        finalResults: validationText,
        rawText: validationText,
        tokenUsage
      };
    } catch (error) {
      console.error('Error validating extracted data:', error);
      throw new Error(`Failed to validate extracted data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Process the validation response into a structured format
   */
  private processValidationResponse(text: string): ComparisonResult {
    try {
      // Extract sections using markdown headings
      const validationSummary = this.extractHeadingContent('VALIDATION SUMMARY', text) || '';
      const comparisonTable = this.extractHeadingContent('COMPARISON TABLE', text) || '';
      
      // Extract confidence score from the validation text
      const confidenceMatch = validationSummary.match(/confidence\s+score:?\s*(\d+)%/i) || 
                             validationSummary.match(/confidence:?\s*(\d+)%/i) ||
                             validationSummary.match(/score:?\s*(\d+)%/i);
      
      const confidenceScore = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 0;
      
      // Parse markdown tables
      const tables = this.parseMarkdownTables(comparisonTable);
      
      // Return the comparison result
      return {
        summary: validationSummary,
        tables: tables.map(table => ({
          headers: table.headers,
          rows: table.rows.map(row => Object.values(row))
        })),
        confidenceScore,
        status: confidenceScore >= 70 ? 'SUCCESS' : 'FAILED',
        discrepancies: [],
        corrections: []
      };
    } catch (error) {
      console.error('Error processing validation response:', error);
      throw new Error(`Failed to process validation response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Extract content from a markdown heading
   */
  private extractHeadingContent(heading: string, text: string): string | undefined {
    const headingRegex = new RegExp(`#+\\s*${heading}:?\\s*\\n([\\s\\S]*?)(?=\\n#+\\s*|$)`, 'i');
    const match = text.match(headingRegex);
    return match ? match[1].trim() : undefined;
  }
  
  /**
   * Parse markdown tables into structured format
   */
  private parseMarkdownTables(tableText: string): any[] {
    const tables = [];
    
    // Match markdown tables
    const tableRegex = /\|([^\n]+)\|\n\|([-:\s|]+)\|\n((?:\|[^\n]+\|\n)+)/g;
    let tableMatch;
    
    while ((tableMatch = tableRegex.exec(tableText)) !== null) {
      try {
        // Extract headers
        const headerRow = tableMatch[1];
        const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
        
        // Extract rows
        const rowsText = tableMatch[3];
        const rows = rowsText.split('\n').filter(row => row.includes('|'));
        
        const parsedRows = rows.map(row => {
          const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
          
          // Create object with headers as keys
          const rowObj: Record<string, string> = {};
          headers.forEach((header, index) => {
            if (index < cells.length) {
              rowObj[header] = cells[index];
            }
          });
          
          return rowObj;
        });
        
        tables.push({
          headers,
          rows: parsedRows
        });
      } catch (error) {
        console.error('Error parsing markdown table:', error);
      }
    }
    
    return tables;
  }
  
  /**
   * Calculate token usage cost
   */
  private calculateTokenUsageCost(usage: any, model: any): TokenUsage {
    const inputTokens = usage?.input_tokens || 0;
    const outputTokens = usage?.output_tokens || 0;
    const cacheReadTokens = usage?.cache_read_input_tokens || 0;
    
    // Calculate cost in dollars
    const inputCost = (inputTokens / 1000000) * model.costPerInputMToken;
    const outputCost = (outputTokens / 1000000) * model.costPerOutputMToken;
    const totalCost = inputCost + outputCost;
    
    // Calculate cache savings if applicable
    const cacheSavings = cacheReadTokens > 0 
      ? ((cacheReadTokens / 1000000) * model.costPerInputMToken) 
      : undefined;
    
    return {
      input: inputTokens,
      output: outputTokens,
      cost: totalCost,
      cacheSavings
    };
  }
  
  /**
   * Calculate total token usage across all stages
   */
  private calculateTotalTokenUsage(
    extractionUsages: TokenUsage[],
    validationUsage: TokenUsage
  ): TokenUsage {
    // Sum up all token usages
    const totalInput = extractionUsages.reduce((sum, usage) => sum + usage.input, 0) + validationUsage.input;
    const totalOutput = extractionUsages.reduce((sum, usage) => sum + usage.output, 0) + validationUsage.output;
    const totalCost = extractionUsages.reduce((sum, usage) => sum + usage.cost, 0) + validationUsage.cost;
    
    // Calculate total cache savings if applicable
    const extractionSavings = extractionUsages
      .filter(usage => usage.cacheSavings !== undefined)
      .reduce((sum, usage) => sum + (usage.cacheSavings || 0), 0);
    
    const totalCacheSavings = (extractionSavings > 0 || validationUsage.cacheSavings)
      ? (extractionSavings + (validationUsage.cacheSavings || 0))
      : undefined;
    
    return {
      input: totalInput,
      output: totalOutput,
      cost: totalCost,
      cacheSavings: totalCacheSavings
    };
  }
  
  /**
   * Guess document type based on filename
   */
  private guessDocumentType(fileName: string): string {
    const lowerName = fileName.toLowerCase();
    
    if (lowerName.includes('invoice')) {
      return 'Invoice';
    } else if (lowerName.includes('bill') && lowerName.includes('lading')) {
      return 'Bill of Lading';
    } else if (lowerName.includes('packing') && lowerName.includes('list')) {
      return 'Packing List';
    } else if (lowerName.includes('certificate') && lowerName.includes('origin')) {
      return 'Certificate of Origin';
    } else if (lowerName.includes('commercial') && lowerName.includes('invoice')) {
      return 'Commercial Invoice';
    } else if (lowerName.includes('shipping') && lowerName.includes('manifest')) {
      return 'Shipping Manifest';
    } else if (lowerName.includes('customs') && lowerName.includes('declaration')) {
      return 'Customs Declaration';
    } else if (lowerName.includes('delivery') && lowerName.includes('order')) {
      return 'Delivery Order';
    } else {
      return 'Unknown';
    }
  }
}

// Export a singleton instance
export const optimizedDocumentService = new OptimizedDocumentService();
