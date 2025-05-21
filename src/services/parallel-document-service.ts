/**
 * Parallel Document Service
 * A document processing service that uses a two-phase approach:
 * 1. Parallel extraction of fields from individual documents
 * 2. Consolidated validation and comparison of all documents
 * 
 * Features:
 * - Parallel processing of documents for faster extraction
 * - Comprehensive field extraction regardless of document type
 * - Separate validation against specific schema
 * - Rich comparison and insights generation
 */

import axios from 'axios';
import { ParsedDocument, ProcessingResult, TokenUsage } from '../types/app-types';
import { enhancedExtractionPrompt } from '../templates/enhanced-extraction-prompt';

export interface ExtractedDocumentData {
  documentId: string;
  documentName: string;
  extractedFields: Record<string, any>;
  confidence: number;
  tokenUsage: TokenUsage;
}

export class ParallelDocumentService {
  private apiBaseUrl = 'https://cbrgpzdxttzlvvryysaf.supabase.co/functions/v1/claude-api-proxy';
  private extractionApiUrl = `${this.apiBaseUrl}/extraction`;
  private validationApiUrl = `${this.apiBaseUrl}/validation`;
  private model = 'claude-3-5-sonnet-20241022';
  private maxTokens = 4096;
  
  /**
   * Process all documents in two phases:
   * 1. Extract fields from each document in parallel
   * 2. Validate and compare the extracted data
   */
  public async processDocuments(documents: ParsedDocument[]): Promise<ProcessingResult> {
    console.log(`🚀 Processing ${documents.length} documents with parallel approach`);
    
    try {
      // Phase 1: Extract fields from each document in parallel
      console.log('Phase 1: Parallel extraction starting');
      const extractionPromises = documents.map(doc => this.extractDocumentFields(doc));
      const extractedDataArray = await Promise.all(extractionPromises);
      console.log(`Phase 1: Completed extraction for ${extractedDataArray.length} documents`);
      
      // Phase 2: Validate and compare the extracted data
      console.log('Phase 2: Validation and comparison starting');
      const result = await this.validateAndCompare(extractedDataArray, documents);
      console.log('Phase 2: Completed validation and comparison');
      
      return result;
    } catch (error) {
      console.error('Error in parallel document processing:', error);
      throw error;
    }
  }

  /**
   * Extract structured data from text when JSON parsing fails
   * This is a fallback method to handle non-JSON responses
   */
  private extractStructuredDataFromText(content: string): any {
    console.log('Attempting to extract structured data from text');
    
    // Initialize default structure
    const result = {
      extractedFields: {},
      documentType: 'Unknown',
      confidence: 70
    };
    
    // Try to identify document type from content
    const docTypeMatch = content.match(/document type[:\s]+(\w+)/i) || 
                       content.match(/type[:\s]+(invoice|packing list|air waybill|bill of lading)/i);
    if (docTypeMatch && docTypeMatch[1]) {
      result.documentType = docTypeMatch[1].trim();
    }
    
    // Look for key-value pairs in format like 'Field: Value' or 'Field - Value'
    const kvRegex = /([\w\s-]+)[:\-]\s*([\w\s,.\/\-()#@&+]+)/g;
    let match;
    
    while ((match = kvRegex.exec(content)) !== null) {
      const key = match[1].trim();
      const value = match[2].trim();
      
      // Skip if key or value is too short or looks like a header
      if (key.length < 2 || value.length < 1 || key.toLowerCase().includes('field')) {
        continue;
      }
      
      // Add to extracted fields
      result.extractedFields[key] = value;
    }
    
    // Look for table-like structures with field value pairs
    const tableRowRegex = /\|\s*([\w\s-]+)\s*\|\s*([\w\s,.\/\-()#@&+]+)\s*\|/g;
    while ((match = tableRowRegex.exec(content)) !== null) {
      const key = match[1].trim();
      const value = match[2].trim();
      
      if (key.length < 2 || value.length < 1 || key.toLowerCase().includes('field')) {
        continue;
      }
      
      result.extractedFields[key] = value;
    }
    
    // If we couldn't extract any fields, add a note about the failure
    if (Object.keys(result.extractedFields).length === 0) {
      result.extractedFields['Note'] = 'Failed to extract structured data from response';
      result.confidence = 10;  // Very low confidence
    } else {
      // Adjust confidence based on number of fields extracted
      const fieldCount = Object.keys(result.extractedFields).length;
      if (fieldCount > 10) {
        result.confidence = 75;  // Good number of fields extracted
      } else if (fieldCount > 5) {
        result.confidence = 60;  // Moderate number of fields
      } else {
        result.confidence = 40;  // Few fields extracted
      }
    }
    
    console.log(`Extracted ${Object.keys(result.extractedFields).length} fields with confidence ${result.confidence}%`);
    return result;
  }

  /**
   * Process the Claude API response and extract JSON
   * Handles various formats and edge cases in the response
   */
  private processClaudeResponse(content: string): any {
    // First, try direct parsing of the entire response
    try {
      return JSON.parse(content);
    } catch (e) {
      // If direct parsing fails, try to find JSON pattern
      console.warn('Direct JSON parsing failed, looking for JSON pattern');
      
      // Look for content that appears to be JSON (between curly braces)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch && jsonMatch[0]) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (jsonError) {
          console.warn('Failed to parse extracted JSON pattern');
        }
      }
      
      // If we still don't have valid JSON, try removing markdown code blocks
      console.warn('Trying to remove markdown code formatting');
      const cleanedContent = content
        .replace(/```json\s+/g, '')
        .replace(/```\s*$/g, '')
        .trim();
      
      try {
        return JSON.parse(cleanedContent);
      } catch (markdownError) {
        console.warn('Failed to parse after removing markdown formatting');
      }
      
      // Final fallback: extract structured data from text
      console.warn('All JSON parsing methods failed, falling back to text extraction');
      return this.extractStructuredDataFromText(content);
    }
  }

  /**
   * Process validation phase with pre-extracted data
   * This is a public wrapper around the private validateAndCompare method
   */
  public async processValidationPhase(data: { extractedData: ExtractedDocumentData[], documents: ParsedDocument[] }): Promise<ProcessingResult> {
    console.log('Processing validation phase with pre-extracted data');
    
    try {
      // Phase 2: Validate and compare the extracted data
      console.log('Validation and comparison starting');
      const result = await this.validateAndCompare(data.extractedData, data.documents);
      console.log('Completed validation and comparison');
      
      return result;
    } catch (error) {
      console.error('Error in validation phase processing:', error);
      throw error;
    }
  }
  
  /**
   * Extract fields from a single document
   */
  public async extractDocumentFields(document: ParsedDocument): Promise<ExtractedDocumentData> {
    console.log(`Extracting fields from document: ${document.name}`);
    
    try {
      // Prepare the message for Claude
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text' as const,
              text: `Document: ${document.name}\n\n${document.content}`
            },
            {
              type: 'text' as const,
              text: this.generateExtractionPrompt(document.name)
            }
          ]
        }
      ];
      
      // Call the Claude API
      const response = await this.callClaudeApi(messages, this.extractionApiUrl);
      
      // Process the response
      const content = response.content[0].text;
      
      // Debug logging to see exactly what's being returned
      console.log('DEBUG: Raw response from Claude:', content.substring(0, 500) + '...');
      try {
        // Try direct JSON parsing
        const testParse = JSON.parse(content);
        console.log('DEBUG: Direct JSON parsing succeeded:', Object.keys(testParse));
      } catch (e) {
        console.log('DEBUG: Direct JSON parsing failed:', e.message);
      }
      
      // Use enhanced JSON processing
      const parsedContent = this.processClaudeResponse(content);
      
      // Calculate token usage and cost
      const tokenUsage: TokenUsage = {
        input: response.usage?.input_tokens || 0,
        output: response.usage?.output_tokens || 0,
        cost: this.calculateCost(response.usage),
        cacheSavings: 0
      };
      
      // Generate a document ID from name + timestamp since ParsedDocument doesn't have an id property
      const documentId = `doc_${document.name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`;
      
      // Return the extracted data
      return {
        documentId,
        documentName: document.name,
        extractedFields: parsedContent.extractedFields || {},
        confidence: parsedContent.confidence ? parsedContent.confidence / 100 : 0.75,
        tokenUsage
      };
    } catch (error) {
      console.error(`Error extracting fields from document ${document.name}:`, error);
      throw error;
    }
  }
  
  /**
   * Validate and compare extracted data from multiple documents
   */
  private async validateAndCompare(extractedDataArray: ExtractedDocumentData[], documents: ParsedDocument[]): Promise<ProcessingResult> {
    console.log(`Validating and comparing data from ${extractedDataArray.length} documents`);
    
    try {
      // Prepare the message for Claude
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text' as const,
              text: this.generateValidationPrompt(extractedDataArray)
            }
          ]
        }
      ];
      
      // Call the Claude API
      const response = await this.callClaudeApi(messages, this.validationApiUrl);
      
      // Process the response
      const content = response.content[0].text;
      let parsedContent;
      
      try {
        // Try to parse JSON response
        // First clean up any extra whitespace or formatting that might cause parsing issues
        const cleanContent = content.trim();
        
        // Try multiple parsing strategies
        try {
          // Direct parsing
          parsedContent = JSON.parse(cleanContent);
        } catch (innerError) {
          // Look for JSON content within the response
          const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
          if (jsonMatch && jsonMatch[0]) {
            try {
              parsedContent = JSON.parse(jsonMatch[0]);
            } catch (jsonError) {
              throw new Error('Failed to parse extracted JSON: ' + jsonError.message);
            }
          } else {
            throw new Error('No JSON pattern found in response');
          }
        }
      } catch (e) {
        console.warn('Could not parse JSON from Claude validation response, falling back to text extraction:', e.message);
        // Create a structured object from the text response
        parsedContent = {
          validation: content,
          summary: 'Could not parse structured data from validation response',
          insights: '',
          recommendations: '',
          tables: []
        };
      }
      
      // Calculate token usage and cost
      const tokenUsage: TokenUsage = {
        input: response.usage?.input_tokens || 0,
        output: response.usage?.output_tokens || 0,
        cost: this.calculateCost(response.usage),
        cacheSavings: 0
      };
      
      // Combine token usage from extraction phase
      const totalTokenUsage: TokenUsage = extractedDataArray.reduce((total, data) => {
        return {
          input: total.input + data.tokenUsage.input,
          output: total.output + data.tokenUsage.output,
          cost: total.cost + data.tokenUsage.cost,
          cacheSavings: total.cacheSavings + data.tokenUsage.cacheSavings
        };
      }, tokenUsage);
      
      // Create a standardized result
      return {
        result: {
          tables: parsedContent.tables || this.createTablesFromExtractedData(extractedDataArray),
          validation: parsedContent.validation || '',
          summary: parsedContent.summary || '',
          insights: parsedContent.insights || '',
          recommendations: parsedContent.recommendations || '',
          extractedFields: this.combineExtractedFields(extractedDataArray),
          confidence: parsedContent.confidence ? parsedContent.confidence / 100 : 0.75
        },
        isValid: true,
        confidenceScore: parsedContent.confidence ? parsedContent.confidence / 100 : 0.75,
        tokenUsage: totalTokenUsage,
        errors: []
      };
    } catch (error) {
      console.error('Error validating and comparing documents:', error);
      throw error;
    }
  }
  
  /**
   * Generate a prompt for document field extraction
   * @param documentNames Names of the documents being processed
   */
  private generateExtractionPrompt(documentNames: string): string {
    return enhancedExtractionPrompt(documentNames, 'logistics');
  }
  
  /**
   * Generate a prompt for validation and comparison
   */
  private generateValidationPrompt(extractedDataArray: ExtractedDocumentData[]): string {
    // Create a JSON representation of all extracted data
    // Limit the data size to avoid request size issues
    const extractedDataJson = JSON.stringify(extractedDataArray.map(data => ({
      documentName: data.documentName,
      extractedFields: data.extractedFields
    })), null, 2);
    
    return `You are validating and comparing data extracted from ${extractedDataArray.length} logistics documents.

Extracted data:
${extractedDataJson}

TASK:
1. Validate the extracted data against the standard logistics fields schema
2. Compare the documents and identify any discrepancies
3. Provide insights and recommendations based on the comparison

Standard logistics fields to validate against:
- Consignee
- Shipper
- Invoice Number
- Date
- Consignee PO Order Number
- Number of Packages
- Gross Weight
- Net Weight
- Product Description
- Cargo Value
- Packing List Details

IMPORTANT: RESPOND USING ONLY THE FOLLOWING JSON STRUCTURE with no explanations outside the JSON:

{
  "validation": "Status of each field with ✅ for valid fields and ❌ for invalid fields",
  "summary": "Brief summary of the documents",
  "insights": "Business insights based on the documents",
  "recommendations": "Recommendations for improvement",
  "confidence": 85,
  "tables": [
    {
      "title": "Document Field Comparison",
      "headers": ["Field", "Document 1", "Document 2", ...],
      "rows": [
        ["Field Name", "Value from Doc 1", "Value from Doc 2", ...],
        ...
      ]
    }
  ]
}

Notes:
1. For validation, list each standard field with a checkmark or X based on presence and correctness
2. In your comparison tables, include ALL standard fields plus any additional important fields
3. Highlight any discrepancies or inconsistencies between documents
4. Provide actionable insights and recommendations`;
  }
  
  /**
   * Call the Claude API through the Supabase proxy
   */
  private async callClaudeApi(messages: any, apiUrl: string) {
    try {
      // Extract endpoint from URL for logging and request configuration
      const isValidation = apiUrl.includes('/validation');
      const endpoint = isValidation ? 'validation' : 'extraction';
      
      console.log(`Making API request to ${apiUrl} for ${endpoint} endpoint`);
      const startTime = Date.now();
      
      // Basic request structure required by Claude API
      // The Supabase function will apply its own model and token configurations,
      // but we need to include these basic parameters for the request to be valid
      const requestBody: any = {
        model: 'claude-3-5-sonnet-20241022', // Will be overridden by server but needed for validation
        max_tokens: isValidation ? 8192 : 4096, // Will be overridden by server but needed for validation
        messages: messages
      };
      
      const response = await axios.post(apiUrl, requestBody);
      
      const endTime = Date.now();
      console.log(`Response received in ${endTime - startTime}ms with status ${response.status}`);
      
      if (response.data && response.data.usage) {
        console.log(`Token usage: ${response.data.usage.input_tokens} input, ${response.data.usage.output_tokens} output`);
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Error calling Claude API:', error);
      
      // Enhanced error reporting
      if (error.response) {
        console.error('API Response Error:', {
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
   * Create tables from extracted data for display purposes
   */
  private createTablesFromExtractedData(extractedDataArray: ExtractedDocumentData[]) {
    if (extractedDataArray.length === 0) return [];
    
    // Get all unique fields across all documents
    const allFields = new Set<string>();
    extractedDataArray.forEach(data => {
      Object.keys(data.extractedFields).forEach(field => allFields.add(field));
    });
    
    // Standard fields to prioritize at the top
    const standardFields = [
      'Consignee',
      'Shipper',
      'Invoice Number',
      'Date',
      'Consignee PO Order Number',
      'Number of Packages',
      'Gross Weight',
      'Net Weight',
      'Product Description',
      'Cargo Value',
      'Packing List Details'
    ];
    
    // Sort fields with standard fields first, then alphabetically
    const sortedFields = [
      ...standardFields.filter(field => allFields.has(field)),
      ...Array.from(allFields).filter(field => !standardFields.includes(field)).sort()
    ];
    
    // Create the headers for the table
    const headers = ['Field', ...extractedDataArray.map(data => data.documentName)];
    
    // Create the rows for the table
    const rows = sortedFields.map(field => {
      return [
        field,
        ...extractedDataArray.map(data => {
          return data.extractedFields[field] || 'u2014'; // Em dash for missing values
        })
      ];
    });
    
    return [{
      title: 'Document Field Comparison',
      headers,
      rows
    }];
  }
  
  /**
   * Combine extracted fields from all documents
   * Used for storing a complete set of all fields from all documents
   */
  private combineExtractedFields(extractedDataArray: ExtractedDocumentData[]): Record<string, any> {
    const combinedFields: Record<string, any> = {};
    
    // For each document
    extractedDataArray.forEach((data, index) => {
      // Store the document's fields under its index
      combinedFields[index] = data.extractedFields;
      
      // Also store all fields at the top level with document 0 taking precedence
      if (index === 0) {
        Object.assign(combinedFields, data.extractedFields);
      }
    });
    
    return combinedFields;
  }
}

// Export a singleton instance
export const parallelDocumentService = new ParallelDocumentService();
