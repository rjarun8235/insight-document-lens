import { LogisticsDocumentType } from '../lib/document-types';

export interface EnhancedPromptContext {
  documentType: LogisticsDocumentType;
  expectedFields?: string[];
  businessContext?: {
    shipmentOrigin?: string;
    shipmentDestination?: string;
    productCategory?: string;
    tradeTerms?: string;
  };
  validationRules?: {
    requireHSNCode?: boolean;
    requireWeightConsistency?: boolean;
    requireDateSequence?: boolean;
  };
}

export class EnhancedLogisticsPrompt {
  
  /**
   * Generate enhanced extraction prompt with domain-specific context
   */
  static generatePrompt(context: EnhancedPromptContext): string {
    const { documentType, expectedFields, businessContext, validationRules } = context;
    
    const basePrompt = this.getBaseExtractionPrompt();
    const domainContext = this.getDomainSpecificContext(documentType);
    const businessRules = this.getBusinessRuleContext(documentType, validationRules);
    const fieldGuidance = this.getFieldExtractionGuidance(documentType, expectedFields);
    const validationHints = this.getValidationHints(documentType, businessContext);
    
    return `${basePrompt}

${domainContext}

${businessRules}

${fieldGuidance}

${validationHints}

## CRITICAL DOMAIN KNOWLEDGE FOR ${documentType.toUpperCase().replace('_', ' ')}:

${this.getDocumentSpecificKnowledge(documentType)}

## ERROR RECOVERY STRATEGIES:

${this.getErrorRecoveryStrategies(documentType)}

## CONFIDENCE SCORING REQUIREMENTS:

${this.getConfidenceScoring(documentType)}

EXTRACT FROM DOCUMENT:`;
  }

  /**
   * Base extraction prompt with field-level confidence scoring
   */
  private static getBaseExtractionPrompt(): string {
    return `You are a world-class logistics document extraction system with deep domain expertise. Extract data with EXTREME precision for customs compliance and supply chain automation.

⚠️ CRITICAL OUTPUT REQUIREMENT ⚠️
- Return ONLY valid JSON with field-level confidence scores
- No markdown, no explanations, no additional text
- First character must be '{', last character must be '}'
- Must pass JSON.parse() validation

## FIELD-LEVEL CONFIDENCE SCORING FRAMEWORK
For each extracted field, provide confidence score using this format:
{
  "value": [extracted value],
  "confidence": [score between 0.0 and 1.0],
  "source": [optional: where in document this was found],
  "alternatives": [optional: array of alternative interpretations]
}

### CONFIDENCE CALIBRATION GUIDE:
- **0.95-1.0**: Perfect pattern match, unambiguous extraction, verified against business rules
- **0.85-0.94**: High confidence with minor formatting variations, passes validation
- **0.70-0.84**: Moderate confidence, readable but some uncertainty in interpretation
- **0.50-0.69**: Low confidence, significant uncertainty, requires human review
- **0.00-0.49**: Very low confidence, extraction attempt but high uncertainty

### CRITICAL ACCURACY TARGETS:
- **99.9% accuracy required**: Invoice numbers, HSN codes, duty amounts, AWB numbers
- **95% accuracy required**: Weights, dimensions, company names, addresses
- **85% accuracy required**: Product descriptions, dates, contact information`;
  }

  /**
   * Document type specific domain context
   */
  private static getDomainSpecificContext(documentType: LogisticsDocumentType): string {
    const contexts = {
      invoice: `
## COMMERCIAL INVOICE DOMAIN CONTEXT:
- Primary purpose: Declare commercial value for customs and payment
- HSN codes on invoices may differ from customs classification (commercial vs. regulatory view)
- Pricing must include all costs up to delivery terms (FOB, FCA, etc.)
- Tax calculations vary by country of origin and destination
- Incoterms determine seller/buyer responsibilities and affect valuation`,

      house_waybill: `
## HOUSE AIR WAYBILL DOMAIN CONTEXT:
- Consolidator document linking master AWB to individual shipments
- Package counts often reflect freight forwarder's packing (pieces/packages)
- Weight may differ from commercial docs due to consolidation/repackaging
- Critical for customs clearance - errors cause shipment delays
- Contains routing through consolidation hubs`,

      air_waybill: `
## MASTER AIR WAYBILL DOMAIN CONTEXT:
- Airline contract of carriage - legally binding transport document
- Chargeable weight may exceed actual weight (volumetric calculation)
- Flight routing shows actual aircraft movements
- Special handling codes affect pricing and treatment
- Dimensions critical for aircraft loading and space allocation`,

      bill_of_entry: `
## BILL OF ENTRY DOMAIN CONTEXT:
- Customs declaration for imported goods - legal document for duty assessment
- HSN codes determine duty rates and may differ from commercial classification
- Exchange rates are officially fixed by customs authorities
- Duty calculations include multiple components (BCD, IGST, SWS, etc.)
- Any errors result in customs penalties and shipment detention`,

      packing_list: `
## PACKING LIST DOMAIN CONTEXT:
- Physical inventory of shipment contents for customs examination
- Package counts represent actual physical units shipped
- Weight distributions help customs verify against other documents
- Detailed contents required for restricted/controlled goods
- Critical for customs physical examination and clearance`,

      delivery_note: `
## DELIVERY NOTE DOMAIN CONTEXT:
- Proof of delivery document for final shipment handover
- Package counts reflect what customer actually received
- Any discrepancies affect insurance claims and disputes
- Critical for freight forwarder liability and billing
- Final link in shipment tracking chain`
    };

    return contexts[documentType] || contexts.invoice;
  }

  /**
   * Business rule context for validation
   */
  private static getBusinessRuleContext(
    documentType: LogisticsDocumentType, 
    validationRules?: EnhancedPromptContext['validationRules']
  ): string {
    let context = `
## LOGISTICS BUSINESS RULES TO CONSIDER:

### PACKAGE COUNT LOGIC:
- Commercial documents (invoices) typically count "boxes" or "cartons"
- Shipping documents (AWB/HAWB) typically count "pieces" or "packages"  
- Reasonable ratio: 1 box = 1-4 pieces (depending on product type)
- Customs documents may use either counting method

### WEIGHT CONSISTENCY RULES:
- Gross weight must be ≥ net weight (packaging adds weight)
- Packaging weight typically 5-20% of net weight for most goods
- Chargeable weight may exceed actual weight (airline volumetric pricing)
- Weight variations of ±0.5kg common between documents (different scales)`;

    if (validationRules?.requireHSNCode) {
      context += `

### HSN CODE CLASSIFICATION RULES:
- Commercial HSN (invoice): Product-focused classification for trade
- Customs HSN (BOE): Duty-focused classification for taxation
- Different codes for same product are common and acceptable
- First 4-6 digits should match for same product category
- 8-10 digit codes provide most specific classification`;
    }

    if (validationRules?.requireDateSequence) {
      context += `

### DATE SEQUENCE LOGIC:
- Expected sequence: Invoice Date → Shipment Date → AWB Date → BOE Date
- Gaps of 1-30 days between stages are normal
- BOE date before shipment date indicates documentation issues
- Large gaps (>30 days) may indicate consolidation or storage`;
    }

    return context;
  }

  /**
   * Field extraction guidance
   */
  private static getFieldExtractionGuidance(
    documentType: LogisticsDocumentType,
    expectedFields?: string[]
  ): string {
    let guidance = `
## FIELD EXTRACTION PRIORITIES FOR ${documentType.toUpperCase().replace('_', ' ')}:

### CRITICAL FIELDS (Extract with 99.9% accuracy):`;

    const criticalFields = {
      invoice: ['invoiceNumber', 'totalValue', 'currency', 'shipper.name', 'consignee.name', 'hsnCode'],
      house_waybill: ['hawbNumber', 'awbNumber', 'grossWeight', 'packageCount', 'origin', 'destination'],
      air_waybill: ['awbNumber', 'grossWeight', 'chargeableWeight', 'origin', 'destination', 'carrier'],
      bill_of_entry: ['beNumber', 'jobNumber', 'hsnCode', 'dutyAmount', 'assessedValue', 'igmNumber'],
      packing_list: ['packingListNumber', 'packageCount', 'grossWeight', 'netWeight', 'itemDescription'],
      delivery_note: ['deliveryNoteNumber', 'deliveryDate', 'packageCount', 'receiverName']
    };

    const fields = criticalFields[documentType] || criticalFields.invoice;
    fields.forEach(field => {
      guidance += `\n- ${field}`;
    });

    if (expectedFields && expectedFields.length > 0) {
      guidance += `

### ADDITIONAL EXPECTED FIELDS (Based on document analysis):`;
      expectedFields.forEach(field => {
        guidance += `\n- ${field}`;
      });
    }

    return guidance;
  }

  /**
   * Validation hints based on business context
   */
  private static getValidationHints(
    documentType: LogisticsDocumentType,
    businessContext?: EnhancedPromptContext['businessContext']
  ): string {
    let hints = `
## VALIDATION HINTS AND CROSS-CHECKS:`;

    if (businessContext?.shipmentOrigin || businessContext?.shipmentDestination) {
      hints += `

### ROUTING VALIDATION:
- Expected route: ${businessContext.shipmentOrigin || '[origin]'} → ${businessContext.shipmentDestination || '[destination]'}
- Verify airport codes and country information match expected routing
- Check for intermediate stops or consolidation hubs`;
    }

    if (businessContext?.productCategory) {
      hints += `

### PRODUCT CATEGORY VALIDATION:
- Expected product category: ${businessContext.productCategory}
- HSN codes should align with this product category
- Weight and packaging should be reasonable for product type`;
    }

    if (businessContext?.tradeTerms) {
      hints += `

### TRADE TERMS VALIDATION:
- Expected Incoterms: ${businessContext.tradeTerms}
- Freight charges should align with trade terms
- Insurance requirements vary by terms`;
    }

    return hints;
  }

  /**
   * Document-specific knowledge base
   */
  private static getDocumentSpecificKnowledge(documentType: LogisticsDocumentType): string {
    const knowledge = {
      invoice: `
- Invoice numbers often follow company-specific patterns (e.g., "CD970077514")
- Multiple currencies may appear (invoice currency vs. freight currency)
- Tax calculations vary by country (VAT, GST, sales tax)
- Payment terms affect cash flow (DP = Documents against Payment)
- HSN codes on invoices may be commercial classifications`,

      house_waybill: `
- HAWB numbers link to master AWB for tracking
- Multiple HAWBs can share one master AWB (consolidation)
- Freight forwarder acts as intermediary between shipper and airline
- Package counts may differ from commercial docs (repackaging)
- Critical for customs clearance and delivery authorization`,

      air_waybill: `
- AWB numbers include airline prefix (e.g., "098" for Air India)
- Chargeable weight = max(actual weight, volumetric weight)
- Volumetric weight = (L×W×H in cm) ÷ 6000 for air freight
- Flight numbers and routing show actual aircraft movement
- Special handling codes (DGR, VAL, etc.) affect pricing`,

      bill_of_entry: `
- BE numbers unique per customs entry (format varies by port)
- Job numbers track customs broker's internal processing
- IGM numbers link to vessel/flight manifest
- Exchange rates fixed by customs authorities (not market rates)
- Duty calculations: BCD (Basic Customs Duty) + IGST + SWS
- GST rates vary by product classification (5%, 12%, 18%, 28%)`,

      packing_list: `
- Must match invoice quantities exactly
- Package numbering helps track individual units
- Net vs. gross weight distinction critical for customs
- Detailed contents required for restricted goods
- Lot numbers enable product traceability`,

      delivery_note: `
- Final proof of shipment completion
- Package condition noted (damaged, short-shipped, etc.)
- Receiver signature confirms delivery acceptance
- Critical for freight forwarder liability release
- Links to final billing and customer satisfaction`
    };

    return knowledge[documentType] || knowledge.invoice;
  }

  /**
   * Error recovery strategies
   */
  private static getErrorRecoveryStrategies(documentType: LogisticsDocumentType): string {
    return `
- **If package count seems incorrect**: Extract both "boxes" and "pieces" separately with context
- **If multiple HSN codes found**: Extract all variants with their sources
- **If weights don't match**: Note measurement source (scale reading vs. calculation)
- **If dates are ambiguous**: Use document type context (European=DD/MM, US=MM/DD)
- **If company names vary**: Extract all variations with confidence scores
- **If addresses are poorly formatted**: Use geographical knowledge to separate components
- **If numbers have multiple formats**: Standardize but preserve original text
- **If currency symbols are unclear**: Use context clues from country/region`;
  }

  /**
   * Confidence scoring rules for specific document types
   */
  private static getConfidenceScoring(documentType: LogisticsDocumentType): string {
    const scoring = {
      invoice: `
- 0.95+: Clear invoice number, total amount, and company names
- 0.85+: All financial fields clear, minor formatting issues
- 0.70+: Core commercial data extracted, some secondary fields unclear
- 0.50+: Basic invoice data present, significant gaps in details`,

      house_waybill: `
- 0.95+: Clear HAWB/AWB numbers, weights, and routing information
- 0.85+: Transport details clear, minor uncertainty in special instructions
- 0.70+: Core shipment data extracted, some agent details unclear
- 0.50+: Basic waybill data present, missing critical transport info`,

      bill_of_entry: `
- 0.95+: All customs numbers clear, duty calculations complete
- 0.85+: Core customs data extracted, minor uncertainty in calculations
- 0.70+: Basic entry information present, some duty details unclear
- 0.50+: Customs document identified, significant data gaps`,

      air_waybill: `
- 0.95+: Clear AWB number, carrier, routing, and weight information
- 0.85+: Transport data complete, minor issues with handling codes
- 0.70+: Basic airline waybill data, some routing details unclear
- 0.50+: Document identified as AWB, core data missing`,

      packing_list: `
- 0.95+: Complete package inventory with weights and dimensions
- 0.85+: Package data clear, minor uncertainty in contents detail
- 0.70+: Basic packing information, some package details unclear
- 0.50+: Packing list identified, significant inventory gaps`,

      delivery_note: `
- 0.95+: Clear delivery details, receiver information, and package status
- 0.85+: Delivery data complete, minor uncertainty in conditions
- 0.70+: Basic delivery information, some details unclear
- 0.50+: Delivery document identified, core information missing`
    };

    return scoring[documentType] || scoring.invoice;
  }

  /**
   * Generate context-aware prompt for specific scenarios
   */
  static generateContextualPrompt(
    documentType: LogisticsDocumentType,
    options: {
      crossDocumentValidation?: boolean;
      businessRuleValidation?: boolean;
      enhancedHSNValidation?: boolean;
      confidenceCalibration?: boolean;
    } = {}
  ): string {
    const context: EnhancedPromptContext = {
      documentType,
      validationRules: {
        requireHSNCode: options.enhancedHSNValidation,
        requireWeightConsistency: options.businessRuleValidation,
        requireDateSequence: options.crossDocumentValidation
      }
    };

    let prompt = this.generatePrompt(context);

    if (options.crossDocumentValidation) {
      prompt += `

## CROSS-DOCUMENT VALIDATION AWARENESS:
This document may be part of a multi-document shipment. Extract fields that will enable:
- Cross-reference validation with other shipment documents
- Consistency checking of weights, package counts, and values
- Timeline validation across commercial, shipping, and customs documents
- Entity name standardization across different document formats`;
    }

    if (options.confidenceCalibration) {
      prompt += `

## ENHANCED CONFIDENCE CALIBRATION:
Apply rigorous confidence scoring based on:
- Pattern recognition strength (exact vs. fuzzy matches)
- Business rule compliance (logical consistency)
- Document quality factors (clarity, completeness, formatting)
- Field criticality (higher standards for customs-critical fields)
- Cross-validation potential (fields that can be verified against other documents)`;
    }

    return prompt;
  }
}