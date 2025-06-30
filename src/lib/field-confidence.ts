/**
 * Field-level confidence scoring for document extraction
 * 
 * This module provides types and utilities for tracking and calculating
 * confidence scores at both the field and document level.
 */

import { LogisticsDocumentType } from './document-types';

/**
 * Represents a field value with its associated confidence score
 */
export interface ConfidenceField<T> {
  value: T;
  confidence: number; // 0.0 to 1.0
}

/**
 * Calculate document-level confidence from field-level confidence scores
 * @param extractedData The extracted data with field-level confidence scores
 * @param documentType The document type to get critical fields for
 * @returns A document-level confidence score between 0 and 1
 */
export function calculateDocumentConfidence(extractedData: any, documentType: LogisticsDocumentType): number {
  // Get critical fields for this document type
  const criticalFields = getCriticalFieldsForType(documentType);
  
  // Track total confidence and field count
  let totalConfidence = 0;
  let fieldCount = 0;
  
  // Calculate weighted confidence for critical fields
  for (const field of criticalFields) {
    const fieldValue = getValueByPath(extractedData, field);
    if (fieldValue && typeof fieldValue === 'object' && 'confidence' in fieldValue) {
      // Critical fields have double weight
      totalConfidence += fieldValue.confidence * 2;
      fieldCount += 2;
    }
  }
  
  // Add confidence from all other fields (with normal weight)
  addFieldConfidence(extractedData, totalConfidence, fieldCount);
  
  // Calculate average confidence
  return fieldCount > 0 ? totalConfidence / fieldCount : 0.5;
}

/**
 * Recursively add confidence scores from all fields in the object
 */
function addFieldConfidence(obj: any, totalConfidence: number, fieldCount: number): void {
  if (!obj || typeof obj !== 'object') return;
  
  for (const key in obj) {
    const value = obj[key];
    if (value && typeof value === 'object') {
      if ('confidence' in value && typeof value.confidence === 'number') {
        totalConfidence += value.confidence;
        fieldCount += 1;
      } else {
        // Recursively process nested objects
        addFieldConfidence(value, totalConfidence, fieldCount);
      }
    }
  }
}

/**
 * Get critical fields for a specific document type
 */
function getCriticalFieldsForType(documentType: LogisticsDocumentType): string[] {
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
 * Get a value from an object by dot-separated path
 */
function getValueByPath(obj: any, path: string): any {
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
