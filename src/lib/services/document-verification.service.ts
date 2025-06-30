/**
 * Document Verification Service
 * 
 * A dedicated service for verifying and comparing documents, generating insights,
 * and identifying discrepancies between related logistics documents.
 * This service is independent of React and UI components, providing a clean
 * interface for document verification operations.
 */

import { ClaudeApiService, ClaudeApiError } from './claude-api.service';
import { EnhancedExtractionResult } from './document-extractor.service';
import { LogisticsDocumentType } from '../document-types';

// ===== INTERFACES =====

/**
 * Represents a document discrepancy
 */
export interface DocumentDiscrepancy {
  fieldName: string;
  category: 'critical' | 'important' | 'minor';
  impact: string;
  documents: Array<{
    documentName: string;
    value: string;
  }>;
  recommendation: string;
}

/**
 * Represents a business insight
 */
export interface BusinessInsight {
  title: string;
  description: string;
  category: 'compliance' | 'operational' | 'financial' | 'customs';
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Represents a business recommendation
 */
export interface BusinessRecommendation {
  action: string;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}

/**
 * Represents a verification report
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
  discrepancies: DocumentDiscrepancy[];
  insights: BusinessInsight[];
  recommendations: BusinessRecommendation[];
  metadata: {
    analysisTimestamp: string;
    processingTime: number;
  };
}

/**
 * Represents a field mapping configuration
 */
interface FieldMapping {
  paths: Record<LogisticsDocumentType, string>;
  category: 'critical' | 'important' | 'minor';
  comparisonType: 'exact' | 'numeric' | 'date' | 'text';
}

/**
 * Represents a field comparison result
 */
interface FieldComparisonResult {
  fieldName: string;
  category: 'critical' | 'important' | 'minor';
  isConsistent: boolean;
  values: Record<string, any>;
  normalizedValues: Record<string, string>;
}

/**
 * Represents verification options
 */
export interface VerificationOptions {
  temperature?: number;
  maxTokens?: number;
  includeRawResponse?: boolean;
  detailedAnalysis?: boolean;
}

/**
 * Service for verifying and comparing documents
 */
export class DocumentVerificationService {
  private claudeApiService: ClaudeApiService;
  private fieldMappings: Record<string, FieldMapping>;
  
  /**
   * Creates a new instance of the DocumentVerificationService
   * 
   * @param claudeApiService - The Claude API service to use
   */
  constructor(claudeApiService?: ClaudeApiService) {
    this.claudeApiService = claudeApiService || new ClaudeApiService();
    this.fieldMappings = this.defineFieldMappings();
  }

  /**
   * Verifies a set of documents and generates a verification report
   * 
   * @param extractionResults - The extraction results to verify
   * @param options - Options for the verification
   * @returns The verification report
   */
  async verifyDocuments(
    extractionResults: EnhancedExtractionResult[],
    options: VerificationOptions = {}
  ): Promise<DocumentVerificationReport> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Verifying ${extractionResults.length} documents...`);
      
      // Filter out failed extractions
      const successfulResults = extractionResults.filter(result => 
        result.success && result.data
      );
      
      if (successfulResults.length === 0) {
        throw new Error('No successful extraction results to verify');
      }
      
      // Get document types
      const documentTypes = successfulResults.map(result => 
        result.documentType || result.data?.metadata?.documentType || 'unknown'
      );
      
      // Compare document fields
      const comparisonResults = this.compareDocumentFields(successfulResults);
      
      // Generate verification report
      const report = await this.generateVerificationReport(
        successfulResults,
        comparisonResults,
        options
      );
      
      // Add metadata
      report.metadata = {
        analysisTimestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };
      
      console.log(`✅ Verification complete for ${extractionResults.length} documents`);
      return report;
      
    } catch (error) {
      console.error(`❌ Verification failed:`, error);
      
      // Create a minimal error report
      return {
        summary: {
          shipmentIdentifier: 'unknown',
          documentCount: extractionResults.length,
          documentTypes: extractionResults.map(r => r.documentType || 'unknown'),
          consistencyScore: 0,
          riskAssessment: 'high',
          expertSummary: `Verification failed: ${error instanceof Error ? error.message : String(error)}`
        },
        discrepancies: [],
        insights: [{
          title: 'Verification Error',
          description: `The verification process encountered an error: ${error instanceof Error ? error.message : String(error)}`,
          category: 'operational',
          severity: 'critical'
        }],
        recommendations: [{
          action: 'Review documents manually and retry verification',
          priority: 'high',
          reasoning: 'Automated verification failed and requires manual intervention'
        }],
        metadata: {
          analysisTimestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Compares fields across documents
   * 
   * @param extractionResults - The extraction results to compare
   * @returns The field comparison results
   */
  private compareDocumentFields(
    extractionResults: EnhancedExtractionResult[]
  ): FieldComparisonResult[] {
    const results: FieldComparisonResult[] = [];
    
    // For each field mapping
    Object.entries(this.fieldMappings).forEach(([fieldName, mapping]) => {
      const fieldValues: Record<string, any> = {};
      const normalizedValues: Record<string, string> = {};
      
      // For each document
      extractionResults.forEach(result => {
        if (!result.success || !result.data || !result.fileName) return;
        
        const documentType = result.documentType || 
                            result.data.metadata?.documentType || 
                            'unknown';
        
        // Skip if document type is not in mapping
        if (!mapping.paths[documentType]) return;
        
        // Get field path for this document type
        const fieldPath = mapping.paths[documentType];
        
        // Extract value using field path
        const value = this.getValueByPath(result.data, fieldPath);
        
        if (value !== undefined && value !== null) {
          fieldValues[result.fileName] = value;
          normalizedValues[result.fileName] = this.normalizeValueForComparison(value, mapping.comparisonType);
        }
      });
      
      // Skip if less than 2 documents have this field
      if (Object.keys(fieldValues).length < 2) return;
      
      // Check consistency
      const uniqueNormalizedValues = new Set(Object.values(normalizedValues));
      const isConsistent = uniqueNormalizedValues.size === 1;
      
      results.push({
        fieldName,
        category: mapping.category,
        isConsistent,
        values: fieldValues,
        normalizedValues
      });
    });
    
    return results;
  }

  /**
   * Generates a verification report
   * 
   * @param extractionResults - The extraction results
   * @param comparisonResults - The field comparison results
   * @param options - Options for the verification
   * @returns The verification report
   */
  private async generateVerificationReport(
    extractionResults: EnhancedExtractionResult[],
    comparisonResults: FieldComparisonResult[],
    options: VerificationOptions
  ): Promise<DocumentVerificationReport> {
    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(comparisonResults);
    
    // Determine risk assessment
    const riskAssessment = this.determineRiskAssessment(consistencyScore, comparisonResults);
    
    // Get shipment identifier
    const shipmentIdentifier = this.extractShipmentIdentifier(extractionResults);
    
    // Get document types
    const documentTypes = extractionResults.map(result => 
      result.documentType || result.data?.metadata?.documentType || 'unknown'
    );
    
    // Generate discrepancies
    const discrepancies = this.generateDiscrepancies(comparisonResults);
    
    // If detailed analysis is requested, use Claude for enhanced insights
    let insights: BusinessInsight[] = [];
    let recommendations: BusinessRecommendation[] = [];
    let expertSummary = '';
    
    if (options.detailedAnalysis) {
      const enhancedAnalysis = await this.generateEnhancedAnalysis(
        extractionResults,
        comparisonResults,
        options
      );
      
      insights = enhancedAnalysis.insights;
      recommendations = enhancedAnalysis.recommendations;
      expertSummary = enhancedAnalysis.expertSummary;
    } else {
      // Generate basic insights and recommendations
      insights = this.generateBasicInsights(comparisonResults, extractionResults);
      recommendations = this.generateBasicRecommendations(comparisonResults, extractionResults);
      expertSummary = this.generateBasicSummary(
        consistencyScore,
        riskAssessment,
        discrepancies.length
      );
    }
    
    return {
      summary: {
        shipmentIdentifier,
        documentCount: extractionResults.length,
        documentTypes,
        consistencyScore,
        riskAssessment,
        expertSummary
      },
      discrepancies,
      insights,
      recommendations,
      metadata: {
        analysisTimestamp: new Date().toISOString(),
        processingTime: 0 // Will be updated later
      }
    };
  }

  /**
   * Generates enhanced analysis using Claude
   * 
   * @param extractionResults - The extraction results
   * @param comparisonResults - The field comparison results
   * @param options - Options for the verification
   * @returns The enhanced analysis
   */
  private async generateEnhancedAnalysis(
    extractionResults: EnhancedExtractionResult[],
    comparisonResults: FieldComparisonResult[],
    options: VerificationOptions
  ): Promise<{
    insights: BusinessInsight[];
    recommendations: BusinessRecommendation[];
    expertSummary: string;
  }> {
    try {
      // Prepare data for Claude
      const documentsData = extractionResults.map(result => ({
        fileName: result.fileName,
        documentType: result.documentType || result.data?.metadata?.documentType || 'unknown',
        data: result.data
      }));
      
      const discrepanciesData = comparisonResults
        .filter(result => !result.isConsistent)
        .map(result => ({
          fieldName: result.fieldName,
          category: result.category,
          values: result.values
        }));
      
      // Build prompt for Claude
      const prompt = `
You are an expert logistics document analyst. Analyze the following logistics documents and their discrepancies to provide business insights and recommendations.

DOCUMENTS:
${JSON.stringify(documentsData, null, 2)}

DISCREPANCIES:
${JSON.stringify(discrepanciesData, null, 2)}

INSTRUCTIONS:
1. Analyze the documents and discrepancies.
2. Provide a concise expert summary of the overall situation.
3. Identify key business insights related to compliance, operational, financial, or customs issues.
4. Provide actionable recommendations with priorities.
5. Format your response as a valid JSON object with the following structure:

{
  "expertSummary": "A concise summary of the overall situation",
  "insights": [
    {
      "title": "Insight title",
      "description": "Detailed description",
      "category": "compliance|operational|financial|customs",
      "severity": "info|warning|critical"
    }
  ],
  "recommendations": [
    {
      "action": "Specific action to take",
      "priority": "high|medium|low",
      "reasoning": "Why this action is important"
    }
  ]
}
`;
      
      // Send prompt to Claude
      const claudeResponse = await this.claudeApiService.sendVerificationRequest(
        prompt,
        {
          temperature: options.temperature || 0.2,
          max_tokens: options.maxTokens || 4000
        }
      );
      
      // Extract and parse the response
      const responseText = this.claudeApiService.extractTextContent(claudeResponse);
      
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                        responseText.match(/```\n([\s\S]*?)\n```/) ||
                        responseText.match(/{[\s\S]*}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in the Claude response');
      }
      
      const jsonContent = jsonMatch[0].startsWith('{') ? jsonMatch[0] : jsonMatch[1];
      const analysisResult = JSON.parse(jsonContent);
      
      return {
        insights: analysisResult.insights || [],
        recommendations: analysisResult.recommendations || [],
        expertSummary: analysisResult.expertSummary || 'Analysis completed'
      };
      
    } catch (error) {
      console.error('Enhanced analysis failed:', error);
      
      // Return basic analysis as fallback
      return {
        insights: this.generateBasicInsights(comparisonResults, extractionResults),
        recommendations: this.generateBasicRecommendations(comparisonResults, extractionResults),
        expertSummary: `Analysis attempted but encountered an error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Generates basic insights
   * 
   * @param comparisonResults - The field comparison results
   * @param extractionResults - The extraction results
   * @returns The basic insights
   */
  private generateBasicInsights(
    comparisonResults: FieldComparisonResult[],
    extractionResults: EnhancedExtractionResult[]
  ): BusinessInsight[] {
    const insights: BusinessInsight[] = [];
    
    // Count inconsistent critical fields
    const criticalDiscrepancies = comparisonResults.filter(
      result => !result.isConsistent && result.category === 'critical'
    );
    
    if (criticalDiscrepancies.length > 0) {
      insights.push({
        title: 'Critical Discrepancies Detected',
        description: `Found ${criticalDiscrepancies.length} critical discrepancies between documents that require immediate attention.`,
        category: 'compliance',
        severity: 'critical'
      });
    }
    
    // Check for missing documents
    const documentTypes = new Set(extractionResults.map(
      result => result.documentType || result.data?.metadata?.documentType || 'unknown'
    ));
    
    const essentialDocuments: LogisticsDocumentType[] = [
      'invoice', 'air_waybill', 'packing_list'
    ];
    
    const missingEssentialDocs = essentialDocuments.filter(
      docType => !documentTypes.has(docType)
    );
    
    if (missingEssentialDocs.length > 0) {
      insights.push({
        title: 'Missing Essential Documents',
        description: `The shipment is missing essential documents: ${missingEssentialDocs.join(', ')}.`,
        category: 'operational',
        severity: 'warning'
      });
    }
    
    // Check for financial discrepancies
    const financialFields = comparisonResults.filter(
      result => !result.isConsistent && 
      (result.fieldName.includes('amount') || 
       result.fieldName.includes('value') || 
       result.fieldName.includes('price') ||
       result.fieldName.includes('total'))
    );
    
    if (financialFields.length > 0) {
      insights.push({
        title: 'Financial Value Discrepancies',
        description: 'There are inconsistencies in financial values across documents which may affect customs valuation.',
        category: 'financial',
        severity: 'warning'
      });
    }
    
    return insights;
  }

  /**
   * Generates basic recommendations
   * 
   * @param comparisonResults - The field comparison results
   * @param extractionResults - The extraction results
   * @returns The basic recommendations
   */
  private generateBasicRecommendations(
    comparisonResults: FieldComparisonResult[],
    extractionResults: EnhancedExtractionResult[]
  ): BusinessRecommendation[] {
    const recommendations: BusinessRecommendation[] = [];
    
    // Critical discrepancies recommendation
    const criticalDiscrepancies = comparisonResults.filter(
      result => !result.isConsistent && result.category === 'critical'
    );
    
    if (criticalDiscrepancies.length > 0) {
      recommendations.push({
        action: 'Resolve critical discrepancies before shipment',
        priority: 'high',
        reasoning: 'Critical discrepancies may lead to customs delays or rejection'
      });
    }
    
    // Document completeness recommendation
    const documentTypes = new Set(extractionResults.map(
      result => result.documentType || result.data?.metadata?.documentType || 'unknown'
    ));
    
    const essentialDocuments: LogisticsDocumentType[] = [
      'invoice', 'air_waybill', 'packing_list'
    ];
    
    const missingEssentialDocs = essentialDocuments.filter(
      docType => !documentTypes.has(docType)
    );
    
    if (missingEssentialDocs.length > 0) {
      recommendations.push({
        action: `Obtain missing essential documents: ${missingEssentialDocs.join(', ')}`,
        priority: 'high',
        reasoning: 'Complete documentation is required for customs clearance'
      });
    }
    
    // General recommendation
    if (comparisonResults.some(result => !result.isConsistent)) {
      recommendations.push({
        action: 'Review all documents for consistency before submission',
        priority: 'medium',
        reasoning: 'Inconsistent information across documents may raise red flags during inspection'
      });
    }
    
    return recommendations;
  }

  /**
   * Generates a basic summary
   * 
   * @param consistencyScore - The consistency score
   * @param riskAssessment - The risk assessment
   * @param discrepancyCount - The number of discrepancies
   * @returns The basic summary
   */
  private generateBasicSummary(
    consistencyScore: number,
    riskAssessment: 'low' | 'medium' | 'high',
    discrepancyCount: number
  ): string {
    if (consistencyScore >= 0.9) {
      return `The documents are highly consistent with a ${(consistencyScore * 100).toFixed(1)}% consistency score. ${discrepancyCount} discrepancies were found, with a ${riskAssessment} risk assessment.`;
    } else if (consistencyScore >= 0.7) {
      return `The documents have moderate consistency with a ${(consistencyScore * 100).toFixed(1)}% consistency score. ${discrepancyCount} discrepancies were found, with a ${riskAssessment} risk assessment. Review recommended.`;
    } else {
      return `The documents have low consistency with a ${(consistencyScore * 100).toFixed(1)}% consistency score. ${discrepancyCount} discrepancies were found, with a ${riskAssessment} risk assessment. Immediate attention required.`;
    }
  }

  /**
   * Generates discrepancies from comparison results
   * 
   * @param comparisonResults - The field comparison results
   * @returns The discrepancies
   */
  private generateDiscrepancies(
    comparisonResults: FieldComparisonResult[]
  ): DocumentDiscrepancy[] {
    return comparisonResults
      .filter(result => !result.isConsistent)
      .map(result => {
        const documents = Object.entries(result.values).map(([docName, value]) => ({
          documentName: docName,
          value: this.formatValueForDisplay(value)
        }));
        
        return {
          fieldName: result.fieldName,
          category: result.category,
          impact: this.getDiscrepancyImpact(result.fieldName, result.category),
          documents,
          recommendation: this.getDiscrepancyRecommendation(result.fieldName, result.category)
        };
      });
  }

  /**
   * Gets the impact of a discrepancy
   * 
   * @param fieldName - The field name
   * @param category - The category
   * @returns The impact
   */
  private getDiscrepancyImpact(
    fieldName: string,
    category: 'critical' | 'important' | 'minor'
  ): string {
    if (category === 'critical') {
      return `Inconsistent ${fieldName} may cause customs delays or rejection`;
    } else if (category === 'important') {
      return `Inconsistent ${fieldName} may require explanation during customs inspection`;
    } else {
      return `Inconsistent ${fieldName} is a minor issue but should be corrected for completeness`;
    }
  }

  /**
   * Gets a recommendation for a discrepancy
   * 
   * @param fieldName - The field name
   * @param category - The category
   * @returns The recommendation
   */
  private getDiscrepancyRecommendation(
    fieldName: string,
    category: 'critical' | 'important' | 'minor'
  ): string {
    if (category === 'critical') {
      return `Correct ${fieldName} across all documents to ensure consistency`;
    } else if (category === 'important') {
      return `Review and align ${fieldName} across documents`;
    } else {
      return `Consider updating ${fieldName} for consistency`;
    }
  }

  /**
   * Calculates the consistency score
   * 
   * @param comparisonResults - The field comparison results
   * @returns The consistency score
   */
  private calculateConsistencyScore(
    comparisonResults: FieldComparisonResult[]
  ): number {
    if (comparisonResults.length === 0) return 1.0;
    
    // Weight by category
    const categoryWeights = {
      'critical': 3,
      'important': 2,
      'minor': 1
    };
    
    let totalWeight = 0;
    let consistentWeight = 0;
    
    comparisonResults.forEach(result => {
      const weight = categoryWeights[result.category];
      totalWeight += weight;
      
      if (result.isConsistent) {
        consistentWeight += weight;
      }
    });
    
    return totalWeight > 0 ? consistentWeight / totalWeight : 1.0;
  }

  /**
   * Determines the risk assessment
   * 
   * @param consistencyScore - The consistency score
   * @param comparisonResults - The field comparison results
   * @returns The risk assessment
   */
  private determineRiskAssessment(
    consistencyScore: number,
    comparisonResults: FieldComparisonResult[]
  ): 'low' | 'medium' | 'high' {
    // Check for critical inconsistencies
    const hasCriticalInconsistencies = comparisonResults.some(
      result => !result.isConsistent && result.category === 'critical'
    );
    
    if (hasCriticalInconsistencies) {
      return 'high';
    }
    
    // Check consistency score
    if (consistencyScore >= 0.9) {
      return 'low';
    } else if (consistencyScore >= 0.7) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Extracts the shipment identifier
   * 
   * @param extractionResults - The extraction results
   * @returns The shipment identifier
   */
  private extractShipmentIdentifier(
    extractionResults: EnhancedExtractionResult[]
  ): string {
    // Try to find AWB number first
    for (const result of extractionResults) {
      if (!result.success || !result.data) continue;
      
      // Check in identifiers
      if (result.data.identifiers?.awbNumber) {
        return result.data.identifiers.awbNumber;
      }
      
      // Check in shipment
      if (result.data.shipment?.awbNumber) {
        return result.data.shipment.awbNumber;
      }
    }
    
    // Try invoice number
    for (const result of extractionResults) {
      if (!result.success || !result.data) continue;
      
      // Check in identifiers
      if (result.data.identifiers?.invoiceNumber) {
        return result.data.identifiers.invoiceNumber;
      }
      
      // Check in financial
      if (result.data.financial?.invoiceNumber) {
        return result.data.financial.invoiceNumber;
      }
    }
    
    // Use first document name as fallback
    const firstDoc = extractionResults[0];
    return firstDoc?.fileName || 'unknown';
  }

  /**
   * Gets a value by path
   * 
   * @param obj - The object
   * @param path - The path
   * @returns The value
   */
  private getValueByPath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    
    return current;
  }

  /**
   * Normalizes a value for comparison
   * 
   * @param value - The value
   * @param comparisonType - The comparison type
   * @returns The normalized value
   */
  private normalizeValueForComparison(
    value: any,
    comparisonType: 'exact' | 'numeric' | 'date' | 'text'
  ): string {
    if (value === null || value === undefined) return '';
    
    switch (comparisonType) {
      case 'exact':
        return String(value).trim().toLowerCase();
        
      case 'numeric':
        // Handle numeric values with units
        if (typeof value === 'object' && value !== null && 'value' in value) {
          return String(value.value);
        }
        
        // Extract numbers from string
        if (typeof value === 'string') {
          const matches = value.match(/[\d,.]+/);
          return matches ? matches[0].replace(/[^\d.]/g, '') : '';
        }
        
        return String(value);
        
      case 'date':
        // Handle date objects
        if (value instanceof Date) {
          return value.toISOString().split('T')[0];
        }
        
        // Handle date strings
        if (typeof value === 'string') {
          // Try to parse as ISO date
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
          
          // Remove common date separators
          return value.replace(/[\/\-\.]/g, '');
        }
        
        return String(value);
        
      case 'text':
        // Normalize text for fuzzy comparison
        return String(value)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ');
        
      default:
        return String(value);
    }
  }

  /**
   * Formats a value for display
   * 
   * @param value - The value
   * @returns The formatted value
   */
  private formatValueForDisplay(value: any): string {
    if (value === null || value === undefined) return 'N/A';
    
    // Handle objects with value and unit
    if (typeof value === 'object' && value !== null) {
      if ('value' in value && 'unit' in value) {
        return `${value.value} ${value.unit}`;
      }
      
      if ('amount' in value && 'currency' in value) {
        return `${value.currency} ${value.amount}`;
      }
      
      return JSON.stringify(value);
    }
    
    return String(value);
  }

  /**
   * Defines field mappings for comparison
   * 
   * @returns The field mappings
   */
  private defineFieldMappings(): Record<string, FieldMapping> {
    return {
      // Shipment identifiers
      'awbNumber': {
        paths: {
          'invoice': 'identifiers.awbNumber',
          'air_waybill': 'identifiers.awbNumber',
          'packing_list': 'identifiers.awbNumber',
          'bill_of_entry': 'identifiers.awbNumber',
          'commercial_invoice': 'identifiers.awbNumber',
          'customs_invoice': 'identifiers.awbNumber',
          'unknown': 'identifiers.awbNumber'
        },
        category: 'critical',
        comparisonType: 'exact'
      },
      'invoiceNumber': {
        paths: {
          'invoice': 'identifiers.invoiceNumber',
          'commercial_invoice': 'identifiers.invoiceNumber',
          'customs_invoice': 'identifiers.invoiceNumber',
          'packing_list': 'identifiers.invoiceNumber',
          'unknown': 'identifiers.invoiceNumber'
        },
        category: 'critical',
        comparisonType: 'exact'
      },
      
      // Parties
      'shipper': {
        paths: {
          'invoice': 'parties.shipper.name',
          'air_waybill': 'parties.shipper.name',
          'packing_list': 'parties.shipper.name',
          'bill_of_lading': 'parties.shipper.name',
          'commercial_invoice': 'parties.shipper.name',
          'unknown': 'parties.shipper.name'
        },
        category: 'important',
        comparisonType: 'text'
      },
      'consignee': {
        paths: {
          'invoice': 'parties.consignee.name',
          'air_waybill': 'parties.consignee.name',
          'packing_list': 'parties.consignee.name',
          'bill_of_lading': 'parties.consignee.name',
          'commercial_invoice': 'parties.consignee.name',
          'unknown': 'parties.consignee.name'
        },
        category: 'important',
        comparisonType: 'text'
      },
      
      // Shipment details
      'grossWeight': {
        paths: {
          'invoice': 'shipment.grossWeight.value',
          'air_waybill': 'shipment.grossWeight.value',
          'packing_list': 'shipment.grossWeight.value',
          'bill_of_entry': 'shipment.grossWeight.value',
          'commercial_invoice': 'shipment.grossWeight.value',
          'unknown': 'shipment.grossWeight.value'
        },
        category: 'important',
        comparisonType: 'numeric'
      },
      'packageCount': {
        paths: {
          'invoice': 'shipment.packageCount.value',
          'air_waybill': 'shipment.packageCount.value',
          'packing_list': 'shipment.packageCount.value',
          'bill_of_entry': 'shipment.packageCount.value',
          'commercial_invoice': 'shipment.packageCount.value',
          'unknown': 'shipment.packageCount.value'
        },
        category: 'important',
        comparisonType: 'numeric'
      },
      
      // Financial details
      'totalValue': {
        paths: {
          'invoice': 'financial.totalAmount.amount',
          'commercial_invoice': 'financial.totalAmount.amount',
          'customs_invoice': 'financial.totalAmount.amount',
          'bill_of_entry': 'financial.assessableValue.amount',
          'unknown': 'financial.totalAmount.amount'
        },
        category: 'critical',
        comparisonType: 'numeric'
      },
      'currency': {
        paths: {
          'invoice': 'financial.totalAmount.currency',
          'commercial_invoice': 'financial.totalAmount.currency',
          'customs_invoice': 'financial.totalAmount.currency',
          'bill_of_entry': 'financial.assessableValue.currency',
          'unknown': 'financial.totalAmount.currency'
        },
        category: 'important',
        comparisonType: 'exact'
      },
      
      // Goods details
      'goodsDescription': {
        paths: {
          'invoice': 'goods.description',
          'air_waybill': 'goods.description',
          'packing_list': 'goods.description',
          'bill_of_entry': 'goods.description',
          'commercial_invoice': 'goods.description',
          'unknown': 'goods.description'
        },
        category: 'important',
        comparisonType: 'text'
      },
      'hsnCode': {
        paths: {
          'invoice': 'goods.hsnCode',
          'commercial_invoice': 'goods.hsnCode',
          'customs_invoice': 'goods.hsnCode',
          'bill_of_entry': 'goods.hsnCode',
          'unknown': 'goods.hsnCode'
        },
        category: 'critical',
        comparisonType: 'exact'
      },
      
      // Dates
      'invoiceDate': {
        paths: {
          'invoice': 'dates.invoiceDate',
          'commercial_invoice': 'dates.invoiceDate',
          'customs_invoice': 'dates.invoiceDate',
          'unknown': 'dates.invoiceDate'
        },
        category: 'important',
        comparisonType: 'date'
      },
      'shipmentDate': {
        paths: {
          'invoice': 'dates.shipmentDate',
          'air_waybill': 'dates.shipmentDate',
          'bill_of_lading': 'dates.shipmentDate',
          'unknown': 'dates.shipmentDate'
        },
        category: 'important',
        comparisonType: 'date'
      }
    };
  }
}
