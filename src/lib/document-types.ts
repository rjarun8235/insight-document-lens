// Document type definitions and utilities for smart document detection

// Types for logistics document handling
export type LogisticsDocumentType = 
  | 'invoice' 
  | 'delivery_note' 
  | 'house_waybill' 
  | 'air_waybill' 
  | 'bill_of_entry' 
  | 'packing_list'
  | 'unknown';

export interface LogisticsDocumentFile {
  id: string;
  name: string;
  file: File;
  type: LogisticsDocumentType;
  fileFormat: 'pdf' | 'image' | 'excel' | 'word' | 'txt' | 'unknown';
  size: number;
  base64?: string;
  confidence?: number;
  validationStatus?: 'pending' | 'processing' | 'validated' | 'error';
  issues?: string[];
  suggestedDocType?: LogisticsDocumentType;
}

// Document type guidance information
export const DOCUMENT_TYPE_GUIDANCE = {
  invoice: {
    name: 'Commercial Invoice',
    icon: '🧾',
    keywords: ['invoice', 'commercial invoice', 'bill', 'inv', 'proforma'],
    filenameExamples: [
      'Invoice_CD970077514.pdf',
      'Commercial_Invoice_12345.pdf',
      'INV-2025-001.pdf'
    ],
    contentHints: [
      'Contains invoice number and date',
      'Shows itemized products with prices',
      'Includes seller and buyer information',
      'Has total amount with currency'
    ],
    importance: 'Required for customs valuation and duty calculation'
  },
  house_waybill: {
    name: 'House Air Waybill (HAWB)',
    icon: '✈️',
    keywords: ['hawb', 'house air waybill', 'house waybill'],
    filenameExamples: [
      'HAWB_448765.pdf',
      'HouseWaybill_448765.pdf',
      'House_Airway_Bill.pdf'
    ],
    contentHints: [
      'Contains HAWB number and Master AWB reference',
      'Shows flight routing and carrier info',
      'Includes gross and chargeable weights',
      'Has shipper and consignee details'
    ],
    importance: 'Required for air cargo tracking and customs clearance'
  },
  air_waybill: {
    name: 'Master Air Waybill (MAWB)',
    icon: '✈️',
    keywords: ['mawb', 'master air waybill', 'awb', 'airway bill', 'air waybill'],
    filenameExamples: [
      'MAWB_09880828764.pdf',
      'AWB_09880828764.pdf',
      'AirWaybill_448765.pdf'
    ],
    contentHints: [
      'Contains Master AWB number',
      'Shows flight routing and carrier info',
      'Includes total shipment weight',
      'Has shipper and consignee details',
      'May reference multiple house waybills'
    ],
    importance: 'Required for air cargo tracking and customs clearance'
  },
  bill_of_entry: {
    name: 'Bill of Entry',
    icon: '🏛️',
    keywords: ['bill of entry', 'customs entry', 'be', 'customs declaration', 'checklist'],
    filenameExamples: [
      'BillOfEntry_577.pdf',
      'BE_Checklist_2025.pdf',
      'Customs_Entry_577.xlsx'
    ],
    contentHints: [
      'Contains BE number and job number',
      'Shows duty calculations and HSN codes',
      'Includes customs station information',
      'Has importer and exporter details'
    ],
    importance: 'Critical for customs clearance and duty payment'
  },
  delivery_note: {
    name: 'Delivery Note',
    icon: '📦',
    keywords: ['delivery note', 'shipment delivery', 'delivery receipt', 'dispatch note'],
    filenameExamples: [
      'DeliveryNote_178389.pdf',
      'ShipmentDelivery_89099.pdf',
      'DN_12345.pdf'
    ],
    contentHints: [
      'Contains delivery note number',
      'Shows packaging details and weights',
      'Includes delivery address',
      'Has shipment tracking information'
    ],
    importance: 'Confirms physical shipment details and packaging'
  },
  packing_list: {
    name: 'Packing List',
    icon: '📋',
    keywords: ['packing list', 'pack list', 'cargo manifest', 'shipping list'],
    filenameExamples: [
      'PackingList_89099.pdf',
      'CargoManifest_2025.pdf',
      'ShippingList_001.pdf'
    ],
    contentHints: [
      'Lists individual packages and contents',
      'Shows dimensions and weights per package',
      'Includes marking and numbering',
      'Details product descriptions'
    ],
    importance: 'Provides detailed breakdown of shipment contents'
  }
};

// Helper function to analyze document filename and suggest document type
export const analyzeDocument = (filename: string, fileContent?: string): {
  suggestedType: LogisticsDocumentType;
  confidence: number;
  matchedKeywords: string[];
  suggestions: string[];
} => {
  const lowerName = filename.toLowerCase();
  const scores: Record<string, { score: number; keywords: string[] }> = {};
  
  // Initialize scores
  Object.keys(DOCUMENT_TYPE_GUIDANCE).forEach(type => {
    scores[type] = { score: 0, keywords: [] };
  });
  
  // Check filename against keywords
  Object.entries(DOCUMENT_TYPE_GUIDANCE).forEach(([type, guidance]) => {
    guidance.keywords.forEach(keyword => {
      if (lowerName.includes(keyword.toLowerCase())) {
        scores[type].score += keyword.length; // Longer matches get higher scores
        scores[type].keywords.push(keyword);
      }
    });
  });
  
  // Find best match
  const bestMatch = Object.entries(scores).reduce((best, [type, data]) => {
    return data.score > best.score ? { type, ...data } : best;
  }, { type: 'unknown', score: 0, keywords: [] as string[] });
  
  // Generate suggestions for improvement
  const suggestions: string[] = [];
  if (bestMatch.score === 0) {
    suggestions.push('Consider renaming file to include document type (e.g., "Invoice_", "HAWB_", "BillOfEntry_")');
  } else if (bestMatch.score < 5) {
    suggestions.push('Filename partially matches. Consider using more specific naming for better detection.');
  }
  
  // Calculate confidence (0-1)
  const confidence = Math.min(bestMatch.score / 10, 1);
  
  return {
    suggestedType: bestMatch.type as LogisticsDocumentType,
    confidence,
    matchedKeywords: bestMatch.keywords,
    suggestions
  };
};

// Helper function to convert file to base64
export const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

// Generate a simple ID based on filename and current timestamp
export function generateDocumentId(fileName: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const cleanName = fileName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
  return `${cleanName}-${timestamp}-${randomSuffix}`;
}
