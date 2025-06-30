/**
 * Document-specific validation rules for extraction
 * 
 * This file contains validation rules for different document types
 * to ensure extracted data matches the expected schema structure.
 */

import { LogisticsDocumentType } from './document-types';

/**
 * Field format validation rules for different document fields
 * Properly aligned with the schema structure for complex objects
 */
export const validateFieldFormat = (fieldName: string, value: any): boolean => {
  const validationRules: Record<string, (val: any) => boolean> = {
    // Invoice fields
    'invoiceNumber': (val) => typeof val === 'string' && /^[A-Z]{1,3}\d{6,10}$/i.test(val),
    'invoiceValue': (val) => {
      if (typeof val !== 'object' || val === null) return false;
      return typeof val.amount === 'number' && val.amount > 0 && 
             typeof val.currency === 'string' && val.currency.length > 0;
    },
    
    // Waybill fields
    'hawbNumber': (val) => typeof val === 'string' && /^\d{5,8}$/i.test(val),
    'awbNumber': (val) => typeof val === 'string' && /^\d{3}[\s-]?\d{8}$/i.test(val),
    
    // Bill of Entry fields
    'beNumber': (val) => typeof val === 'string' && val.length > 5,
    'jobNumber': (val) => typeof val === 'string' && /^[A-Z]\/[A-Z]\/\d{6}\/\d{2}-\d{2}$/i.test(val),
    
    // Weight and dimension fields
    'grossWeight': (val) => {
      if (typeof val !== 'object' || val === null) return false;
      return typeof val.value === 'number' && val.value > 0 && 
             typeof val.unit === 'string' && val.unit.length > 0;
    },
    'netWeight': (val) => {
      if (typeof val !== 'object' || val === null) return false;
      return typeof val.value === 'number' && val.value > 0 && 
             typeof val.unit === 'string' && val.unit.length > 0;
    },
    'chargeableWeight': (val) => {
      if (typeof val !== 'object' || val === null) return false;
      return typeof val.value === 'number' && val.value > 0 && 
             typeof val.unit === 'string' && val.unit.length > 0;
    },
    'packageCount': (val) => {
      if (typeof val !== 'object' || val === null) return false;
      return typeof val.value === 'number' && val.value > 0 && Number.isInteger(val.value);
    },
    'dimensions': (val) => {
      if (typeof val !== 'object' || val === null) return false;
      if (!Array.isArray(val.dimensions) || val.dimensions.length === 0) return false;
      return val.dimensions.every((dim: any) => 
        typeof dim.length === 'number' && dim.length > 0 &&
        typeof dim.width === 'number' && dim.width > 0 &&
        typeof dim.height === 'number' && dim.height > 0 &&
        typeof dim.unit === 'string' && dim.unit.length > 0
      );
    },
    
    // Customs fields
    'duties': (val) => {
      if (typeof val !== 'object' || val === null) return false;
      // At least one duty type should be present
      return (typeof val.bcd === 'number' || 
              typeof val.igst === 'number' || 
              typeof val.cess === 'number');
    },
    'hsnCode': (val) => typeof val === 'string' && /^\d{4,8}$/.test(val),
    
    // Address and party fields
    'address': (val) => typeof val === 'string' && val.length > 10,
    'name': (val) => typeof val === 'string' && val.length > 2,
    'email': (val) => typeof val === 'string' && /^[^@]+@[^@]+\.[^@]+$/.test(val),
    'phone': (val) => typeof val === 'string' && /^[\d\+\-\(\)\s]{7,20}$/.test(val),
    
    // Date fields
    'date': (val) => typeof val === 'string' && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(val),
    'shipmentDate': (val) => typeof val === 'string' && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(val),
    'deliveryDate': (val) => typeof val === 'string' && /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(val)
  };
  
  return validationRules[fieldName] ? validationRules[fieldName](value) : true;
};

/**
 * Type-specific validation rules for each document type
 * Ensures that document-specific required fields are present and valid
 */
export interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

/**
 * Validate extracted data against expected document type
 */
export const validateDocumentTypeData = (
  data: any, 
  documentType: LogisticsDocumentType
): ValidationResult => {
  const issues: string[] = [];
  
  // Common validation for all document types
  if (!data || typeof data !== 'object') {
    return { isValid: false, issues: ['Invalid data structure'] };
  }
  
  // Type-specific validation rules
  switch (documentType) {
    case 'invoice':
      validateInvoice(data, issues);
      break;
      
    case 'house_waybill':
      validateHouseWaybill(data, issues);
      break;
      
    case 'air_waybill':
      validateAirWaybill(data, issues);
      break;
      
    case 'bill_of_entry':
      validateBillOfEntry(data, issues);
      break;
      
    case 'packing_list':
      validatePackingList(data, issues);
      break;
      
    case 'delivery_note':
      validateDeliveryNote(data, issues);
      break;
      
    default:
      issues.push(`Unknown document type: ${documentType}`);
  }
  
  // Business logic validation for all document types
  validateBusinessLogic(data, documentType, issues);
  
  return { isValid: issues.length === 0, issues };
};

/**
 * Validate invoice-specific fields
 */
function validateInvoice(data: any, issues: string[]): void {
  // Required identifiers
  if (!data.identifiers?.invoiceNumber) {
    issues.push('Invoice number is required for invoice documents');
  }
  
  // Commercial information
  if (!data.commercial?.invoiceValue?.amount) {
    issues.push('Invoice value is required for invoice documents');
  }
  
  // Required parties
  if (!data.parties?.shipper?.name) {
    issues.push('Shipper name is required for invoice documents');
  }
  
  if (!data.parties?.consignee?.name) {
    issues.push('Consignee name is required for invoice documents');
  }
  
  // Date validation
  if (!data.commercial?.invoiceDate) {
    issues.push('Invoice date is required for invoice documents');
  }
}

/**
 * Validate house waybill-specific fields
 */
function validateHouseWaybill(data: any, issues: string[]): void {
  // Required identifiers
  if (!data.identifiers?.hawbNumber) {
    issues.push('HAWB number is required for house waybill documents');
  }
  
  if (!data.identifiers?.awbNumber) {
    issues.push('Master AWB number is required for house waybill documents');
  }
  
  // Required parties
  if (!data.parties?.shipper?.name) {
    issues.push('Shipper name is required for house waybill documents');
  }
  
  if (!data.parties?.consignee?.name) {
    issues.push('Consignee name is required for house waybill documents');
  }
  
  // Shipment details
  if (!data.shipment?.origin) {
    issues.push('Origin is required for house waybill documents');
  }
  
  if (!data.shipment?.destination) {
    issues.push('Destination is required for house waybill documents');
  }
  
  if (!data.shipment?.grossWeight) {
    issues.push('Gross weight is required for house waybill documents');
  }
}

/**
 * Validate air waybill-specific fields
 */
function validateAirWaybill(data: any, issues: string[]): void {
  // Required identifiers
  if (!data.identifiers?.awbNumber) {
    issues.push('AWB number is required for air waybill documents');
  }
  
  // Required parties
  if (!data.parties?.shipper?.name) {
    issues.push('Shipper name is required for air waybill documents');
  }
  
  if (!data.parties?.consignee?.name) {
    issues.push('Consignee name is required for air waybill documents');
  }
  
  // Shipment details
  if (!data.shipment?.origin) {
    issues.push('Origin is required for air waybill documents');
  }
  
  if (!data.shipment?.destination) {
    issues.push('Destination is required for air waybill documents');
  }
  
  if (!data.shipment?.grossWeight) {
    issues.push('Gross weight is required for air waybill documents');
  }
  
  // Carrier information
  if (!data.shipment?.carrier) {
    issues.push('Carrier information is required for air waybill documents');
  }
}

/**
 * Validate bill of entry-specific fields
 */
function validateBillOfEntry(data: any, issues: string[]): void {
  // Required identifiers
  if (!data.identifiers?.beNumber) {
    issues.push('BE number is required for bill of entry documents');
  }
  
  // Customs information
  if (!data.customs?.duties?.bcd && !data.customs?.duties?.igst) {
    issues.push('Duty information is required for bill of entry documents');
  }
  
  // Required parties
  if (!data.parties?.importer?.name) {
    issues.push('Importer name is required for bill of entry documents');
  }
  
  // Date validation
  if (!data.customs?.beDate) {
    issues.push('BE date is required for bill of entry documents');
  }
  
  // HSN code validation
  if (!data.customs?.hsnCode) {
    issues.push('HSN code is required for bill of entry documents');
  }
}

/**
 * Validate packing list-specific fields
 */
function validatePackingList(data: any, issues: string[]): void {
  // Required identifiers
  if (!data.identifiers?.packingListNumber) {
    issues.push('Packing list number is required for packing list documents');
  }
  
  // Required parties
  if (!data.parties?.shipper?.name) {
    issues.push('Shipper name is required for packing list documents');
  }
  
  if (!data.parties?.consignee?.name) {
    issues.push('Consignee name is required for packing list documents');
  }
  
  // Package details
  if (!data.shipment?.packageCount) {
    issues.push('Package count is required for packing list documents');
  }
  
  if (!data.shipment?.grossWeight) {
    issues.push('Gross weight is required for packing list documents');
  }
  
  if (!data.shipment?.netWeight) {
    issues.push('Net weight is required for packing list documents');
  }
}

/**
 * Validate delivery note-specific fields
 */
function validateDeliveryNote(data: any, issues: string[]): void {
  // Required identifiers
  if (!data.identifiers?.deliveryNoteNumber) {
    issues.push('Delivery note number is required for delivery note documents');
  }
  
  // Required parties
  if (!data.parties?.shipper?.name) {
    issues.push('Shipper name is required for delivery note documents');
  }
  
  if (!data.parties?.consignee?.name) {
    issues.push('Consignee name is required for delivery note documents');
  }
  
  // Delivery details
  if (!data.shipment?.deliveryDate) {
    issues.push('Delivery date is required for delivery note documents');
  }
  
  if (!data.shipment?.packageCount) {
    issues.push('Package count is required for delivery note documents');
  }
}

/**
 * Validate business logic across all document types
 */
function validateBusinessLogic(data: any, documentType: LogisticsDocumentType, issues: string[]): void {
  // Weight validation: Gross weight should be >= Net weight
  if (data.shipment?.grossWeight?.value && data.shipment?.netWeight?.value) {
    if (data.shipment.grossWeight.value < data.shipment.netWeight.value) {
      issues.push('Gross weight cannot be less than net weight');
    }
  }
  
  // Package count should match dimensions count if both are present
  if (data.shipment?.packageCount?.value && 
      data.shipment?.dimensions?.dimensions && 
      Array.isArray(data.shipment.dimensions.dimensions)) {
    
    if (documentType === 'packing_list' && 
        data.shipment.packageCount.value !== data.shipment.dimensions.dimensions.length) {
      issues.push('Package count should match the number of dimension entries');
    }
  }
  
  // Date validation: shipment date should be before delivery date
  if (data.shipment?.shipmentDate && data.shipment?.deliveryDate) {
    const shipDate = new Date(data.shipment.shipmentDate);
    const deliveryDate = new Date(data.shipment.deliveryDate);
    
    if (shipDate > deliveryDate) {
      issues.push('Shipment date cannot be after delivery date');
    }
  }
  
  // Invoice-specific business logic
  if (documentType === 'invoice') {
    // Invoice date validation
    if (data.commercial?.invoiceDate && data.shipment?.shipmentDate) {
      const invoiceDate = new Date(data.commercial.invoiceDate);
      const shipmentDate = new Date(data.shipment.shipmentDate);
      
      // Invoice date should typically be before or on the shipment date
      if (invoiceDate > shipmentDate) {
        issues.push('Invoice date is after shipment date, which is unusual');
      }
    }
  }
  
  // Bill of Entry specific business logic
  if (documentType === 'bill_of_entry') {
    // Customs value validation
    if (data.customs?.assessableValue && data.commercial?.invoiceValue?.amount) {
      if (data.customs.assessableValue < data.commercial.invoiceValue.amount) {
        issues.push('Assessable value is less than invoice value, which is unusual');
      }
    }
  }
}
