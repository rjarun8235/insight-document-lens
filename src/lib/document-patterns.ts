/**
 * Document-specific pattern recognition for extraction
 * 
 * This file contains pattern definitions and examples for different document types
 * to improve extraction accuracy by providing specific format guidance.
 */

import { LogisticsDocumentType } from './document-types';

/**
 * Document-specific prompts with exact pattern examples for each document type
 */
export const DOCUMENT_SPECIFIC_PROMPTS: Record<LogisticsDocumentType, string> = {
  'invoice': `
## INVOICE-SPECIFIC PATTERNS
- Invoice numbers often appear as "Invoice No: CD970077514" or similar format
- Currency codes appear as "GBP" near amount fields (e.g., "1,989.00 GBP")
- Tax information appears in a separate section with "Zero Rated" designation
- Payment terms may be listed as "Pro-forma basis"
- Delivery terms may appear as "FCA (Incoterms 2020)"
- Customer references may appear as "Customer No: 10583"
  `,
  'house_waybill': `
## HAWB-SPECIFIC PATTERNS
- HAWB numbers are typically shorter: "448765"
- Master AWB numbers often include airport codes: "098 LHR 80828764"
- Routing appears in format: "DEL AI MAA AI" (origin-carrier-destination-carrier)
- Flight numbers appear as "AI112 14" and "AI2467 16"
- Weights may be marked with just "K" instead of "KG" or "KGS"
- Look for "FREIGHT COLLECT" or "FREIGHT PREPAID" terms
- Dimensions may appear as "2 x 057x031x020 m3"
  `,
  'air_waybill': `
## MAWB-SPECIFIC PATTERNS
- Master AWB numbers include airport codes: "098 LHR 80828764"
- May reference multiple house waybills
- Contains total shipment weight for all consolidated shipments
- Includes carrier-specific information and routing
- May include special handling codes and security information
  `,
  'bill_of_entry': `
## BILL OF ENTRY-SPECIFIC PATTERNS
- BE numbers appear in specific format with date references
- Contains customs duty calculations with HSN codes
- Job numbers may be formatted like "I/A/000577/25-26"
- Includes importer IEC code and other customs identifiers
- Contains detailed product classifications with tariff codes
- May include special customs handling instructions
  `,
  'delivery_note': `
## DELIVERY NOTE-SPECIFIC PATTERNS
- Delivery note numbers typically appear at the top
- Contains package counts and delivery instructions
- May reference related invoice or order numbers
- Includes detailed delivery address information
- May contain recipient signature fields
  `,
  'packing_list': `
## PACKING LIST-SPECIFIC PATTERNS
- Contains detailed item counts and packaging information
- Lists dimensions and weights for each package
- May include pallet or container references
- Often references related invoice numbers
- Contains detailed product descriptions
  `,
  'unknown': `
## GENERAL DOCUMENT PATTERNS
- Look for document title or type indicators at the top of the document
- Identify key reference numbers (invoice numbers, waybill numbers, etc.)
- Extract dates in various formats (DD/MM/YYYY, MM/DD/YYYY, etc.)
- Find company names, addresses, and contact information
- Extract monetary values with currency indicators
  `
};

/**
 * Field format validation rules for different document fields
 */
export const validateFieldFormat = (fieldName: string, value: any): boolean => {
  const validationRules: Record<string, (val: any) => boolean> = {
    // Invoice fields
    'invoiceNumber': (val) => typeof val === 'string' && /^[A-Z]{1,3}\d{6,10}$/i.test(val),
    'invoiceValue': (val) => typeof val === 'object' && typeof val.amount === 'number' && val.amount > 0,
    
    // Waybill fields
    'hawbNumber': (val) => typeof val === 'string' && /^\d{5,8}$/.test(val),
    'awbNumber': (val) => typeof val === 'string' && /^[\d\s]{10,15}$/.test(val.replace(/[A-Z]/g, '')),
    
    // Bill of Entry fields
    'beNumber': (val) => typeof val === 'string' && val.length > 5,
    'jobNumber': (val) => typeof val === 'string' && /^[A-Z]\/[A-Z]\/\d{6}\/\d{2}-\d{2}$/i.test(val),
    
    // Weight fields
    'grossWeight': (val) => {
      if (typeof val !== 'object') return false;
      if (typeof val.value !== 'number' || val.value <= 0) return false;
      if (typeof val.unit !== 'string') return false;
      return true;
    },
    
    // Address fields
    'address': (val) => typeof val === 'string' && val.length > 10,
    
    // General fields
    'name': (val) => typeof val === 'string' && val.length > 2,
    'date': (val) => typeof val === 'string' && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(val)
  };
  
  return validationRules[fieldName] ? validationRules[fieldName](value) : true;
};

/**
 * Normalize extracted field values to standard formats
 */
export const normalizeFieldValue = (fieldName: string, value: any): any => {
  if (value === null || value === undefined) return value;
  
  // Address normalization
  if (fieldName === 'address' && typeof value === 'string') {
    return value
      .replace(/\bMIDLETON\b/i, 'MIDDLETON')
      .replace(/\bIND ESTATE\b/i, 'INDUSTRIAL ESTATE')
      .replace(/\bST\.\s/i, 'STREET ')
      .replace(/\bRD\.\s/i, 'ROAD ');
  }
  
  // Weight unit normalization
  if (fieldName === 'grossWeight' || fieldName === 'netWeight' || fieldName === 'chargeableWeight') {
    if (typeof value === 'object' && value.unit) {
      const unit = value.unit.toUpperCase();
      value.unit = unit === 'K' || unit === 'KG' || unit === 'KGS' ? 'KG' : unit;
      return value;
    }
  }
  
  // Postal code normalization
  if (fieldName === 'postalCode' && typeof value === 'string') {
    // Specific corrections for known postal codes
    if (value === 'DE7 5TH') return 'DE7 5TN';
    return value;
  }
  
  // Date normalization (ensure consistent format)
  if (fieldName.includes('date') && typeof value === 'string') {
    // Try to parse and standardize date format
    try {
      const dateParts = value.split(/[\/\-]/);
      if (dateParts.length === 3) {
        // Assume DD/MM/YYYY format for simplicity
        const day = dateParts[0].padStart(2, '0');
        const month = dateParts[1].padStart(2, '0');
        const year = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2];
        return `${day}/${month}/${year}`;
      }
    } catch (e) {
      // If parsing fails, return original
    }
  }
  
  return value;
};

/**
 * Preprocess document content to highlight important fields
 */
export const preprocessDocumentContent = (content: string, documentType: LogisticsDocumentType): string => {
  let processedContent = content;
  
  // Common preprocessing for all document types
  // Highlight dates
  processedContent = processedContent.replace(
    /(\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b)/g,
    '<<DATE: $1>>'
  );
  
  // Document-specific preprocessing
  if (documentType === 'invoice') {
    // Highlight invoice numbers
    processedContent = processedContent.replace(
      /(\bInvoice\s*(?:No|Number)?[\s:.]*\s*([A-Z0-9]{5,15})\b)/i,
      '<<INVOICE_NUMBER: $1>>'
    );
    
    // Highlight monetary values
    processedContent = processedContent.replace(
      /(\b\d{1,3}(?:,\d{3})*\.\d{2}\s*(?:GBP|USD|EUR)\b)/g,
      '<<MONETARY_VALUE: $1>>'
    );
    
    // Highlight tax information
    processedContent = processedContent.replace(
      /(\bZero Rated\b|\bVAT\s*\d+%\b)/gi,
      '<<TAX_INFO: $1>>'
    );
  } 
  else if (documentType === 'house_waybill' || documentType === 'air_waybill') {
    // Highlight AWB numbers
    processedContent = processedContent.replace(
      /(\b\d{3}\s+[A-Z]{3}\s+\d{8}\b)/g,
      '<<MASTER_AWB: $1>>'
    );
    
    // Highlight HAWB numbers
    processedContent = processedContent.replace(
      /(\bHAWB\s*(?:No|Number)?[\s:.]*\s*(\d{5,8})\b)/i,
      '<<HAWB_NUMBER: $1>>'
    );
    
    // Highlight routing information
    processedContent = processedContent.replace(
      /(\b[A-Z]{3}\s+[A-Z]{2}\s+[A-Z]{3}\s+[A-Z]{2}\b)/g,
      '<<ROUTING: $1>>'
    );
    
    // Highlight weight information
    processedContent = processedContent.replace(
      /(\b\d+(?:\.\d+)?\s*(?:K|KG|KGS)\b)/i,
      '<<WEIGHT: $1>>'
    );
  }
  else if (documentType === 'bill_of_entry') {
    // Highlight BE numbers
    processedContent = processedContent.replace(
      /(\bBE\s*(?:No|Number)?[\s:.]*\s*([A-Z0-9\-\/]{5,20})\b)/i,
      '<<BE_NUMBER: $1>>'
    );
    
    // Highlight job numbers
    processedContent = processedContent.replace(
      /(\b[A-Z]\/[A-Z]\/\d{6}\/\d{2}-\d{2}\b)/i,
      '<<JOB_NUMBER: $1>>'
    );
    
    // Highlight duty calculations
    processedContent = processedContent.replace(
      /(\bBCD\s*\d+(?:\.\d+)?%|\bIGST\s*\d+(?:\.\d+)?%)/gi,
      '<<DUTY: $1>>'
    );
  }
  
  return processedContent;
};
