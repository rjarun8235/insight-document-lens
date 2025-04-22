
import axios from 'axios';
import { ComparisonResult } from '@/lib/types';

// This is a placeholder for the Claude API integration
// In production, you would use the actual Claude API endpoints and authentication

export async function analyzeDocuments(
  documents: string[], 
  instruction: string
): Promise<ComparisonResult> {
  // In production, this would make an actual API call to Claude
  // For now, we'll simulate a response
  
  console.log('Analyzing documents:', documents.length);
  console.log('Instruction:', instruction);
  
  // This would be replaced with an actual API call
  // const response = await axios.post('https://api.claude.ai/analyze', {
  //   documents,
  //   instruction
  // });
  
  // Simulated response
  return {
    tables: [
      {
        title: 'Document Comparison',
        headers: ['Property', 'Document 1', 'Document 2'],
        rows: [
          ['Date', '2023-04-15', '2023-04-16'],
          ['Author', 'John Doe', 'Jane Smith'],
          ['Total Amount', '$10,000', '$12,500'],
          ['Status', 'Approved', 'Pending'],
        ]
      }
    ],
    verification: 'The documents appear to be authentic with valid signatures and timestamps.',
    validation: 'All required fields are present in both documents with appropriate formatting.',
    review: 'Both documents follow the standard template with minor differences in content.',
    analysis: 'The second document contains a 25% higher total amount and is still pending approval.',
    summary: 'These are similar contract documents with different dates, authors, amounts, and approval statuses.',
    insights: 'The increase in amount may be due to additional services included in the second document.',
    recommendations: 'Verify the reason for the increased amount in Document 2 before approval.',
    risks: 'The pending status of Document 2 may delay the project timeline if not addressed promptly.',
    issues: 'The difference in amounts needs reconciliation to ensure budget compliance.'
  };
}

// Function to prepare instructions for Claude based on the comparison type
export function prepareInstructions(comparisonType: string): string {
  const baseInstruction = `
  Please analyze the provided documents and compare them. 
  Generate structured output with the following sections:
  
  1. Tables with key value comparisons
  2. Verification
  3. Validation
  4. Review
  5. Analysis
  6. Summary
  7. Insights
  8. Recommendations
  9. Risks
  10. Issues
  
  For the tables section, extract important values from all documents that should be compared side by side.
  `;
  
  const specificInstructions = {
    contracts: 'Focus on parties involved, dates, terms, conditions, and financial details.',
    invoices: 'Focus on invoice numbers, dates, items, quantities, prices, taxes, and totals.',
    resumes: 'Focus on skills, experience, education, and qualifications.',
    reports: 'Focus on key findings, metrics, trends, and conclusions.'
  };
  
  return baseInstruction + (specificInstructions[comparisonType as keyof typeof specificInstructions] || '');
}
