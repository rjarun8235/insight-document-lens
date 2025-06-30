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
    description:string;
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
   * @param extractionResults - An array of extraction results from multiple documents, can include failures.
   * @returns A promise that resolves to a DocumentVerificationReport.
   */
  public async verifyDocuments(
    extractionResults: Array<EnhancedExtractionResult & { fileName: string }>
  ): Promise<DocumentVerificationReport> {
    const startTime = Date.now();
    const successfulExtractions = extractionResults.filter(r => r.success && r.data);

    if (successfulExtractions.length < 2) {
      throw new Error('At least two documents must be successfully extracted to run verification.');
    }

    const prompt = this.buildVerificationPrompt(successfulExtractions);

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
        let errorBody = 'Could not parse error response.';
        try {
            errorBody = await response.json();
        } catch (e) {
            // Ignore if response is not JSON
        }
        throw new Error(`API Error (${response.status}): ${JSON.stringify(errorBody)}`);
      }

      const result = await response.json();
      const llmResponseText = result.content?.[0]?.text;

      if (!llmResponseText) {
          throw new Error("Received an empty or invalid response from the LLM API.");
      }

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
   * Constructs the prompt to send to the LLM for document verification.
   * @param successfulExtractionResults - The array of successfully extracted document data.
   * @returns A string containing the full prompt.
   */
  private buildVerificationPrompt(successfulExtractionResults: Array<EnhancedExtractionResult & { fileName: string }>): string {
    const documentsData = successfulExtractionResults
      .map(
        (result) => {
            // Defensive coding to prevent type errors
            const docType = result.data?.metadata?.documentType || 'unknown';
            const confidence = (result.data?.metadata?.extractionConfidence ?? 0).toFixed(2);
            const data = JSON.stringify(result.data ?? {}, null, 2);

            return `
<document>
  <fileName>${result.fileName}</fileName>
  <documentType>${docType}</documentType>
  <extractionConfidence>${confidence}</extractionConfidence>
  <extractedData>
    ${data}
  </extractedData>
</document>
`;
        }
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
    documents: Array<EnhancedExtractionResult & { fileName: string }>
    ) => {
    // This check is now inside the service, but it's good to have it here too to prevent unnecessary state updates.
    const successfulDocs = documents.filter(d => d.success && d.data);
    if (successfulDocs.length < 2) {
      // Don't set an error here, the UI component will handle the "not enough docs" state.
      return;
    }

    setIsVerifying(true);
    setVerificationReport(null);
    setVerificationError(null);

    try {
      const report = await verificationService.verifyDocuments(documents);
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
