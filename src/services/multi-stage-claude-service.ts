import { ComparisonResult, ComparisonTable, ParsedDocument } from '../lib/types';
import { prepareInstructions, prepareSystemInstructions } from './claude-service';

// Model configuration for different stages
type ModelConfig = {
  name: string;
  maxTokens: number;
  temperature: number;
  costPerInputMToken: number;
  costPerOutputMToken: number;
};

const MODELS = {
  EXTRACTION: {
    name: 'claude-3-5-haiku-20241022',
    maxTokens: 4000,
    temperature: 0.1,
    costPerInputMToken: 0.80,
    costPerOutputMToken: 4.00
  },
  ANALYSIS: {
    name: 'claude-3-5-sonnet-20241022',
    maxTokens: 4000,
    temperature: 0.2,
    costPerInputMToken: 3.00,
    costPerOutputMToken: 15.00
  },
  VALIDATION: {
    name: 'claude-3-7-sonnet-20250219',
    maxTokens: 16000,
    temperature: 0.1,
    costPerInputMToken: 3.00,
    costPerOutputMToken: 15.00,
    thinkingBudget: 8000
  }
};

// Result types for each stage
interface ExtractionResult {
  documentData: Record<string, any>[];
  documentTypes: string[];
  extractedFields: Record<string, string[]>;
  rawText: string;
  tokenUsage: { input: number; output: number; cost: number };
}

interface AnalysisResult {
  comparisonResult: ComparisonResult;
  tokenUsage: { input: number; output: number; cost: number };
}

interface ValidationResult {
  validatedResult: ComparisonResult;
  confidence: number;
  thinkingProcess?: string;
  tokenUsage: { input: number; output: number; cost: number };
}

interface MultiStageResult {
  result: ComparisonResult;
  stages: {
    extraction: ExtractionResult;
    analysis: AnalysisResult;
    validation?: ValidationResult;
  };
  totalTokenUsage: { input: number; output: number; cost: number };
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
      validationResult = await this.validateAnalysis(
        extractionResult,
        analysisResult.comparisonResult,
        comparisonType,
        options.showThinking || false,
        options.useExtendedOutput || false
      );
      console.log('✅ Stage 3 complete: Validation');
    }
    
    // Calculate total token usage
    const totalTokenUsage = {
      input: extractionResult.tokenUsage.input + analysisResult.tokenUsage.input + (validationResult?.tokenUsage.input || 0),
      output: extractionResult.tokenUsage.output + analysisResult.tokenUsage.output + (validationResult?.tokenUsage.output || 0),
      cost: extractionResult.tokenUsage.cost + analysisResult.tokenUsage.cost + (validationResult?.tokenUsage.cost || 0)
    };
    
    // Prepare final result
    const finalResult: MultiStageResult = {
      result: validationResult ? validationResult.validatedResult : analysisResult.comparisonResult,
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
    
    return finalResult;
  }
  
  /**
   * Stage 1: Extract data from documents
   */
  private async extractDocumentData(documents: ParsedDocument[]): Promise<ExtractionResult> {
    // Prepare document content for the prompt
    let documentTexts = '<documents>\n';
    const documentContents: any[] = [];
    
    // First, add text content for each document
    documents.forEach((doc, index) => {
      documentTexts += `  <document index="${index + 1}">\n`;
      documentTexts += `    <source>${doc.documentType || 'unknown'}_document_${index + 1}</source>\n`;
      documentTexts += `    <document_content>\n${doc.text || '[No text content available]'}\n    </document_content>\n`;
      documentTexts += `  </document>\n`;
      
      // For PDF files, we'll also add them as document content blocks
      if (doc.documentType === 'pdf' && doc.image) {
        documentContents.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: doc.base64Data || '[PDF data not available]'
          }
        });
      }
    });
    documentTexts += '</documents>\n\n';
    
    // Add text instruction after document content blocks
    documentContents.push({
      type: 'text',
      text: `
You are a document data extraction specialist. Your task is to extract structured data from the provided documents.

CRITICAL INSTRUCTION: ONLY extract information that is ACTUALLY PRESENT in the documents. NEVER generate placeholder data, fictional company names, or make assumptions about missing information.

For each document:
1. Identify the document type (Invoice, Bill of Lading, Packing List, Purchase Order, etc.)
2. Extract ALL key fields and their values exactly as they appear in the document
3. For fields not present in a document, explicitly note "No data available"

Return the extracted data in this JSON format:
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
  * Invoice/PO/BL numbers
  * Dates (issue date, shipping date, etc.)
  * Product descriptions
  * Quantities and units
  * Prices and totals
  * Package counts and weights
  * Special instructions or notes
- If you can't determine a document type, use "Unknown" and extract whatever fields are visible
- If a document appears to be empty or unreadable, note this in your response
`
    });
    
    // Prepare API call
    const apiParams: any = {
      model: MODELS.EXTRACTION.name,
      max_tokens: MODELS.EXTRACTION.maxTokens,
      temperature: MODELS.EXTRACTION.temperature,
      messages: [
        {
          role: 'user',
          content: documentContents.length > 0 ? documentContents : [
            {
              type: 'text',
              text: documentTexts + `
You are a document data extraction specialist. Your task is to extract structured data from the provided documents.

CRITICAL INSTRUCTION: ONLY extract information that is ACTUALLY PRESENT in the documents. NEVER generate placeholder data, fictional company names, or make assumptions about missing information.

For each document:
1. Identify the document type (Invoice, Bill of Lading, Packing List, Purchase Order, etc.)
2. Extract ALL key fields and their values exactly as they appear in the document
3. For fields not present in a document, explicitly note "No data available"

Return the extracted data in this JSON format:
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
  * Invoice/PO/BL numbers
  * Dates (issue date, shipping date, etc.)
  * Product descriptions
  * Quantities and units
  * Prices and totals
  * Package counts and weights
  * Special instructions or notes
- If you can't determine a document type, use "Unknown" and extract whatever fields are visible
- If a document appears to be empty or unreadable, note this in your response
`
            }
          ]
        }
      ]
    };
    
    // Call Claude API for extraction
    const extractionResponse = await this.callClaudeApi(apiParams);
    
    // Process the extraction result
    try {
      const contentText = extractionResponse.content?.[0]?.text || '';
      
      // Extract JSON from the response - using more flexible patterns to match various formats
      const jsonMatch = contentText.match(/```json\n([\s\S]*?)\n```/) || 
                        contentText.match(/```\n([\s\S]*?)\n```/) ||
                        contentText.match(/```javascript\n([\s\S]*?)\n```/) ||
                        contentText.match(/```js\n([\s\S]*?)\n```/) ||
                        contentText.match(/{[\s\S]*"documentData"[\s\S]*"documentTypes"[\s\S]*"extractedFields"[\s\S]*}/);
      
      let extractedData;
      
      if (!jsonMatch) {
        console.warn('Failed to extract JSON. Creating fallback structure. Raw response:', contentText);
        
        // Create a fallback structure based on the documents
        extractedData = {
          documentData: documents.map((doc, index) => {
            const fileName = doc.image?.name || `document_${index + 1}`;
            const docType = this.guessDocumentType(fileName);
            
            return {
              documentIndex: index + 1,
              documentType: docType,
              fileName: fileName,
              fields: {
                "Document Type": docType,
                "File Name": fileName,
                "Note": "Document content could not be extracted. Please ensure the PDF contains readable text."
              }
            };
          }),
          documentTypes: documents.map((doc, index) => {
            const fileName = doc.image?.name || `document_${index + 1}`;
            return this.guessDocumentType(fileName);
          }),
          extractedFields: {
            "Document Type": documents.map((doc, index) => {
              const fileName = doc.image?.name || `document_${index + 1}`;
              return this.guessDocumentType(fileName);
            }),
            "File Name": documents.map(doc => doc.image?.name || "Unknown")
          }
        };
      } else {
        let jsonText = jsonMatch[1] || jsonMatch[0];
        
        // Clean up the JSON text - remove any markdown artifacts or extra text
        jsonText = jsonText.trim();
        
        // If the JSON doesn't start with {, try to find the first { and extract from there
        if (!jsonText.startsWith('{')) {
          const startIndex = jsonText.indexOf('{');
          if (startIndex >= 0) {
            jsonText = jsonText.substring(startIndex);
          }
        }
        
        // If the JSON doesn't end with }, try to find the last } and extract up to there
        if (!jsonText.endsWith('}')) {
          const endIndex = jsonText.lastIndexOf('}');
          if (endIndex >= 0) {
            jsonText = jsonText.substring(0, endIndex + 1);
          }
        }
        
        try {
          extractedData = JSON.parse(jsonText);
          
          // Validate the extracted data has the required structure
          if (!extractedData.documentData || !Array.isArray(extractedData.documentData) || 
              !extractedData.documentTypes || !Array.isArray(extractedData.documentTypes) ||
              !extractedData.extractedFields || typeof extractedData.extractedFields !== 'object') {
            throw new Error('Extracted JSON does not have the required structure');
          }
        } catch (parseError) {
          console.error('JSON parse error:', parseError, 'for text:', jsonText);
          throw new Error(`Failed to parse JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
      }
      
      // Calculate token usage cost
      const tokenUsage = {
        input: extractionResponse.usage?.input_tokens || 0,
        output: extractionResponse.usage?.output_tokens || 0,
        cost: (
          ((extractionResponse.usage?.input_tokens || 0) / 1000000) * MODELS.EXTRACTION.costPerInputMToken +
          ((extractionResponse.usage?.output_tokens || 0) / 1000000) * MODELS.EXTRACTION.costPerOutputMToken
        )
      };
      
      return {
        ...extractedData,
        rawText: contentText,
        tokenUsage
      };
    } catch (error) {
      console.error('Error parsing extraction result:', error);
      throw new Error(`Failed to parse extraction result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Stage 2: Analyze extracted data
   */
  private async analyzeExtractedData(
    documentData: Record<string, any>[],
    documentTypes: string[],
    extractedFields: Record<string, string[]>,
    comparisonType: string
  ): Promise<AnalysisResult> {
    // Get specialized instructions for the comparison type
    const typeInstructions = prepareInstructions(comparisonType);
    
    // Create analysis prompt
    const analysisPrompt = `
You are a document analysis specialist. Your task is to analyze the extracted data from multiple documents and create a structured comparison.

I'll provide you with pre-extracted data from the documents. Your job is to:
1. Create a structured comparison table showing key fields across all documents
2. Identify discrepancies and inconsistencies between documents
3. Provide analysis in the required sections (verification, validation, review, etc.)

CRITICAL INSTRUCTION: ONLY use the data provided. Do NOT generate fictional data or make assumptions about missing information.

Here is the extracted data:
${JSON.stringify(documentData, null, 2)}

Document types: ${documentTypes.join(', ')}

Key fields extracted across documents:
${Object.entries(extractedFields).map(([field, values]) => `- ${field}: ${values.join(', ')}`).join('\n')}

${typeInstructions}

Format your response with these sections:
1. Comparison Tables: Create markdown tables comparing key fields across documents
2. Verification: Quote relevant data and analyze document authenticity
3. Validation: Quote relevant data and validate consistency
4. Review: Quote relevant data and review completeness
5. Analysis: Quote relevant data and provide deeper analysis
6. Summary: Quote relevant data and summarize key findings
7. Insights: Quote relevant data and offer insights
8. Recommendations: Quote relevant data and recommend actions
9. Risks: Quote relevant data and identify potential risks
10. Issues: Quote relevant data and list specific issues

For each section, use this format:
### Section Name
<quotes>
Direct quotes from the extracted data
</quotes>

<analysis>
Your analysis based only on the quoted data
</analysis>

IMPORTANT: 
- Only reference information that exists in the extracted data
- For missing information, use "No data available"
- Be specific about discrepancies between documents
- Format all sections consistently
`;

    // Call Claude API for analysis
    const analysisResponse = await this.callClaudeApi({
      model: MODELS.ANALYSIS.name,
      max_tokens: MODELS.ANALYSIS.maxTokens,
      temperature: MODELS.ANALYSIS.temperature,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: analysisPrompt
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
      
      // Calculate token usage cost
      const tokenUsage = {
        input: analysisResponse.usage?.input_tokens || 0,
        output: analysisResponse.usage?.output_tokens || 0,
        cost: (
          ((analysisResponse.usage?.input_tokens || 0) / 1000000) * MODELS.ANALYSIS.costPerInputMToken +
          ((analysisResponse.usage?.output_tokens || 0) / 1000000) * MODELS.ANALYSIS.costPerOutputMToken
        )
      };
      
      return {
        comparisonResult,
        tokenUsage
      };
    } catch (error) {
      console.error('Error processing analysis result:', error);
      throw new Error(`Failed to process analysis result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Stage 3: Validate analysis with extended thinking
   */
  private async validateAnalysis(
    extractionResult: ExtractionResult,
    analysisResult: ComparisonResult,
    comparisonType: string,
    showThinking: boolean = false,
    useExtendedOutput: boolean = false
  ): Promise<ValidationResult> {
    // Format the analysis result for validation
    const formattedAnalysis = this.formatComparisonResultForValidation(analysisResult);
    
    // Create validation prompt
    const validationPrompt = `
You are an expert document validator with deep experience in logistics and shipping documents. Your task is to validate the analysis of multiple documents and ensure it is accurate, thorough, and grounded in the actual document content.

Please think deeply and thoroughly about this task. Consider multiple approaches and show your complete reasoning. Be meticulous in your validation process.

I'll provide you with:
1. The original extracted data from the documents
2. An initial analysis of this data

Your job is to:
1. Verify that the analysis is ONLY based on information actually present in the documents
2. Identify and correct any fictional data, assumptions, or hallucinations
3. Ensure all comparisons are accurate and well-supported
4. Enhance the analysis with deeper insights where appropriate
5. Validate that all sections are thorough and accurate

CRITICAL INSTRUCTION: Your validation must ensure that ONLY information actually present in the documents is referenced. Remove any fictional data, company names, or assumptions not supported by the documents.

Here is the original extracted data:
${JSON.stringify(extractionResult.documentData, null, 2)}

Document types: ${extractionResult.documentTypes.join(', ')}

Here is the initial analysis that needs validation:
${formattedAnalysis}

As you validate this analysis, please:
1. Check each fact against the original document data
2. Verify all quoted content is accurate
3. Identify any discrepancies between documents that were missed
4. Ensure the analysis is comprehensive and covers all key logistics fields
5. Focus especially on critical shipping information like dates, quantities, prices, and party details
6. Before finalizing your response, verify your work by checking that you haven't introduced any information not present in the original data

Return the validated and improved analysis in the same format, maintaining all sections.

IMPORTANT: 
- Be thorough and meticulous in your validation
- Only reference information that exists in the extracted data
- For missing information, use "No data available"
- Be specific about discrepancies between documents
- Format all sections consistently
`;
    
    // Prepare API call parameters with error handling
    try {
      const apiParams: any = {
        model: MODELS.VALIDATION.name,
        max_tokens: MODELS.VALIDATION.maxTokens,
        temperature: 1.0, // Must be exactly 1.0 when using thinking
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: validationPrompt
              }
            ]
          }
        ]
      };
      
      // Add extended thinking if requested
      if (showThinking) {
        apiParams.thinking = {
          type: "enabled",
          budget_tokens: MODELS.VALIDATION.thinkingBudget
        };
        
        // Ensure max_tokens is greater than thinking budget
        if (apiParams.max_tokens <= MODELS.VALIDATION.thinkingBudget) {
          apiParams.max_tokens = MODELS.VALIDATION.thinkingBudget + 8000;
        }
      }
      
      // Add extended output if requested - without using unsupported betas parameter
      if (useExtendedOutput) {
        // Increase max tokens for extended output, but stay within model limits
        // Claude 3.7 Sonnet supports up to 64,000 tokens
        apiParams.max_tokens = Math.min(64000, Math.max(apiParams.max_tokens, MODELS.VALIDATION.thinkingBudget + 8000));
      }
      
      // Call Claude API for validation with retry mechanism
      let retryCount = 0;
      const maxRetries = 3;
      let validationResponse = null;
      
      while (retryCount < maxRetries) {
        try {
          validationResponse = await this.callClaudeApi(apiParams);
          break; // Success, exit retry loop
        } catch (error) {
          retryCount++;
          console.error(`Validation API call failed (attempt ${retryCount}/${maxRetries}):`, error);
          
          if (retryCount >= maxRetries) {
            throw error; // Re-throw if all retries failed
          }
          
          // Wait before retrying (exponential backoff)
          const waitTime = Math.min(2000 * Math.pow(2, retryCount - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      if (!validationResponse) {
        throw new Error('Failed to get validation response after retries');
      }
      
      // Process the validation result
      const contentText = validationResponse.content?.[0]?.text || '';
      let thinkingProcess = null;
      
      // Extract thinking process if available
      const thinkingBlock = validationResponse.content?.find(block => block.type === 'thinking');
      if (thinkingBlock && showThinking) {
        thinkingProcess = thinkingBlock.thinking;
      }
      
      // Parse the result into a structured format
      const validatedResult = this.processClaudeResponse(contentText);
      
      // Calculate token usage cost
      const tokenUsage = {
        input: validationResponse.usage?.input_tokens || 0,
        output: validationResponse.usage?.output_tokens || 0,
        cost: (
          ((validationResponse.usage?.input_tokens || 0) / 1000000) * MODELS.VALIDATION.costPerInputMToken +
          ((validationResponse.usage?.output_tokens || 0) / 1000000) * MODELS.VALIDATION.costPerOutputMToken
        )
      };
      
      // Calculate confidence score
      const confidence = this.calculateConfidenceScore(validatedResult, extractionResult);
      
      return {
        validatedResult,
        confidence,
        thinkingProcess,
        tokenUsage
      };
    } catch (error) {
      console.error('Error in validation stage:', error);
      
      // Provide a fallback result with error information
      return {
        validatedResult: {
          ...analysisResult,
          validation: `<quotes></quotes>\n\n<analysis>Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}</analysis>`,
          issues: `<quotes></quotes>\n\n<analysis>Validation process encountered an error. Using unvalidated analysis results.</analysis>`
        },
        confidence: 0.3, // Low confidence due to validation failure
        thinkingProcess: null,
        tokenUsage: {
          input: 0,
          output: 0,
          cost: 0
        }
      };
    }
  }
  
  /**
   * Call the Claude API via proxy
   */
  private async callClaudeApi(payload: any): Promise<any> {
    try {
      const response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API HTTP error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw new Error(`Failed to call Claude API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Process Claude response into a structured ComparisonResult
   */
  private processClaudeResponse(contentText: string): ComparisonResult {
    try {
      // Initialize the result object
      const result: ComparisonResult = {
        tables: [],
      };
      
      // Extract tables from the response
      // Look for markdown tables (starting with | and having header separator row)
      const markdownTableRegex = /\|[^\n]+\|\n\|[\s-:]+\|\n(\|[^\n]+\|\n)+/g;
      let mdTableMatch;
      while ((mdTableMatch = markdownTableRegex.exec(contentText)) !== null) {
        const tableContent = mdTableMatch[0].trim();
        const table = this.parseMarkdownTable(tableContent);
        if (table) {
          result.tables.push(table);
        }
      }
      
      // Extract sections using markdown header format (### Section Name)
      const markdownSectionRegex = /###\s+(.*?)\s*\n+(?:<quotes>([\s\S]*?)<\/quotes>\s*\n+)?(?:<analysis>([\s\S]*?)<\/analysis>|([^#<][\s\S]*?)(?=\n+###|\n*$))/g;
      
      let mdSectionMatch;
      while ((mdSectionMatch = markdownSectionRegex.exec(contentText)) !== null) {
        const sectionName = mdSectionMatch[1].toLowerCase().trim();
        // If quotes/analysis tags are used
        let quotes = mdSectionMatch[2]?.trim() || '';
        let analysis = mdSectionMatch[3]?.trim() || mdSectionMatch[4]?.trim() || '';
        
        // If no quotes tag but we can identify quotes by quotation marks
        if (!quotes && analysis) {
          const extractedQuotes = [];
          // Extract text in quotation marks
          const quoteRegex = /"([^"]+)"/g;
          let quoteMatch;
          while ((quoteMatch = quoteRegex.exec(analysis)) !== null) {
            extractedQuotes.push(quoteMatch[1]);
          }
          
          if (extractedQuotes.length > 0) {
            quotes = extractedQuotes.join('\n');
            // Remove the quotes from the analysis text
            analysis = analysis.replace(/"([^"]+)"/g, '').replace(/\n\s*\n+/g, '\n\n').trim();
          }
        }
        
        // Format the section with quotes and analysis
        result[sectionName] = `<quotes>${quotes}</quotes>\n\n<analysis>${analysis}</analysis>`;
      }
      
      // Check if we have any sections, if not try to extract from plain text
      const sectionNames = ['verification', 'validation', 'review', 'analysis', 'summary', 
                           'insights', 'recommendations', 'risks', 'issues'];
      
      let hasSections = false;
      for (const name of sectionNames) {
        if (result[name]) {
          hasSections = true;
          break;
        }
      }
      
      if (!hasSections) {
        // Try to find sections by looking for headers
        for (const name of sectionNames) {
          const headerRegex = new RegExp(`(?:^|\\n+)(?:##?#?\\s*${name}|${name.charAt(0).toUpperCase() + name.slice(1)})\\s*(?:\\n+|:)([\\s\\S]*?)(?=\\n+(?:##?#?|[A-Z][a-z]+:)|$)`, 'i');
          const match = headerRegex.exec(contentText);
          if (match) {
            const content = match[1].trim();
            result[name.toLowerCase()] = `<quotes></quotes>\n\n<analysis>${content}</analysis>`;
          }
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error processing Claude response:', error);
      
      // Return a minimal result to avoid breaking the UI
      return {
        tables: [],
        analysis: `Error processing Claude response: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Parse a markdown table string into a structured ComparisonTable object
   */
  private parseMarkdownTable(tableText: string): ComparisonTable | null {
    try {
      // Split the table into rows
      const rows = tableText.trim().split('\n');
      if (rows.length < 3) return null; // Need at least header, separator, and one data row
      
      // Extract headers
      const headerRow = rows[0];
      const headers = headerRow
        .split('|')
        .filter(cell => cell.trim() !== '')
        .map(cell => cell.trim());
      
      // Skip the separator row (row[1])
      
      // Extract data rows
      const dataRows = rows.slice(2).map(row => {
        return row
          .split('|')
          .filter(cell => cell.trim() !== '')
          .map(cell => cell.trim());
      });
      
      // Generate a title based on the first header or use a default title
      const title = headers[0] ? `Comparison of ${headers[0]}` : 'Document Comparison';
      
      return {
        title,
        headers,
        rows: dataRows
      };
    } catch (error) {
      console.error('Error parsing markdown table:', error);
      return null;
    }
  }
  
  /**
   * Format ComparisonResult for validation
   */
  private formatComparisonResultForValidation(result: ComparisonResult): string {
    let formatted = '';
    
    // Format tables
    if (result.tables && result.tables.length > 0) {
      formatted += '## Comparison Tables\n\n';
      
      result.tables.forEach((table, index) => {
        // Create header row
        let tableText = '| ' + table.headers.join(' | ') + ' |\n';
        
        // Create separator row
        tableText += '| ' + table.headers.map(() => '---').join(' | ') + ' |\n';
        
        // Create data rows
        table.rows.forEach(row => {
          tableText += '| ' + row.join(' | ') + ' |\n';
        });
        
        formatted += tableText + '\n\n';
      });
    }
    
    // Format sections
    const sectionNames = ['verification', 'validation', 'review', 'analysis', 'summary', 
                         'insights', 'recommendations', 'risks', 'issues'];
    
    sectionNames.forEach(name => {
      if (result[name]) {
        formatted += `### ${name.charAt(0).toUpperCase() + name.slice(1)}\n`;
        formatted += result[name] + '\n\n';
      }
    });
    
    return formatted;
  }
  
  /**
   * Calculate confidence score based on validation result
   */
  private calculateConfidenceScore(
    validatedResult: ComparisonResult, 
    extractionResult: ExtractionResult
  ): number {
    // Simple heuristic for confidence score
    let score = 0.5; // Start with neutral score
    
    // Check if we have tables
    if (validatedResult.tables && validatedResult.tables.length > 0) {
      score += 0.1;
    }
    
    // Check if we have analysis sections
    const sections = ['verification', 'validation', 'review', 'analysis', 'summary', 
                     'insights', 'recommendations', 'risks', 'issues'];
    
    for (const section of sections) {
      if (validatedResult[section]) {
        score += 0.05;
      }
    }
    
    // Check if we found discrepancies
    if (validatedResult.analysis && validatedResult.analysis.includes('discrep')) {
      score += 0.1;
    }
    
    // Cap the score at 0.95 - never be 100% confident
    return Math.min(score, 0.95);
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
