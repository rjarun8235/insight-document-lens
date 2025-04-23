import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { ComparisonResult, ComparisonTable, ParsedDocument } from '../lib/types';
import { callWithRetry, formatErrorMessage } from '@/utils/api-helpers';

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

// Mock response for development when API is unavailable
function getMockResponse(): ComparisonResult {
  console.log('Using mock response due to API connection issues');
  return {
    tables: [{
      title: 'Document Comparison',
      headers: ['Field', 'Document 1', 'Document 2'],
      rows: [
        ['Invoice Number', 'INV-2023-001', 'INV-2023-002'],
        ['Date', '2023-10-15', '2023-10-16'],
        ['Amount', '$1,200.00', '$1,500.00'],
        ['Supplier', 'ABC Corp', 'ABC Corp'],
        ['Items', '10 units of Product A', '15 units of Product A']
      ]
    }],
    verification: "The documents appear to be valid invoices with consistent formatting.",
    validation: "All required fields are present in both documents.",
    review: "Both invoices follow standard formatting with minor differences in quantities and amounts.",
    analysis: "The second invoice shows a 25% increase in both quantity and amount compared to the first invoice.",
    summary: "Two invoices from the same supplier with different quantities and amounts.",
    insights: "There appears to be a volume discount as the per-unit price remains consistent despite the increased quantity.",
    recommendations: "Consider consolidating orders to take advantage of potential volume discounts.",
    risks: "No significant risks identified in these standard invoices.",
    issues: "No issues detected."
  };
}

// Claude API service
export default class ClaudeService {
  private anthropic: Anthropic;
  private apiKey: string;
  
  constructor() {
    this.apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
    this.anthropic = new Anthropic({
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true
    });
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
                
                // Return as document type
                return {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: base64Data.base64
                  }
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
                
                const imageContent = {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64,
                  }
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

REQUIRED OUTPUT FORMAT:
<comparison_tables>
| Field | Document 1 | Document 2 |
| ----- | ---------- | ---------- |
| Field Name | Value from Doc 1 | Value from Doc 2 |
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

    // Use the retry mechanism for the API call
    try {
      return await callWithRetry(async () => {
        try {
          // Check if we're in development mode and should use mock data
          if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API === 'true') {
            return { result: getMockResponse(), tokenUsage: { input: 0, output: 0, cost: 0 } };
          }

          // Create the request payload
          const payload = {
            model: claudeModel,
            max_tokens: 4000,
            system: systemMessage,
            messages: [
              {
                role: "user",
                content: userContent
              }
            ]
          };

          let responseData;

          // Check if we're in a browser environment
          const isBrowser = typeof window !== 'undefined';
          
          // In browser environments, we need to handle CORS issues
          if (isBrowser) {
            try {
              // First try to use the SDK directly (will work in deployed environments where CORS is handled)
              const response = await this.anthropic.messages.create(payload);
              responseData = response;
            } catch (error) {
              // If direct SDK call fails due to CORS, fall back to mock data in development
              if (import.meta.env.DEV) {
                console.warn('API call failed, using mock data in development:', error);
                return { result: getMockResponse(), tokenUsage: { input: 0, output: 0, cost: 0 } };
              } else {
                // In production, rethrow the error
                throw error;
              }
            }
          } else {
            // In non-browser environments (Node.js), use the SDK directly
            const response = await this.anthropic.messages.create(payload);
            responseData = response;
          }
          
          // Log token usage to see cache effectiveness
          console.log('Token usage:', responseData.usage);
          
          // Log the first 500 characters of the response for debugging
          console.log('Response preview:', responseData.content[0].text.substring(0, 500) + '...');

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
          const tableRegex = /\|([^\|]*)\|([^\|]*)\|([^\|]*)\|/g;
          const tableHeaderRegex = /\|\s*([^\|]*)\s*\|\s*([^\|]*)\s*\|\s*([^\|]*)\s*\|/;
          const tableSeparatorRegex = /\|\s*[-:\s]+\s*\|\s*[-:\s]+\s*\|\s*[-:\s]+\s*\|/;

          // Find all tables in the response
          const tables: ComparisonTable[] = [];
          let currentTable: ComparisonTable | null = null;

          // Split the response by lines
          const lines = responseText.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Check if this is a table header
            if (tableHeaderRegex.test(line) && i + 1 < lines.length && tableSeparatorRegex.test(lines[i + 1])) {
              // Extract headers
              const headerMatch = line.match(tableHeaderRegex);
              if (headerMatch) {
                currentTable = {
                  title: 'Document Comparison',
                  headers: headerMatch.slice(1).map((h: string) => h.trim()),
                  rows: []
                };
                i++; // Skip the separator line
              }
            }
            // Check if this is a table row
            else if (currentTable && tableRegex.test(line)) {
              const cells = line.split('|').slice(1, -1).map((cell: string) => cell.trim());
              currentTable.rows.push(cells);
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

          result.tables = tables.length > 0 ? tables : [{
            title: 'Document Comparison',
            headers: ['Field', 'Document 1', 'Document 2'],
            rows: [['No data extracted', '', '']]
          }];

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

          // Return the result and token usage
          return { 
            result, 
            tokenUsage: {
              input: responseData.usage.input_tokens + estimatedImageTokens,
              output: responseData.usage.output_tokens,
              cost: ((responseData.usage.input_tokens + estimatedImageTokens) * 3 + responseData.usage.output_tokens * 15) / 1000000 // $3 per million input tokens, $15 per million output tokens
            }
          };
        } catch (error) {
          console.error('Error calling Claude API:', error);
          throw new Error(formatErrorMessage(error));
        }
      }, 3); // Retry up to 3 times
    } catch (error) {
      console.error('Error preparing documents:', error);
      throw new Error('Failed to prepare documents for analysis.');
    }
  }

  // Instruction builder for various doc types (esp. logistics: packing-list, invoice, bill-of-entry)
  prepareInstructions(comparisonType: string): string {
    // Default instruction for general document comparison
    let instruction = `Please analyze these documents and provide a detailed comparison. Extract key information into a comparison table, then provide analysis in the required sections.`;
    
    // Customize instructions based on document type
    switch (comparisonType.toLowerCase()) {
      case 'invoice':
        instruction = `Please analyze these invoices and provide a detailed comparison. 
        
Extract key information such as:
- Invoice numbers and dates
- Buyer and seller information
- Item descriptions, quantities, and prices
- Total amounts and payment terms
- Tax information
- Shipping details

Organize this information into a comparison table, then provide analysis in the required sections.`;
        break;
        
      case 'packing-list':
        instruction = `Please analyze these packing lists and provide a detailed comparison. 
        
Extract key information such as:
- Shipment references and dates
- Consignee and shipper information
- Item descriptions, quantities, weights, and dimensions
- Package counts and types
- Special handling instructions
- Total gross and net weights

Organize this information into a comparison table, then provide analysis in the required sections.`;
        break;
        
      case 'bill-of-entry':
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

Organize this information into a comparison table, then provide analysis in the required sections.`;
        break;
    }
    
    return instruction;
  }
}
