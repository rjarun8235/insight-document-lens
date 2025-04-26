import { ComparisonResult, ComparisonTable, ParsedDocument } from '../lib/types';
import { prepareInstructions, prepareSystemInstructions } from './claude-service';
import axios from 'axios';

// Claude API types
interface ContentBlock {
  type: string;
  text?: string;
  source?: {
    type: string;
    media_type: string;
    data: string;
  };
  cache_control?: {
    type: string;
  };
}

interface CreateMessageParams {
  model: string;
  max_tokens: number;
  messages: Array<{
    role: string;
    content: string | ContentBlock[];
  }>;
  thinking?: {
    type: string;
    budget_tokens: number;
  };
}

// Model configuration for different stages
type ModelConfig = {
  name: string;
  maxTokens: number;
  temperature?: number;
  thinkingBudget?: number;
  costPerInputMToken: number;
  costPerOutputMToken: number;
};

const MODELS = {
  EXTRACTION: {
    name: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    costPerInputMToken: 3.0,
    costPerOutputMToken: 15.0
  },
  ANALYSIS: {
    name: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    costPerInputMToken: 3.0,
    costPerOutputMToken: 15.0
  },
  VALIDATION: {
    name: 'claude-3-7-sonnet-20250219',
    maxTokens: 16000,
    thinkingBudget: 32000,
    costPerInputMToken: 3.0,
    costPerOutputMToken: 15.0
  }
};

// Result types for each stage
interface ExtractionResult {
  documentData: any[];
  documentTypes: string[];
  extractedFields: Record<string, any[]>;
  rawText: string;
  tokenUsage: { input: number; output: number; cost: number; cacheSavings?: number };
}

interface AnalysisResult {
  comparisonResult: ComparisonResult;
  rawText: string;
  tokenUsage: { input: number; output: number; cost: number; cacheSavings?: number };
}

interface ValidationResult {
  isValid: boolean;
  confidenceScore: number;
  thinkingProcess: string;
  finalResults: string;
  tables: ComparisonResult;
  rawText: string;
  tokenUsage: { input: number; output: number; cost: number; cacheSavings?: number };
}

interface MultiStageResult {
  result: ComparisonResult;
  stages: {
    extraction: ExtractionResult;
    analysis: AnalysisResult;
    validation?: ValidationResult;
  };
  totalTokenUsage: { input: number; output: number; cost: number; cacheSavings?: number };
}

/**
 * Multi-stage TSV Global service that implements a three-stage pipeline:
 * 1. Extraction: Extract raw data from documents
 * 2. Analysis: Structure data and perform initial analysis
 * 3. Validation: Validate results with extended thinking
 */
export default class TSVDocumentIntelligenceService {
  private proxyUrl = 'https://cbrgpzdxttzlvvryysaf.supabase.co/functions/v1/claude-api-proxy';

  /**
   * Process documents through the multi-stage pipeline
   */
  async processDocuments(
    documents: ParsedDocument[],
    comparisonType: string,
    options: {
      skipValidation?: boolean;
      showThinking?: boolean;
      useExtendedOutput?: boolean;
    } = {}
  ): Promise<MultiStageResult> {
    console.log('🚀 Starting multi-stage document processing pipeline');
    console.log(`📄 Processing ${documents.length} documents with comparison type: ${comparisonType}`);
    
    const startTime = performance.now();
    
    // Stage 1: Extract data from documents
    console.log('🔍 Stage 1: Extracting data from documents');
    const extractionResult = await this.extractDocumentData(documents);
    console.log('✅ Stage 1 complete: Data extraction');
    
    // Stage 2: Analyze extracted data
    console.log('🔍 Stage 2: Analyzing extracted data');
    const analysisResult = await this.analyzeExtractedData(
      extractionResult.documentData,
      extractionResult.documentTypes,
      extractionResult.extractedFields,
      comparisonType
    );
    console.log('✅ Stage 2 complete: Data analysis');
    
    // Stage 3: Validate analysis (optional)
    let validationResult: ValidationResult | undefined;
    if (!options.skipValidation) {
      console.log('🔍 Stage 3: Validating analysis with extended thinking');
      validationResult = await this.validateAnalysisWithExtendedThinking(
        documents,
        extractionResult,
        analysisResult
      );
      console.log('✅ Stage 3 complete: Validation');
    }
    
    // Calculate total token usage
    const totalTokenUsage = {
      input: extractionResult.tokenUsage.input + analysisResult.tokenUsage.input + (validationResult?.tokenUsage.input || 0),
      output: extractionResult.tokenUsage.output + analysisResult.tokenUsage.output + (validationResult?.tokenUsage.output || 0),
      cost: extractionResult.tokenUsage.cost + analysisResult.tokenUsage.cost + (validationResult?.tokenUsage.cost || 0),
      cacheSavings: extractionResult.tokenUsage.cacheSavings + analysisResult.tokenUsage.cacheSavings + (validationResult?.tokenUsage.cacheSavings || 0)
    };
    
    // Prepare final result
    const finalResult: MultiStageResult = {
      result: validationResult ? validationResult.tables : analysisResult.comparisonResult,
      stages: {
        extraction: extractionResult,
        analysis: analysisResult,
        validation: validationResult
      },
      totalTokenUsage
    };
    
    const endTime = performance.now();
    console.log(`🏁 Multi-stage processing complete in ${((endTime - startTime) / 1000).toFixed(2)}s`);
    console.log(`💰 Total cost: $${totalTokenUsage.cost.toFixed(6)}`);
    if (totalTokenUsage.cacheSavings) {
      console.log(`💸 Cache savings: $${totalTokenUsage.cacheSavings.toFixed(6)}`);
    }
    
    return finalResult;
  }
  
  /**
   * Stage 1: Extract data from documents
   */
  private async extractDocumentData(documents: ParsedDocument[]): Promise<ExtractionResult> {
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
          cache_control: { type: 'ephemeral' } // Enable prompt caching for PDF documents
        });
      } else if (doc.content) {
        // Add text content block for non-PDF documents
        contentBlocks.push({
          type: 'text',
          text: `Document ${index + 1}: ${doc.name}\n\n${doc.content}`,
          cache_control: { type: 'ephemeral' } // Enable prompt caching for text documents
        });
      }
    });
    
    // Add the extraction instructions as the final text block
    contentBlocks.push({
      type: 'text',
      text: `
You are a document data extraction specialist. Your task is to extract structured data from the provided documents.

CRITICAL INSTRUCTION: ONLY extract information that is ACTUALLY PRESENT in the documents. NEVER generate placeholder data, fictional company names, or make assumptions about missing information.

For each document:
1. Identify the document type (Invoice, Bill of Lading, Packing List, Purchase Order, etc.)
2. Extract ALL key fields and their values exactly as they appear in the document
3. For fields not present in a document, explicitly note "No data available"

IMPORTANT: You MUST return your response in valid JSON format. Wrap the JSON in triple backticks with the json tag like this:
\`\`\`json
{
  "documentData": [...],
  "documentTypes": [...],
  "extractedFields": {...}
}
\`\`\`

The JSON must follow this exact structure:
{
  "documentData": [
    {
      "documentIndex": 1,
      "documentType": "Invoice",
      "fields": {
        "Invoice Number": "12345",
        "Date": "2023-01-15",
        "Shipper": "Actual Company Name from Document",
        "Consignee": "Actual Company Name from Document",
        "Total Amount": "1,234.56",
        "Currency": "USD",
        // Include ALL fields found in the document
      }
    },
    // Repeat for each document
  ],
  "documentTypes": ["Invoice", "Purchase Order", "Bill of Lading"],
  "extractedFields": {
    "Document Number": ["12345", "PO-6789", "BL-9876"],
    "Date": ["2023-01-15", "2023-01-10", "2023-01-20"],
    // Include all fields found across documents
  }
}

IMPORTANT: 
- Extract EVERY field and value present in the documents
- Be precise and accurate with all extracted data
- For logistics documents, pay special attention to:
  * Consignee and Shipper information
  * Document numbers and dates
  * Item descriptions and quantities
  * Weights and measurements
  * Delivery terms and payment terms
  * Container/shipment details
  * Origin and destination information
  * Any special instructions or remarks

CRITICAL: If you cannot extract data from a document, explain why in your JSON response under a field called "Error" for that document.

DO NOT include any explanations, notes, or text outside of the JSON structure. Your entire response must be valid JSON wrapped in the code block.
`,
      cache_control: { type: 'ephemeral' } // Enable prompt caching for extraction instructions
    });
    
    // Prepare API call parameters
    try {
      // Log content blocks for debugging
      console.log(`Sending ${contentBlocks.length} content blocks to Claude API`);
      
      // Prepare API call parameters
      const apiParams: CreateMessageParams = {
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
      const extractionResponse = await this.callClaudeApi(apiParams);
      console.log(`Received response from Claude API, processing results...`);
      
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
          
          // Calculate token usage cost with prompt caching
          const tokenUsage = this.calculateTokenUsageCost(extractionResponse.usage, MODELS.EXTRACTION);
          
          return {
            documentData: extractedData.documentData || [],
            documentTypes: extractedData.documentTypes || [],
            extractedFields: extractedData.extractedFields || {},
            rawText: extractionText,
            tokenUsage
          };
        } else {
          // If no JSON pattern was found, try to create a structured response from the text
          console.log('No JSON pattern found in Claude response. Attempting to create structured data from text.');
          
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
          
          // Calculate token usage cost with prompt caching
          const tokenUsage = this.calculateTokenUsageCost(extractionResponse.usage, MODELS.EXTRACTION);
          
          return {
            documentData,
            documentTypes,
            extractedFields: { 'File Name': documents.map(doc => doc.name) },
            rawText: extractionText,
            tokenUsage
          };
        }
      } catch (jsonError) {
        console.error('Error parsing extraction JSON:', jsonError);
        
        // Fallback to document type guessing if JSON parsing fails
        const documentData = documents.map((doc, index) => ({
          documentIndex: index + 1,
          documentType: this.guessDocumentType(doc.name),
          fields: {
            'File Name': doc.name,
            'Error': 'Failed to extract structured data from document'
          }
        }));
        
        const documentTypes = documentData.map(doc => doc.documentType);
        
        // Calculate token usage cost with prompt caching
        const tokenUsage = this.calculateTokenUsageCost(extractionResponse.usage, MODELS.EXTRACTION);
        
        return {
          documentData,
          documentTypes,
          extractedFields: { 'File Name': documents.map(doc => doc.name) },
          rawText: extractionText,
          tokenUsage
        };
      }
    } catch (error) {
      console.error('Error in extraction stage:', error);
      
      // Fallback to document type guessing if API call fails
      const documentData = documents.map((doc, index) => ({
        documentIndex: index + 1,
        documentType: this.guessDocumentType(doc.name),
        fields: {
          'File Name': doc.name,
          'Error': `API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }));
      
      const documentTypes = documentData.map(doc => doc.documentType);
      
      // Calculate token usage cost with prompt caching
      const tokenUsage = this.calculateTokenUsageCost({}, MODELS.EXTRACTION);
      
      return {
        documentData,
        documentTypes,
        extractedFields: { 'File Name': documents.map(doc => doc.name) },
        rawText: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        tokenUsage
      };
    }
  }
  
  /**
   * Stage 2: Analyze extracted data
   */
  private async analyzeExtractedData(
    documentData: any[],
    documentTypes: string[],
    extractedFields: Record<string, any[]>,
    comparisonType: string
  ): Promise<AnalysisResult> {
    // Get specialized instructions for the comparison type
    const typeInstructions = prepareInstructions(comparisonType);
    
    // Create analysis prompt
    const analysisPrompt = `
You are a document analysis specialist. Your task is to analyze the extracted data from multiple logistics documents and create a structured comparison.

I'll provide you with pre-extracted data from the documents. Your job is to:
1. Create detailed comparison tables showing key fields across all documents
2. Identify discrepancies and inconsistencies between documents
3. Provide thorough analysis in the required sections

CRITICAL INSTRUCTION: ONLY use the data provided. Do NOT generate fictional data or make assumptions about missing information.

Here is the extracted data:
${JSON.stringify(documentData, null, 2)}

Document types: ${documentTypes.join(', ')}

Key fields extracted across documents:
${Object.entries(extractedFields).map(([field, values]) => `- ${field}: ${values.join(', ')}`).join('\n')}

${typeInstructions}

Format your response with these sections:

## Comparison Tables
Create multiple detailed markdown tables comparing key fields across documents. Each table should focus on a specific category:

1. First create a "Document Overview" table with basic document information
2. Then create a "Party Information" table comparing shipper/consignee details
3. Then create a "Shipment Details" table comparing weights, quantities, etc.
4. Then create a "Payment and Delivery" table comparing terms and conditions

Use this markdown format for tables:
| Field | Document 1 | Document 2 | Document 3 |
|-------|------------|------------|------------|
| Field Name | Value | Value | Value |

## Analysis
Provide a thorough analysis of the documents, highlighting:
- Key similarities and differences
- Important discrepancies that require attention
- Relationships between the documents
- Completeness of information across documents

## Summary
Summarize the key findings from your analysis, focusing on:
- The overall consistency between documents
- Critical information present or missing
- Important observations for logistics processing

## Insights
Offer valuable insights based on the document comparison, such as:
- Patterns or issues identified
- Potential implications for logistics operations
- Suggestions for improving document consistency

## Issues
List specific issues or discrepancies found between the documents that require attention.

IMPORTANT: Make your analysis detailed, accurate, and focused on logistics document comparison. Structure your response clearly with proper markdown formatting.
`;

    // Call Claude API for analysis
    const analysisResponse = await this.callClaudeApi({
      model: MODELS.ANALYSIS.name,
      max_tokens: MODELS.ANALYSIS.maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: analysisPrompt,
              cache_control: { type: 'ephemeral' } // Enable prompt caching for analysis prompt
            }
          ]
        }
      ]
    });
    
    // Process the analysis result
    try {
      const contentText = analysisResponse.content?.[0]?.text || '';
      
      // Parse the result into a structured format
      const comparisonResult = this.processClaudeResponse(contentText);
      
      // Calculate token usage cost with prompt caching
      const tokenUsage = this.calculateTokenUsageCost(analysisResponse.usage, MODELS.ANALYSIS);
      
      return {
        comparisonResult,
        rawText: contentText,
        tokenUsage
      };
    } catch (error) {
      console.error('Error processing analysis result:', error);
      throw new Error(`Failed to process analysis result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Stage 3: Validate the analysis with extended thinking
   */
  private async validateAnalysisWithExtendedThinking(
    documents: ParsedDocument[],
    extractionResult: ExtractionResult,
    analysisResult: AnalysisResult
  ): Promise<ValidationResult> {
    console.log('🔍 Stage 3: Validating analysis with extended thinking');
    
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
          cache_control: { type: 'ephemeral' } // Enable prompt caching for PDF documents
        });
      } else if (doc.content) {
        // Add text content block for non-PDF documents
        contentBlocks.push({
          type: 'text',
          text: `Document ${index + 1}: ${doc.name}\n\n${doc.content}`,
          cache_control: { type: 'ephemeral' } // Enable prompt caching for text documents
        });
      }
    });
    
    // Add the extraction result as a content block
    contentBlocks.push({
      type: 'text',
      text: `Extracted Document Data:\n${JSON.stringify(extractionResult.documentData, null, 2)}`,
      cache_control: { type: 'ephemeral' } // Enable prompt caching for extraction result
    });
    
    // Add the analysis result as a content block
    contentBlocks.push({
      type: 'text',
      text: `Analysis Result:\n${JSON.stringify(analysisResult.comparisonResult, null, 2)}`,
      cache_control: { type: 'ephemeral' } // Enable prompt caching for analysis result
    });
    
    // Add the validation instructions as the final text block
    contentBlocks.push({
      type: 'text',
      text: `
You are a document validation specialist for TSV Global, a logistics company. Your task is to validate the extracted data and analysis for the provided logistics documents.

TASK:
1. Carefully review the original documents
2. Validate the extracted data for accuracy and completeness
3. Validate the analysis for correctness and insights
4. Identify any discrepancies, errors, or missing information
5. Provide a confidence score for the overall validation (0-100%)

IMPORTANT: Structure your response as follows:

1. THINKING PROCESS:
   - Document your step-by-step validation process
   - Note any discrepancies between the original documents and the extracted data
   - Identify any errors or omissions in the analysis
   - Explain your reasoning for each validation point

2. FINAL VALIDATION RESULTS:
   - Provide a clear, concise summary of your validation
   - Format your findings in a well-structured markdown table
   - Include a confidence score (0-100%)
   - List any corrections needed

Focus on the following key logistics fields:
- Consignee and Shipper information
- Document numbers and dates
- Item descriptions and quantities
- Weights and measurements
- Delivery terms and payment terms
- Container/shipment details
- Origin and destination information

Your validation is critical for ensuring accurate logistics processing and compliance.
`,
      cache_control: { type: 'ephemeral' } // Enable prompt caching for validation instructions
    });
    
    // Configure API parameters for validation stage
    const apiParams: CreateMessageParams = {
      model: MODELS.VALIDATION.name,
      max_tokens: MODELS.VALIDATION.maxTokens,
      messages: [
        {
          role: 'user',
          content: contentBlocks
        }
      ],
      // Enable extended thinking for the validation stage
      thinking: {
        type: 'enabled',
        budget_tokens: 32000
      }
    };
    
    // Call Claude API for validation
    console.log(`Calling Claude API (${MODELS.VALIDATION.name}) for validation with extended thinking...`);
    const validationResponse = await this.callClaudeApi(apiParams);
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
    
    // Calculate token usage cost with prompt caching
    const tokenUsage = this.calculateTokenUsageCost(validationResponse.usage, MODELS.VALIDATION);
    
    // Extract confidence score from the validation text
    const confidenceMatch = finalResults.match(/confidence\s+score:?\s*(\d+)%/i) || 
                           finalResults.match(/confidence:?\s*(\d+)%/i) ||
                           finalResults.match(/score:?\s*(\d+)%/i);
    
    const confidenceScore = confidenceMatch ? parseInt(confidenceMatch[1], 10) : 0;
    
    return {
      isValid: confidenceScore >= 70,
      confidenceScore,
      thinkingProcess,
      finalResults,
      tables,
      rawText: validationText,
      tokenUsage
    };
  }
  
  /**
   * Call the Claude API via proxy
   */
  private async callClaudeApi(payload: CreateMessageParams): Promise<any> {
    try {
      const response = await axios.post(this.proxyUrl, payload);
      
      if (!response.data.success) {
        const errorText = response.data.error || 'Unknown error';
        throw new Error(`Claude API error: ${errorText}`);
      }
      
      // Log cache usage metrics if available
      if (response.data.result.usage) {
        const usage = response.data.result.usage;
        if (usage.cache_creation_input_tokens) {
          console.log(`📊 Cache metrics - Cache creation: ${usage.cache_creation_input_tokens} tokens`);
        }
        if (usage.cache_read_input_tokens) {
          console.log(`📊 Cache metrics - Cache read: ${usage.cache_read_input_tokens} tokens (90% cost savings)`);
        }
        console.log(`📊 Regular input tokens: ${usage.input_tokens}, Output tokens: ${usage.output_tokens}`);
      }
      
      return response.data.result;
    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw new Error(`Failed to call Claude API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Calculate token usage cost with prompt caching
   */
  private calculateTokenUsageCost(usage: any, model: ModelConfig): { input: number; output: number; cost: number; cacheSavings?: number } {
    // Extract token usage metrics
    const inputTokens = usage?.input_tokens || 0;
    const outputTokens = usage?.output_tokens || 0;
    const cacheCreationTokens = usage?.cache_creation_input_tokens || 0;
    const cacheReadTokens = usage?.cache_read_input_tokens || 0;
    
    // Calculate costs with prompt caching
    const inputCost = (inputTokens / 1000000) * model.costPerInputMToken;
    const outputCost = (outputTokens / 1000000) * model.costPerOutputMToken;
    
    // Cache write costs are 25% more expensive than base input tokens
    const cacheWriteCost = (cacheCreationTokens / 1000000) * (model.costPerInputMToken * 1.25);
    
    // Cache read costs are 90% cheaper than base input tokens
    const cacheReadCost = (cacheReadTokens / 1000000) * (model.costPerInputMToken * 0.1);
    
    // Calculate cost savings from cache reads
    const potentialCost = (cacheReadTokens / 1000000) * model.costPerInputMToken;
    const actualCost = cacheReadCost;
    const cacheSavings = potentialCost - actualCost;
    
    // Total cost
    const totalCost = inputCost + outputCost + cacheWriteCost + cacheReadCost;
    
    return {
      input: inputTokens + cacheCreationTokens + cacheReadTokens,
      output: outputTokens,
      cost: totalCost,
      cacheSavings: cacheSavings
    };
  }
  
  /**
   * Process Claude's response into a structured format
   */
  private processClaudeResponse(text: string): ComparisonResult {
    // Initialize result structure
    const result: ComparisonResult = {
      tables: [],
    };
    
    // Extract tables from markdown - look for markdown table patterns
    const markdownTableRegex = /\|[\s\S]+?\|[\s\S]+?\|[\s-:]+\|[\s\S]+?\|/g;
    const tableMatches = text.match(markdownTableRegex);
    
    if (tableMatches) {
      tableMatches.forEach(tableMatch => {
        // Find the table's title (heading before the table)
        const tableStartIndex = text.indexOf(tableMatch);
        let titleText = 'Comparison Table';
        
        // Look for a heading before the table
        const headingRegex = /##\s+([^\n]+)/g;
        let headingMatch;
        let closestHeadingIndex = -1;
        
        while ((headingMatch = headingRegex.exec(text)) !== null) {
          const headingIndex = headingMatch.index;
          if (headingIndex < tableStartIndex && headingIndex > closestHeadingIndex) {
            closestHeadingIndex = headingIndex;
            titleText = headingMatch[1].trim();
          }
        }
        
        // Parse the table
        const parsedTable = this.parseMarkdownTable(tableMatch);
        parsedTable.title = titleText;
        
        // Add the table to the result
        result.tables.push(parsedTable);
      });
    }
    
    // Extract analysis sections using markdown headings
    const extractHeadingContent = (heading: string): string | undefined => {
      const headingRegex = new RegExp(`##\\s+${heading}\\s*\n([\\s\\S]*?)(?=\n##\\s+|$)`, 'i');
      const match = text.match(headingRegex);
      return match ? match[1].trim() : undefined;
    };
    
    // Extract various sections
    result.analysis = extractHeadingContent('Analysis');
    result.summary = extractHeadingContent('Summary');
    result.insights = extractHeadingContent('Insights');
    result.issues = extractHeadingContent('Issues');
    result.recommendations = extractHeadingContent('Recommendations');
    result.risks = extractHeadingContent('Risks');
    result.verification = extractHeadingContent('Verification');
    result.validation = extractHeadingContent('Validation');
    result.review = extractHeadingContent('Review');
    
    // If we have Claude's thinking process, add it as a special section
    if (text.includes("Let me analyze what I'm being asked to do here") || 
        text.includes("I'm given the task of validating")) {
      result.analysis = result.analysis || text.trim();
    }
    
    // If no sections were found but we have text, use it as the analysis
    if (!result.analysis && !result.summary && !result.insights && text.trim()) {
      result.analysis = text.trim();
    }
    
    return result;
  }
  
  /**
   * Parse a markdown table into a structured format
   */
  private parseMarkdownTable(tableText: string): ComparisonTable {
    try {
      // Split the table into lines
      const lines = tableText.trim().split('\n');
      
      // Need at least 3 lines for a valid table (header, separator, and at least one data row)
      if (lines.length < 3) {
        return {
          title: 'Empty Table',
          headers: ['No Data'],
          rows: [['No data available']]
        };
      }
      
      // Extract headers (first line)
      const headerLine = lines[0].trim();
      const headers = headerLine
        .split('|')
        .map(header => header.trim())
        .filter(header => header !== '');
      
      // Skip the separator line (second line)
      
      // Extract rows (remaining lines)
      const rows = lines.slice(2).map(line => {
        const rowCells = line
          .split('|')
          .map(cell => cell.trim())
          .filter(cell => cell !== '');
        
        // Ensure consistent number of cells in each row
        while (rowCells.length < headers.length) {
          rowCells.push('');
        }
        
        return rowCells;
      }).filter(row => row.length > 0); // Skip empty rows
      
      // Create a title based on the first header if no title is provided
      const title = headers.length > 0 ? headers[0] : 'Comparison Table';
      
      return {
        title,
        headers,
        rows
      };
    } catch (error) {
      console.error('Error parsing markdown table:', error);
      
      // Return a minimal valid table to avoid breaking the UI
      return {
        title: 'Error Parsing Table',
        headers: ['Error'],
        rows: [['Error parsing table data']]
      };
    }
  }
  
  /**
   * Guess the document type based on the file name
   */
  private guessDocumentType(fileName: string): string {
    fileName = fileName.toLowerCase();
    
    if (fileName.includes('invoice') || fileName.includes('inv-') || fileName.includes('inv_')) {
      return 'Invoice';
    } else if (fileName.includes('po') || fileName.includes('purchase') || fileName.includes('order')) {
      return 'Purchase Order';
    } else if (fileName.includes('bl') || fileName.includes('lading') || fileName.includes('bill of')) {
      return 'Bill of Lading';
    } else if (fileName.includes('packing') || fileName.includes('pl-') || fileName.includes('pl_')) {
      return 'Packing List';
    } else if (fileName.includes('manifest')) {
      return 'Manifest';
    } else if (fileName.includes('delivery') || fileName.includes('do-') || fileName.includes('do_')) {
      return 'Delivery Order';
    } else {
      return 'Unknown Document';
    }
  }
}
