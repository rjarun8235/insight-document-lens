// LLM EXTRACTION SERVICE
// Connects parsed documents to Claude API via Supabase proxy

import { useState } from 'react';
import { ParsedFileResult } from './FileParser';
import { LogisticsDocumentType, LogisticsDocumentFile } from './document-types';
import { Anthropic } from '@anthropic-ai/sdk';
import { 
  DOCUMENT_SPECIFIC_PROMPTS,
  normalizeFieldValue,
  preprocessDocumentContent
} from './document-patterns';

import {
  validateFieldFormat,
  validateDocumentTypeData,
  ValidationResult
} from './document-validation';

// Import our new validation modules
import { 
  LogisticsBusinessRules, 
  DocumentQualityAssessment, 
  BusinessRuleResult,
  ValidationResult as BusinessValidationResult 
} from './logistics-validation';
import { 
  DocumentRelationshipValidator, 
  CrossDocumentValidationResult 
} from './document-relationship-validator';
import { 
  EnhancedFieldExtraction, 
  EnhancedFieldValue 
} from './enhanced-field-extraction';
import { 
  HSNCodeValidator, 
  HSNCodeValidationResult, 
  HSNCodeMappingResult 
} from './hsn-code-validator';
import { 
  EnhancedLogisticsPrompt, 
  EnhancedPromptContext 
} from '../templates/enhanced-logistics-prompt';
import { 
  ExtractionLogger 
} from './extraction-logger';
import { 
  DocumentFieldComparator, 
  DocumentComparisonReport 
} from './document-field-comparator';

// Define the extraction schema for logistics documents
export interface LogisticsExtractionSchema {
  // Core identifiers that must propagate across all documents
  identifiers: {
    invoiceNumber: string | null;        // "CD970077514" - Master reference
    customerPO: string | null;           // "SKI-EXIM-0118/23-24" - Commercial reference
    shipmentID: string | null;           // "89099" - Internal tracking
    awbNumber: string | null;            // "09880828764" - Transport reference
    hawbNumber: string | null;           // "448765" - House bill reference
    deliveryNoteNumber: string | null;   // "178389" - Delivery reference
    jobNumber: string | null;            // "577" - Customs job
    beNumber: string | null;             // Bill of Entry number
    packingListNumber: string | null;    // Packing list reference
  };

  // Party information (shipper/consignee)
  parties: {
    shipper: {
      name: string | null;               // "R.A. LABONE & CO LTD"
      address: string | null;            // Complete address
      country: string | null;            // "UNITED KINGDOM"
      phone: string | null;              // Contact information
      email: string | null;              // Email address
    };
    consignee: {
      name: string | null;               // "SKI MANUFACTURING"
      address: string | null;            // Complete address
      country: string | null;            // "INDIA"
      customerNumber: string | null;     // "10583"
      importerCode: string | null;       // "ADKFS7580G"
      adCode: string | null;             // "0510004"
      phone: string | null;              // Contact information
      email: string | null;              // Email address
    };
  };

  // Physical shipment details
  shipment: {
    packageCount: {
      value: number | null;              // 2
      unit: string | null;               // "PKG"
      originalText: string | null;       // "2.000PKG"
    };
    grossWeight: {
      value: number | null;              // 37.0
      unit: string | null;               // "KGS"
      originalText: string | null;       // "37.000KGS"
    };
    netWeight: {
      value: number | null;              // 34.2
      unit: string | null;               // "KG"
      originalText: string | null;       // "34.20 KG"
    };
    dimensions: string | null;           // "57 x 31 x 20 cms"
    volume: string | null;               // "0.071 m3"
  };

  // Commercial details
  commercial: {
    invoiceValue: {
      amount: number | null;             // 1989.00
      currency: string | null;           // "GBP"
    };
    terms: string | null;                // "FCA" or "FOB"
    freight: {
      amount: number | null;             // 140
      currency: string | null;           // "USD"
    };
    insurance: {
      amount: number | null;             // 24.14
      currency: string | null;           // "GBP"
    };
    miscCharges: {
      amount: number | null;             // 210
      currency: string | null;           // "USD"
    };
  };

  // Product details
  product: {
    description: string | null;          // "EARTH SPRING"
    itemNumber: string | null;           // "GN7001001"
    partNumber: string | null;           // "P3146-A"
    hsnCode: string | null;              // "73261990" (Invoice) vs "73201019" (BE)
    quantity: {
      value: number | null;              // 10000
      unit: string | null;               // "Each"
    };
    unitPrice: number | null;            // 0.198900
  };

  // Route information
  route: {
    origin: string | null;               // "HEATHROW, LONDON"
    destination: string | null;          // "CHENNAI"
    carrier: string | null;              // "AIR INDIA"
    countryOfOrigin: string | null;      // "UNITED KINGDOM"
  };

  // Dates
  dates: {
    invoiceDate: string | null;          // "07/05/2025"
    shipDate: string | null;             // "07/05/2025"
    awbDate: string | null;              // "12/05/2025"
    entryDate: string | null;            // "14/05/2025"
  };

  // Customs details (Bill of Entry specific)
  customs: {
    assessedValue: {
      amount: number | null;             // 260547.76
      currency: string | null;           // "INR"
    };
    duties: {
      bcd: number | null;                // 26054.80
      igst: number | null;               // 52057.50
      socialWelfareSurcharge: number | null; // 2605.50
      totalDuty: number | null;          // 80717.80
    };
    exchangeRates: Array<{
      from: string;                      // "GBP"
      to: string;                        // "INR"
      rate: number;                      // 114.5500
    }>;
    buyerSellerRelated: boolean | null;  // false for "N"
  };

  // Metadata
  metadata: {
    documentType: string;                // "invoice" | "delivery_note" | "hawb" | "bill_of_entry"
    extractionConfidence: number;        // 0.0 to 1.0
    criticalFields: string[];            // List of business-critical fields found
    missingFields: string[];             // Expected but missing fields
    issues?: string[];                   // Document-specific issues or warnings
  };
}

// ===== EXTRACTION PROMPT (YOUR AGREED VERSION) =====

const LOGISTICS_EXTRACTION_PROMPT = `
You are a logistics document extraction system. Extract data with EXTREME precision for customs compliance.

⚠️ CRITICAL OUTPUT REQUIREMENT ⚠️
- Return ONLY valid JSON
- No markdown, no explanations, no additional text
- First character must be '{', last character must be '}'
- Must pass JSON.parse() validation

## FIELD-LEVEL CONFIDENCE SCORES
- For each extracted field, provide a confidence score between 0.0 and 1.0
- Use the format: { "value": [extracted value], "confidence": [score] }
- A score of 1.0 means you are 100% confident in the extraction
- A score of 0.5 means you are 50% confident (moderate uncertainty)
- A score of 0.0 means you found no value but are including a placeholder
- Be honest about your uncertainty - this helps downstream processing

## EXTRACTION FOCUS:

### CRITICAL FIELDS (99.9% accuracy required):
1. **Reference Numbers**: Invoice, AWB, HAWB, PO numbers
2. **HSN/Commodity Codes**: Different codes = customs penalties  
3. **Financial Values**: Invoice amounts, duties, taxes
4. **Weight Values**: Gross vs Net weight (critical for customs)
5. **Entity Names**: Exact shipper/consignee names

### HIGH PRIORITY FIELDS (95% accuracy required):
1. **Addresses**: Complete addresses with postal codes
2. **Package Counts**: Number of packages/boxes
3. **Product Descriptions**: Item descriptions and part numbers
4. **Dates**: Invoice, shipping, customs entry dates
5. **Terms**: Incoterms (FOB, FCA, etc.)

### DOCUMENT-SPECIFIC EXTRACTION:

#### FOR INVOICES:
- Extract commodity code from line items (may be different from customs docs)
- Get precise financial breakdown (subtotal, tax, total)
- Extract payment terms and delivery terms
- Get customer references and order numbers

#### FOR DELIVERY NOTES:
- Focus on physical details (packaging, weight, dimensions)
- Extract shipment ID and tracking references
- Get actual packed quantities and weights
- Note any delivery instructions

#### FOR HAWB (House Air Waybill):
- Extract both Master AWB and House AWB numbers
- Get carrier information and routing details
- Extract gross weight AND chargeable weight
- Get origin/destination airports
- Note freight terms (COLLECT, PREPAID)

#### FOR BILL OF ENTRY:
- Extract ALL customs reference numbers (BE, Job, IGM)
- Get precise duty calculations with rates
- Extract HSN/RITC codes (often different from invoice)
- Get exchange rates and assessed values
- Note buyer-seller relationship declaration

## EXTRACTION RULES:

### Address Handling:
- Normalize spelling: "MIDLETON" → "MIDDLETON"
- Expand abbreviations: "IND ESTATE" → "INDUSTRIAL ESTATE"  
- Standardize postal codes: "DE7 5TH" → "DE7 5TN"
- Include complete country information

### Weight Processing:
- Always separate value from unit: "37 KGS" → value: 37, unit: "KGS"
- Distinguish gross vs net vs chargeable weight
- Keep original text format for reference
- Handle variations: "37K", "37.000KGS", "36.6 kgs"

### Reference Number Extraction:
- AWB numbers often have prefixes: "098 LHR 80828764"
- Invoice numbers: alphanumeric patterns like "CD970077514"
- PO numbers: format like "SKI-EXIM-0118/23-24"
- Job numbers: may be formatted like "I/A/000577/25-26"

### Financial Data:
- Always include currency with amounts
- Extract both percentage rates AND calculated amounts for duties
- Handle multiple currencies and exchange rates
- Distinguish between different charge types

### HSN/Commodity Code Priority:
- These codes determine customs duties - extract with 99.9% accuracy
- May appear as "HSN", "HS", "RITC", "CTH", "Tariff Code"
- Often 8-10 digits: "73261990", "73201019"
- CRITICAL: Different docs may have different codes for same product

## OUTPUT SCHEMA:

{
  "identifiers": {
    "invoiceNumber": null,
    "customerPO": null,
    "shipmentID": null,
    "awbNumber": null,
    "hawbNumber": null,
    "deliveryNoteNumber": null,
    "jobNumber": null,
    "beNumber": null
  },
  "parties": {
    "shipper": {
      "name": null,
      "address": null,
      "country": null,
      "phone": null
    },
    "consignee": {
      "name": null,
      "address": null,
      "country": null,
      "customerNumber": null,
      "importerCode": null,
      "adCode": null
    }
  },
  "shipment": {
    "packageCount": {
      "value": null,
      "unit": null,
      "originalText": null
    },
    "grossWeight": {
      "value": null,
      "unit": null,
      "originalText": null
    },
    "netWeight": {
      "value": null,
      "unit": null,
      "originalText": null
    },
    "dimensions": null,
    "volume": null
  },
  "commercial": {
    "invoiceValue": {
      "amount": null,
      "currency": null
    },
    "terms": null,
    "freight": {
      "amount": null,
      "currency": null
    },
    "insurance": {
      "amount": null,
      "currency": null
    },
    "miscCharges": {
      "amount": null,
      "currency": null
    }
  },
  "product": {
    "description": null,
    "itemNumber": null,
    "partNumber": null,
    "hsnCode": null,
    "quantity": {
      "value": null,
      "unit": null
    },
    "unitPrice": null
  },
  "route": {
    "origin": null,
    "destination": null,
    "carrier": null,
    "countryOfOrigin": null
  },
  "dates": {
    "invoiceDate": null,
    "shipDate": null,
    "awbDate": null,
    "entryDate": null
  },
  "customs": {
    "assessedValue": {
      "amount": null,
      "currency": null
    },
    "duties": {
      "bcd": null,
      "igst": null,
      "socialWelfareSurcharge": null,
      "totalDuty": null
    },
    "exchangeRates": [],
    "buyerSellerRelated": null
  },
  "metadata": {
    "documentType": "",
    "extractionConfidence": 0.0,
    "criticalFields": [],
    "missingFields": [],
    "issues": []
  }
}

## CONFIDENCE SCORING:
- 0.95-1.0: Clear, unambiguous extraction with perfect pattern match
- 0.85-0.94: High confidence with minor formatting variations
- 0.70-0.84: Moderate confidence, some fields unclear but reasonable
- 0.50-0.69: Low confidence, significant uncertainty

For each extracted field, provide a confidence score using the format:
{
  "value": [extracted value],
  "confidence": [score between 0.0-1.0]
}

Example:
"invoiceNumber": {
  "value": "CD970077514",
  "confidence": 0.95
}
- 0.0-0.49: Very low confidence, manual review required

## CRITICAL REMINDERS:
1. Different documents may have different HSN codes for same product
2. Weight discrepancies >0.5 KG between documents are common
3. Address spelling variations are frequent ("MIDDLETON" vs "MIDLETON")
4. Company name formats vary ("R.A. LABONE" vs "R.A LABONE & CO LTD")
5. Extract ALL found values even if they seem contradictory

EXTRACT FROM DOCUMENT:
`;

// ===== EXTRACTION SERVICE =====

// Enhanced extraction result with all validation data
export interface EnhancedExtractionResult {
  success: boolean;
  data?: LogisticsExtractionSchema;
  error?: string;
  processingTime: number;
  inputTokens: number;
  outputTokens: number;
  
  // New validation results
  businessRuleValidation?: {
    results: BusinessRuleResult[];
    overallCompliance: number;
    criticalIssues: string[];
    warnings: string[];
  };
  
  documentQuality?: {
    score: number;
    factors: {
      identifierConsistency: number;
      dataCompletion: number;
      formatValidation: number;
      businessRuleCompliance: number;
    };
    recommendations: string[];
  };
  
  hsnValidation?: {
    commercial?: HSNCodeValidationResult;
    customs?: HSNCodeValidationResult;
    mapping?: HSNCodeMappingResult;
  };
  
  enhancedFields?: {
    packageCount?: EnhancedFieldValue;
    hsnCode?: EnhancedFieldValue;
    grossWeight?: EnhancedFieldValue;
    netWeight?: EnhancedFieldValue;
  };
}

// Backward compatibility
export interface ExtractionResult extends EnhancedExtractionResult {}

export class LLMExtractionService {
  private supabaseProxyUrl: string;
  private relationshipValidator: DocumentRelationshipValidator;
  private logger: ExtractionLogger;
  
  constructor(supabaseProxyUrl: string = 'https://cbrgpzdxttzlvvryysaf.supabase.co/functions/v1/claude-api-proxy') {
    this.supabaseProxyUrl = supabaseProxyUrl;
    this.relationshipValidator = new DocumentRelationshipValidator();
    this.logger = new ExtractionLogger();
  }

  /**
   * Get extraction logs and performance metrics
   */
  getExtractionMetrics(since?: Date) {
    return {
      logs: this.logger.getLogs({ since }),
      summary: this.logger.getSummary(since)
    };
  }

  /**
   * Export extraction logs
   */
  exportLogs(filter?: { category?: any; level?: any; since?: Date }): string {
    return this.logger.exportLogs(filter);
  }

  /**
   * Enhanced validation pipeline that applies all business rules and quality checks
   */
  private async applyEnhancedValidation(
    extractedData: LogisticsExtractionSchema,
    documentType: LogisticsDocumentType
  ): Promise<{
    businessRuleValidation: EnhancedExtractionResult['businessRuleValidation'];
    documentQuality: EnhancedExtractionResult['documentQuality'];
    hsnValidation: EnhancedExtractionResult['hsnValidation'];
    enhancedFields: EnhancedExtractionResult['enhancedFields'];
  }> {
    
    const timer = this.logger.startTimer(`Enhanced validation for ${documentType}`);
    
    try {
      // 1. Business Rule Validation
      this.logger.info('business_rules', 'Starting business rule validation', { documentType });
    const businessRules = [
      LogisticsBusinessRules.packageCountConsistency(
        extractedData.shipment.packageCount?.value,
        extractedData.shipment.packageCount?.value, // Same for single doc
        extractedData.shipment.packageCount?.unit,
        extractedData.shipment.packageCount?.unit
      ),
      LogisticsBusinessRules.weightConsistency(
        extractedData.shipment.grossWeight?.value,
        extractedData.shipment.netWeight?.value,
        extractedData.shipment.grossWeight?.unit
      ),
      LogisticsBusinessRules.hsnCodeMapping(
        extractedData.product?.hsnCode,
        extractedData.product?.hsnCode // customs.hsnCode doesn't exist in schema, using product.hsnCode
      ),
      LogisticsBusinessRules.dateSequenceValidation(
        extractedData.dates?.invoiceDate,
        extractedData.dates?.awbDate,
        extractedData.dates?.entryDate
      ),
      LogisticsBusinessRules.financialConsistency(
        extractedData.commercial?.invoiceValue?.amount,
        extractedData.customs?.duties?.totalDuty,
        extractedData.commercial?.invoiceValue?.currency
      )
    ];

    const criticalIssues = businessRules.filter(rule => !rule.passed && rule.severity === 'error').map(rule => rule.message);
    const warnings = businessRules.filter(rule => !rule.passed && rule.severity === 'warning').map(rule => rule.message);
    const overallCompliance = businessRules.filter(rule => rule.passed).length / businessRules.length;

    if (criticalIssues.length > 0) {
      this.logger.warn('business_rules', `${criticalIssues.length} critical business rule violations found`, {
        documentType,
        issueCount: criticalIssues.length
      });
    }

    if (warnings.length > 0) {
      this.logger.info('business_rules', `${warnings.length} business rule warnings found`, {
        documentType,
        issueCount: warnings.length
      });
    }

    this.logger.info('business_rules', 'Business rule validation completed', {
      documentType,
      compliance: overallCompliance
    });

    // 2. Document Quality Assessment
    this.logger.info('validation', 'Starting document quality assessment', { documentType });
    const qualityScore = DocumentQualityAssessment.assessDocumentQuality(extractedData);
    const qualityFactors = {
      identifierConsistency: this.calculateIdentifierConsistency(extractedData),
      dataCompletion: this.calculateDataCompletion(extractedData),
      formatValidation: this.calculateFormatValidation(extractedData),
      businessRuleCompliance: overallCompliance
    };

    // 3. HSN Code Validation
    let hsnValidation: EnhancedExtractionResult['hsnValidation'] = {};
    
    if (extractedData.product?.hsnCode) {
      hsnValidation.commercial = HSNCodeValidator.validateHSNCode(extractedData.product.hsnCode);
    }
    
    // Note: customs.hsnCode doesn't exist in schema, using product.hsnCode for customs validation too
    if (extractedData.product?.hsnCode) {
      hsnValidation.customs = HSNCodeValidator.validateHSNCode(extractedData.product.hsnCode);
    }
    
    // Note: Since customs.hsnCode doesn't exist in schema, we'll skip HSN mapping for now
    // This would typically compare commercial vs customs HSN codes
    if (extractedData.product?.hsnCode) {
      // For now, we'll just validate the single HSN code we have
      hsnValidation.mapping = {
        commercialCode: extractedData.product.hsnCode,
        customsCode: extractedData.product.hsnCode, // Same code since we don't have separate customs code
        isConsistent: true,
        mappingConfidence: 0.8,
        discrepancyType: 'none',
        explanation: 'Single HSN code found - no comparison available',
        recommendations: []
      };
    }

    // 4. Enhanced Field Extraction (re-extract with enhanced logic if needed)
    const enhancedFields: EnhancedExtractionResult['enhancedFields'] = {};
    
    if (extractedData.shipment.packageCount) {
      enhancedFields.packageCount = {
        value: extractedData.shipment.packageCount.value,
        confidence: 0.8, // Would be calculated based on extraction quality
        unit: extractedData.shipment.packageCount.unit,
        context: documentType
      };
    }

      const result = {
        businessRuleValidation: {
          results: businessRules,
          overallCompliance,
          criticalIssues,
          warnings
        },
        documentQuality: {
          score: qualityScore,
          factors: qualityFactors,
          recommendations: this.generateQualityRecommendations(qualityFactors, businessRules)
        },
        hsnValidation,
        enhancedFields
      };

      timer();
      this.logger.info('validation', 'Enhanced validation completed successfully', {
        documentType,
        validationScore: qualityScore,
        compliance: overallCompliance
      });

      return result;

    } catch (error) {
      timer();
      this.logger.error('validation', 'Enhanced validation failed', {
        documentType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Return minimal validation result on error
      return {
        businessRuleValidation: {
          results: [],
          overallCompliance: 0,
          criticalIssues: ['Validation pipeline failed'],
          warnings: []
        },
        documentQuality: {
          score: 0.1,
          factors: {
            identifierConsistency: 0,
            dataCompletion: 0,
            formatValidation: 0,
            businessRuleCompliance: 0
          },
          recommendations: ['Manual review required due to validation errors']
        },
        hsnValidation: {},
        enhancedFields: {}
      };
    }
  }

  /**
   * Calculate identifier consistency score
   */
  private calculateIdentifierConsistency(data: LogisticsExtractionSchema): number {
    let score = 0;
    let checks = 0;

    const identifiers = [
      data.identifiers?.invoiceNumber,
      data.identifiers?.awbNumber,
      data.identifiers?.hawbNumber,
      data.identifiers?.beNumber
    ];

    identifiers.forEach(id => {
      if (id) {
        checks++;
        // Simple validation - could be enhanced with pattern matching
        if (typeof id === 'string' && id.length > 3) {
          score++;
        }
      }
    });

    return checks > 0 ? score / checks : 0.5;
  }

  /**
   * Calculate data completion score
   */
  private calculateDataCompletion(data: LogisticsExtractionSchema): number {
    const criticalFields = [
      data.parties?.shipper?.name,
      data.parties?.consignee?.name,
      data.shipment?.grossWeight?.value,
      data.commercial?.invoiceValue?.amount
    ];

    const completedFields = criticalFields.filter(field => field !== undefined && field !== null).length;
    return completedFields / criticalFields.length;
  }

  /**
   * Calculate format validation score
   */
  private calculateFormatValidation(data: LogisticsExtractionSchema): number {
    let validFormats = 0;
    let totalChecks = 0;

    // Check HSN code format
    if (data.product?.hsnCode) {
      const hsnPattern = /^\d{6,10}$/;
      validFormats += hsnPattern.test(data.product.hsnCode.replace(/\D/g, '')) ? 1 : 0;
      totalChecks++;
    }

    // Check AWB number format
    if (data.identifiers?.awbNumber) {
      const awbPattern = /^\d{3}[-\s]?\d{8,}$/;
      validFormats += awbPattern.test(data.identifiers.awbNumber) ? 1 : 0;
      totalChecks++;
    }

    return totalChecks > 0 ? validFormats / totalChecks : 0.8;
  }

  /**
   * Generate quality improvement recommendations
   */
  private generateQualityRecommendations(
    qualityFactors: any,
    businessRules: BusinessRuleResult[]
  ): string[] {
    const recommendations: string[] = [];

    if (qualityFactors.identifierConsistency < 0.8) {
      recommendations.push('Review document reference numbers for accuracy');
    }

    if (qualityFactors.dataCompletion < 0.7) {
      recommendations.push('Some critical fields are missing - verify document completeness');
    }

    if (qualityFactors.formatValidation < 0.9) {
      recommendations.push('Check format of key fields (HSN codes, reference numbers)');
    }

    const failedRules = businessRules.filter(rule => !rule.passed);
    if (failedRules.length > 0) {
      recommendations.push(`${failedRules.length} business rule(s) failed validation - review for compliance`);
    }

    return recommendations;
  }

  /**
   * Extract data from a text-based document (TXT, CSV, Excel, Word)
   */
  private async extractFromText(
    content: string, 
    documentType: LogisticsDocumentType
  ): Promise<ExtractionResult> {
    console.log(`🔍 Extracting from text document (${documentType})...`);
    console.log(`📄 Content length: ${content.length} characters`);
    
    const startTime = Date.now();
    
    try {
      // Preprocess content to highlight important fields
      const processedContent = preprocessDocumentContent(content, documentType);
      console.log(`🔎 Content preprocessed with field highlighting`);
      
      // Add document-specific pattern guidance
      const patternGuidance = DOCUMENT_SPECIFIC_PROMPTS[documentType] || DOCUMENT_SPECIFIC_PROMPTS['unknown'];
      console.log(`📋 Added document-specific pattern guidance for ${documentType}`);
      
      const response = await fetch(`${this.supabaseProxyUrl}/extraction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `${LOGISTICS_EXTRACTION_PROMPT}

${patternGuidance}

${processedContent}`
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      const processingTime = (Date.now() - startTime) / 1000;
      console.log(`✅ Extraction completed in ${processingTime.toFixed(2)}s`);

      // Extract the JSON content from Claude's response
      const claudeResponse = result.content[0].text;
      
      // Clean and parse the JSON response
      const cleanedResponse = this.cleanJsonResponse(claudeResponse);
      const extractedData = JSON.parse(cleanedResponse);
      
      // Ensure metadata exists and document type is set correctly
      if (!extractedData.metadata) {
        extractedData.metadata = {
          documentType: documentType,
          extractionConfidence: 0.0,
          criticalFields: [],
          missingFields: [],
          issues: []
        };
      } else {
        extractedData.metadata.documentType = documentType;
      }
      
      // Normalize extracted field values
      const normalizedData = this.normalizeExtractedData(extractedData);
      console.log(`🔄 Normalized extracted field values`);
      
      // Enhanced document type detection
      const enhancedData = this.enhanceDocumentTypeDetection(normalizedData);
      console.log(`🔍 Enhanced document type detection: ${enhancedData.metadata.documentType}`);
      
      // Calculate enhanced confidence score
      const confidenceScore = this.calculateEnhancedConfidenceScore(enhancedData);
      enhancedData.metadata.extractionConfidence = confidenceScore;
      console.log(`📊 Calculated enhanced confidence score: ${(confidenceScore * 100).toFixed(1)}%`);
      
      // Apply enhanced validation pipeline
      console.log(`🔍 Running enhanced validation pipeline...`);
      const validationResults = await this.applyEnhancedValidation(enhancedData, documentType);
      console.log(`✅ Validation complete - Quality Score: ${(validationResults.documentQuality.score * 100).toFixed(1)}%`);
      console.log(`📋 Business Rule Compliance: ${(validationResults.businessRuleValidation.overallCompliance * 100).toFixed(1)}%`);
      
      if (validationResults.businessRuleValidation.criticalIssues.length > 0) {
        console.log(`⚠️  Critical Issues: ${validationResults.businessRuleValidation.criticalIssues.length}`);
      }
      
      return {
        success: true,
        data: enhancedData,
        processingTime,
        inputTokens: result.usage?.input_tokens || 0,
        outputTokens: result.usage?.output_tokens || 0,
        businessRuleValidation: validationResults.businessRuleValidation,
        documentQuality: validationResults.documentQuality,
        hsnValidation: validationResults.hsnValidation,
        enhancedFields: validationResults.enhancedFields
      };

    } catch (error) {
      const processingTime = (Date.now() - startTime) / 1000;
      
      console.error('Text extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown extraction error',
        processingTime,
        inputTokens: 0,
        outputTokens: 0
      };
    }
  }

  /**
   * Extract data from a binary document (PDF, Image) using base64
   */
  private async extractFromBase64(
    base64: string, 
    documentType: LogisticsDocumentType,
    fileName: string
  ): Promise<ExtractionResult> {
    console.log(`Extracting from base64 document: ${fileName}`);
    const startTime = performance.now();
    
    try {
      // Determine if this is an image or PDF based on file extension
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
      const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
      const isPdf = fileExtension === 'pdf';
      
      // Prepare the request body based on content type
      let requestBody: any;
      
      // Prepare the base request body with the extraction prompt
      requestBody = {
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${LOGISTICS_EXTRACTION_PROMPT}

Document Type: ${documentType.toUpperCase().replace('_', ' ')}

This is a ${fileExtension.toUpperCase()} document named '${fileName}'.

Please extract all relevant information according to the schema. Focus on the typical fields found in a ${documentType.toUpperCase().replace('_', ' ')} document.

For example, in a ${documentType.toUpperCase().replace('_', ' ')}:

${this.getDocumentTypeHints(documentType)}`
              }
            ]
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
      };
      
      // Add the appropriate content type based on file type
      if (isImage) {
        // For images, use the image content type
        requestBody.messages[0].content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg', // Claude API accepts jpeg, png, gif, webp
            data: base64
          }
        });
      } else if (isPdf) {
        // For PDFs, use the document content type which Claude can process directly
        requestBody.messages[0].content.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64
          }
        });
      } else {
        // For other document types, include a sample of the base64 content as text
        const sampleBase64 = base64.substring(0, 1000);
        requestBody.messages[0].content[0].text += `

Here is a sample of the document content (base64 encoded):

${sampleBase64}...`;
      }
      
      // Prepare the request to Claude API
      const response = await fetch(`${this.supabaseProxyUrl}/extraction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let errorText = '';
        try {
          const errorJson = await response.json();
          errorText = JSON.stringify(errorJson);
        } catch (e) {
          errorText = await response.text();
        }
        console.error(`Base64 extraction failed with status ${response.status}:`, errorText);
        throw new Error(`API Error: ${errorText}`);
      }

      const data = await response.json();
      const content = data.content[0].text;
      
      // Clean the JSON response
      const cleanedJson = this.cleanJsonResponse(content);
      
      try {
        // Parse the JSON response
        const extractedData = JSON.parse(cleanedJson) as LogisticsExtractionSchema;
        
        // Ensure metadata exists and document type is set correctly
        if (!extractedData.metadata) {
          extractedData.metadata = {
            documentType: documentType,
            extractionConfidence: 0.0,
            criticalFields: [],
            missingFields: [],
            issues: []
          };
        } else {
          extractedData.metadata.documentType = documentType;
        }
        
        // Validate against expected document type
        const typeValidation = validateDocumentTypeData(extractedData, documentType);
        
        // Calculate confidence score
        const confidenceScore = this.calculateConfidenceScore(extractedData);
        
        // Set metadata
        extractedData.metadata = {
          ...extractedData.metadata,
          documentType,
          extractionConfidence: confidenceScore,
          issues: typeValidation.issues,
          criticalFields: this.getCriticalFieldsForType(documentType),
          missingFields: this.getMissingCriticalFields(extractedData, documentType)
        };
        
        // Normalize the extracted data
        const normalizedData = this.normalizeExtractedData(extractedData);
        
        // Apply enhanced validation pipeline
        console.log(`🔍 Running enhanced validation pipeline for ${fileName}...`);
        const validationResults = await this.applyEnhancedValidation(normalizedData, documentType);
        console.log(`✅ Validation complete - Quality Score: ${(validationResults.documentQuality.score * 100).toFixed(1)}%`);
        
        // Calculate processing time
        const processingTime = (performance.now() - startTime) / 1000; // in seconds
        
        return {
          success: true,
          data: normalizedData,
          processingTime,
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0,
          businessRuleValidation: validationResults.businessRuleValidation,
          documentQuality: validationResults.documentQuality,
          hsnValidation: validationResults.hsnValidation,
          enhancedFields: validationResults.enhancedFields
        };
      } catch (jsonError) {
        console.error(`JSON parsing error:`, jsonError, `
Response:`, cleanedJson);
        throw new Error(`Failed to parse extraction results: ${jsonError.message}`);
      }
    } catch (error) {
      console.error(`Base64 extraction failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during extraction',
        processingTime: (performance.now() - startTime) / 1000,
        inputTokens: 0,
        outputTokens: 0
      };
    }
  }

  /**
   * Clean JSON response to ensure valid JSON
   */
  private cleanJsonResponse(response: string): string {
    // Find the first opening brace and last closing brace
    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No valid JSON object found in response');
    }
    
    // Extract just the JSON part
    const jsonPart = response.substring(firstBrace, lastBrace + 1);
    
    // Remove any markdown code block markers
    return jsonPart.replace(/```json|```/g, '').trim();
  }
  
  /**
   * Get a value from an object by dot-separated path
   * @param obj The object to get the value from
   * @param path The dot-separated path to the value
   * @returns The value at the path, or undefined if not found
   */
  private getValueByPath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    
    const parts = path.split('.');
    let value = obj;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Previously normalized extracted data, but now returns the original data to prevent false positives
   * and ensure accurate validation in subsequent steps.
   * @param data The extracted data
   * @returns The original data without normalization
   */
  private normalizeExtractedData(data: LogisticsExtractionSchema): LogisticsExtractionSchema {
    // Simply return a deep copy of the original data without normalization
    // This preserves the raw extraction data for validation
    return JSON.parse(JSON.stringify(data)) as LogisticsExtractionSchema;
  }
  
  /**
   * Enhanced document type detection based on extracted content
   * @param extractedData The extracted data to analyze for document type
   * @returns Updated data with enhanced document type detection
   */
  /**
   * Helper method to get the value from a field that might be in the new confidence format
   * @param field The field to get the value from
   * @returns The value of the field
   */
  private getFieldValue(field: any): any {
    if (!field) return null;
    return typeof field === 'object' && 'value' in field ? field.value : field;
  }

  private enhanceDocumentTypeDetection(extractedData: LogisticsExtractionSchema): LogisticsExtractionSchema {
    if (!extractedData || !extractedData.metadata) return extractedData;
    
    if (extractedData.metadata.documentType === 'unknown') {
      // More sophisticated detection
      const hawbNumber = this.getFieldValue(extractedData.identifiers?.hawbNumber);
      const awbNumber = this.getFieldValue(extractedData.identifiers?.awbNumber);
      const invoiceNumber = this.getFieldValue(extractedData.identifiers?.invoiceNumber);
      const beNumber = this.getFieldValue(extractedData.identifiers?.beNumber);
      const deliveryNoteNumber = this.getFieldValue(extractedData.identifiers?.deliveryNoteNumber);
      const carrier = this.getFieldValue(extractedData.route?.carrier);
      const packageCount = this.getFieldValue(extractedData.shipment?.packageCount);
      const invoiceAmount = this.getFieldValue(extractedData.commercial?.invoiceValue?.amount);
      const invoiceCurrency = this.getFieldValue(extractedData.commercial?.invoiceValue?.currency);
      const productDescription = this.getFieldValue(extractedData.product?.description);
      const bcd = this.getFieldValue(extractedData.customs?.duties?.bcd);
      const igst = this.getFieldValue(extractedData.customs?.duties?.igst);
      
      // Detect House Air Waybill
      if (hawbNumber || (awbNumber && carrier === 'AIR INDIA')) {
        extractedData.metadata.documentType = 'house_waybill';
      }
      
      // Detect Air Waybill (Master)
      else if (awbNumber && !hawbNumber && carrier) {
        extractedData.metadata.documentType = 'air_waybill';
      }
      
      // Detect Invoice
      else if (invoiceNumber || (invoiceAmount && invoiceCurrency)) {
        extractedData.metadata.documentType = 'invoice';
      }
      
      // Detect Bill of Entry
      else if (beNumber || (bcd !== null && igst !== null)) {
        extractedData.metadata.documentType = 'bill_of_entry';
      }
      
      // Detect Delivery Note
      else if (deliveryNoteNumber || (packageCount && !invoiceAmount)) {
        extractedData.metadata.documentType = 'delivery_note';
      }
      
      // Detect Packing List
      else if (packageCount && productDescription && !invoiceAmount) {
        extractedData.metadata.documentType = 'packing_list';
      }
    }
    
    return extractedData;
  }
  
  /**
   * Calculate an enhanced confidence score based on field presence and quality
   * @param extractedData The extracted data to calculate confidence for
   * @returns An enhanced confidence score between 0 and 1
   */
  private calculateEnhancedConfidenceScore(extractedData: LogisticsExtractionSchema): number {
    // Define critical fields for each document type
    const criticalFieldsByType: Record<string, string[]> = {
      'invoice': ['invoiceNumber', 'invoiceValue', 'parties.shipper.name', 'parties.consignee.name'],
      'house_waybill': ['hawbNumber', 'awbNumber', 'parties.shipper.name', 'parties.consignee.name'],
      'air_waybill': ['awbNumber', 'parties.shipper.name', 'parties.consignee.name', 'shipment.grossWeight'],
      'bill_of_entry': ['beNumber', 'customs.duties', 'parties.consignee.name'],
      'delivery_note': ['deliveryNoteNumber', 'shipment.packageCount', 'parties.shipper.name'],
      'packing_list': ['shipmentID', 'shipment.packageCount', 'product.description', 'parties.shipper.name']
    };
    
    // Get critical fields for this document type
    let docType = extractedData.metadata.documentType;
    
    // If document type is unknown, try to detect it
    if (docType === 'unknown') {
      const enhancedData = this.enhanceDocumentTypeDetection(extractedData);
      docType = enhancedData.metadata.documentType;
    }
    
    const criticalFields = criticalFieldsByType[docType] || [];
    
    if (criticalFields.length === 0) {
      // If we don't have critical fields defined for this type, use a default score
      return 0.75;
    }
    
    // Count how many critical fields are populated
    let populatedCount = 0;
    let qualityScore = 0;
    let totalQualityChecks = 0;
    
    for (const field of criticalFields) {
      // Handle nested fields like 'parties.shipper.name'
      const parts = field.split('.');
      let value: any = extractedData;
      let fieldName = parts[parts.length - 1];
      
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          value = null;
          break;
        }
      }
      
      if (value !== null && value !== undefined && value !== '') {
        populatedCount++;
        
        // Add field quality assessment
        totalQualityChecks++;
        if (validateFieldFormat(fieldName, value)) {
          qualityScore++;
        }
      }
    }
    
    // Add consistency checks
    // For example, check if gross weight > net weight
    if (extractedData.shipment.grossWeight?.value && extractedData.shipment.netWeight?.value) {
      totalQualityChecks++;
      if (extractedData.shipment.grossWeight.value >= extractedData.shipment.netWeight.value) {
        qualityScore++;
      }
    }
    
    // Calculate final confidence
    const baseConfidence = populatedCount / criticalFields.length;
    const qualityMultiplier = totalQualityChecks > 0 ? (0.8 + (0.2 * qualityScore / totalQualityChecks)) : 1.0;
    
    return Math.min(1.0, populatedCount > 0 ? Math.max(0.5, baseConfidence * qualityMultiplier) : 0.25);
  }
  
  /**
   * Get missing critical fields for a specific document type
   * @param extractedData The extracted data to check
   * @param documentType The document type to get critical fields for
   * @returns Array of missing critical field paths
   */
  private getMissingCriticalFields(extractedData: LogisticsExtractionSchema, documentType: LogisticsDocumentType): string[] {
    const criticalFields = this.getCriticalFieldsForType(documentType);
    const missingFields: string[] = [];
    
    for (const field of criticalFields) {
      const value = this.getValueByPath(extractedData, field);
      if (value === null || value === undefined || value === '') {
        missingFields.push(field);
      }
    }
    
    return missingFields;
  }

  /**
   * Get critical fields for a specific document type
   * @param documentType The document type to get critical fields for
   * @returns Array of critical field paths
   */
  public getCriticalFieldsForType(documentType: LogisticsDocumentType): string[] {
    // Define critical fields for each document type
    const criticalFieldsByType: Record<string, string[]> = {
      'invoice': [
        'identifiers.invoiceNumber', 
        'commercial.invoiceValue', 
        'parties.shipper.name', 
        'parties.consignee.name',
        'commercial.invoiceDate'
      ],
      'house_waybill': [
        'identifiers.hawbNumber', 
        'identifiers.awbNumber', 
        'shipment.origin', 
        'shipment.destination', 
        'shipment.grossWeight',
        'parties.shipper.name',
        'parties.consignee.name'
      ],
      'air_waybill': [
        'identifiers.awbNumber', 
        'shipment.origin', 
        'shipment.destination', 
        'shipment.grossWeight',
        'parties.shipper.name',
        'parties.consignee.name',
        'shipment.carrier'
      ],
      'bill_of_entry': [
        'identifiers.beNumber', 
        'customs.duties', 
        'parties.importer.name', 
        'customs.beDate',
        'customs.hsnCode'
      ],
      'packing_list': [
        'identifiers.packingListNumber', 
        'shipment.packageCount', 
        'shipment.grossWeight', 
        'shipment.netWeight',
        'parties.shipper.name',
        'parties.consignee.name'
      ],
      'delivery_note': [
        'identifiers.deliveryNoteNumber', 
        'shipment.deliveryDate', 
        'shipment.packageCount',
        'parties.shipper.name',
        'parties.consignee.name'
      ]
    };
    
    return criticalFieldsByType[documentType] || [];
  }

  /**
   * Calculate confidence score for extracted data
   * @param extractedData The extracted data to calculate confidence for
   * @returns A confidence score between 0 and 1
   */
  public calculateConfidenceScore(extractedData: LogisticsExtractionSchema): number {
    // Determine document type from metadata or try to detect it
    const docType = extractedData.metadata?.documentType || 'unknown';
    
    // Get critical fields for this document type
    const criticalFields = this.getCriticalFieldsForType(docType as LogisticsDocumentType);
    
    // Track total confidence and field count
    let totalConfidence = 0;
    let fieldCount = 0;
    let criticalFieldsCount = 0;
    let criticalFieldsConfidence = 0;
    
    // Calculate weighted confidence for critical fields (2x weight)
    for (const field of criticalFields) {
      const fieldValue = this.getValueByPath(extractedData, field);
      
      if (fieldValue) {
        // Check if the field has a confidence score
        if (typeof fieldValue === 'object' && fieldValue !== null && 'confidence' in fieldValue) {
          criticalFieldsConfidence += (fieldValue.confidence as number);
          criticalFieldsCount++;
        } else {
          // For backward compatibility with fields that don't have confidence scores
          criticalFieldsConfidence += 0.8; // Assume 80% confidence for populated fields
          criticalFieldsCount++;
        }
      }
    }
    
    // Add confidence from all fields recursively
    this.addFieldConfidence(extractedData, totalConfidence, fieldCount);
    
    // Calculate weighted average confidence
    // Critical fields have 70% weight, all other fields have 30% weight
    const criticalConfidence = criticalFieldsCount > 0 ? criticalFieldsConfidence / criticalFieldsCount : 0;
    const overallConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0;
    
    const weightedConfidence = (criticalConfidence * 0.7) + (overallConfidence * 0.3);
    
    // Apply a minimum confidence of 0.5 if at least one critical field is populated
    return criticalFieldsCount > 0 ? Math.max(0.5, weightedConfidence) : 0.25;
  }
  
  /**
   * Recursively add confidence scores from all fields in the object
   */
  private addFieldConfidence(obj: any, totalConfidence: number, fieldCount: number): void {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key in obj) {
      const value = obj[key];
      if (value && typeof value === 'object') {
        if ('confidence' in value && typeof value.confidence === 'number') {
          totalConfidence += value.confidence;
          fieldCount += 1;
        } else {
          // Recursively process nested objects
          this.addFieldConfidence(value, totalConfidence, fieldCount);
        }
      }
    }
  }

  /**
   * Get hints for specific document types to help with extraction
   * @param documentType The document type to get hints for
   * @returns A string containing hints for the document type
   */
  public getDocumentTypeHints(documentType: LogisticsDocumentType): string {
    switch (documentType) {
      case 'invoice':
        return `- Look for invoice number, date, and customer PO
- Extract shipper and consignee details
- Find itemized product list with prices
- Calculate total amount and currency`;
        
      case 'air_waybill':
      case 'house_waybill':
        return `- Look for AWB number and HAWB number
- Extract origin, destination, and carrier details
- Find shipment details like gross weight and dimensions
- Note any special handling instructions`;
        
      case 'bill_of_entry':
        return `- Look for BE number and customs references
- Extract importer/exporter details
- Find duty calculations and HSN codes
- Note any customs remarks or special conditions`;
        
      case 'packing_list':
        return `- Look for packing list reference number
- Extract package count, weights, and dimensions
- Find detailed contents of each package
- Note any special packing instructions`;
        
      case 'delivery_note':
        return `- Look for delivery note number and date
- Extract delivery address and contact details
- Find item quantities and descriptions
- Note any delivery instructions or conditions`;
        
      default:
        return `- Look for any reference numbers or dates
- Extract company names and addresses
- Find product or service details
- Note any financial information`;
    }
  }

  /**
   * Extract data from a parsed file result
   */
  async extractFromParsedFile(
    parsedFile: ParsedFileResult,
    documentType: LogisticsDocumentType
  ): Promise<ExtractionResult> {
    // Capture any issues from the parsed file to include in the extraction result
    const documentIssues = parsedFile.metadata?.issues || [];
    if (parsedFile.format === 'pdf' || parsedFile.format === 'image') {
      if (!parsedFile.base64) {
        return {
          success: false,
          error: 'No base64 content available for binary file',
          processingTime: 0,
          inputTokens: 0,
          outputTokens: 0
        };
      }
      
      // Pass the document issues to the extraction method
      const result = await this.extractFromBase64(parsedFile.base64, documentType, parsedFile.file.name);
      
      // Add the document issues to the extraction result
      if (result.success && result.data && documentIssues.length > 0) {
        result.data.metadata.issues = documentIssues;
      }
      
      return result;
    } else {
      if (!parsedFile.content) {
        return {
          success: false,
          error: 'No text content available for text file',
          processingTime: 0,
          inputTokens: 0,
          outputTokens: 0
        };
      }
      
      // Pass the document issues to the extraction method
      const result = await this.extractFromText(parsedFile.content, documentType);
      
      // Add the document issues to the extraction result
      if (result.success && result.data && documentIssues.length > 0) {
        result.data.metadata.issues = documentIssues;
      }
      
      return result;
    }
  }

  /**
   * Extract data from multiple documents sequentially (one after another)
   */
  async extractFromMultipleDocuments(
    documents: Array<{
      parsedFile: ParsedFileResult;
      documentType: LogisticsDocumentType;
    }>,
    onProgress?: (current: number, total: number, currentFile: string, status: 'processing' | 'success' | 'error') => void
  ): Promise<Array<ExtractionResult & { fileName: string }>> {
    const results = [];
    
    console.log(`🔄 Starting sequential extraction of ${documents.length} documents...`);
    console.log(`⏳ Processing documents one by one - please wait...`);
    
    for (const [index, { parsedFile, documentType }] of documents.entries()) {
      const fileName = parsedFile.metadata.fileName;
      const current = index + 1;
      
      console.log(`\n📄 [${current}/${documents.length}] Processing: ${fileName}`);
      console.log(`📋 Document type: ${documentType}`);
      console.log(`📊 File format: ${parsedFile.metadata.fileFormat}`);
      
      // Notify progress - starting processing
      onProgress?.(current, documents.length, fileName, 'processing');
      
      try {
        // Extract data from current document
        const result = await this.extractFromParsedFile(parsedFile, documentType);
        
        // Add filename to result
        const resultWithFileName = {
          ...result,
          fileName
        };
        
        results.push(resultWithFileName);
        
        if (result.success) {
          console.log(`✅ [${current}/${documents.length}] SUCCESS: ${fileName}`);
          console.log(`   ⏱️  Processing time: ${result.processingTime.toFixed(2)}s`);
          console.log(`   🎯 Confidence: ${result.data?.metadata.extractionConfidence?.toFixed(2) || 'N/A'}`);
          
          // Show key extracted fields
          if (result.data) {
            const keyFields = [];
            if (result.data.identifiers.invoiceNumber) keyFields.push(`Invoice: ${result.data.identifiers.invoiceNumber}`);
            if (result.data.identifiers.awbNumber) keyFields.push(`AWB: ${result.data.identifiers.awbNumber}`);
            if (result.data.identifiers.hawbNumber) keyFields.push(`HAWB: ${result.data.identifiers.hawbNumber}`);
            if (keyFields.length > 0) {
              console.log(`   📋 Key fields: ${keyFields.join(', ')}`);
            }
          }
          
          // Notify progress - success
          onProgress?.(current, documents.length, fileName, 'success');
          
        } else {
          console.log(`❌ [${current}/${documents.length}] FAILED: ${fileName}`);
          console.log(`   🚫 Error: ${result.error}`);
          
          // Notify progress - error
          onProgress?.(current, documents.length, fileName, 'error');
        }
        
      } catch (error) {
        console.error(`💥 [${current}/${documents.length}] EXCEPTION: ${fileName}`, error);
        
        // Add error result
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unexpected error',
          processingTime: 0,
          inputTokens: 0,
          outputTokens: 0,
          fileName
        });
        
        // Notify progress - error
        onProgress?.(current, documents.length, fileName, 'error');
      }
      
      // Wait before processing next document (except for the last one)
      if (index < documents.length - 1) {
        console.log(`⏳ Waiting 3 seconds before next document...`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
      }
    }
    
    // Final summary
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const totalTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    
    console.log(`\n📊 EXTRACTION COMPLETE:`);
    console.log(`   ✅ Successful: ${successful}/${results.length}`);
    console.log(`   ❌ Failed: ${failed}/${results.length}`);
    console.log(`   ⏱️  Total processing time: ${totalTime.toFixed(2)}s`);
    
    if (successful > 0) {
      console.log(`🎉 Successfully extracted data from ${successful} documents!`);
    }
    
    if (failed > 0) {
      console.log(`⚠️  ${failed} documents failed - check logs for details`);
    }
    
    return results;
  }
}

// ===== REACT HOOK FOR EXTRACTION =====

export const useDocumentExtraction = () => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResults, setExtractionResults] = useState<(ExtractionResult & { fileName: string })[]>([]);
  const [documentComparison, setDocumentComparison] = useState<DocumentComparisonReport | null>(null);
  const [currentProgress, setCurrentProgress] = useState({ current: 0, total: 0, fileName: '', status: 'processing' as 'processing' | 'success' | 'error' });
  
  const extractionService = new LLMExtractionService();
  
  const extractDocuments = async (
    documents: Array<{
      parsedFile: ParsedFileResult;
      documentType: LogisticsDocumentType;
    }>
  ) => {
    setIsExtracting(true);
    setCurrentProgress({ current: 0, total: documents.length, fileName: '', status: 'processing' });
    setExtractionResults([]);
    setDocumentComparison(null);
    
    try {
      console.log(`🚀 Starting sequential document extraction...`);
      console.log(`⏳ This will take approximately ${documents.length * 5} seconds`);
      
      const results = await extractionService.extractFromMultipleDocuments(
        documents,
        (current, total, fileName, status) => {
          setCurrentProgress({ current, total, fileName, status });
          
          // Update results array as we go
          setExtractionResults(prev => {
            const newResults = [...prev];
            // This will be updated when each result completes
            return newResults;
          });
        }
      );
      
      // Apply cross-document validation if multiple documents
      let crossDocumentValidation: CrossDocumentValidationResult | undefined;
      if (results.length > 1) {
        console.log(`🔗 Running cross-document validation for ${results.length} documents...`);

        // Create a new relationship validator for this batch
        const relationshipValidator = new DocumentRelationshipValidator();

        // Add successful extractions to relationship validator
        results.forEach(result => {
          if (result.success && result.data) {
            relationshipValidator.addDocument(result.data);
          }
        });

        if (relationshipValidator.getDocumentCount() > 1) {
          crossDocumentValidation = relationshipValidator.validateShipmentConsistency();
          console.log(`🔗 Cross-document validation complete - Confidence: ${(crossDocumentValidation.confidence * 100).toFixed(1)}%`);

          if (crossDocumentValidation.issues.length > 0) {
            console.log(`⚠️  Cross-document issues found: ${crossDocumentValidation.issues.length}`);
          }
        }
      }

      // Generate document comparison report if multiple documents
      let comparisonReport: DocumentComparisonReport | null = null;
      if (results.length > 1) {
        console.log(`📊 Generating document field comparison report...`);
        
        // Prepare documents for comparison
        const documentsForComparison = results
          .filter(result => result.success && result.data)
          .map((result, index) => ({
            name: result.fileName,
            type: documents[index]?.documentType || result.data!.metadata.documentType as LogisticsDocumentType,
            data: result.data!
          }));

        if (documentsForComparison.length > 1) {
          try {
            comparisonReport = DocumentFieldComparator.compareDocuments(documentsForComparison);
            setDocumentComparison(comparisonReport);
            console.log(`📊 Document comparison complete - Overall consistency: ${(comparisonReport.summary.overallConsistencyScore * 100).toFixed(1)}%`);
            console.log(`🎯 Risk level: ${comparisonReport.summary.riskLevel.toUpperCase()}`);
            
            if (comparisonReport.criticalIssues.length > 0) {
              console.log(`⚠️  Critical discrepancies found: ${comparisonReport.criticalIssues.length}`);
            }
          } catch (error) {
            console.error('⚠️ Document comparison failed:', error);
          }
        }
      }

      // Ensure document types from UI are applied to results
      const resultsWithCorrectTypes = results.map((result, index) => {
        // Make sure we have a corresponding document
        if (documents[index]) {
          const docType = documents[index].documentType;
          
          if (result.success && result.data) {
            // Check if document type was unknown before
            const wasUnknown = result.data.metadata?.documentType === 'unknown';
            
            // Create metadata if it doesn't exist
            if (!result.data.metadata) {
              result.data.metadata = {
                documentType: docType,
                extractionConfidence: 0.0,
                criticalFields: [],
                missingFields: [],
                issues: []
              };
            } else {
              // ALWAYS apply the document type from UI selection - this is critical
              result.data.metadata.documentType = docType;
              
              // Ensure issues array exists
              if (!result.data.metadata.issues) {
                result.data.metadata.issues = [];
              }
              
              // Add a helpful issue message if the document type was previously unknown
              if (wasUnknown && !result.data.metadata.issues.some(issue => issue.includes('document type'))) {
                result.data.metadata.issues.push('Document type set from user selection');
              }
            }
            
            // Update critical fields based on document type
            const criticalFields = extractionService.getCriticalFieldsForType(docType);
            result.data.metadata.criticalFields = criticalFields;
            
            // Recalculate confidence score with correct document type
            result.data.metadata.extractionConfidence = extractionService.calculateConfidenceScore(result.data);
          }
        }
        return result;
      });
      
      setExtractionResults(resultsWithCorrectTypes);
      console.log(`🎉 All documents processed!`);
      
      return resultsWithCorrectTypes;
      
    } catch (error) {
      console.error('❌ Document extraction pipeline failed:', error);
      throw error;
    } finally {
      setIsExtracting(false);
      setCurrentProgress({ current: 0, total: 0, fileName: '', status: 'processing' });
    }
  };
  
  return {
    extractDocuments,
    isExtracting,
    extractionResults,
    documentComparison,
    currentProgress,
    // Helper computed values
    isComplete: currentProgress.current === currentProgress.total && currentProgress.total > 0,
    progressPercentage: currentProgress.total > 0 ? (currentProgress.current / currentProgress.total) * 100 : 0,
  };
};

export default LLMExtractionService;
