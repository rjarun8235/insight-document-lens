/**
 * Document Service
 * Handles the multi-stage document processing pipeline for TSV Global
 * Implements strict compliance and accuracy standards for logistics document verification
 */

import { 
  ParsedDocument, 
  ContentBlock, 
  ProcessingOptions, 
  ExtractionResult, 
  AnalysisResult, 
  ValidationResult, 
  ProcessingResult,
  ComparisonResult,
  ComparisonTable,
  TokenUsage
} from '../types/app-types';
import axios from 'axios';
import { extractionPrompt } from '../templates/extraction-prompt';
import { analysisPrompt } from '../templates/analysis-prompt';
import { validationPrompt } from '../templates/validation-prompt';

/**
 * Document Service
 * Orchestrates the multi-stage document processing pipeline
 * Ensures strict compliance and accuracy for logistics document verification
 */
export class DocumentService {
  // API endpoints for different processing stages
  private extractionApiUrl = 'https://cbrgpzdxttzlvvryysaf.supabase.co/functions/v1/claude-api-proxy/extraction';
  private analysisApiUrl = 'https://cbrgpzdxttzlvvryysaf.supabase.co/functions/v1/claude-api-proxy/analysis';
  private validationApiUrl = 'https://cbrgpzdxttzlvvryysaf.supabase.co/functions/v1/claude-api-proxy/validation';
  
  // Default model configuration
  private maxTokens = 4096;
  
  /**
   * Call the Claude API through the Supabase proxy
   * @param messages The messages to send to Claude
   * @param apiUrl The API URL to use (extraction, analysis, or validation)
   * @returns The API response
   */
  private async callClaudeApi(messages: any, apiUrl: string) {
    try {
      const response = await axios.post(apiUrl, {
        messages,
        max_tokens: this.maxTokens
      });
      
      return response.data;
    } catch (error: any) {
      // Detailed error logging with different error scenarios
      if (error.response) {
        // The request was made and the server responded with an error status
        console.error('API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.request) {
        console.error('API Request Error (No Response):', error.request);
      } else {
        console.error('API Error:', error.message);
      }
      
      throw new Error(`Claude API error: ${error.message}`);
    }
  }
  
  /**
   * Calculate the cost of the API call based on token usage
   */
  private calculateCost(usage: any): number {
    if (!usage) return 0;
    
    const inputCost = (usage.input_tokens || 0) * 0.000003;
    const outputCost = (usage.output_tokens || 0) * 0.000015;
    
    return inputCost + outputCost;
  }
  
  /**
   * Process documents through the multi-stage pipeline
   * @param documents Array of parsed documents
   * @param options Processing options
   * @returns Processing result with comparison result and token usage
   */
  async processDocuments(
    documents: ParsedDocument[], 
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    console.log('Processing documents with options:', options);
    
    // Default options - extended thinking enabled by default, thinking not shown in UI
    const processingOptions = {
      showThinking: false, // Never show thinking in UI
      useExtendedOutput: true, // Always use extended output
      skipValidation: options.skipValidation || false,
      comparisonType: options.comparisonType || 'logistics'
    };
    
    // Stage 1: Extraction
    console.log('Starting extraction stage...');
    const extractionResult = await this.extractDocumentData(documents, processingOptions);
    console.log('Extraction complete');
    
    // Stage 2: Analysis
    console.log('Starting analysis stage...');
    const analysisResult = await this.analyzeDocuments(
      documents, 
      extractionResult, 
      processingOptions
    );
    console.log('Analysis complete');
    
    // Stage 3: Validation (optional)
    let validationResult = null;
    let finalResult = analysisResult.result;
    
    if (!processingOptions.skipValidation) {
      console.log('Starting validation stage with extended thinking...');
      validationResult = await this.validateAnalysis(
        documents,
        extractionResult.result,
        analysisResult.result,
        processingOptions
      );
      finalResult = validationResult.result;
      console.log('Validation complete');
    } else {
      console.log('Validation stage skipped (disabled in options)');
    }
    
    // Build final token usage numbers
    const totalInput = extractionResult.tokenUsage.input + 
      analysisResult.tokenUsage.input + 
      (validationResult ? validationResult.tokenUsage.input : 0);
      
    const totalOutput = extractionResult.tokenUsage.output + 
      analysisResult.tokenUsage.output + 
      (validationResult ? validationResult.tokenUsage.output : 0);
      
    const totalCost = extractionResult.tokenUsage.cost + 
      analysisResult.tokenUsage.cost + 
      (validationResult ? validationResult.tokenUsage.cost : 0);
    
    const totalCacheSavings = extractionResult.tokenUsage.cacheSavings + 
      analysisResult.tokenUsage.cacheSavings + 
      (validationResult ? validationResult.tokenUsage.cacheSavings : 0);
      
    return {
      result: finalResult,
      tokenUsage: {
        input: totalInput,
        output: totalOutput,
        cost: totalCost,
        cacheSavings: totalCacheSavings
      },
      thinkingProcess: validationResult ? validationResult.thinkingProcess : undefined,
      confidenceScore: validationResult ? validationResult.confidenceScore : analysisResult.confidenceScore
    };
  }
  
  /**
   * Extract structured data from documents
   * Ensures accurate extraction of key logistics fields
   */
  async extractDocumentData(
    documents: ParsedDocument[],
    options: ProcessingOptions
  ): Promise<ExtractionResult> {
    console.log(`Extracting data from ${documents.length} documents...`);
    
    try {
      // Prepare document content for extraction
      const documentTexts = documents.map(doc => {
        return `Document: ${doc.name}\n\n${doc.content}`;
      }).join('\n\n---\n\n');
      
      // Prepare extraction request with content blocks
      const contentBlocks: ContentBlock[] = [
        {
          type: 'text',
          text: documentTexts
        },
        {
          type: 'text',
          text: extractionPrompt(documents.map(doc => doc.name).join('\n'), options.comparisonType || 'logistics')
        }
      ];
      
      // Call Claude API for extraction
      const extractionResponse = await this.callClaudeApi(
        [{
          role: 'user',
          content: contentBlocks
        }],
        this.extractionApiUrl
      );
      
      // Parse the extraction result
      const extractionText = extractionResponse.content?.[0]?.text || '';
      
      let extractedData: any = null;
      try {
        // Try to parse JSON from the response
        const jsonMatch = extractionText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          extractedData = JSON.parse(jsonMatch[1]);
        } else {
          // Try to find and parse any JSON in the response
          const anyJsonMatch = extractionText.match(/{[\s\S]*}/);
          if (anyJsonMatch) {
            extractedData = JSON.parse(anyJsonMatch[0]);
          }
        }
      } catch (error) {
        console.error('Error parsing extraction JSON:', error);
        // If JSON parsing fails, try to extract structured data from the text
        extractedData = null;
      }
      
      // If JSON parsing failed, create structured data from tables
      if (!extractedData) {
        console.log('Falling back to table parsing for extraction results');
        
        // Look for markdown tables in the response
        const tables: any[] = [];
        const tableRegex = /\|(.+)\|\n\|(?:[-:]+\|)+\n((?:\|.+\|\n)+)/g;
        let tableMatch;
        
        while ((tableMatch = tableRegex.exec(extractionText)) !== null) {
          const headerRow = tableMatch[1].trim();
          const dataRows = tableMatch[2].trim();
          
          // Parse headers
          const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
          
          // Parse data rows
          const rows: string[][] = [];
          const dataRowsArray = dataRows.split('\n');
          
          for (const row of dataRowsArray) {
            if (row.trim() === '') continue;
            const cells = row.split('|').map(cell => cell.trim()).filter((_, i) => i > 0 && i <= headers.length);
            rows.push(cells);
          }
          
          // Add table to result
          tables.push({
            headers,
            rows
          });
        }
        
        // Create structured data from tables
        const documentData = documents.map((doc, index) => ({
          documentType: this.guessDocumentType(doc.name),
          documentName: doc.name,
          fields: {}
        }));
        
        // If tables are found, use the first table to populate document data
        if (tables.length > 0 && tables[0].headers.includes('Document') && tables[0].headers.includes('Field')) {
          const table = tables[0];
          const documentIndex = table.headers.indexOf('Document');
          const fieldIndex = table.headers.indexOf('Field');
          const valueIndex = table.headers.indexOf('Value');
          
          if (documentIndex >= 0 && fieldIndex >= 0 && valueIndex >= 0) {
            for (const row of table.rows) {
              const docName = row[documentIndex];
              const field = row[fieldIndex];
              const value = row[valueIndex];
              
              const docDataItem = documentData.find(d => d.documentName.includes(docName));
              if (docDataItem) {
                docDataItem.fields[field] = value;
              }
            }
          }
        } else {
          // If no usable tables found, add placeholder data
          documentData.forEach((doc, index) => {
            doc.fields = {
              'File Name': doc.documentName,
              'Content': extractionText.includes(doc.documentName) ? 
                'Document was processed but structured data could not be extracted' : 
                'Document may not have been properly processed'
            }
          });
        }
        
        const documentTypes = documentData.map(doc => doc.documentType);
        
        extractedData = {
          documentData,
          documentTypes
        };
      }
      
      // Calculate token usage cost
      const tokenUsage: TokenUsage = {
        input: extractionResponse.usage.input_tokens,
        output: extractionResponse.usage.output_tokens,
        cost: this.calculateCost(extractionResponse.usage),
        cacheSavings: this.calculateCacheSavings(extractionResponse.usage)
      };
      
      return {
        result: extractedData,
        tokenUsage
      };
    } catch (error) {
      console.error('Error extracting document data:', error);
      throw error;
    }
  }
  
  /**
   * Analyze extracted data
   */
  async analyzeDocuments(
    documents: ParsedDocument[],
    extractionResult: ExtractionResult,
    options: ProcessingOptions
  ): Promise<AnalysisResult> {
    console.log('Analyzing extracted document data...');
    
    try {
      // Prepare content blocks for analysis
      const contentBlocks: ContentBlock[] = [
        {
          type: 'text',
          text: JSON.stringify(extractionResult.result, null, 2)
        },
        {
          type: 'text',
          text: analysisPrompt(documents.length, options.comparisonType || 'logistics')
        }
      ];
      
      // Call Claude API for analysis
      const analysisResponse = await this.callClaudeApi(
        [{
          role: 'user',
          content: contentBlocks
        }],
        this.analysisApiUrl
      );
      
      // Process the response
      const analysisText = analysisResponse.content?.[0]?.text || '';
      
      // Parse the analysis result into a structured format
      const analysisResult = this.processClaudeResponse(analysisText);
      
      // Extract confidence score (default to 0 if not found)
      const confidenceMatch = analysisText.match(/confidence(?:\s+score)?:?\s*(\d+)%/i);
      const confidenceScore = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 0;
      
      // Calculate token usage cost
      const tokenUsage: TokenUsage = {
        input: analysisResponse.usage.input_tokens,
        output: analysisResponse.usage.output_tokens,
        cost: this.calculateCost(analysisResponse.usage),
        cacheSavings: this.calculateCacheSavings(analysisResponse.usage)
      };
      
      return {
        result: analysisResult,
        tokenUsage,
        confidenceScore
      };
    } catch (error) {
      console.error('Error analyzing documents:', error);
      throw error;
    }
  }
  
  /**
   * Validate the analysis with extended thinking
   */
  async validateAnalysis(
    documents: ParsedDocument[],
    extractedData: any,
    analysisResult: any,
    options: ProcessingOptions
  ): Promise<ValidationResult> {
    console.log('Validating analysis with extended thinking...');
    
    try {
      // Combine data from previous stages for validation
      const validationData = {
        extractedData,
        analysisResult,
        documentNames: documents.map(doc => doc.name)
      };
      
      // Prepare content blocks
      const contentBlocks: ContentBlock[] = [
        {
          type: 'text',
          text: JSON.stringify(validationData, null, 2)
        },
        {
          type: 'text',
          text: validationPrompt(documents.length, options.comparisonType || 'logistics')
        }
      ];

      // Call Claude API for validation with extended thinking
      const validationResponse = await this.callClaudeApi(
        [{
          role: 'user',
          content: contentBlocks
        }],
        this.validationApiUrl
      );
      
      // Extract the response text and optional thinking process
      const validationText = validationResponse.content?.[0]?.text || '';
      const thinkingProcess = options.showThinking ? validationResponse.thinking?.thinking_text : undefined;
      
      // Process the response into a structured format
      const finalResults = this.processClaudeResponse(validationText);
      
      // Extract tables from validation result
      const tables = finalResults.tables || [];
      
      // Extract confidence score
      let confidenceScore = 0;
      const confidenceMatch = validationText.match(/confidence(?:\s+score)?:?\s*(\d+)%/i) || 
                             finalResults.match(/score:?\s*(\d+)%/i);
      
      if (confidenceMatch) {
        confidenceScore = parseInt(confidenceMatch[1], 10);
      }
      
      // Calculate token usage cost
      const tokenUsage: TokenUsage = {
        input: validationResponse.usage.input_tokens,
        output: validationResponse.usage.output_tokens,
        cost: this.calculateCost(validationResponse.usage),
        cacheSavings: this.calculateCacheSavings(validationResponse.usage)
      };
      
      return {
        result: finalResults,
        tokenUsage,
        confidenceScore,
        thinkingProcess
      };
    } catch (error) {
      console.error('Error validating analysis:', error);
      throw error;
    }
  }
  
  /**
   * Process Claude's response into a structured format
   */
  private processClaudeResponse(text: string): ComparisonResult {
    // Initialize the result object
    const result: ComparisonResult = {
      tables: []
    };
    
    // Extract tables
    const tableRegex = /\|(.+)\|\n\|(?:[-:]+\|)+\n((?:\|.+\|\n)+)/g;
    let tableMatch;
    
    while ((tableMatch = tableRegex.exec(text)) !== null) {
      const headerRow = tableMatch[1].trim();
      const dataRows = tableMatch[2].trim();
      
      // Parse headers
      const headers = headerRow.split('|').map(h => h.trim()).filter(h => h);
      
      // Parse data rows
      const rows: string[][] = [];
      const dataRowsArray = dataRows.split('\n');
      
      for (const row of dataRowsArray) {
        if (row.trim() === '') continue;
        const cells = row.split('|').map(cell => cell.trim()).filter((_, i) => i > 0 && i <= headers.length);
        rows.push(cells);
      }
      
      // Add table to result
      result.tables.push({
        headers,
        rows
      });
    }
    
    // Extract sections
    const sections = [
      { name: 'analysis', regex: /##\s*Analysis\s*([\s\S]*?)(?=##|$)/i },
      { name: 'summary', regex: /##\s*Summary\s*([\s\S]*?)(?=##|$)/i },
      { name: 'insights', regex: /##\s*Insights\s*([\s\S]*?)(?=##|$)/i },
      { name: 'issues', regex: /##\s*Issues\s*([\s\S]*?)(?=##|$)/i },
      { name: 'verification', regex: /##\s*Verification\s*([\s\S]*?)(?=##|$)/i },
      { name: 'validation', regex: /##\s*Validation\s*([\s\S]*?)(?=##|$)/i },
      { name: 'review', regex: /##\s*Review\s*([\s\S]*?)(?=##|$)/i },
      { name: 'recommendations', regex: /##\s*Recommendations\s*([\s\S]*?)(?=##|$)/i },
      { name: 'risks', regex: /##\s*Risks\s*([\s\S]*?)(?=##|$)/i }
    ];
    
    for (const section of sections) {
      const match = text.match(section.regex);
      if (match && match[1]) {
        result[section.name] = match[1].trim();
      }
    }
    
    return result;
  }
  
  /**
   * Guess the document type based on the file name
   */
  private guessDocumentType(fileName: string): string {
    const lowerName = fileName.toLowerCase();
    
    if (lowerName.includes('invoice')) {
      return 'Invoice';
    } else if (lowerName.includes('bill') && lowerName.includes('lading') || lowerName.includes('bl')) {
      return 'Bill of Lading';
    } else if (lowerName.includes('pack')) {
      return 'Packing List';
    } else if (lowerName.includes('purchase') || lowerName.includes('po') || lowerName.includes('order')) {
      return 'Purchase Order';
    } else {
      return 'Unknown Document';
    }
  }
  
  /**
   * Calculate cost based on token usage and endpoint
   * @deprecated Use the calculateCost method with usage object instead
   */
  private calculateCostLegacy(inputTokens: number, outputTokens: number, endpoint: string): number {
    // Cost per million tokens (same for all endpoints)
    const costPerInputMToken = 0.000003; // $3 per million tokens
    const costPerOutputMToken = 0.000015; // $15 per million tokens
    
    const inputCost = inputTokens * costPerInputMToken;
    const outputCost = outputTokens * costPerOutputMToken;
    return inputCost + outputCost;
  }
  
  private calculateCacheSavings(usage: any): number {
    // Calculate cache savings from cached tokens (if available)
    const cacheReadTokens = usage.cache_read_input_tokens || 0;
    // Return 0 if no cache savings
    if (cacheReadTokens === 0) {
      return 0;
    }
    // Return the estimated cost savings (90% discount on cached content)
    return cacheReadTokens * 0.000003 * 0.9;
  }
}

// Export a singleton instance
export const documentService = new DocumentService();
