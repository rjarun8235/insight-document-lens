
import Anthropic from '@anthropic-ai/sdk';
import { ComparisonResult, DocumentFile } from '@/lib/types';

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
  instruction: string
): Promise<ComparisonResult> {
  // Get Claude API Key
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
  if (!apiKey) throw new Error('Anthropic API key is missing.');

  const anthropic = new Anthropic({ apiKey });

  // Compose multi-modal content for Claude (for text + image docs)
  let hasImage = documents.some(doc => typeof doc === 'object');
  let messages: any[] = [];

  if (hasImage) {
    // Images + Text: each "doc" is either a string or { image, text? }
    // Structure per Claude's vision/multimodal API
    const multimodalContent = await Promise.all(
      documents.map(async doc => {
        if (typeof doc === 'string') {
          // Just text (parsed contents of PDF, Word, etc)
          return { type: "text", text: doc };
        } else {
          // Image (with base64)
          const { base64, mediaType } = await fileToBase64(doc.image);
          const contentArray = [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            }
          ];
          // Add associated OCR text (if present from front-end parser)
          if (doc.text) {
            contentArray.push({ type: "text", text: doc.text });
          }
          return contentArray;
        }
      })
    );

    // Flatten and append the instruction for comparison/analysis 
    messages = [
      {
        role: "user",
        content: multimodalContent.flat().concat({ type: "text", text: instruction })
      }
    ];
  } else {
    // Text-only case
    messages = [{
      role: "user",
      content: [
        ...documents.map(doc => ({
          type: "text",
          text: typeof doc === "string" ? doc : (doc.text || '')
        })),
        { type: "text", text: instruction }
      ]
    }];
  }

  // Claude API call
  const response = await anthropic.messages.create({
    model: "claude-3-5-haiku-20241022",
    max_tokens: 5000,
    messages,
  });

  // Placeholder: Parse Claude's response structure as desired
  return {
    tables: [
      {
        title: 'Document Comparison',
        headers: ['Section', 'Doc 1', 'Doc 2'],
        rows: [
          ['Date', '2024-01-01', '2024-02-02'],
          ['Shipment ID', 'ABC123', 'XYZ789'],
          ['Value', '$100', '$212'],
        ]
      }
    ],
    verification: "Verified sample.",
    validation: "Validation passed.",
    review: "Reviewed sample output.",
    analysis: "Analysis would appear here.",
    summary: "Summary from Claude output.",
    insights: "Insights appear.",
    recommendations: "Recommendations go here.",
    risks: "Risks from AI.",
    issues: "Issues listed here."
  };
}

// Instruction builder for various doc types (esp. logistics: packing-list, invoice, bill-of-entry)
export function prepareInstructions(comparisonType: string): string {
  const baseInstruction = `
Carefully analyze and compare the uploaded documents.
Output should include:
1. Table with compared values & sections (especially those relevant for logistics/forwarding)
2. Verification
3. Validation
4. Review
5. Analysis
6. Summary
7. Insights
8. Recommendations
9. Risks
10. Issues

For tables, extract and compare all major values (dates, IDs, totals, etc).
`;

  // Specific details for the key logistics activities
  const specific: Record<string, string> = {
    'packing-list':
      "Focus on items, quantities, weight, packaging type, consignee/consignor, shipment IDs, and dates.",
    'invoice':
      "Focus on invoice numbers, shipment details, item prices, taxes, totals, and currency.",
    'bill-of-entry':
      "Focus on customs details, HS codes, duties, declared goods, shipper/receiver, and regulatory fields.",
    // Older/fallback types for general apps
    'contracts': "Focus on parties, terms, financials, and validity dates.",
    'invoices': "Extract invoice numbers, dates, items, quantity, price, taxes, total.",
    'resumes': "Compare skills, roles, education, relevant dates.",
    'reports': "Compare key findings, sections, metrics."
  };

  // Normalize input for matching
  const logiKey = comparisonType.toLowerCase().replace(/\s+/g, '-');
  return baseInstruction + (specific[logiKey] || '');
}

