import { LogisticsExtractionSchema } from './LLMExtractionService';
import { LogisticsDocumentType } from './document-types';
import { LogisticsBusinessRules, BusinessRuleResult, ValidationResult } from './logistics-validation';

export interface DocumentRelationshipAnalysis {
  relationshipScore: number;
  consistencyIssues: string[];
  recommendations: string[];
  consolidatedData: Partial<LogisticsExtractionSchema>;
  confidence: number;
}

export interface CrossDocumentValidationResult extends ValidationResult {
  relationshipAnalysis: DocumentRelationshipAnalysis;
  businessRuleResults: BusinessRuleResult[];
  documentPairings: {
    invoice_hawb?: number;
    invoice_boe?: number;
    hawb_boe?: number;
  };
}

export class DocumentRelationshipValidator {
  private documents: Map<LogisticsDocumentType, LogisticsExtractionSchema> = new Map();

  addDocument(document: LogisticsExtractionSchema): void {
    if (document.metadata?.documentType) {
      this.documents.set(document.metadata.documentType, document);
    }
  }

  validateShipmentConsistency(): CrossDocumentValidationResult {
    const invoice = this.documents.get('invoice');
    const hawb = this.documents.get('house_waybill');
    const boe = this.documents.get('bill_of_entry');

    const issues: string[] = [];
    const businessRuleResults: BusinessRuleResult[] = [];
    const recommendations: string[] = [];
    let overallConfidence = 0.7;

    // Package Count Validation
    if (invoice && hawb) {
      const packageRule = LogisticsBusinessRules.packageCountConsistency(
        invoice.shipment.packageCount?.value,
        hawb.shipment.packageCount?.value,
        invoice.shipment.packageCount?.unit,
        hawb.shipment.packageCount?.unit
      );
      businessRuleResults.push(packageRule);
      
      if (!packageRule.passed) {
        issues.push(packageRule.message);
        overallConfidence -= 0.2;
        recommendations.push("Review package counting method - commercial docs may count boxes while shipping docs count pieces");
      }
    }

    // Weight Consistency Validation
    const weightSources = [invoice, hawb, boe].filter(doc => doc?.shipment.grossWeight?.value);
    if (weightSources.length > 1) {
      const weights = weightSources.map(doc => doc!.shipment.grossWeight!.value!);
      const maxWeight = Math.max(...weights);
      const minWeight = Math.min(...weights);
      const weightTolerance = 0.1; // 10% tolerance
      
      if ((maxWeight - minWeight) / minWeight > weightTolerance) {
        issues.push(`Weight inconsistency across documents: Range ${minWeight}kg - ${maxWeight}kg`);
        overallConfidence -= 0.15;
        recommendations.push("Verify weight measurements - different scales or measurement methods may cause variations");
      }
    }

    // HSN Code Mapping Validation
    if (invoice && boe) {
      const hsnRule = LogisticsBusinessRules.hsnCodeMapping(
        invoice.product?.hsnCode?.value,
        boe.customs?.hsnCode?.value
      );
      businessRuleResults.push(hsnRule);
      
      if (!hsnRule.passed) {
        issues.push(hsnRule.message);
        overallConfidence -= 0.25;
        recommendations.push("HSN code discrepancy detected - commercial and customs classifications may differ for the same product");
      }
    }

    // Date Sequence Validation
    const dateRule = LogisticsBusinessRules.dateSequenceValidation(
      invoice?.commercial.invoiceDate?.value,
      hawb?.shipment.hawbDate?.value,
      boe?.customs?.boeDate?.value
    );
    businessRuleResults.push(dateRule);
    
    if (!dateRule.passed) {
      issues.push(dateRule.message);
      overallConfidence -= 0.1;
      recommendations.push("Review document dates - ensure logical sequence of commercial, shipping, and customs events");
    }

    // Financial Consistency
    if (invoice && boe) {
      const financialRule = LogisticsBusinessRules.financialConsistency(
        invoice.commercial.totalValue?.value,
        boe.customs?.dutyAmount?.value,
        invoice.commercial.currency?.value
      );
      businessRuleResults.push(financialRule);
      
      if (!financialRule.passed) {
        issues.push(financialRule.message);
        overallConfidence -= 0.1;
        recommendations.push("Review duty calculation - rate seems unusual for the declared invoice value");
      }
    }

    // Entity Name Standardization
    const entityConsistency = this.validateEntityConsistency();
    if (entityConsistency.issues.length > 0) {
      issues.push(...entityConsistency.issues);
      overallConfidence -= 0.05 * entityConsistency.issues.length;
      recommendations.push(...entityConsistency.recommendations);
    }

    // Calculate relationship analysis
    const relationshipAnalysis = this.analyzeDocumentRelationships();
    
    // Calculate document pairings confidence
    const documentPairings = this.calculateDocumentPairings();

    return {
      isValid: issues.length === 0,
      issues,
      confidence: Math.max(0.1, overallConfidence),
      corrections: this.generateCorrections(),
      relationshipAnalysis,
      businessRuleResults,
      documentPairings
    };
  }

  private validateEntityConsistency(): { issues: string[]; recommendations: string[] } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    const allDocs = Array.from(this.documents.values());
    
    // Check shipper consistency
    const shippers = allDocs
      .map(doc => doc.parties.shipper?.name?.value)
      .filter(name => name);
    
    if (shippers.length > 1) {
      const uniqueShippers = [...new Set(shippers)];
      if (uniqueShippers.length > 1) {
        const similarity = this.calculateStringSimilarity(uniqueShippers[0], uniqueShippers[1]);
        if (similarity < 0.8) {
          issues.push(`Shipper name inconsistency: ${uniqueShippers.join(' vs ')}`);
          recommendations.push("Verify shipper entity - names should be consistent across documents");
        }
      }
    }

    // Check consignee consistency
    const consignees = allDocs
      .map(doc => doc.parties.consignee?.name?.value)
      .filter(name => name);
    
    if (consignees.length > 1) {
      const uniqueConsignees = [...new Set(consignees)];
      if (uniqueConsignees.length > 1) {
        const similarity = this.calculateStringSimilarity(uniqueConsignees[0], uniqueConsignees[1]);
        if (similarity < 0.8) {
          issues.push(`Consignee name inconsistency: ${uniqueConsignees.join(' vs ')}`);
          recommendations.push("Verify consignee entity - names should be consistent across documents");
        }
      }
    }

    return { issues, recommendations };
  }

  private analyzeDocumentRelationships(): DocumentRelationshipAnalysis {
    const allDocs = Array.from(this.documents.values());
    let relationshipScore = 0.5;
    const consistencyIssues: string[] = [];
    const recommendations: string[] = [];

    // Analyze identifier relationships
    const awbNumbers = allDocs
      .map(doc => doc.identifiers.awbNumber?.value)
      .filter(awb => awb);
    
    if (awbNumbers.length > 1) {
      const uniqueAWBs = [...new Set(awbNumbers)];
      if (uniqueAWBs.length === 1) {
        relationshipScore += 0.2;
      } else {
        consistencyIssues.push("Multiple AWB numbers found across documents");
        relationshipScore -= 0.1;
      }
    }

    // Analyze shipment consistency
    const origins = allDocs
      .map(doc => doc.shipment.origin?.value)
      .filter(origin => origin);
    
    if (origins.length > 1) {
      const uniqueOrigins = [...new Set(origins)];
      if (uniqueOrigins.length === 1) {
        relationshipScore += 0.1;
      } else {
        consistencyIssues.push("Origin locations vary across documents");
      }
    }

    // Generate consolidated data
    const consolidatedData = this.consolidateDocumentData();

    return {
      relationshipScore: Math.max(0.1, relationshipScore),
      consistencyIssues,
      recommendations,
      consolidatedData,
      confidence: Math.max(0.3, relationshipScore)
    };
  }

  private calculateDocumentPairings(): {
    invoice_hawb?: number;
    invoice_boe?: number;
    hawb_boe?: number;
  } {
    const pairings: any = {};

    const invoice = this.documents.get('invoice');
    const hawb = this.documents.get('house_waybill');
    const boe = this.documents.get('bill_of_entry');

    if (invoice && hawb) {
      pairings.invoice_hawb = this.calculatePairingScore(invoice, hawb);
    }

    if (invoice && boe) {
      pairings.invoice_boe = this.calculatePairingScore(invoice, boe);
    }

    if (hawb && boe) {
      pairings.hawb_boe = this.calculatePairingScore(hawb, boe);
    }

    return pairings;
  }

  private calculatePairingScore(doc1: LogisticsExtractionSchema, doc2: LogisticsExtractionSchema): number {
    let score = 0.5;
    let matches = 0;
    let total = 0;

    // Check AWB number match
    if (doc1.identifiers.awbNumber?.value && doc2.identifiers.awbNumber?.value) {
      if (doc1.identifiers.awbNumber.value === doc2.identifiers.awbNumber.value) {
        matches++;
      }
      total++;
    }

    // Check shipper match
    if (doc1.parties.shipper?.name?.value && doc2.parties.shipper?.name?.value) {
      const similarity = this.calculateStringSimilarity(
        doc1.parties.shipper.name.value,
        doc2.parties.shipper.name.value
      );
      if (similarity > 0.8) {
        matches++;
      }
      total++;
    }

    // Check consignee match
    if (doc1.parties.consignee?.name?.value && doc2.parties.consignee?.name?.value) {
      const similarity = this.calculateStringSimilarity(
        doc1.parties.consignee.name.value,
        doc2.parties.consignee.name.value
      );
      if (similarity > 0.8) {
        matches++;
      }
      total++;
    }

    if (total > 0) {
      score = matches / total;
    }

    return Math.max(0.1, score);
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private consolidateDocumentData(): Partial<LogisticsExtractionSchema> {
    const allDocs = Array.from(this.documents.values());
    const consolidated: Partial<LogisticsExtractionSchema> = {
      identifiers: {},
      parties: { shipper: {}, consignee: {}, notify: {} },
      shipment: {},
      product: {},
      commercial: {},
      customs: {}
    };

    // Consolidate with highest confidence values
    allDocs.forEach(doc => {
      // Identifiers
      Object.entries(doc.identifiers).forEach(([key, value]) => {
        if (value && (!consolidated.identifiers![key as keyof typeof consolidated.identifiers] || 
            value.confidence > consolidated.identifiers![key as keyof typeof consolidated.identifiers]?.confidence!)) {
          consolidated.identifiers![key as keyof typeof consolidated.identifiers] = value;
        }
      });

      // Parties
      ['shipper', 'consignee', 'notify'].forEach(party => {
        const partyData = doc.parties[party as keyof typeof doc.parties];
        if (partyData) {
          Object.entries(partyData).forEach(([key, value]) => {
            if (value && (!consolidated.parties![party as keyof typeof consolidated.parties]![key as any] || 
                value.confidence > consolidated.parties![party as keyof typeof consolidated.parties]![key as any]?.confidence!)) {
              consolidated.parties![party as keyof typeof consolidated.parties]![key as any] = value;
            }
          });
        }
      });

      // Shipment data
      Object.entries(doc.shipment).forEach(([key, value]) => {
        if (value && (!consolidated.shipment![key as keyof typeof consolidated.shipment] || 
            value.confidence > consolidated.shipment![key as keyof typeof consolidated.shipment]?.confidence!)) {
          consolidated.shipment![key as keyof typeof consolidated.shipment] = value;
        }
      });
    });

    return consolidated;
  }

  private generateCorrections(): Partial<LogisticsExtractionSchema> {
    // This would contain suggested corrections based on cross-document analysis
    // For now, return the consolidated data as potential corrections
    return this.consolidateDocumentData();
  }

  clearDocuments(): void {
    this.documents.clear();
  }

  getDocumentCount(): number {
    return this.documents.size;
  }

  hasDocument(type: LogisticsDocumentType): boolean {
    return this.documents.has(type);
  }
}