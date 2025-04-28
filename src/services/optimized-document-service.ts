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
  ValidationResult
} from '../types/app-types';
import { claudeApi, MODELS } from '../api/claude-api';
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
  private EXTRACTION_MODEL = MODELS.EXTRACTION.name;
  private EXTRACTION_MAX_TOKENS = MODELS.EXTRACTION.maxTokens;
  private EXTRACTION_THINKING = {
    type: 'enabled',
    budget_tokens: 8000 // Hardcoded value since thinkingBudget doesn't exist in EXTRACTION model
  };
  private VALIDATION_MODEL = MODELS.VALIDATION.name;
  private VALIDATION_MAX_TOKENS = MODELS.VALIDATION.maxTokens;
  private VALIDATION_THINKING = {
    type: 'enabled',
    budget_tokens: 16000 // Hardcoded value since thinkingBudget doesn't exist in VALIDATION model
  };

  constructor() {
    // Using the singleton claudeApi instance
  }

  /**
   * Process multiple documents by extracting data from each independently
   * and then validating them together
   */
  public async processDocuments(
    documents: ParsedDocument[],
    options: ProcessingOptions
  ): Promise<ProcessingResult> {
    try {
      console.log(`🚀 Starting document processing for ${documents.length} documents`);
      console.log(`Processing options: ${JSON.stringify(options)}`);

      // Track overall token usage
      const totalTokenUsage: TokenUsage = {
        input: 0,
        output: 0,
        cost: 0,
        cacheSavings: 0
      };

      // Step 1: Extract data from each document independently
      console.log(`Step 1: Extracting data from ${documents.length} documents independently...`);
      const extractionResults: DocumentExtractionResult[] = [];
      const extractionErrors: string[] = [];

      // Process each document in parallel
      const extractionPromises = documents.map(async (document) => {
        try {
          const result = await this.extractDocumentData(document);
          extractionResults.push(result);

          // Update token usage
          totalTokenUsage.input += result.tokenUsage.input;
          totalTokenUsage.output += result.tokenUsage.output;
          totalTokenUsage.cost += result.tokenUsage.cost;

          if (result.tokenUsage.cacheSavings) {
            totalTokenUsage.cacheSavings = (totalTokenUsage.cacheSavings || 0) + result.tokenUsage.cacheSavings;
          }

          console.log(`✅ Extracted data from ${document.name} (${result.documentType})`);
        } catch (error) {
          console.error(`❌ Failed to extract data from ${document.name}:`, error);
          extractionErrors.push(`${document.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      // Wait for all extraction processes to complete
      await Promise.all(extractionPromises);

      // Check if we have any successful extractions
      if (extractionResults.length === 0) {
        throw new Error(`Failed to extract data from any documents: ${extractionErrors.join(', ')}`);
      }

      // Log extraction errors if any
      if (extractionErrors.length > 0) {
        console.warn(`⚠️ Extraction errors occurred for ${extractionErrors.length} documents:`, extractionErrors);
      }

      // Step 2: Validate and compare the extracted data
      console.log(`Step 2: Validating and comparing extracted data from ${extractionResults.length} documents...`);
      const validationResult = await this.validateExtractedData(
        documents,
        extractionResults,
        options.comparisonType || 'General'
      );

      // Update token usage with validation usage
      totalTokenUsage.input += validationResult.tokenUsage.input;
      totalTokenUsage.output += validationResult.tokenUsage.output;
      totalTokenUsage.cost += validationResult.tokenUsage.cost;

      if (validationResult.tokenUsage.cacheSavings) {
        totalTokenUsage.cacheSavings = (totalTokenUsage.cacheSavings || 0) + validationResult.tokenUsage.cacheSavings;
      }

      // Log validation result
      console.log(`✅ Validation complete with confidence score: ${validationResult.confidenceScore * 100}%`);
      console.log(`🔢 Total token usage: ${totalTokenUsage.input} input, ${totalTokenUsage.output} output`);
      console.log(`💰 Estimated cost: $${totalTokenUsage.cost.toFixed(4)}`);

      if (totalTokenUsage.cacheSavings) {
        console.log(`💰 Cache savings: $${totalTokenUsage.cacheSavings.toFixed(4)}`);
      }

      // Return the final processing result
      return {
        result: validationResult.result,
        isValid: validationResult.isValid,
        confidenceScore: validationResult.confidenceScore,
        thinkingProcess: validationResult.thinkingProcess,
        tokenUsage: totalTokenUsage,
        extractionResults,
        errors: extractionErrors.length > 0 ? extractionErrors : undefined
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
      console.log(`🔍 Extracting data from document: ${document.name}`);

      // Prepare the instruction for extraction
      const instruction = extractionPrompt;

      // Prepare the document content
      const documentContent = document.content;

      // Create messages for Claude API
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: instruction
            },
            {
              type: 'text',
              text: documentContent
            }
          ] as ContentBlock[]
        }
      ];

      // Call Claude API for document extraction
      console.log(`Calling Claude API (${this.EXTRACTION_MODEL}) for document extraction...`);
      const response = await claudeApi.callApi(
        this.EXTRACTION_MODEL,
        messages,
        this.EXTRACTION_MAX_TOKENS,
        this.EXTRACTION_THINKING
      );

      console.log(`Received response from Claude API, processing extraction results...`);

      // Extract the response text
      const responseText = response.content[0].text;

      // Log a preview of the response
      console.log(`Claude extraction response preview: ${responseText.substring(0, 200)}...`);

      // Parse the JSON response
      let extractedData: { documentType?: string; fields?: Record<string, any> } = {};
      try {
        console.log(`Attempting to parse JSON: ${responseText.substring(0, 200)}...`);
        extractedData = this.parseJsonFromResponse(responseText);
      } catch (error) {
        console.error(`Error parsing JSON from Claude response:`, error);
        throw new Error(`Failed to parse extraction result: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Calculate token usage
      const tokenUsage: TokenUsage = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cost: this.calculateCost(
          response.usage.input_tokens,
          response.usage.output_tokens,
          this.EXTRACTION_MODEL
        )
      };

      // Add cache savings if applicable
      if (response.usage.cache_read_input_tokens) {
        tokenUsage.cacheSavings = this.calculateCacheSavings(response.usage);
      }

      // Return the extracted data
      return {
        documentName: document.name,
        documentType: extractedData.documentType || 'Unknown',
        extractedFields: extractedData.fields || {},
        tokenUsage
      };
    } catch (error) {
      console.error(`Error extracting data from document ${document.name}:`, error);
      throw new Error(`Failed to extract data from document ${document.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate extracted document data
   */
  private async validateExtractedData(
    documents: ParsedDocument[],
    extractionResults: DocumentExtractionResult[],
    comparisonType: string
  ): Promise<ValidationResult> {
    try {
      console.log(`🔍 Validating extracted data from ${documents.length} documents`);

      // Prepare the validation prompt
      const validationPrompt = this.prepareValidationPrompt(extractionResults, comparisonType);

      // Create messages for Claude API
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: validationPrompt
            }
          ] as ContentBlock[]
        }
      ];

      // Call Claude API for validation
      console.log(`Calling Claude API (${this.VALIDATION_MODEL}) for validation...`);
      const response = await claudeApi.callApi(
        this.VALIDATION_MODEL,
        messages,
        this.VALIDATION_MAX_TOKENS,
        this.VALIDATION_THINKING
      );

      console.log(`Received response from Claude API, processing validation results...`);

      // Extract the response text and thinking process
      const responseText = response.content[0].text;
      const thinkingProcess = response.content.find((c: any) => c.type === 'thinking')?.thinking;

      // Process the validation response
      const comparisonResult = this.processValidationResponse(responseText);

      // Calculate token usage
      const tokenUsage: TokenUsage = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cost: this.calculateCost(
          response.usage.input_tokens,
          response.usage.output_tokens,
          this.VALIDATION_MODEL
        )
      };

      // Add cache savings if applicable
      if (response.usage.cache_read_input_tokens) {
        tokenUsage.cacheSavings = this.calculateCacheSavings(response.usage);
      }

      // Extract confidence score if available
      const confidenceScore = this.extractConfidenceScore(responseText);

      // Determine if the documents are valid based on confidence score
      const isValid = confidenceScore >= 0.8; // 80% confidence threshold

      return {
        result: comparisonResult,
        isValid,
        confidenceScore,
        thinkingProcess,
        tokenUsage
      };
    } catch (error) {
      console.error('Error validating documents:', error);
      throw new Error(`Failed to validate documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
   * Parse JSON from response text
   */
  private parseJsonFromResponse(text: string): any {
    try {
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) ||
                        text.match(/{[\s\S]*}/);

      if (jsonMatch) {
        const jsonString = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonString);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (error) {
      throw new Error(`Failed to parse JSON from response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    tokenUsages: TokenUsage[]
  ): TokenUsage {
    // Sum up all token usages
    const totalInput = tokenUsages.reduce((sum, usage) => sum + usage.input, 0);
    const totalOutput = tokenUsages.reduce((sum, usage) => sum + usage.output, 0);
    const totalCost = tokenUsages.reduce((sum, usage) => sum + usage.cost, 0);

    // Calculate total cache savings if applicable
    const totalCacheSavings = tokenUsages
      .filter(usage => usage.cacheSavings !== undefined)
      .reduce((sum, usage) => sum + (usage.cacheSavings || 0), 0);

    return {
      input: totalInput,
      output: totalOutput,
      cost: totalCost,
      cacheSavings: totalCacheSavings > 0 ? totalCacheSavings : undefined
    };
  }

  /**
   * Calculate cost
   */
  private calculateCost(inputTokens: number, outputTokens: number, modelName: string): number {
    // Find the model configuration by name
    const model = Object.values(MODELS).find(m => m.name === modelName) || MODELS.EXTRACTION;

    // Calculate costs using the model's cost per token values
    const inputCost = (inputTokens / 1000000) * model.costPerInputMToken;
    const outputCost = (outputTokens / 1000000) * model.costPerOutputMToken;
    return inputCost + outputCost;
  }

  /**
   * Calculate cache savings
   */
  private calculateCacheSavings(usage: any): number {
    const cacheReadTokens = usage.cache_read_input_tokens || 0;
    // Use the EXTRACTION model's cost per token for cache savings calculation
    return (cacheReadTokens / 1000000) * MODELS.EXTRACTION.costPerInputMToken;
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

  /**
   * Prepare the validation prompt
   */
  private prepareValidationPrompt(extractionResults: DocumentExtractionResult[], comparisonType: string): string {
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

    // Join the content blocks into a single string
    return contentBlocks.map(block => block.text).join('\n\n');
  }

  /**
   * Extract confidence score from the validation text
   */
  private extractConfidenceScore(text: string): number {
    const confidenceMatch = text.match(/confidence\s+score:?\s*(\d+)%/i) ||
                           text.match(/confidence:?\s*(\d+)%/i) ||
                           text.match(/score:?\s*(\d+)%/i);

    return confidenceMatch ? parseInt(confidenceMatch[1], 10) / 100 : 0;
  }
}

// Export a singleton instance
export const optimizedDocumentService = new OptimizedDocumentService();
