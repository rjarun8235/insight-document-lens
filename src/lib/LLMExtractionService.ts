// LLM EXTRACTION SERVICE
// Connects parsed documents to Claude API via Supabase proxy

import { ParsedFileResult } from './FileParser';
import { LogisticsDocumentType } from './document-types';
import { useState } from 'react';

// ===== EXTRACTION SCHEMA (FROM YOUR AGREED DESIGN) =====

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
  };

  // Party information (shipper/consignee)
  parties: {
    shipper: {
      name: string | null;               // "R.A. LABONE & CO LTD"
      address: string | null;            // Complete address
      country: string | null;            // "UNITED KINGDOM"
      phone: string | null;              // Contact information
    };
    consignee: {
      name: string | null;               // "SKI MANUFACTURING"
      address: string | null;            // Complete address
      country: string | null;            // "INDIA"
      customerNumber: string | null;     // "10583"
      importerCode: string | null;       // "ADKFS7580G"
      adCode: string | null;             // "0510004"
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
    "missingFields": []
  }
}

## CONFIDENCE SCORING:
- 0.95-1.0: Clear, unambiguous extraction
- 0.85-0.94: High confidence with minor formatting issues
- 0.70-0.84: Moderate confidence, some fields unclear
- 0.50-0.69: Low confidence, significant uncertainty
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

export interface ExtractionResult {
  success: boolean;
  data?: LogisticsExtractionSchema;
  error?: string;
  processingTime: number;
  inputTokens: number;
  outputTokens: number;
}

export class LLMExtractionService {
  private supabaseProxyUrl: string;
  
  constructor(supabaseProxyUrl: string = 'https://cbrgpzdxttzlvvryysaf.supabase.co/functions/v1/claude-api-proxy') {
    this.supabaseProxyUrl = supabaseProxyUrl;
  }

  /**
   * Extract data from a text-based document (TXT, CSV, Excel, Word)
   */
  private async extractFromText(
    content: string, 
    documentType: LogisticsDocumentType
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.supabaseProxyUrl}/extraction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: LOGISTICS_EXTRACTION_PROMPT + content
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

      // Extract the JSON content from Claude's response
      const claudeResponse = result.content[0].text;
      
      // Clean and parse the JSON response
      const cleanedResponse = this.cleanJsonResponse(claudeResponse);
      const extractedData = JSON.parse(cleanedResponse);

      // Add metadata
      extractedData.metadata = {
        ...extractedData.metadata,
        documentType: documentType
      };
      
      return {
        success: true,
        data: extractedData,
        processingTime,
        inputTokens: result.usage?.input_tokens || 0,
        outputTokens: result.usage?.output_tokens || 0
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
      let requestBody;
      
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
        
        // Add metadata to extraction result
        // Set a default confidence score based on the completeness of the extraction
        const confidenceScore = this.calculateConfidenceScore(extractedData);
        
        extractedData.metadata = {
          ...extractedData.metadata,
          documentType: documentType,
          extractionConfidence: confidenceScore
          // Document issues are now added in the extractFromParsedFile method
        };
        
        // Calculate processing time
        const processingTime = (performance.now() - startTime) / 1000; // in seconds
        
        return {
          success: true,
          data: extractedData,
          processingTime,
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0
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
   * Calculate a confidence score based on the completeness of the extraction
   * @param extractedData The extracted data to calculate confidence for
   * @returns A confidence score between 0 and 1
   */
  private calculateConfidenceScore(extractedData: LogisticsExtractionSchema): number {
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
    
    // If document type is unknown but we can detect it from the content, update it
    if (docType === 'unknown') {
      // Check for invoice-specific fields
      if (extractedData.identifiers.invoiceNumber && extractedData.commercial.invoiceValue?.amount) {
        docType = 'invoice';
        extractedData.metadata.documentType = 'invoice';
      }
      // Check for house waybill specific fields
      else if (extractedData.identifiers.hawbNumber && extractedData.identifiers.awbNumber) {
        docType = 'house_waybill';
        extractedData.metadata.documentType = 'house_waybill';
      }
      // Check for bill of entry specific fields
      else if (extractedData.identifiers.beNumber || extractedData.customs.duties?.bcd) {
        docType = 'bill_of_entry';
        extractedData.metadata.documentType = 'bill_of_entry';
      }
      // Check for delivery note specific fields
      else if (extractedData.identifiers.deliveryNoteNumber) {
        docType = 'delivery_note';
        extractedData.metadata.documentType = 'delivery_note';
      }
    }
    
    const criticalFields = criticalFieldsByType[docType] || [];
    
    if (criticalFields.length === 0) {
      // If we don't have critical fields defined for this type, use a default score
      return 0.75;
    }
    
    // Count how many critical fields are populated
    let populatedCount = 0;
    
    for (const field of criticalFields) {
      // Handle nested fields like 'parties.shipper.name'
      const parts = field.split('.');
      let value: any = extractedData;
      
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
      }
    }
    
    // Calculate confidence based on percentage of critical fields populated
    const baseConfidence = populatedCount / criticalFields.length;
    
    // Apply a minimum confidence of 0.5 if at least one critical field is populated
    return populatedCount > 0 ? Math.max(0.5, baseConfidence) : 0.25;
  }
  
  // Get hints for specific document types to help with extraction
  getDocumentTypeHints(documentType: LogisticsDocumentType): string {
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
      
      setExtractionResults(results);
      console.log(`🎉 All documents processed!`);
      
      return results;
      
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
    currentProgress,
    // Helper computed values
    isComplete: currentProgress.current === currentProgress.total && currentProgress.total > 0,
    progressPercentage: currentProgress.total > 0 ? (currentProgress.current / currentProgress.total) * 100 : 0,
  };
};

export default LLMExtractionService;
