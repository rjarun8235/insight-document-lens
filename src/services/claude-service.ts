import axios from 'axios';
import { ComparisonResult, ComparisonTable, ParsedDocument } from '../lib/types';
import { callWithRetry, formatErrorMessage } from '@/utils/api-helpers';
import { fetchApiKeyFromSupabase } from '@/lib/supabase';

// Helper to convert a File object (image) to base64 and media type
async function fileToBase64(file: File): Promise<{base64: string, mediaType: string}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = function () {
      const base64 = (reader.result as string).split(',')[1];
      
      // Get file type and ensure it's a supported media type for Claude API
      let mediaType = file.type;
      
      // If mediaType is empty or not supported for images, determine from file extension or default to jpeg
      if (file.type.startsWith('image/') && !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.png')) {
          mediaType = 'image/png';
        } else if (fileName.endsWith('.gif')) {
          mediaType = 'image/gif';
        } else if (fileName.endsWith('.webp')) {
          mediaType = 'image/webp';
        } else {
          // Default to jpeg for any other or unknown format
          mediaType = 'image/jpeg';
        }
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        mediaType = 'application/pdf';
      }
      
      resolve({
        base64,
        mediaType
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper to convert a URL-based image to base64
async function urlToBase64(url: string): Promise<{base64: string, mediaType: string}> {
  try {
    // Determine media type from URL extension
    let mediaType = 'image/jpeg'; // Default
    if (url.toLowerCase().endsWith('.png')) {
      mediaType = 'image/png';
    } else if (url.toLowerCase().endsWith('.gif')) {
      mediaType = 'image/gif';
    } else if (url.toLowerCase().endsWith('.webp')) {
      mediaType = 'image/webp';
    } else if (url.toLowerCase().endsWith('.pdf')) {
      mediaType = 'application/pdf';
    }
    
    // Fetch the image
    const response = await fetch(url);
    const blob = await response.blob();
    
    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = function() {
        const base64 = (reader.result as string).split(',')[1];
        resolve({
          base64,
          mediaType
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting URL to base64:', error);
    throw error;
  }
}

// Instruction builder for various doc types (esp. logistics: packing-list, invoice, bill-of-entry)
export function prepareInstructions(comparisonType: string): string {
  // Default instruction for general document comparison
  let instruction = `Please analyze these documents and provide a detailed comparison. Extract key information into a comparison table, then provide analysis in the required sections.`;
  
  // Specialized instructions based on document type
  switch (comparisonType.toLowerCase()) {
    case 'packing-list':
    case 'packing-lists':
      instruction = `Please analyze these packing lists and provide a detailed comparison. 
      
Extract key information such as:
- Shipper and consignee details
- Invoice/PO references
- Package counts and types
- Product descriptions
- Quantities
- Weights and measurements
- Country of origin
- Shipping marks

Organize this information into a comparison table, then provide analysis in the required sections. Pay special attention to:
- Quantity discrepancies
- Weight or measurement inconsistencies
- Missing or additional items
- Description mismatches
- Package count differences`;
      break;
      
    case 'invoice':
    case 'invoices':
      instruction = `Please analyze these invoices and provide a detailed comparison. 
      
Extract key information such as:
- Seller and buyer details
- Invoice numbers and dates
- Payment terms
- Currency and total amounts
- Itemized product listings
- Unit prices and quantities
- Discounts or additional charges
- Tax information
- Delivery terms (Incoterms)

Organize this information into a comparison table, then provide analysis in the required sections. Pay special attention to:
- Price discrepancies
- Quantity inconsistencies
- Missing or additional items
- Payment term differences
- Currency or total amount mismatches`;
      break;
      
    case 'bill-of-lading':
    case 'bills-of-lading':
      instruction = `Please analyze these bills of lading and provide a detailed comparison. 
      
Extract key information such as:
- Shipper, consignee and notify party details
- BL numbers and dates
- Vessel and voyage information
- Ports of loading and discharge
- Container and seal numbers
- Description of goods
- Package counts
- Weights and measurements
- Freight terms
- Special clauses or remarks

Organize this information into a comparison table, then provide analysis in the required sections. Pay special attention to:
- Vessel or voyage inconsistencies
- Port information discrepancies
- Container or seal number mismatches
- Description of goods inconsistencies
- Weight or measurement discrepancies
- Missing or additional clauses`;
      break;
      
    case 'bill-of-entry':
    case 'bills-of-entry':
      instruction = `Please analyze these bills of entry and provide a detailed comparison. 
      
Extract key information such as:
- Entry numbers and dates
- Importer and exporter information
- Customs broker details
- Port of loading and discharge
- Country of origin
- HS codes and product descriptions
- Duty and tax assessments
- Total declared value
- Exchange rates
- Import license details
- Customs station

Organize this information into a comparison table, then provide analysis in the required sections. Pay special attention to:
- HS code discrepancies
- Duty calculation errors
- Value declaration inconsistencies
- Country of origin mismatches
- Missing or additional items`;
      break;

    case 'logistics':
      instruction = `Please analyze these logistics documents and provide a detailed comparison. These may include Bills of Lading, Invoices, Packing Lists, or other shipping documents.
      
First identify the document types, then extract all relevant information such as:
- Parties involved (shipper, consignee, notify party)
- Reference numbers (BL, invoice, PO numbers)
- Dates (issue, shipping, delivery)
- Goods description and quantities
- Packaging details
- Weights and measurements
- Origin and destination
- Vessel/voyage/container details if applicable
- Terms and conditions

Organize this information into a comparison table, then provide analysis in the required sections. Pay special attention to any discrepancies between the documents that could cause issues in the logistics process.`;
      break;
  }
  
  return instruction;
}

// Claude API service
export default class ClaudeService {
  private apiKey: string;

  constructor() {
    // Initialize with empty API key - will be set by fetchApiKey()
    this.apiKey = '';
    
    // Check environment variable if available (for development)
    if (import.meta.env.VITE_ANTHROPIC_API_KEY) {
      this.apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    } else {
      // Will need to fetch from Supabase
      this.fetchApiKey();
    }
  }
  
  private async fetchApiKey() {
    try {
      // Fetch API key from Supabase
      const apiKey = await fetchApiKeyFromSupabase();
      
      if (apiKey) {
        this.apiKey = apiKey;
      } else {
        console.warn('API key not found in Supabase. Using empty key.');
      }
    } catch (error) {
      console.error('Failed to fetch API key:', error);
    }
  }
  
  async callClaudeApi(payload: any): Promise<any> {
    let responseData;
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        console.log('Calling Claude API...');
        
        // Direct API call with the CORS header
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          throw new Error(`Claude API returned error: ${response.status} ${response.statusText}`);
        }
        
        responseData = await response.json();
        console.log('Successfully called Claude API');
        break;
      } catch (error) {
        retryCount++;
        console.warn(`API call failed (attempt ${retryCount}/${maxRetries}):`, error);
        
        // If we've reached max retries, throw the error
        if (retryCount >= maxRetries) {
          console.error('Max retries reached. Unable to connect to Claude API:', error);
          throw new Error('Unable to connect to Claude API after multiple attempts. Please check your network connection and API key.');
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Log token usage to see cache effectiveness
    const inputTokens = responseData.usage?.input_tokens || 0;
    const outputTokens = responseData.usage?.output_tokens || 0;
    
    // Calculate approximate cost (based on Claude 3 Sonnet pricing)
    // $15 per million input tokens, $75 per million output tokens
    const inputCost = (inputTokens / 1000000) * 15;
    const outputCost = (outputTokens / 1000000) * 75;
    const totalCost = inputCost + outputCost;
    
    console.log(`Token usage - Input: ${inputTokens}, Output: ${outputTokens}, Estimated cost: $${totalCost.toFixed(4)}`);
    
    return {
      result: this.processResponse(responseData),
      tokenUsage: {
        input: inputTokens,
        output: outputTokens,
        cost: totalCost
      }
    };
  }
  
  processResponse(responseData: any): ComparisonResult {
    // Get the response text
    const responseText = responseData.content[0].text;

    // Check if we got a valid response
    if (!responseText || responseText.trim().length < 100) {
      console.error('Claude returned an empty or very short response');
      throw new Error('Claude returned an incomplete analysis. Please try again.');
    }

    // Parse the response to extract tables and sections
    const result: ComparisonResult = {
      tables: [],
      verification: "",
      validation: "",
      review: "",
      analysis: "",
      summary: "",
      insights: "",
      recommendations: "",
      risks: "",
      issues: ""
    };

    // Extract tables from markdown
    const tableRegex = /\|([^\|]*)\|([^\|]*)\|/g;
    const tableHeaderRegex = /\|\s*([^\|]*)\s*\|\s*([^\|]*)\s*\|/;
    const tableSeparatorRegex = /\|\s*[-:\s]+\s*\|\s*[-:\s]+\s*\|/;

    // Find all tables in the response
    const tables: ComparisonTable[] = [];
    let currentTable: ComparisonTable | null = null;

    // Split the response by lines
    const lines = responseText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this is a table header
      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line.split('|').filter(cell => cell.trim() !== '');
        
        // If this is the first row and the next line has separator characters, it's a header
        if (!currentTable && i + 1 < lines.length && lines[i + 1].includes('-')) {
          // Extract headers
          currentTable = {
            title: 'Document Comparison',
            headers: cells.map(h => h.trim()),
            rows: [],
            isMultiDocument: cells.length > 3 // If more than 3 columns (Field, Doc1, Doc2), it's multi-document
          };
          
          // If it's a multi-document table, set document names
          if (currentTable.isMultiDocument) {
            // Use the document names passed from the DocumentProcessor component
            // or generate default names based on the number of documents
            currentTable.documentNames = [];
          }
          
          i++; // Skip the separator line
        }
        // Check if this is a table row
        else if (currentTable) {
          currentTable.rows.push(cells.map(cell => cell.trim()));
        }
      }
      // Check if we've reached the end of a table
      else if (currentTable && line === '') {
        tables.push(currentTable);
        currentTable = null;
      }
    }

    // Add the last table if it exists
    if (currentTable) {
      tables.push(currentTable);
    }

    // If no tables were found, create a default one
    if (tables.length === 0) {
      // Create appropriate headers based on number of documents
      const headers = ['Field'];
      
      tables.push({
        title: 'Document Comparison',
        headers: headers,
        rows: [['No data extracted', ...Array().fill('')]],
        isMultiDocument: false,
        documentNames: []
      });
    }

    result.tables = tables;

    // Extract sections using multiple pattern matching approaches
    const sectionKeys = [
      'verification', 'validation', 'review', 'analysis',
      'summary', 'insights', 'recommendations', 'risks', 'issues'
    ];

    // Try multiple patterns to extract sections
    sectionKeys.forEach(key => {
      // Try the structured format first (most precise)
      const structuredRegex = new RegExp(
        `<section_name>${key.charAt(0).toUpperCase() + key.slice(1)}<\\/section_name>[\\s\\S]*?<quotes>([\\s\\S]*?)<\\/quotes>[\\s\\S]*?<analysis>([\\s\\S]*?)<\\/analysis>`,
        'i'
      );

      const match = responseText.match(structuredRegex);

      if (match && match[1] && match[2]) {
        // Include both quotes and analysis in the result
        result[key] = `Quotes:\n${match[1].trim()}\n\nAnalysis:\n${match[2].trim()}`;
        return; // Section found, move to next
      }

      // Try markdown heading format (## Verification)
      const markdownHeadingRegex = new RegExp(
        `##\\s*${key.charAt(0).toUpperCase() + key.slice(1)}\\s*\\n([\\s\\S]*?)(?=\\n##|$)`,
        'i'
      );

      const markdownMatch = responseText.match(markdownHeadingRegex);

      if (markdownMatch && markdownMatch[1]) {
        result[key] = markdownMatch[1].trim();
        return; // Section found, move to next
      }

      // Try simple label format (Verification:)
      const labelRegex = new RegExp(
        `${key.charAt(0).toUpperCase() + key.slice(1)}:\\s*([\\s\\S]*?)(?=\\n[A-Z][a-z]+:|$)`,
        'i'
      );

      const labelMatch = responseText.match(labelRegex);

      if (labelMatch && labelMatch[1]) {
        result[key] = labelMatch[1].trim();
        return; // Section found, move to next
      }
    });

    return result;
  }

  // Main Claude analysis, for both images & text files, tailored for logistics docs and standard use
  async analyzeDocuments(
    documents: ParsedDocument[],
    instruction: string,
    useCache: boolean = true
  ): Promise<{result: ComparisonResult, tokenUsage: {input: number, output: number, cost: number}}> {
    // Prepare content for Claude API
    let userContent: any[] = [];
    let estimatedImageTokens = 0;
    
    // Check if we have any images to process
    const hasImages = documents.some(doc => doc.image);
    
    if (hasImages) {
      // Handle multimodal content (images + text)
      const multimodalContent = await Promise.all(
        documents.map(async doc => {
          if (!doc.image && doc.text) {
            // Just text (parsed contents of CSV, Excel, etc)
            return {
              type: "text",
              text: doc.text
            };
          } else if (doc.image) {
            try {
              // Handle based on document type
              if (doc.documentType === 'pdf') {
                // PDF document - use document type for better handling
                console.log(`Processing PDF document: ${doc.image.name} (${Math.round(doc.image.size / 1024)} KB)`);
                
                // Convert PDF to base64
                const base64Data = await fileToBase64(doc.image);
                
                // Return as document type with the latest API format
                return {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: base64Data.base64
                  },
                  cache_control: { type: "ephemeral" }
                };
              } else {
                // Image (with base64)
                const { base64, mediaType } = await fileToBase64(doc.image);
                
                // Estimate token usage: tokens = (width px * height px)/750
                const img = new Image();
                img.src = URL.createObjectURL(doc.image);
                await new Promise(resolve => {
                  img.onload = resolve;
                  img.onerror = resolve;
                });
                
                const width = img.width || 1000; // Default if can't determine
                const height = img.height || 1000; // Default if can't determine
                URL.revokeObjectURL(img.src);
                
                const imageTokenEstimate = Math.ceil((width * height) / 750);
                estimatedImageTokens += imageTokenEstimate;
                
                console.log(`Image: ${doc.image.name}, Size: ${width}x${height}, Estimated tokens: ${imageTokenEstimate}`);
                
                // Create image content object following Claude's latest API format
                const imageContent = {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64
                  },
                  cache_control: { type: "ephemeral" }
                };

                // Add associated OCR text (if present from front-end parser)
                if (doc.text) {
                  return [
                    imageContent,
                    {
                      type: "text",
                      text: doc.text
                    }
                  ];
                }

                return imageContent;
              }
            } catch (error) {
              console.error('Error processing document:', error);
              // Return a text fallback if processing fails
              return {
                type: "text",
                text: `[Failed to process document. Using text fallback if available: ${doc.text || 'No text available'}]`
              };
            }
          } else {
            // Fallback to text if no image
            return {
              type: "text",
              text: doc.text || "[No content available]"
            };
          }
        })
      );

      // Log estimated token usage for images
      if (estimatedImageTokens > 0) {
        console.log(`Total estimated image tokens: ${estimatedImageTokens}`);
        const estimatedCost = (estimatedImageTokens * 3) / 1000000; // $3 per million tokens
        console.log(`Estimated image cost: $${estimatedCost.toFixed(6)}`);
      }

      // For multimodal content, we need to put everything in the user message
      userContent = [
        ...multimodalContent.flat(),
        { 
          type: "text", 
          text: "\n\n" + instruction 
        }
      ];
    } else {
      // Text-only case - put documents in user message
      const documentTexts = documents.map(doc => doc.text || '').join("\n\n---\n\n");

      // Put documents and instruction in user message
      userContent = [
        {
          type: "text",
          text: documentTexts
        },
        {
          type: "text",
          text: "\n\n" + instruction
        }
      ];
    }

    // Get Claude model from environment variables or use default
    const claudeModel = import.meta.env.VITE_CLAUDE_MODEL || "claude-3-5-sonnet-20240620";

    // Create system message with instructions
    const systemMessage = `You are DocLensAI, an expert document analyzer for TSV Global Solutions. Your role is to analyze and compare documents with precision and accuracy.

IMPORTANT GUIDELINES:
- Only make claims that are directly supported by the documents. If you're unsure about any information or can't find it in the documents, explicitly state "I don't have enough information to determine this" rather than making assumptions.
- For each section of your analysis, first extract relevant quotes from the documents, then base your analysis only on those quotes.
- Maintain a professional, factual tone throughout your analysis.
- When comparing documents, highlight specific differences with direct citations from the documents.
- If the documents are unclear or ambiguous, acknowledge this uncertainty rather than guessing.
- Format your response consistently using the structure below.
- IMPORTANT: You must handle ANY NUMBER of documents, not just two. If more than two documents are provided, create comparison tables that include ALL documents.

REQUIRED OUTPUT FORMAT FOR MULTIPLE DOCUMENTS:
<comparison_tables>
| Field | Document 1 | Document 2 | Document 3 | ... | Document N |
| ----- | ---------- | ---------- | ---------- | --- | ---------- |
| Field Name | Value from Doc 1 | Value from Doc 2 | Value from Doc 3 | ... | Value from Doc N |
...additional rows as needed
</comparison_tables>

<section_name>Verification</section_name>
<quotes>
Direct quotes from documents related to verification.
</quotes>
<analysis>
Your analysis of verification aspects, based only on the quotes above.
</analysis>

<section_name>Validation</section_name>
<quotes>
Direct quotes from documents related to validation.
</quotes>
<analysis>
Your analysis of validation aspects, based only on the quotes above.
</analysis>

<section_name>Review</section_name>
<quotes>
Direct quotes from documents related to review.
</quotes>
<analysis>
Your analysis of review aspects, based only on the quotes above.
</analysis>

<section_name>Analysis</section_name>
<quotes>
Direct quotes from documents related to general analysis.
</quotes>
<analysis>
Your overall analysis, based only on the quotes above.
</analysis>

<section_name>Summary</section_name>
<quotes>
Key quotes that summarize the documents.
</quotes>
<analysis>
Your summary of the documents, based only on the quotes above.
</analysis>

<section_name>Insights</section_name>
<quotes>
Quotes that lead to insights.
</quotes>
<analysis>
Your insights based only on the quotes above.
</analysis>

<section_name>Recommendations</section_name>
<quotes>
Quotes that inform recommendations.
</quotes>
<analysis>
Your recommendations based only on the quotes above.
</analysis>

<section_name>Risks</section_name>
<quotes>
Quotes that indicate risks.
</quotes>
<analysis>
Your risk assessment based only on the quotes above.
</analysis>

<section_name>Issues</section_name>
<quotes>
Quotes that highlight issues.
</quotes>
<analysis>
Your analysis of issues based only on the quotes above.
</analysis>`;

    // Add specific instructions for handling empty or missing values
    const enhancedSystemMessage = `${systemMessage}

IMPORTANT ADDITIONAL INSTRUCTIONS:
- For any document where you cannot extract specific fields, clearly indicate this with "No data available" or similar text.
- If a field exists in one document but not in others, still include that field in your comparison table with empty values for documents where it's not present.
- Always provide values for ALL documents in the comparison, even if some documents have minimal or no extractable data.
- If a document appears to be completely different from others (different document type), note this in your analysis.`;

    // Use the retry mechanism for the API call
    try {
      return await this.callClaudeApi({
        model: claudeModel,
        max_tokens: 4000,
        system: enhancedSystemMessage,
        messages: [
          {
            role: "user",
            content: userContent
          }
        ]
      });
    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw new Error(formatErrorMessage(error));
    }
  }
}
