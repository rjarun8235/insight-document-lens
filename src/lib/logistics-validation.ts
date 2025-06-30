import { LogisticsExtractionSchema } from './LLMExtractionService';
import { LogisticsDocumentType } from './document-types';

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  confidence: number;
  corrections?: Partial<LogisticsExtractionSchema>;
}

export interface BusinessRuleResult {
  rule: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  confidence: number;
}

export class LogisticsBusinessRules {
  static packageCountConsistency(
    invoiceCount?: number, 
    hawbCount?: number, 
    invoiceUnit?: string, 
    hawbUnit?: string
  ): BusinessRuleResult {
    if (!invoiceCount || !hawbCount) {
      return {
        rule: 'packageCountConsistency',
        passed: true,
        severity: 'info',
        message: 'Insufficient data for package count validation',
        confidence: 0.1
      };
    }

    const ratio = invoiceCount / hawbCount;
    const isReasonableRatio = ratio >= 0.5 && ratio <= 4;
    
    // Commercial docs often count boxes/cartons, shipping docs count pieces
    const unitConsistency = this.analyzePackageUnits(invoiceUnit, hawbUnit);
    
    return {
      rule: 'packageCountConsistency',
      passed: isReasonableRatio,
      severity: isReasonableRatio ? 'info' : 'warning',
      message: isReasonableRatio 
        ? `Package count ratio (${ratio.toFixed(2)}) is reasonable. ${unitConsistency.explanation}`
        : `Package count mismatch: Invoice(${invoiceCount} ${invoiceUnit}) vs HAWB(${hawbCount} ${hawbUnit}). Ratio: ${ratio.toFixed(2)}`,
      confidence: isReasonableRatio ? 0.9 : 0.3
    };
  }

  static weightConsistency(grossWeight?: number, netWeight?: number, unit?: string): BusinessRuleResult {
    if (!grossWeight || !netWeight) {
      return {
        rule: 'weightConsistency',
        passed: true,
        severity: 'info',
        message: 'Insufficient weight data for validation',
        confidence: 0.1
      };
    }

    const isGrossGreaterThanNet = grossWeight >= netWeight;
    const packagingWeight = grossWeight - netWeight;
    const packagingRatio = packagingWeight / netWeight;
    const isReasonablePackaging = packagingRatio <= 0.2; // 20% packaging weight is reasonable

    const passed = isGrossGreaterThanNet && isReasonablePackaging;

    return {
      rule: 'weightConsistency',
      passed,
      severity: passed ? 'info' : 'error',
      message: passed 
        ? `Weight consistency verified: Gross(${grossWeight}${unit}) > Net(${netWeight}${unit}), packaging: ${packagingWeight.toFixed(2)}${unit}`
        : `Weight inconsistency: Gross(${grossWeight}${unit}) vs Net(${netWeight}${unit}). ${!isGrossGreaterThanNet ? 'Gross must be >= Net' : 'Packaging weight too high'}`,
      confidence: passed ? 0.95 : 0.2
    };
  }

  static hsnCodeMapping(commercialHSN?: string, customsHSN?: string): BusinessRuleResult {
    // helper to extract a plain string from optional object/number formats
    const normalizeHSN = (code: unknown): string | null => {
      if (code == null) return null;
      // Object with { value: 'xxxxx', … }
      if (typeof code === 'object' && 'value' in (code as any)) {
        code = (code as any).value;
      }
      // number → string
      if (typeof code === 'number') {
        code = String(code);
      }
      if (typeof code !== 'string') return null;
      const trimmed = code.trim();
      return trimmed.length ? trimmed : null;
    };

    const commercialRaw = normalizeHSN(commercialHSN);
    const customsRaw    = normalizeHSN(customsHSN);

    if (!commercialRaw || !customsRaw) {
      return {
        rule: 'hsnCodeMapping',
        passed: true,
        severity: 'info',
        message: 'Insufficient HSN code data for validation',
        confidence: 0.1
      };
    }

    // Clean HSN codes (remove spaces, special characters)
    const cleanCommercial = commercialRaw.replace(/\D/g, '');
    const cleanCustoms    = customsRaw.replace(/\D/g, '');

    // Check different levels of HSN code matching
    const exactMatch = cleanCommercial === cleanCustoms;
    const chapter6Match = cleanCommercial.substring(0, 6) === cleanCustoms.substring(0, 6);
    const chapter4Match = cleanCommercial.substring(0, 4) === cleanCustoms.substring(0, 4);
    const chapter2Match = cleanCommercial.substring(0, 2) === cleanCustoms.substring(0, 2);

    let confidence = 0.1;
    let message = '';
    let passed = false;

    if (exactMatch) {
      passed = true;
      confidence = 0.99;
      message = `Exact HSN code match: ${commercialRaw}`;
    } else if (chapter6Match) {
      passed = true;
      confidence = 0.9;
      message = `HSN codes match at 6-digit level (same sub-heading): Commercial(${commercialRaw}) vs Customs(${customsRaw})`;
    } else if (chapter4Match) {
      passed = true;
      confidence = 0.7;
      message = `HSN codes match at 4-digit level (same heading): Commercial(${commercialRaw}) vs Customs(${customsRaw})`;
    } else if (chapter2Match) {
      passed = false;
      confidence = 0.4;
      message = `HSN codes only match at 2-digit level (same chapter): Commercial(${commercialRaw}) vs Customs(${customsRaw}) - May need review`;
    } else {
      passed = false;
      confidence = 0.1;
      message = `HSN code mismatch: Commercial(${commercialRaw}) vs Customs(${customsRaw}) - Different product classifications`;
    }

    return {
      rule: 'hsnCodeMapping',
      passed,
      severity: passed ? 'info' : 'warning',
      message,
      confidence
    };
  }

  static dateSequenceValidation(
    invoiceDate?: string, 
    hawbDate?: string, 
    boeDate?: string
  ): BusinessRuleResult {
    const dates = {
      invoice: invoiceDate ? new Date(invoiceDate) : null,
      hawb: hawbDate ? new Date(hawbDate) : null,
      boe: boeDate ? new Date(boeDate) : null
    };

    const validDates = Object.entries(dates).filter(([_, date]) => date && !isNaN(date.getTime()));
    
    if (validDates.length < 2) {
      return {
        rule: 'dateSequenceValidation',
        passed: true,
        severity: 'info',
        message: 'Insufficient date data for sequence validation',
        confidence: 0.1
      };
    }

    // Expected sequence: Invoice -> HAWB -> BOE (with some flexibility)
    let issues: string[] = [];
    let confidence = 0.9;

    if (dates.invoice && dates.hawb) {
      const daysDiff = Math.abs((dates.hawb.getTime() - dates.invoice.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 30) {
        issues.push(`Large gap between Invoice (${invoiceDate}) and HAWB (${hawbDate}): ${daysDiff.toFixed(0)} days`);
        confidence -= 0.2;
      }
    }

    if (dates.hawb && dates.boe) {
      if (dates.boe < dates.hawb) {
        issues.push(`BOE date (${boeDate}) is before HAWB date (${hawbDate})`);
        confidence -= 0.3;
      }
    }

    return {
      rule: 'dateSequenceValidation',
      passed: issues.length === 0,
      severity: issues.length === 0 ? 'info' : 'warning',
      message: issues.length === 0 
        ? 'Date sequence is logical' 
        : `Date sequence issues: ${issues.join('; ')}`,
      confidence: Math.max(0.1, confidence)
    };
  }

  static financialConsistency(
    invoiceValue?: number, 
    dutyAmount?: number, 
    currency?: string
  ): BusinessRuleResult {
    if (!invoiceValue || !dutyAmount) {
      return {
        rule: 'financialConsistency',
        passed: true,
        severity: 'info',
        message: 'Insufficient financial data for validation',
        confidence: 0.1
      };
    }

    // Duty is typically 5-30% of invoice value for most goods
    const dutyPercentage = (dutyAmount / invoiceValue) * 100;
    const isReasonableDuty = dutyPercentage >= 0 && dutyPercentage <= 50;

    return {
      rule: 'financialConsistency',
      passed: isReasonableDuty,
      severity: isReasonableDuty ? 'info' : 'warning',
      message: isReasonableDuty 
        ? `Duty rate (${dutyPercentage.toFixed(2)}%) is reasonable for invoice value ${currency}${invoiceValue}`
        : `Unusual duty rate: ${dutyPercentage.toFixed(2)}% (${currency}${dutyAmount} on ${currency}${invoiceValue})`,
      confidence: isReasonableDuty ? 0.8 : 0.3
    };
  }

  private static analyzePackageUnits(invoiceUnit?: string, hawbUnit?: string): {
    isConsistent: boolean;
    explanation: string;
  } {
    if (!invoiceUnit || !hawbUnit) {
      return { isConsistent: true, explanation: 'Unit information not available' };
    }

    const commercialUnits = ['boxes', 'cartons', 'packages', 'units'];
    const shippingUnits = ['pieces', 'pcs', 'pkgs', 'items'];

    const invoiceIsCommercial = commercialUnits.some(unit => 
      invoiceUnit.toLowerCase().includes(unit)
    );
    const hawbIsShipping = shippingUnits.some(unit => 
      hawbUnit.toLowerCase().includes(unit)
    );

    if (invoiceIsCommercial && hawbIsShipping) {
      return {
        isConsistent: true,
        explanation: `Units are consistent: Invoice counts ${invoiceUnit} (commercial), HAWB counts ${hawbUnit} (shipping)`
      };
    }

    return {
      isConsistent: false,
      explanation: `Unit mismatch may indicate counting inconsistency: ${invoiceUnit} vs ${hawbUnit}`
    };
  }
}

export class DocumentQualityAssessment {
  static assessDocumentQuality(extractedData: LogisticsExtractionSchema): number {
    const qualityFactors = {
      identifierConsistency: this.checkIdentifierConsistency(extractedData),
      dataCompletion: this.checkDataCompletion(extractedData),
      formatValidation: this.checkFormatValidation(extractedData),
      businessRuleCompliance: this.checkBusinessRuleCompliance(extractedData)
    };

    const weights = {
      identifierConsistency: 0.3,
      dataCompletion: 0.3,
      formatValidation: 0.2,
      businessRuleCompliance: 0.2
    };

    return Object.entries(qualityFactors).reduce(
      (sum, [key, score]) => sum + (score * weights[key as keyof typeof weights]), 
      0
    );
  }

  private static checkIdentifierConsistency(data: LogisticsExtractionSchema): number {
    let score = 0;
    let checks = 0;

    if (data.identifiers.invoiceNumber?.value) {
      score += data.identifiers.invoiceNumber.confidence;
      checks++;
    }
    if (data.identifiers.awbNumber?.value) {
      score += data.identifiers.awbNumber.confidence;
      checks++;
    }
    if (data.identifiers.boeNumber?.value) {
      score += data.identifiers.boeNumber.confidence;
      checks++;
    }

    return checks > 0 ? score / checks : 0.1;
  }

  private static checkDataCompletion(data: LogisticsExtractionSchema): number {
    const criticalFields = [
      data.parties.shipper?.name,
      data.parties.consignee?.name,
      data.shipment.grossWeight?.value,
      data.commercial.invoiceValue?.amount
    ];

    const completedFields = criticalFields.filter(field => field !== undefined && field !== null).length;
    return completedFields / criticalFields.length;
  }

  private static checkFormatValidation(data: LogisticsExtractionSchema): number {
    let validFormats = 0;
    let totalChecks = 0;

    // Check HSN code format (should be 6-8 digits)
    if (data.product?.hsnCode) {
      const hsnPattern = /^\d{6,8}$/;
      validFormats += hsnPattern.test(data.product.hsnCode.replace(/\D/g, '')) ? 1 : 0;
      totalChecks++;
    }

    // Check AWB number format
    if (data.identifiers.awbNumber) {
      const awbPattern = /^\d{3}[-\s]?\d{8,}$/;
      validFormats += awbPattern.test(data.identifiers.awbNumber) ? 1 : 0;
      totalChecks++;
    }

    // Check email format
    if (data.parties.shipper?.email) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      validFormats += emailPattern.test(data.parties.shipper.email) ? 1 : 0;
      totalChecks++;
    }

    return totalChecks > 0 ? validFormats / totalChecks : 0.8;
  }

  private static checkBusinessRuleCompliance(data: LogisticsExtractionSchema): number {
    const rules = [
      LogisticsBusinessRules.weightConsistency(
        data.shipment.grossWeight?.value,
        data.shipment.netWeight?.value,
        data.shipment.grossWeight?.unit
      ),
      LogisticsBusinessRules.hsnCodeMapping(
        data.product?.hsnCode,
        data.product?.hsnCode // Using same field since customs.hsnCode doesn't exist
      ),
      LogisticsBusinessRules.financialConsistency(
        data.commercial.invoiceValue?.amount,
        data.customs?.duties?.totalDuty,
        data.commercial.invoiceValue?.currency
      )
    ];

    const validRules = rules.filter(rule => rule.passed).length;
    const totalRules = rules.length;

    return totalRules > 0 ? validRules / totalRules : 0.7;
  }
}