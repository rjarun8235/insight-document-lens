
import Anthropic from '@anthropic-ai/sdk';
import { ComparisonResult, DocumentFile } from '@/lib/types';

// Helper: convert image file to base64 string
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

// Main analysis function (Anthropic Claude)
export async function analyzeDocuments(
  documents: (string | { image: File, text?: string })[], 
  instruction: string
): Promise<ComparisonResult> {
  // Initialize Anthropic SDK (API key must be set via secrets or process.env)
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY || ''; // Consider using Supabase Edge secrets if needed.
  if (!apiKey) throw new Error('Anthropic API key is missing.');

  const anthropic = new Anthropic({ apiKey });

  // Compose content for multimodal (text + image) if any image exists
  let hasImage = documents.some(doc => typeof doc === 'object');
  let messages: any[] = [];

  if (hasImage) {
    // Compose content array with image and text
    messages = [
      {
        role: "user",
        content: await Promise.all(documents.map(async doc => {
          if (typeof doc === 'string') {
            // Text doc (parsed text of non-image file)
            return {
              type: "text",
              text: doc
            };
          } else {
            // Image document
            const { base64, mediaType } = await fileToBase64(doc.image);
            let arr: any[] = [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64,
                }
              }
            ];
            // Optionally add associated OCR text if present (rare), or leave as just image
            if (doc.text) arr.push({ type: "text", text: doc.text });
            return arr;
          }
        })).then(parts => parts.flat().concat({type: "text", text: instruction}))
      }
    ];
  } else {
    // All text docs: concatenate + add instruction as final message
    messages = [{
      role: "user",
      content: [
        ...documents.map(doc => ({
          type: "text",
          text: typeof doc === "string" ? doc : doc.text || ''
        })),
        { type: "text", text: instruction }
      ]
    }];
  }

  // Call Anthropic Claude
  const response = await anthropic.messages.create({
    model: "claude-3-5-haiku-20241022", // Update as model version needed
    max_tokens: 5000,
    messages,
  });

  // You'd normally parse 'response' to create a ComparisonResult, for now simulate
  // Placeholder: Return mock result until wiring up full Claude JSON downstream
  // (TODO: parse response content as needed)
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

// Enhanced instruction builder with logistics-specifics
export function prepareInstructions(comparisonType: string): string {
  const baseInstruction = `
  Carefully analyze and compare the uploaded documents. 
  Output should include:
  1. Table with compared values & sections (especially those relevant for logistics documents)
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

  // Add packing/invoice/bill-of-entry specific instructions
  const specific: Record<string, string> = {
    'packing-list':
      "Focus on items, quantities, weight, packaging type, consignee/consignor, shipment IDs, and dates.",
    'invoice':
      "Focus on invoice numbers, shipment details, item prices, taxes, totals, and currency.",
    'bill-of-entry':
      "Focus on customs details, HS codes, duties, declared goods, shipper/receiver, and regulatory fields.",
    // Add fallback for previous types too
    'contracts': "Focus on parties, terms, financials, and validity dates.",
    'invoices': "Extract invoice numbers, dates, items, quantity, price, taxes, total.",
    'resumes': "Compare skills, roles, education, relevant dates.",
    'reports': "Compare key findings, sections, metrics."
  };

  // Try logistic type, then previous types, else default
  const logiKey = comparisonType.toLowerCase().replace(/\s+/g, '-');
  return baseInstruction + (specific[logiKey] || '');
}

