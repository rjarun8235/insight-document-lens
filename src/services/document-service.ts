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
import { ClaudeApiService } from '../api/claude-api';
import { extractionPrompt } from '../templates/extraction-prompt';
import { analysisPrompt } from '../templates/analysis-prompt';
import { validationPrompt } from '../templates/validation-prompt';

/**
 * Document Service
 * Orchestrates the multi-stage document processing pipeline
 * Ensures strict compliance and accuracy for logistics document verification
 */
export class DocumentService {
  private claudeApi: ClaudeApiService;
  
  constructor() {
    this.claudeApi = new ClaudeApiService();
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
      skipValidation: options.skipValidation || false
    };
    
    // Stage 1: Extraction
    console.log('Starting extraction stage...');
    const extractionResult = await this.extractDocumentData(documents, processingOptions);
    console.log('Extraction complete');
    
    // Stage 2: Analysis
    console.log('Starting analysis stage...');
    const analysisResult = await this.analyzeDocuments(
      documents, 
      extractionResult.result, 
      processingOptions
    );
    console.log('Analysis complete');
    
    // Stage 3: Validation (optional)
    let validationResult = null;
    let finalResult = analysisResult.result;
    
    if (!processingOptions.skipValidation) {
      console.log('Starting validation stage...');
      validationResult = await this.validateAnalysis(
        documents, 
        extractionResult.result,
        analysisResult.result,
        processingOptions
      );
      finalResult = validationResult.result;
      console.log('Validation complete');
    }
    
    // Calculate total token usage
    const totalTokenUsage: TokenUsage = {
      input: extractionResult.tokenUsage.input + 
             analysisResult.tokenUsage.input + 
             (validationResult ? validationResult.tokenUsage.input : 0),
      output: extractionResult.tokenUsage.output + 
              analysisResult.tokenUsage.output + 
              (validationResult ? validationResult.tokenUsage.output : 0),
      cost: extractionResult.tokenUsage.cost + 
            analysisResult.tokenUsage.cost + 
            (validationResult ? validationResult.tokenUsage.cost : 0),
      cacheSavings: (extractionResult.tokenUsage.cacheSavings || 0) + 
                    (analysisResult.tokenUsage.cacheSavings || 0) + 
                    (validationResult && validationResult.tokenUsage.cacheSavings ? 
                      validationResult.tokenUsage.cacheSavings : 0)
    };
    
    // Compile stages for debugging (not shown in UI)
    const stages = {
      extraction: extractionResult,
      analysis: analysisResult
    };
    
    if (validationResult) {
      stages['validation'] = validationResult;
    }
    
    return {
      result: finalResult,
      stages,
      tokenUsage: totalTokenUsage
    };
  }
  
  /**
   * Extract structured data from documents
   * Ensures accurate extraction of key logistics fields
   */
  private async extractDocumentData(
    documents: ParsedDocument[],
    options: ProcessingOptions
  ): Promise<ExtractionResult> {
    // Prepare content blocks for the API request
    const contentBlocks: ContentBlock[] = [];
    
    // Add each document as a content block
    documents.forEach((doc, index) => {
      if (doc.type === 'application/pdf' && doc.base64Data) {
        // Add PDF as document content block with prompt caching
        contentBlocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: doc.base64Data.replace(/^data:application\/pdf;base64,/, '')
          },
          cache_control: { type: 'ephemeral' } // Enable prompt caching
        });
      } else if (doc.content) {
        // Add text content block for non-PDF documents
        contentBlocks.push({
          type: 'text',
          text: `Document ${index + 1}: ${doc.name}\n\n${doc.content}`,
          cache_control: { type: 'ephemeral' } // Enable prompt caching
        });
      }
    });
    
    // Add the extraction instructions as the final text block
    contentBlocks.push({
      type: 'text',
      text: extractionPrompt,
      cache_control: { type: 'ephemeral' } // Enable prompt caching
    });
    
    // Prepare API call parameters
    const apiRequest = {
      model: this.claudeApi.MODELS.EXTRACTION.name,
      max_tokens: this.claudeApi.MODELS.EXTRACTION.maxTokens,
      messages: [
        {
          role: 'user',
          content: contentBlocks
        }
      ]
    };
    
    try {
      console.log(`Sending ${contentBlocks.length} content blocks to Claude API`);
      
      // Call Claude API for extraction
      const extractionResponse = await this.claudeApi.callApi(
        apiRequest.model,
        apiRequest.messages,
        apiRequest.max_tokens
      );
      
      // Parse the extraction result
      const extractionText = extractionResponse.content?.[0]?.text || '';
      
      // Log a preview of the response for debugging
      console.log(`Claude extraction response preview: ${extractionText.substring(0, 200)}...`);
      
      try {
        // Try to parse the JSON response
        const jsonMatch = extractionText.match(/```json\n([\s\S]*?)\n```/) || 
                         extractionText.match(/```\n([\s\S]*?)\n```/) ||
                         extractionText.match(/```javascript\n([\s\S]*?)\n```/) ||
                         extractionText.match(/```js\n([\s\S]*?)\n```/) ||
                         extractionText.match(/\{[\s\S]*?"documentData"[\s\S]*?"documentTypes"[\s\S]*?"extractedFields"[\s\S]*?\}/);
        
        if (jsonMatch) {
          // Clean up the JSON string
          let jsonStr = jsonMatch[1] || jsonMatch[0];
          
          // Remove any trailing or leading backticks or whitespace
          jsonStr = jsonStr.trim();
          if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.substring(3);
          }
          if (jsonStr.endsWith('```')) {
            jsonStr = jsonStr.substring(0, jsonStr.length - 3);
          }
          
          // Ensure we have a valid JSON object
          if (!jsonStr.startsWith('{')) {
            const startIndex = jsonStr.indexOf('{');
            if (startIndex >= 0) {
              jsonStr = jsonStr.substring(startIndex);
            }
          }
          
          // Ensure the JSON ends properly
          if (!jsonStr.endsWith('}')) {
            const endIndex = jsonStr.lastIndexOf('}');
            if (endIndex >= 0) {
              jsonStr = jsonStr.substring(0, endIndex + 1);
            }
          }
          
          console.log('Attempting to parse JSON:', jsonStr.substring(0, 100) + '...');
          
          const extractedData = JSON.parse(jsonStr);
          
          // Calculate token usage cost
          const tokenUsage: TokenUsage = {
            input: extractionResponse.usage.input_tokens,
            output: extractionResponse.usage.output_tokens,
            cost: this.calculateCost(
              extractionResponse.usage.input_tokens,
              extractionResponse.usage.output_tokens,
              this.claudeApi.MODELS.EXTRACTION
            ),
            cacheSavings: this.calculateCacheSavings(extractionResponse.usage)
          };
          
          return {
            result: extractedData,
            tokenUsage
          };
        } else {
          // If no JSON pattern was found, try to create a structured response from the text
          console.log('No JSON pattern found in Claude response. Creating fallback structure.');
          
          // Create a fallback structure based on the documents
          const documentData = documents.map((doc, index) => ({
            documentIndex: index + 1,
            documentType: this.guessDocumentType(doc.name),
            fields: {
              'File Name': doc.name,
              'Content': extractionText.includes(doc.name) ? 
                'Document was processed but structured data could not be extracted' : 
                'Document may not have been properly processed'
            }
          }));
          
          const documentTypes = documentData.map(doc => doc.documentType);
          
          // Calculate token usage cost
          const tokenUsage: TokenUsage = {
            input: extractionResponse.usage.input_tokens,
            output: extractionResponse.usage.output_tokens,
            cost: this.calculateCost(
              extractionResponse.usage.input_tokens,
              extractionResponse.usage.output_tokens,
              this.claudeApi.MODELS.EXTRACTION
            ),
            cacheSavings: this.calculateCacheSavings(extractionResponse.usage)
          };
          
          return {
            result: {
              documentData,
              documentTypes,
              extractedFields: { 'File Name': documents.map(doc => doc.name) }
            },
            tokenUsage
          };
        }
      } catch (jsonError) {
        console.error('Error parsing extraction JSON:', jsonError);
        console.log('Claude response excerpt:', extractionText.substring(0, 500) + '...');
        
        // Create a fallback structure for error cases
        const documentData = documents.map((doc, index) => ({
          documentIndex: index + 1,
          documentType: this.guessDocumentType(doc.name),
          fields: {
            'File Name': doc.name,
            'Error': `Failed to parse JSON: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`
          }
        }));
        
        const documentTypes = documentData.map(doc => doc.documentType);
        
        // Calculate token usage cost
        const tokenUsage: TokenUsage = {
          input: extractionResponse.usage.input_tokens,
          output: extractionResponse.usage.output_tokens,
          cost: this.calculateCost(
            extractionResponse.usage.input_tokens,
            extractionResponse.usage.output_tokens,
            this.claudeApi.MODELS.EXTRACTION
          ),
          cacheSavings: this.calculateCacheSavings(extractionResponse.usage)
        };
        
        return {
          result: {
            documentData,
            documentTypes,
            extractedFields: { 'File Name': documents.map(doc => doc.name) }
          },
          tokenUsage
        };
      }
    } catch (error) {
      console.error('Error in extraction stage:', error);
      
      // Create a fallback structure for API error cases
      const documentData = documents.map((doc, index) => ({
        documentIndex: index + 1,
        documentType: this.guessDocumentType(doc.name),
        fields: {
          'File Name': doc.name,
          'Error': `API Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }));
      
      const documentTypes = documentData.map(doc => doc.documentType);
      
      // Calculate token usage cost with zeros for error case
      const tokenUsage: TokenUsage = {
        input: 0,
        output: 0,
        cost: 0,
        cacheSavings: 0
      };
      
      return {
        result: {
          documentData,
          documentTypes,
          extractedFields: { 'File Name': documents.map(doc => doc.name) }
        },
        tokenUsage
      };
    }
  }
  
  /**
   * Analyze extracted data
   */
  private async analyzeDocuments(
    documents: ParsedDocument[],
    extractedData: any,
    options: ProcessingOptions
  ): Promise<AnalysisResult> {
    try {
      // Format the extracted data for analysis
      const formattedData = JSON.stringify({
        documentData: extractedData.documentData,
        documentTypes: extractedData.documentTypes,
        extractedFields: extractedData.extractedFields
      }, null, 2);
      
      // Prepare API call parameters
      const apiRequest = {
        model: this.claudeApi.MODELS.ANALYSIS.name,
        max_tokens: this.claudeApi.MODELS.ANALYSIS.maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Document Type: Logistics Documents\n\nExtracted Data:\n${formattedData}\n\n${analysisPrompt}`,
                cache_control: { type: 'ephemeral' } // Enable prompt caching
              }
            ]
          }
        ]
      };
      
      // Call Claude API for analysis
      const analysisResponse = await this.claudeApi.callApi(
        apiRequest.model,
        apiRequest.messages,
        apiRequest.max_tokens
      );
      
      // Parse the analysis result
      const contentText = analysisResponse.content?.[0]?.text || '';
      
      // Parse the result into a structured format
      const comparisonResult = this.processClaudeResponse(contentText);
      
      // Calculate token usage cost
      const tokenUsage: TokenUsage = {
        input: analysisResponse.usage.input_tokens,
        output: analysisResponse.usage.output_tokens,
        cost: this.calculateCost(
          analysisResponse.usage.input_tokens,
          analysisResponse.usage.output_tokens,
          this.claudeApi.MODELS.ANALYSIS
        ),
        cacheSavings: this.calculateCacheSavings(analysisResponse.usage)
      };
      
      return {
        result: comparisonResult,
        tokenUsage
      };
    } catch (error) {
      console.error('Error in analysis stage:', error);
      
      // Provide a fallback result with error information
      return {
        result: {
          tables: [] as ComparisonTable[],
          analysis: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          summary: 'Unable to analyze the documents due to an error.',
          insights: 'No insights available due to analysis failure.',
          issues: `Analysis process encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`
        } as ComparisonResult,
        tokenUsage: {
          input: 0,
          output: 0,
          cost: 0,
          cacheSavings: 0
        }
      };
    }
  }
  
  /**
   * Validate the analysis with extended thinking
   */
  private async validateAnalysis(
    documents: ParsedDocument[],
    extractedData: any,
    analysisResult: any,
    options: ProcessingOptions
  ): Promise<ValidationResult> {
    console.log('Validating analysis with extended thinking');
    
    // Prepare content blocks for the validation stage
    const contentBlocks: ContentBlock[] = [];
    
    // Add the document content blocks
    documents.forEach((doc, index) => {
      if (doc.type === 'application/pdf' && doc.base64Data) {
        // Add PDF as document content block with prompt caching
        contentBlocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: doc.base64Data.replace(/^data:application\/pdf;base64,/, '')
          },
          cache_control: { type: 'ephemeral' } // Enable prompt caching
        });
      } else if (doc.content) {
        // Add text content block for non-PDF documents
        contentBlocks.push({
          type: 'text',
          text: `Document ${index + 1}: ${doc.name}\n\n${doc.content}`,
          cache_control: { type: 'ephemeral' } // Enable prompt caching
        });
      }
    });
    
    // Add the extraction result as a content block
    contentBlocks.push({
      type: 'text',
      text: `Extracted Document Data:\n${JSON.stringify(extractedData, null, 2)}`,
      cache_control: { type: 'ephemeral' } // Enable prompt caching
    });
    
    // Add the analysis result as a content block
    contentBlocks.push({
      type: 'text',
      text: `Analysis Result:\n${JSON.stringify(analysisResult, null, 2)}`,
      cache_control: { type: 'ephemeral' } // Enable prompt caching
    });
    
    // Add the validation instructions as the final text block
    contentBlocks.push({
      type: 'text',
      text: validationPrompt,
      cache_control: { type: 'ephemeral' } // Enable prompt caching
    });
    
    // Configure API parameters for validation stage
    const apiRequest = {
      model: this.claudeApi.MODELS.VALIDATION.name,
      max_tokens: this.claudeApi.MODELS.VALIDATION.maxTokens,
      messages: [
        {
          role: 'user',
          content: contentBlocks
        }
      ]
      // Removed extended thinking for validation to avoid 400 Bad Request errors
    };
    
    // Call Claude API for validation
    console.log(`Calling Claude API (${this.claudeApi.MODELS.VALIDATION.name}) for validation...`);
    const validationResponse = await this.claudeApi.callApi(
      apiRequest.model,
      apiRequest.messages,
      apiRequest.max_tokens
    );
    console.log(`Received response from Claude API, processing validation results...`);
    
    // Process the validation result
    const validationText = validationResponse.content?.[0]?.text || '';
    
    // Extract thinking process and final results
    let thinkingProcess = '';
    let finalResults = '';
    
    // Check if the response has thinking blocks
    const thinkingBlocks = validationResponse.content?.filter(block => block.type === 'thinking');
    if (thinkingBlocks && thinkingBlocks.length > 0) {
      thinkingProcess = thinkingBlocks[0].thinking || '';
    }
    
    // Get the final text blocks
    const textBlocks = validationResponse.content?.filter(block => block.type === 'text');
    if (textBlocks && textBlocks.length > 0) {
      finalResults = textBlocks[0].text || '';
    }
    
    // If there are no explicit thinking blocks, try to extract thinking from the text
    if (!thinkingProcess && validationText) {
      const thinkingMatch = validationText.match(/THINKING PROCESS:[\s\S]*?(?=FINAL VALIDATION RESULTS:|$)/i);
      const resultsMatch = validationText.match(/FINAL VALIDATION RESULTS:[\s\S]*/i);
      
      if (thinkingMatch) {
        thinkingProcess = thinkingMatch[0].replace(/THINKING PROCESS:/i, '').trim();
      }
      
      if (resultsMatch) {
        finalResults = resultsMatch[0].replace(/FINAL VALIDATION RESULTS:/i, '').trim();
      } else {
        finalResults = validationText;
      }
    }
    
    // Process the final results to extract tables
    const tables = this.processClaudeResponse(finalResults);
    
    // Calculate token usage cost
    const tokenUsage: TokenUsage = {
      input: validationResponse.usage.input_tokens,
      output: validationResponse.usage.output_tokens,
      cost: this.calculateCost(
        validationResponse.usage.input_tokens,
        validationResponse.usage.output_tokens,
        this.claudeApi.MODELS.VALIDATION
      ),
      cacheSavings: this.calculateCacheSavings(validationResponse.usage)
    };
    
    // Extract confidence score from the validation text
    const confidenceMatch = finalResults.match(/confidence\s+score:?\s*(\d+)%/i) || 
                           finalResults.match(/confidence:?\s*(\d+)%/i) ||
                           finalResults.match(/score:?\s*(\d+)%/i);
    
    const confidenceScore = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 0;
    
    return {
      result: tables,
      tokenUsage,
      confidenceScore
    };
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
  
  private calculateCost(inputTokens: number, outputTokens: number, model: any): number {
    const inputCost = (inputTokens / 1000000) * model.costPerInputMToken;
    const outputCost = (outputTokens / 1000000) * model.costPerOutputMToken;
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
    return cacheReadTokens * 0.9;
  }
}

// Export a singleton instance
export const documentService = new DocumentService();
