import Anthropic from '@anthropic-ai/sdk';
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
        ['Amount', '$1,250.00', '$1,350.00'],
        ['Supplier', 'ABC Logistics', 'ABC Logistics'],
        ['Items', '5 items', '6 items']
      ]
    }],
    verification: "Quotes:\nDocument 1: \"Invoice #INV-2023-001 dated October 15, 2023\"\nDocument 2: \"Invoice #INV-2023-002 dated October 16, 2023\"\n\nAnalysis:\nBoth documents appear to be legitimate invoices with proper formatting and expected information. The invoice numbers follow the standard format and include dates that are sequential.",
    validation: "Quotes:\nDocument 1: \"Total: $1,250.00 for 5 items\"\nDocument 2: \"Total: $1,350.00 for 6 items\"\n\nAnalysis:\nAll required fields are present in both documents. The calculations for totals match the line items. Each document contains the necessary information including invoice number, date, supplier details, item counts, and total amounts.",
    review: "Quotes:\nDocument 1: \"Supplier: ABC Logistics\"\nDocument 2: \"Supplier: ABC Logistics\"\n\nAnalysis:\nBoth invoices follow standard formats with minor differences in content. They are from the same supplier but have different invoice numbers, dates, and amounts. The structure and formatting are consistent between both documents.",
    analysis: "Quotes:\nDocument 1: \"5 items totaling $1,250.00\"\nDocument 2: \"6 items totaling $1,350.00\"\n\nAnalysis:\nThe invoices differ primarily in invoice number, date, and total amount. The supplier remains the same. Document 2 shows one additional item compared to Document 1, with a corresponding increase in the total amount of $100.00.",
    summary: "Quotes:\nDocument 1: \"Invoice #INV-2023-001, ABC Logistics, $1,250.00\"\nDocument 2: \"Invoice #INV-2023-002, ABC Logistics, $1,350.00\"\n\nAnalysis:\nTwo sequential invoices from the same supplier (ABC Logistics) with different dates and amounts. The second invoice is for a slightly higher amount and includes one additional item compared to the first invoice.",
    insights: "Quotes:\nDocument 1: \"5 items totaling $1,250.00\"\nDocument 2: \"6 items totaling $1,350.00\"\n\nAnalysis:\nThe second invoice shows a slight increase in both quantity (1 additional item) and total amount ($100.00 more) compared to the first. This suggests a consistent per-item cost of approximately $100 per item across both invoices.",
    recommendations: "Quotes:\nBoth documents: \"Payment terms: Net 30\"\n\nAnalysis:\nThese invoices should be processed according to standard procedures. Given the consistent supplier and sequential nature, they appear to be part of regular business operations. The payment terms of Net 30 should be observed for both invoices.",
    risks: "Quotes:\nNo specific risk indicators found in either document.\n\nAnalysis:\nNo significant risks identified in these documents. The invoices appear to be standard and consistent with expected business operations from a known supplier.",
    issues: "Quotes:\nNo issue indicators found in either document.\n\nAnalysis:\nNo issues detected in the document comparison. Both invoices contain all required information and follow consistent formatting."
  };
}

// Main Claude analysis, for both images & text files, tailored for logistics docs and standard use
export async function analyzeDocuments(
  documents: ParsedDocument[],
  instruction: string,
  useCache: boolean = true
): Promise<{result: ComparisonResult, tokenUsage: {input: number, output: number, cost: number}}> {
  // Get Claude API Key
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  if (!apiKey) throw new Error('Anthropic API key is missing.');

  // Set request timeout (30 seconds)
  const requestTimeout = 30000;

  // Initialize Anthropic client with the latest SDK configuration
  const anthropic = new Anthropic({
    apiKey: apiKey.trim(), // Ensure no whitespace
    dangerouslyAllowBrowser: true
  });

  // Compose multi-modal content for Claude (for text + image docs)
  let hasImage = documents.some(doc => doc.image !== undefined);
  let hasPDF = documents.some(doc => doc.documentType === 'pdf');
  let userContent: any[] = [];
  
  // Track estimated token usage for images
  let estimatedImageTokens = 0;

  try {
    if (hasImage || hasPDF) {
      // Images + Text: each "doc" is a ParsedDocument with image, text, and documentType
      // Structure per Claude's vision/multimodal API
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

          // Make the API call with proper error handling and caching
          const response = await anthropic.messages.create({
            model: claudeModel,
            max_tokens: 4000,
            system: systemMessage,
            messages: [
              {
                role: "user",
                content: userContent
              }
            ]
          });

          // Log token usage to see cache effectiveness
          console.log('Token usage:', response.usage);
          
          // Log the first 500 characters of the response for debugging
          console.log('Response preview:', response.content[0].text.substring(0, 500) + '...');

          // Get the response text
          const responseText = response.content[0].text;

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
              `${key.charAt(0).toUpperCase() + key.slice(1)}[:\\s]+(.*?)(?=\\n\\s*\\n|\\n\\s*[A-Z]|$)`,
              'is'
            );

            const labelMatch = responseText.match(labelRegex);

            if (labelMatch && labelMatch[1]) {
              result[key] = labelMatch[1].trim();
              return; // Section found, move to next
            }

            // Default if no match found
            result[key] = `No ${key} information provided.`;
          });

          // Calculate token usage cost
          const tokenUsage = {
            input: response.usage.input_tokens,
            output: response.usage.output_tokens,
            cost: (response.usage.input_tokens + response.usage.output_tokens) * 3 / 1000000 // $3 per million tokens
          };

          return { result, tokenUsage };
        } catch (error: any) {
          console.error('Error calling Claude API:', error);
          
          // Check for network/CORS errors
          if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            console.error('Network error detected - likely a CORS issue');
            
            // In development, fall back to mock data
            if (import.meta.env.DEV) {
              console.warn('Using mock data due to network error in development');
              return { result: getMockResponse(), tokenUsage: { input: 0, output: 0, cost: 0 } };
            }
          }
          
          // Provide more detailed error messages based on the error type
          const errorMessage = formatErrorMessage(error);
          
          // Log detailed error for debugging
          console.error('Detailed error:', {
            message: errorMessage,
            originalError: error,
            documents: documents.map(doc => `image: ${doc.image?.name || 'No image'}`),
            hasImage,
            modelUsed: claudeModel
          });
          
          throw new Error(errorMessage);
        }
      }, 3, 2000);
    } catch (error) {
      // If all retries failed and we're in development, use mock data
      if (import.meta.env.DEV) {
        console.warn('All retries failed, using mock data in development');
        return { result: getMockResponse(), tokenUsage: { input: 0, output: 0, cost: 0 } };
      }
      throw error;
    }
  } catch (error) {
    console.error('Error preparing documents:', error);
    
    // In development, fall back to mock data
    if (import.meta.env.DEV) {
      console.warn('Using mock data due to document preparation error in development');
      return { result: getMockResponse(), tokenUsage: { input: 0, output: 0, cost: 0 } };
    }
    
    throw new Error('Failed to prepare documents for analysis.');
  }
}

// Instruction builder for various doc types (esp. logistics: packing-list, invoice, bill-of-entry)
export function prepareInstructions(comparisonType: string): string {
  const baseInstruction = `
Carefully analyze and compare the uploaded documents.

Your output MUST include:
1. First, create a structured comparison table with key fields from the documents using markdown tables
2. Then provide ALL of the following sections in this exact order:
   - Verification - Verify if the documents are consistent with each other
   - Validation - Validate if the documents meet standard requirements
   - Review - Provide a detailed review of the documents
   - Analysis - Analyze the content and identify patterns or discrepancies
   - Summary - Summarize the key points from all documents
   - Insights - Provide insights that might not be immediately obvious
   - Recommendations - Suggest actions based on the document analysis
   - Risks - Identify potential risks or issues
   - Issues - List any problems found in the documents

For tables, extract and compare all major values (dates, IDs, totals, etc). Make sure to align corresponding fields from different documents.

CRITICAL: For EACH section, you MUST follow this EXACT structure to ensure proper parsing:
<section_name>Verification</section_name>
<quotes>
- Quote 1 from document
- Quote 2 from document
</quotes>
<analysis>
Your analysis based strictly on the quotes
</analysis>

Repeat this structure for EVERY section (Validation, Review, etc.). This format is required for the application to properly parse your response.
`;

  // Specific details for the key logistics activities
  const specific: Record<string, string> = {
    'packing-list':
      "Focus on items, quantities, weight, packaging type, consignee/consignor, shipment IDs, and dates. Compare item counts and weights between documents. Highlight any discrepancies in quantities or descriptions.",
    'invoice':
      "Focus on invoice numbers, shipment details, item prices, taxes, totals, and currency. Compare financial values and ensure calculations are correct. Check for price discrepancies between documents.",
    'bill-of-entry':
      "Focus on customs details, HS codes, duties, declared goods, shipper/receiver, and regulatory fields. Verify that customs information is consistent across documents. Check for compliance with import/export regulations.",
    // General document types
    'general': "Compare all key information between documents. Identify any inconsistencies or missing information.",
    'contracts': "Focus on parties, terms, financials, and validity dates. Compare contract clauses and identify any differences in terms or conditions. Check for legal compliance and potential risks.",
    'invoices': "Extract invoice numbers, dates, items, quantity, price, taxes, total. Verify calculations and check for pricing discrepancies. Ensure tax calculations are correct.",
    'resumes': "Compare skills, roles, education, relevant dates. Identify key qualifications and experience. Highlight strengths and potential areas for development.",
    'reports': "Compare key findings, sections, metrics. Identify trends and patterns across reports. Highlight significant changes or developments over time."
  };

  // Normalize input for matching
  const logiKey = comparisonType.toLowerCase().replace(/\s+/g, '-');
  return baseInstruction + (specific[logiKey] || '');
}
