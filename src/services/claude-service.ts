
import Anthropic from '@anthropic-ai/sdk';
import { ComparisonResult, ComparisonTable } from '@/lib/types';

// Helper to convert a File object (image) to base64 and media type
async function fileToBase64(file: File): Promise<{base64: string, mediaType: string}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = function () {
      const base64 = (reader.result as string).split(',')[1];
      resolve({
        base64,
        mediaType: file.type || 'image/jpeg'
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

  const anthropic = new Anthropic({ apiKey });

  // Compose multi-modal content for Claude (for text + image docs)
  let hasImage = documents.some(doc => typeof doc === 'object');
  let systemContent: any[] = [];
  let userContent: any[] = [];

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
        }
      })
    );

    // Put document content in system message for caching
    // and instruction in user message
    systemContent = multimodalContent.flat();
    userContent = [{ type: "text", text: instruction }];
  } else {
    // Text-only case - put documents in system message for caching
    systemContent = documents.map(doc => ({
      type: "text",
      text: typeof doc === "string" ? doc : (doc.text || ''),
      ...(useCache && { cache_control: { type: "ephemeral" } })
    }));

    // Put instruction in user message
    userContent = [{ type: "text", text: instruction }];
  }

  try {
    // Get Claude model from environment variables or use default
    const claudeModel = import.meta.env.VITE_CLAUDE_MODEL || "claude-3-5-haiku-20241022";

    // Create system message with document content and instructions
    const systemMessage = `You are an expert document analyzer. Analyze the provided documents and extract key information.

      IMPORTANT GUIDELINES:
      - If you're unsure about any information or can't find it in the documents, explicitly state "I don't have enough information to determine this" rather than making assumptions.
      - Always ground your analysis in the actual content of the documents. Use direct quotes when possible.
      - Only make claims that are directly supported by the documents.
      - For each section of your analysis, first extract relevant quotes from the documents, then base your analysis on those quotes.

      Format your response as follows:
      1. First, create a structured comparison table with key fields from the documents
      2. Then provide sections for: verification, validation, review, analysis, summary, insights, recommendations, risks, and issues

      Use markdown tables for the comparison data. Make sure to include all important fields from the documents.

      For each section, follow this structure:
      <section_name>Verification/Validation/etc.</section_name>
      <quotes>
      - Quote 1 from document
      - Quote 2 from document
      </quotes>
      <analysis>
      Your analysis based strictly on the quotes
      </analysis>`;

    // Claude API call with structured output format and caching
    const response = await anthropic.messages.create({
      model: claudeModel,
      max_tokens: 5000,
      system: [
        { type: "text", text: systemMessage },
        ...systemContent
      ],
      messages: [
        {
          role: "user",
          content: userContent
        }
      ]
    });

    // Log token usage to see cache effectiveness
    console.log('Token usage:', response.usage);

    // Get the response text
    const responseText = response.content[0].text;

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

    // Extract sections using the structured format
    const sections = [
      { key: 'verification', regex: /<section_name>Verification<\/section_name>[\s\S]*?<quotes>([\s\S]*?)<\/quotes>[\s\S]*?<analysis>([\s\S]*?)<\/analysis>/i },
      { key: 'validation', regex: /<section_name>Validation<\/section_name>[\s\S]*?<quotes>([\s\S]*?)<\/quotes>[\s\S]*?<analysis>([\s\S]*?)<\/analysis>/i },
      { key: 'review', regex: /<section_name>Review<\/section_name>[\s\S]*?<quotes>([\s\S]*?)<\/quotes>[\s\S]*?<analysis>([\s\S]*?)<\/analysis>/i },
      { key: 'analysis', regex: /<section_name>Analysis<\/section_name>[\s\S]*?<quotes>([\s\S]*?)<\/quotes>[\s\S]*?<analysis>([\s\S]*?)<\/analysis>/i },
      { key: 'summary', regex: /<section_name>Summary<\/section_name>[\s\S]*?<quotes>([\s\S]*?)<\/quotes>[\s\S]*?<analysis>([\s\S]*?)<\/analysis>/i },
      { key: 'insights', regex: /<section_name>Insights<\/section_name>[\s\S]*?<quotes>([\s\S]*?)<\/quotes>[\s\S]*?<analysis>([\s\S]*?)<\/analysis>/i },
      { key: 'recommendations', regex: /<section_name>Recommendations<\/section_name>[\s\S]*?<quotes>([\s\S]*?)<\/quotes>[\s\S]*?<analysis>([\s\S]*?)<\/analysis>/i },
      { key: 'risks', regex: /<section_name>Risks<\/section_name>[\s\S]*?<quotes>([\s\S]*?)<\/quotes>[\s\S]*?<analysis>([\s\S]*?)<\/analysis>/i },
      { key: 'issues', regex: /<section_name>Issues<\/section_name>[\s\S]*?<quotes>([\s\S]*?)<\/quotes>[\s\S]*?<analysis>([\s\S]*?)<\/analysis>/i }
    ];

    // Also try the old format as fallback
    const fallbackSections = [
      { key: 'verification', regex: /verification[:\s]+(.*?)(?=\n\s*\n|\n\s*#|$)/is },
      { key: 'validation', regex: /validation[:\s]+(.*?)(?=\n\s*\n|\n\s*#|$)/is },
      { key: 'review', regex: /review[:\s]+(.*?)(?=\n\s*\n|\n\s*#|$)/is },
      { key: 'analysis', regex: /analysis[:\s]+(.*?)(?=\n\s*\n|\n\s*#|$)/is },
      { key: 'summary', regex: /summary[:\s]+(.*?)(?=\n\s*\n|\n\s*#|$)/is },
      { key: 'insights', regex: /insights[:\s]+(.*?)(?=\n\s*\n|\n\s*#|$)/is },
      { key: 'recommendations', regex: /recommendations[:\s]+(.*?)(?=\n\s*\n|\n\s*#|$)/is },
      { key: 'risks', regex: /risks[:\s]+(.*?)(?=\n\s*\n|\n\s*#|$)/is },
      { key: 'issues', regex: /issues[:\s]+(.*?)(?=\n\s*\n|\n\s*#|$)/is }
    ];

    sections.forEach(section => {
      const match = responseText.match(section.regex);
      if (match && match[2]) {
        // Include both quotes and analysis in the result
        result[section.key] = `Quotes:\n${match[1].trim()}\n\nAnalysis:\n${match[2].trim()}`;
      } else {
        // Try fallback format
        const fallbackRegex = fallbackSections.find(s => s.key === section.key)?.regex;
        const fallbackMatch = fallbackRegex ? responseText.match(fallbackRegex) : null;
        if (fallbackMatch && fallbackMatch[1]) {
          result[section.key] = fallbackMatch[1].trim();
        } else {
          // Default values if section not found
          result[section.key] = `No ${section.key} information provided.`;
        }
      }
    });

    return result;
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw new Error('Failed to analyze documents with Claude AI. Please try again.');
  }
}

// Instruction builder for various doc types (esp. logistics: packing-list, invoice, bill-of-entry)
export function prepareInstructions(comparisonType: string): string {
  const baseInstruction = `
Carefully analyze and compare the uploaded documents.

Output should include:
1. Table with compared values & sections (especially those relevant for logistics/forwarding)
2. Verification - Verify if the documents are consistent with each other
3. Validation - Validate if the documents meet standard requirements
4. Review - Provide a detailed review of the documents
5. Analysis - Analyze the content and identify patterns or discrepancies
6. Summary - Summarize the key points from all documents
7. Insights - Provide insights that might not be immediately obvious
8. Recommendations - Suggest actions based on the document analysis
9. Risks - Identify potential risks or issues
10. Issues - List any problems found in the documents

For tables, extract and compare all major values (dates, IDs, totals, etc). Make sure to align corresponding fields from different documents.

IMPORTANT: For each section, follow this exact structure to ensure consistency:
<section_name>Verification</section_name>
<quotes>
- Quote 1 from document
- Quote 2 from document
</quotes>
<analysis>
Your analysis based strictly on the quotes
</analysis>

This structure must be followed for each section to ensure proper parsing of your response.
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

