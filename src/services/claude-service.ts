import Anthropic from '@anthropic-ai/sdk';
import { ComparisonResult, ComparisonTable } from '@/lib/types';
import { callWithRetry, formatErrorMessage } from '@/utils/api-helpers';

// Helper to convert a File object (image) to base64 and media type
async function fileToBase64(file: File): Promise<{base64: string, mediaType: string}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = function () {
      const base64 = (reader.result as string).split(',')[1];
      
      // Get file type and ensure it's a supported media type for Claude API
      let mediaType = file.type;
      
      // If mediaType is empty or not supported, determine from file extension or default to jpeg
      if (!mediaType || !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
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

// Main Claude analysis, for both images & text files, tailored for logistics docs and standard use
export async function analyzeDocuments(
  documents: (string | { image: File, text?: string })[],
  instruction: string,
  useCache: boolean = true
): Promise<ComparisonResult> {
  // Get Claude API Key
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  if (!apiKey) throw new Error('Anthropic API key is missing.');

  // Set request timeout (30 seconds)
  const requestTimeout = 30000;

  const anthropic = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true
  });

  // Compose multi-modal content for Claude (for text + image docs)
  let hasImage = documents.some(doc => typeof doc === 'object');
  let userContent: any[] = [];

  try {
    if (hasImage) {
      // Images + Text: each "doc" is either a string or { image, text? }
      // Structure per Claude's vision/multimodal API
      const multimodalContent = await Promise.all(
        documents.map(async doc => {
          if (typeof doc === 'string') {
            // Just text (parsed contents of PDF, Word, etc)
            return {
              type: "text",
              text: doc,
              ...(useCache && { cache_control: { type: "ephemeral" } })
            };
          } else {
            try {
              // Image (with base64)
              const { base64, mediaType } = await fileToBase64(doc.image);
              const imageContent = {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64,
                },
                ...(useCache && { cache_control: { type: "ephemeral" } })
              };

              // Add associated OCR text (if present from front-end parser)
              if (doc.text) {
                return [
                  imageContent,
                  {
                    type: "text",
                    text: doc.text,
                    ...(useCache && { cache_control: { type: "ephemeral" } })
                  }
                ];
              }

              return imageContent;
            } catch (error) {
              console.error('Error processing image:', error);
              // Return a text fallback if image processing fails
              return {
                type: "text",
                text: `[Failed to process image: ${doc.image.name}. Using text fallback if available: ${doc.text || 'No text available'}]`,
                ...(useCache && { cache_control: { type: "ephemeral" } })
              };
            }
          }
        })
      );

      // For multimodal content, we need to put everything in the user message
      userContent = [
        ...multimodalContent.flat(),
        { type: "text", text: "\n\n" + instruction }
      ];
    } else {
      // Text-only case - put documents in user message
      const documentTexts = documents.map(doc =>
        typeof doc === "string" ? doc : (doc.text || '')
      ).join("\n\n---\n\n");

      // Put documents and instruction in user message
      userContent = [{
        type: "text",
        text: documentTexts + "\n\n" + instruction,
        ...(useCache && { cache_control: { type: "ephemeral" } })
      }];
    }

    // Get Claude model from environment variables or use default
    const claudeModel = import.meta.env.VITE_CLAUDE_MODEL || "claude-3-5-haiku-20241022";

    // Create system message with instructions
    const systemMessage = `You are an expert document analyzer. Analyze the provided documents and extract key information.

      IMPORTANT GUIDELINES:
      - If you're unsure about any information or can't find it in the documents, explicitly state "I don't have enough information to determine this" rather than making assumptions.
      - Always ground your analysis in the actual content of the documents. Use direct quotes when possible.
      - Only make claims that are directly supported by the documents.
      - For each section of your analysis, first extract relevant quotes from the documents, then base your analysis on those quotes.`;

    // Claude API call with structured output format and caching
    // Use retry mechanism for resilience
    const response = await callWithRetry(
      async () => {
        const startTime = Date.now();
        const response = await anthropic.messages.create({
          model: claudeModel,
          max_tokens: 10000,
          system: systemMessage,
          messages: [
            {
              role: "user",
              content: userContent
            }
          ]
        });
        const endTime = Date.now();
        console.log(`Claude API call took ${endTime - startTime}ms`);
        return response;
      },
      3, // Max 3 retries
      2000 // Base delay of 2 seconds
    );

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

    return result;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    
    // Provide more detailed error messages based on the error type
    const errorMessage = formatErrorMessage(error);
    
    // Log detailed error for debugging
    console.error('Detailed error:', {
      message: errorMessage,
      originalError: error,
      documents: documents.map(doc => typeof doc === 'string' ? 'text document' : `image: ${doc.image.name}`),
      hasImage,
      modelUsed: import.meta.env.VITE_CLAUDE_MODEL || "claude-3-5-haiku-20241022"
    });
    
    throw new Error(errorMessage);
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
