// Import Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';
import { ComparisonResult, ComparisonTable } from '@/lib/types';
import { fetchApiKeyFromSupabase } from '@/lib/supabase';

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

// Interface for streaming callbacks
export interface StreamCallbacks {
  onStart?: () => void;
  onToken?: (token: string) => void;
  onChunk?: (chunk: string) => void;
  onComplete?: (result: ComparisonResult) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

// Stream Claude analysis with callbacks
export async function streamAnalyzeDocuments(
  documents: (string | { image: File, text?: string })[],
  instruction: string,
  callbacks: StreamCallbacks = {},
  useCache: boolean = true
): Promise<void> {
  try {
    // Start callback if provided
    if (callbacks.onStart) callbacks.onStart();
    
    // Get Claude API Key - first try environment variable
    let apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
    
    // If no API key in environment, try to fetch from Supabase
    if (!apiKey) {
      try {
        apiKey = await fetchApiKeyFromSupabase() || '';
      } catch (fetchError) {
        console.error('Failed to fetch API key:', fetchError);
      }
    }
    
    // Check if we have an API key after all attempts
    if (!apiKey) {
      const error = new Error('Anthropic API key is missing. Please configure it in Supabase or environment variables.');
      if (callbacks.onError) callbacks.onError(error);
      throw error;
    }

    const anthropic = new Anthropic({ 
      apiKey,
      dangerouslyAllowBrowser: true
    });

    // Get Claude model from environment variables or use default
    const claudeModel = import.meta.env.VITE_CLAUDE_MODEL || "claude-3-5-haiku-20241022";

    // Prepare content for Claude API
    let userContent: any[] = [{ type: "text", text: instruction }];

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

    // Prepare document content
    let systemContent: any[] = [];

    // Check if we have images
    const hasImage = documents.some(doc => typeof doc === 'object');

    if (hasImage) {
      // Images + Text: each "doc" is either a string or { image, text? }
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
      systemContent = multimodalContent.flat();
    } else {
      // Text-only case - put documents in system message for caching
      systemContent = documents.map(doc => ({
        type: "text",
        text: typeof doc === "string" ? doc : (doc.text || ''),
        ...(useCache && { cache_control: { type: "ephemeral" } })
      }));
    }

    // Variables to track streaming progress
    let fullResponse = '';
    let tokenCount = 0;
    const estimatedTotalTokens = 3000; // Rough estimate

    // Create a message with streaming
    const messageParams: any = {
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
    };

    // Signal that we're starting to stream
    if (callbacks.onProgress) callbacks.onProgress(5);

    try {
      // Create a streaming response
      // @ts-ignore - Ignore the stream property TypeScript error
      const response = await anthropic.messages.create({
        ...messageParams,
        stream: true
      });

      // Process the stream
      // @ts-ignore - Ignore the async iterator TypeScript error
      for await (const chunk of response) {
        if (chunk.type === 'content_block_delta' && chunk.delta && chunk.delta.text) {
          const token = chunk.delta.text;
          fullResponse += token;
          tokenCount++;

          // Call token callback if provided
          if (callbacks.onToken) callbacks.onToken(token);

          // Accumulate tokens into chunks and call chunk callback
          if (tokenCount % 20 === 0 && callbacks.onChunk) {
            callbacks.onChunk(fullResponse);
          }

          // Update progress (rough estimate)
          if (callbacks.onProgress) {
            const progress = Math.min(Math.round((tokenCount / estimatedTotalTokens) * 100), 99);
            callbacks.onProgress(progress);
          }
        }
      }

      // Final chunk callback with complete response
      if (callbacks.onChunk) callbacks.onChunk(fullResponse);

      // Parse the response to extract tables and sections
      const result = parseClaudeResponse(fullResponse);

      // Call complete callback with parsed result
      if (callbacks.onComplete) {
        callbacks.onComplete(result);
        callbacks.onProgress?.(100);
      }
    } catch (streamError) {
      console.error('Error in streaming:', streamError);
      throw streamError;
    }

  } catch (error) {
    console.error('Error streaming from Claude API:', error);
    if (callbacks.onError) {
      callbacks.onError(error instanceof Error
        ? error
        : new Error('Failed to analyze documents with Claude AI. Please try again.')
      );
    }
  }
}

// Parse Claude's response into structured format
function parseClaudeResponse(responseText: string): ComparisonResult {
  // Initialize result object
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
}

// Re-export the prepareInstructions function from claude-service
export { prepareInstructions } from './claude-service';
