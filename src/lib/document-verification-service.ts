import { useState } from 'react';
import { EnhancedExtractionResult } from './LLMExtractionService';

// ===== INTERFACES FOR VERIFICATION REPORT =====

/**
 * Defines the structured response for the document verification report.
 */
export interface DocumentVerificationReport {
  summary: {
    shipmentIdentifier: string;
    documentCount: number;
    documentTypes: string[];
    consistencyScore: number; // 0.0 to 1.0
    riskAssessment: 'low' | 'medium' | 'high';
    expertSummary: string;
  };
  discrepancies: Array<{
    fieldName: string;
    category: 'critical' | 'important' | 'minor';
    impact: string;
    documents: Array<{
      documentName: string;
      value: string;
    }>;
    recommendation: string;
  }>;
  insights: Array<{
    title: string;
    description: string;
    category: 'compliance' | 'operational' | 'financial' | 'customs';
    severity: 'info' | 'warning' | 'critical';
  }>;
  recommendations: Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    reasoning: string;
  }>;
  metadata: {
    analysisTimestamp: string;
    processingTime: number;
  };
}


// ===== DOCUMENT VERIFICATION SERVICE =====

export class DocumentVerificationService {
  private claudeProxyUrl: string;

  constructor(claudeProxyUrl: string = 'https://cbrgpzdxttzlvvryysaf.supabase.co/functions/v1/claude-api-proxy') {
    this.claudeProxyUrl = claudeProxyUrl;
  }

  /**
   * Analyzes multiple document extraction payloads and generates a comprehensive verification report.
   * @param extractionResults - An array of extraction results from multiple documents.
   * @param useMockData - If true, returns mock data instead of calling the API.
   * @returns A promise that resolves to a DocumentVerificationReport.
   */
  public async verifyDocuments(
    extractionResults: Array<EnhancedExtractionResult & { fileName: string }>,
    useMockData: boolean = false
  ): Promise<DocumentVerificationReport> {
    const startTime = Date.now();

    if (useMockData) {
      console.log(" MOCK MODE: Using mock data for verification report.");
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.generateMockVerificationReport(extractionResults);
    }

    if (extractionResults.length < 2) {
      throw new Error('At least two documents are required for verification.');
    }

    const prompt = this.buildVerificationPrompt(extractionResults);

    try {
      const response = await fetch(`${this.claudeProxyUrl}/extraction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      const llmResponseText = result.content[0].text;
      const cleanedJson = this.cleanJsonResponse(llmResponseText);
      const verificationReport = JSON.parse(cleanedJson) as DocumentVerificationReport;

      // Add processing time to the report metadata
      verificationReport.metadata.processingTime = (Date.now() - startTime) / 1000;
      verificationReport.metadata.analysisTimestamp = new Date().toISOString();

      return verificationReport;

    } catch (error) {
      console.error('Document verification failed:', error);
      throw new Error(`Failed to verify documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generates a realistic mock verification report for testing and demonstration.
   * @param extractionResults - The array of document extraction data to make the mock report relevant.
   * @returns A mock DocumentVerificationReport object.
   */
  private generateMockVerificationReport(
    extractionResults: Array<EnhancedExtractionResult & { fileName: string }>
  ): DocumentVerificationReport {
    const docNames = extractionResults.map(d => d.fileName);
    const docTypes = [...new Set(extractionResults.map(d => d.data?.metadata.documentType || 'unknown'))];

    return {
      summary: {
        shipmentIdentifier: "AWB 098-80828764",
        documentCount: extractionResults.length,
        documentTypes: docTypes,
        consistencyScore: 0.65,
        riskAssessment: 'high',
        expertSummary: "This shipment has multiple critical discrepancies, including a mismatch in HSN codes and package counts. This poses a high risk for customs delays and potential fines. Immediate manual review and correction are required before proceeding.",
      },
      discrepancies: [
        {
          fieldName: "HSN Code",
          category: 'critical',
          impact: "Incorrect customs duties will be applied, leading to penalties and shipment delays.",
          documents: [
            { documentName: docNames.find(n => n.includes('SKI.xls')) || docNames[0], value: "73201019" },
            { documentName: docNames.find(n => n.includes('Xerox')) || docNames[1], value: "73261990" },
          ],
          recommendation: "Verify the correct HSN code with the engineering/product team and update all documents to match.",
        },
        {
          fieldName: "Package Count",
          category: 'important',
          impact: "Mismatch can lead to confusion at receiving, and suggests part of the shipment may be missing or incorrectly documented.",
          documents: [
             { documentName: docNames.find(n => n.includes('HAWB')) || docNames[0], value: "2" },
             { documentName: docNames.find(n => n.includes('Xerox')) || docNames[2], value: "4" },
          ],
          recommendation: "Physically count the packages and amend the documentation to reflect the actual count.",
        },
        {
          fieldName: "Shipper Address",
          category: 'minor',
          impact: "Minor risk of confusion, but could delay courier or official correspondence.",
          documents: [
            { documentName: docNames[0], value: "LOWER MIDLETON STREET" },
            { documentName: docNames[1], value: "LOWER MIDDLETON STREET" },
          ],
          recommendation: "Standardize address across all templates for future shipments. No immediate action required for this shipment.",
        },
      ],
      insights: [
        {
          title: "Customs Compliance Risk",
          description: "The HSN code discrepancy is a major red flag for customs authorities and will likely trigger an inspection, causing significant delays.",
          category: 'customs',
          severity: 'critical',
        },
        {
          title: "Operational Inefficiency",
          description: "Inconsistent data across documents (e.g., weights, package counts) suggests a lack of process control, which can lead to receiving errors and inventory mismatches.",
          category: 'operational',
          severity: 'warning',
        },
         {
          title: "Financial Inaccuracy",
          description: "The difference in gross weight (36kg vs 37kg) may result in minor discrepancies in freight charges.",
          category: 'financial',
          severity: 'info',
        }
      ],
      recommendations: [
        {
          action: "Immediately correct the HSN code on all relevant documents.",
          priority: 'high',
          reasoning: "To avoid customs penalties and delays, which is the most significant risk.",
        },
        {
          action: "Verify the physical package count against all documents.",
          priority: 'medium',
          reasoning: "To ensure the full shipment is accounted for before it leaves the facility.",
        },
        {
          action: "Update internal templates with standardized shipper/consignee information.",
          priority: 'low',
          reasoning: "To prevent minor data entry errors in future shipments.",
        },
      ],
      metadata: {
        analysisTimestamp: new Date().toISOString(),
        processingTime: 1.23, // Mock processing time
      },
    };
  }

  /**
   * Constructs the prompt to send to the LLM for document verification.
   * @param extractionResults - The array of document extraction data.
   * @returns A string containing the full prompt.
   */
  private buildVerificationPrompt(extractionResults: Array<EnhancedExtractionResult & { fileName: string }>): string {
    const documentsData = extractionResults
      .map(
        (result) => `
<document>
  <fileName>${result.fileName}</fileName>
  <documentType>${result.data?.metadata.documentType || 'unknown'}</documentType>
  <extractionConfidence>${result.data?.metadata.extractionConfidence.toFixed(2) || 'N/A'}</extractionConfidence>
  <extractedData>
    ${JSON.stringify(result.data, null, 2)}
  </extractedData>
</document>
`
      )
      .join('');

    const responseSchema = this.getResponseSchema();

    return `
You are an expert logistics and customs compliance officer. Your task is to analyze and verify a set of shipping documents for a single shipment. You will receive extracted data from multiple documents. Your goal is to identify discrepancies, provide expert insights, and generate a structured verification report.

## INSTRUCTIONS:
1.  **Analyze Holistically**: Review all provided documents as a single set for one shipment.
2.  **Identify Discrepancies**: Compare corresponding fields across all documents. Note any mismatches, even minor ones.
3.  **Assess Risk**: Based on the discrepancies, determine an overall risk level for the shipment (low, medium, high).
4.  **Provide Insights**: Offer expert analysis on the potential consequences of the identified issues (e.g., customs delays, financial penalties, operational problems).
5.  **Recommend Actions**: Suggest clear, actionable steps to resolve the discrepancies.
6.  **Summarize Findings**: Write a concise expert summary of the overall document set's quality and readiness.

## CRITICAL AREAS OF FOCUS:
-   **HSN/Commodity Codes**: A mismatch is a critical issue.
-   **Weights & Package Counts**: Inconsistencies can indicate cargo issues.
-   **Shipper/Consignee Details**: Mismatches can cause delivery failures.
-   **Financial Values**: Differences in invoice amounts or currencies affect customs duties.
-   **Reference Numbers**: Ensure key identifiers like AWB, HAWB, and Invoice numbers are consistent.
-   **Dates**: Check for logical sequences (e.g., invoice date before ship date).

## DOCUMENTS FOR ANALYSIS:
${documentsData}

## REQUIRED OUTPUT FORMAT:
You MUST return ONLY a single, valid JSON object that strictly adheres to the following schema. Do not include any text, explanations, or markdown formatting before or after the JSON object.

\`\`\`json
${JSON.stringify(responseSchema, null, 2)}
\`\`\`
`;
  }

  /**
   * Defines the JSON schema for the expected response from the LLM.
   * @returns A template object representing the JSON schema.
   */
  private getResponseSchema(): any {
    return {
      summary: {
        shipmentIdentifier: "string (e.g., AWB or Invoice Number)",
        documentCount: "number",
        documentTypes: ["string"],
        consistencyScore: "number (0.0 to 1.0)",
        riskAssessment: "string ('low', 'medium', or 'high')",
        expertSummary: "string (A brief, expert analysis of the document set's overall status)",
      },
      discrepancies: [
        {
          fieldName: "string (e.g., 'grossWeight')",
          category: "string ('critical', 'important', or 'minor')",
          impact: "string (Potential business impact of the discrepancy)",
          documents: [
            {
              documentName: "string (filename)",
              value: "string (the discrepant value)",
            },
          ],
          recommendation: "string (Actionable advice to resolve the issue)",
        },
      ],
      insights: [
        {
          title: "string (A short title for the insight)",
          description: "string (Detailed explanation of the insight)",
          category: "string ('compliance', 'operational', 'financial', 'customs')",
          severity: "string ('info', 'warning', 'critical')",
        },
      ],
      recommendations: [
        {
          action: "string (A specific, actionable task)",
          priority: "string ('high', 'medium', 'low')",
          reasoning: "string (Why this action is necessary)",
        },
      ],
      metadata: {
        analysisTimestamp: "string (ISO 8601 format)",
        processingTime: "number (in seconds)",
      },
    };
  }

  /**
   * Cleans the raw text response from the LLM to ensure it's valid JSON.
   * @param response - The raw string from the LLM.
   * @returns A cleaned string that should be valid JSON.
   */
  private cleanJsonResponse(response: string): string {
    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No valid JSON object found in the LLM response.');
    }
    const jsonPart = response.substring(firstBrace, lastBrace + 1);
    return jsonPart.replace(/```json|```/g, '').trim();
  }
}


// ===== REACT HOOK FOR DOCUMENT VERIFICATION =====

/**
 * A React hook to manage the state and logic for document verification.
 */
export const useDocumentVerification = () => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationReport, setVerificationReport] = useState<DocumentVerificationReport | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const verificationService = new DocumentVerificationService();

  const verifyDocuments = async (
    documents: Array<EnhancedExtractionResult & { fileName: string }>,
    options: { useMockData?: boolean } = {}
    ) => {
    if (documents.length < 2) {
      setVerificationError("At least two documents are needed for verification.");
      return;
    }

    setIsVerifying(true);
    setVerificationReport(null);
    setVerificationError(null);

    try {
      const report = await verificationService.verifyDocuments(documents, options.useMockData);
      setVerificationReport(report);
    } catch (error) {
      setVerificationError(error instanceof Error ? error.message : "An unknown error occurred during verification.");
    } finally {
      setIsVerifying(false);
    }
  };

  return {
    isVerifying,
    verificationReport,
    verificationError,
    verifyDocuments,
  };
};
