import { LogisticsExtractionSchema, LogisticsDocumentType } from './LLMExtractionService';

export interface FieldComparison {
  fieldName: string;
  category: 'critical' | 'important' | 'minor';
  values: Array<{
    documentType: LogisticsDocumentType;
    documentName: string;
    value: any;
    formatted?: string;
  }>;
  isConsistent: boolean;
  discrepancyType: 'exact_match' | 'acceptable_variance' | 'major_discrepancy' | 'missing_data';
  impact: 'high' | 'medium' | 'low';
  explanation: string;
  recommendedAction?: string;
}

export interface DocumentComparisonReport {
  summary: {
    totalDocuments: number;
    documentsCompared: string[];
    totalFieldsCompared: number;
    consistentFields: number;
    discrepantFields: number;
    missingFields: number;
    overallConsistencyScore: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
  
  fieldComparisons: FieldComparison[];
  
  criticalIssues: Array<{
    description: string;
    affectedDocuments: string[];
    impact: string;
    recommendedAction: string;
  }>;
  
  recommendations: string[];
  
  metadata: {
    comparisonDate: string;
    documentsAnalyzed: Array<{
      name: string;
      type: LogisticsDocumentType;
      extractionConfidence: number;
    }>;
  };
}

export class DocumentFieldComparator {
  
  /**
   * Main function to compare logistics documents and generate comparison report
   */
  static compareDocuments(
    documents: Array<{
      name: string;
      type: LogisticsDocumentType;
      data: LogisticsExtractionSchema;
    }>
  ): DocumentComparisonReport {
    
    if (documents.length < 2) {
      throw new Error('At least 2 documents required for comparison');
    }

    console.log(`🔍 Comparing ${documents.length} logistics documents for field consistency...`);

    // Define critical fields that must match across documents
    const fieldMappings = this.defineFieldMappings();
    const fieldComparisons: FieldComparison[] = [];
    const criticalIssues: Array<any> = [];

    // Compare each critical field across all documents
    for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
      const comparison = this.compareField(fieldName, mapping, documents);
      fieldComparisons.push(comparison);

      // Flag critical issues
      if (comparison.category === 'critical' && !comparison.isConsistent) {
        criticalIssues.push({
          description: `Critical field "${fieldName}" has discrepancies`,
          affectedDocuments: comparison.values.map(v => v.documentName),
          impact: `${mapping.businessImpact}`,
          recommendedAction: comparison.recommendedAction || 'Manual review required'
        });
      }
    }

    // Calculate summary statistics
    const consistentFields = fieldComparisons.filter(f => f.isConsistent).length;
    const discrepantFields = fieldComparisons.filter(f => !f.isConsistent && f.discrepancyType !== 'missing_data').length;
    const missingFields = fieldComparisons.filter(f => f.discrepancyType === 'missing_data').length;
    const overallConsistencyScore = fieldComparisons.length > 0 ? consistentFields / fieldComparisons.length : 0;

    // Determine risk level
    const criticalDiscrepancies = fieldComparisons.filter(f => f.category === 'critical' && !f.isConsistent).length;
    const riskLevel: 'low' | 'medium' | 'high' = 
      criticalDiscrepancies > 2 ? 'high' :
      criticalDiscrepancies > 0 ? 'medium' : 'low';

    // Generate recommendations
    const recommendations = this.generateRecommendations(fieldComparisons, documents);

    return {
      summary: {
        totalDocuments: documents.length,
        documentsCompared: documents.map(d => `${d.name} (${d.type})`),
        totalFieldsCompared: fieldComparisons.length,
        consistentFields,
        discrepantFields,
        missingFields,
        overallConsistencyScore,
        riskLevel
      },
      fieldComparisons,
      criticalIssues,
      recommendations,
      metadata: {
        comparisonDate: new Date().toISOString(),
        documentsAnalyzed: documents.map(d => ({
          name: d.name,
          type: d.type,
          extractionConfidence: d.data.metadata?.extractionConfidence || 0
        }))
      }
    };
  }

  /**
   * Define which fields to compare and how they map across document types
   */
  private static defineFieldMappings(): Record<string, {
    paths: Record<LogisticsDocumentType, string>;
    category: 'critical' | 'important' | 'minor';
    tolerance?: number | string;
    businessImpact: string;
    comparisonType: 'exact' | 'numeric' | 'text_similarity' | 'date' | 'weight';
  }> {
    return {
      // CRITICAL SHIPPING IDENTIFIERS
      awbNumber: {
        paths: {
          invoice: 'identifiers.awbNumber',
          air_waybill: 'identifiers.awbNumber',
          house_waybill: 'identifiers.awbNumber',
          bill_of_entry: 'identifiers.awbNumber',
          packing_list: 'identifiers.awbNumber',
          delivery_note: 'identifiers.awbNumber'
        },
        category: 'critical',
        businessImpact: 'AWB number mismatch prevents shipment tracking',
        comparisonType: 'exact'
      },

      // CRITICAL PARTY INFORMATION
      shipperName: {
        paths: {
          invoice: 'parties.shipper.name',
          air_waybill: 'parties.shipper.name', 
          house_waybill: 'parties.shipper.name',
          bill_of_entry: 'parties.shipper.name',
          packing_list: 'parties.shipper.name',
          delivery_note: 'parties.shipper.name'
        },
        category: 'critical',
        businessImpact: 'Shipper name discrepancy causes customs delays',
        comparisonType: 'text_similarity'
      },

      consigneeName: {
        paths: {
          invoice: 'parties.consignee.name',
          air_waybill: 'parties.consignee.name',
          house_waybill: 'parties.consignee.name', 
          bill_of_entry: 'parties.consignee.name',
          packing_list: 'parties.consignee.name',
          delivery_note: 'parties.consignee.name'
        },
        category: 'critical',
        businessImpact: 'Consignee name mismatch prevents delivery',
        comparisonType: 'text_similarity'
      },

      // CRITICAL SHIPMENT DETAILS  
      grossWeight: {
        paths: {
          invoice: 'shipment.grossWeight.value',
          air_waybill: 'shipment.grossWeight.value',
          house_waybill: 'shipment.grossWeight.value',
          bill_of_entry: 'shipment.grossWeight.value', 
          packing_list: 'shipment.grossWeight.value',
          delivery_note: 'shipment.grossWeight.value'
        },
        category: 'critical',
        tolerance: 0.5, // 0.5 kg tolerance
        businessImpact: 'Weight discrepancy affects freight charges and customs duty',
        comparisonType: 'weight'
      },

      packageCount: {
        paths: {
          invoice: 'shipment.packageCount.value',
          air_waybill: 'shipment.packageCount.value',
          house_waybill: 'shipment.packageCount.value',
          bill_of_entry: 'shipment.packageCount.value',
          packing_list: 'shipment.packageCount.value', 
          delivery_note: 'shipment.packageCount.value'
        },
        category: 'critical',
        businessImpact: 'Package count mismatch indicates missing or extra cargo',
        comparisonType: 'numeric'
      },

      // IMPORTANT COMMERCIAL DETAILS
      invoiceValue: {
        paths: {
          invoice: 'commercial.invoiceValue.amount',
          air_waybill: '',
          house_waybill: '',
          bill_of_entry: 'customs.assessedValue.amount',
          packing_list: '',
          delivery_note: ''
        },
        category: 'important',
        tolerance: 0.01, // 1% tolerance for currency conversion
        businessImpact: 'Invoice value discrepancy affects customs duty calculation',
        comparisonType: 'numeric'
      },

      hsnCode: {
        paths: {
          invoice: 'product.hsnCode',
          air_waybill: '',
          house_waybill: '',
          bill_of_entry: 'product.hsnCode', // Using same field as we don't have customs.hsnCode
          packing_list: 'product.hsnCode',
          delivery_note: ''
        },
        category: 'important',
        businessImpact: 'HSN code mismatch affects duty rates and customs classification',
        comparisonType: 'exact'
      },

      // MINOR REFERENCE FIELDS
      invoiceNumber: {
        paths: {
          invoice: 'identifiers.invoiceNumber',
          air_waybill: 'identifiers.invoiceNumber',
          house_waybill: 'identifiers.invoiceNumber',
          bill_of_entry: 'identifiers.invoiceNumber',
          packing_list: 'identifiers.invoiceNumber',
          delivery_note: 'identifiers.invoiceNumber'
        },
        category: 'minor',
        businessImpact: 'Invoice number helps with document reconciliation',
        comparisonType: 'exact'
      }
    };
  }

  /**
   * Compare a specific field across all documents
   */
  private static compareField(
    fieldName: string,
    mapping: any,
    documents: Array<{ name: string; type: LogisticsDocumentType; data: LogisticsExtractionSchema }>
  ): FieldComparison {
    
    const values: FieldComparison['values'] = [];
    
    // Extract values from each document
    for (const doc of documents) {
      const path = mapping.paths[doc.type];
      if (path) {
        const value = this.getNestedValue(doc.data, path);
        if (value !== null && value !== undefined) {
          values.push({
            documentType: doc.type,
            documentName: doc.name,
            value: value,
            formatted: this.formatValue(value, mapping.comparisonType)
          });
        }
      }
    }

    // Determine consistency
    const { isConsistent, discrepancyType, explanation } = this.analyzeFieldConsistency(
      values, 
      mapping.comparisonType, 
      mapping.tolerance
    );

    // Determine impact
    const impact = mapping.category === 'critical' ? 'high' : 
                  mapping.category === 'important' ? 'medium' : 'low';

    // Generate recommended action
    let recommendedAction: string | undefined;
    if (!isConsistent) {
      if (mapping.category === 'critical') {
        recommendedAction = 'URGENT: Resolve discrepancy before shipment';
      } else if (mapping.category === 'important') {
        recommendedAction = 'Review and clarify discrepancy with stakeholders';
      } else {
        recommendedAction = 'Note discrepancy for future reference';
      }
    }

    return {
      fieldName,
      category: mapping.category,
      values,
      isConsistent,
      discrepancyType,
      impact,
      explanation,
      recommendedAction
    };
  }

  /**
   * Get nested value from object using dot notation path
   */
  private static getNestedValue(obj: any, path: string): any {
    if (!path) return null;
    
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  /**
   * Format value for display based on comparison type
   */
  private static formatValue(value: any, comparisonType: string): string {
    if (value === null || value === undefined) return 'N/A';
    
    switch (comparisonType) {
      case 'numeric':
      case 'weight':
        return typeof value === 'number' ? value.toFixed(2) : value.toString();
      case 'exact':
      case 'text_similarity':
      default:
        return value.toString();
    }
  }

  /**
   * Analyze if field values are consistent across documents
   */
  private static analyzeFieldConsistency(
    values: FieldComparison['values'],
    comparisonType: string,
    tolerance?: number | string
  ): {
    isConsistent: boolean;
    discrepancyType: FieldComparison['discrepancyType'];
    explanation: string;
  } {
    
    if (values.length === 0) {
      return {
        isConsistent: false,
        discrepancyType: 'missing_data',
        explanation: 'Field not found in any document'
      };
    }

    if (values.length === 1) {
      return {
        isConsistent: true,
        discrepancyType: 'exact_match',
        explanation: 'Field found in only one document'
      };
    }

    switch (comparisonType) {
      case 'exact':
        return this.compareExact(values);
      
      case 'numeric':
      case 'weight':
        return this.compareNumeric(values, tolerance as number);
      
      case 'text_similarity':
        return this.compareText(values);
      
      default:
        return this.compareExact(values);
    }
  }

  private static compareExact(values: FieldComparison['values']): any {
    const uniqueValues = [...new Set(values.map(v => v.value))];
    
    if (uniqueValues.length === 1) {
      return {
        isConsistent: true,
        discrepancyType: 'exact_match',
        explanation: `All documents have the same value: ${uniqueValues[0]}`
      };
    } else {
      return {
        isConsistent: false,
        discrepancyType: 'major_discrepancy',
        explanation: `Different values found: ${uniqueValues.join(', ')}`
      };
    }
  }

  private static compareNumeric(values: FieldComparison['values'], tolerance: number = 0): any {
    const numericValues = values.map(v => parseFloat(v.value)).filter(v => !isNaN(v));
    
    if (numericValues.length !== values.length) {
      return {
        isConsistent: false,
        discrepancyType: 'major_discrepancy',
        explanation: 'Some values are not numeric'
      };
    }

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const range = max - min;

    if (range === 0) {
      return {
        isConsistent: true,
        discrepancyType: 'exact_match',
        explanation: `All values are identical: ${min}`
      };
    } else if (range <= tolerance) {
      return {
        isConsistent: true,
        discrepancyType: 'acceptable_variance',
        explanation: `Values within acceptable tolerance (±${tolerance}): ${min} - ${max}`
      };
    } else {
      return {
        isConsistent: false,
        discrepancyType: 'major_discrepancy',
        explanation: `Values exceed tolerance: ${min} - ${max} (tolerance: ±${tolerance})`
      };
    }
  }

  private static compareText(values: FieldComparison['values']): any {
    // Simple text similarity check
    const textValues = values.map(v => v.value.toString().toLowerCase().trim());
    const uniqueValues = [...new Set(textValues)];

    if (uniqueValues.length === 1) {
      return {
        isConsistent: true,
        discrepancyType: 'exact_match',
        explanation: 'All text values match exactly'
      };
    }

    // Check for similar text (simple approach)
    const similarities = [];
    for (let i = 0; i < textValues.length - 1; i++) {
      for (let j = i + 1; j < textValues.length; j++) {
        const similarity = this.calculateTextSimilarity(textValues[i], textValues[j]);
        similarities.push(similarity);
      }
    }

    const avgSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;

    if (avgSimilarity > 0.8) {
      return {
        isConsistent: true,
        discrepancyType: 'acceptable_variance',
        explanation: `Text values are similar (${(avgSimilarity * 100).toFixed(1)}% similarity)`
      };
    } else {
      return {
        isConsistent: false,
        discrepancyType: 'major_discrepancy',
        explanation: `Text values are significantly different: ${uniqueValues.join(', ')}`
      };
    }
  }

  private static calculateTextSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private static levenshteinDistance(str1: string, str2: string): number {
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

  /**
   * Generate actionable recommendations based on comparison results
   */
  private static generateRecommendations(
    fieldComparisons: FieldComparison[],
    documents: Array<{ name: string; type: LogisticsDocumentType; data: LogisticsExtractionSchema }>
  ): string[] {
    const recommendations: string[] = [];
    
    const criticalIssues = fieldComparisons.filter(f => f.category === 'critical' && !f.isConsistent);
    const importantIssues = fieldComparisons.filter(f => f.category === 'important' && !f.isConsistent);
    
    if (criticalIssues.length > 0) {
      recommendations.push(`🚨 URGENT: ${criticalIssues.length} critical field discrepancies must be resolved before shipment`);
      criticalIssues.forEach(issue => {
        recommendations.push(`• Review ${issue.fieldName}: ${issue.explanation}`);
      });
    }
    
    if (importantIssues.length > 0) {
      recommendations.push(`⚠️ ${importantIssues.length} important field discrepancies should be reviewed`);
    }
    
    const missingDocs = this.identifyMissingDocumentTypes(documents);
    if (missingDocs.length > 0) {
      recommendations.push(`📄 Consider adding missing document types: ${missingDocs.join(', ')}`);
    }
    
    const consistencyScore = fieldComparisons.filter(f => f.isConsistent).length / fieldComparisons.length;
    if (consistencyScore >= 0.9) {
      recommendations.push('✅ Documents show high consistency - ready for processing');
    } else if (consistencyScore >= 0.7) {
      recommendations.push('⚠️ Moderate consistency - review flagged discrepancies');  
    } else {
      recommendations.push('🚨 Low consistency - comprehensive review required');
    }
    
    return recommendations;
  }

  private static identifyMissingDocumentTypes(documents: Array<{ type: LogisticsDocumentType }>): string[] {
    const presentTypes = new Set(documents.map(d => d.type));
    const expectedTypes: LogisticsDocumentType[] = ['invoice', 'air_waybill', 'house_waybill', 'bill_of_entry'];
    
    return expectedTypes.filter(type => !presentTypes.has(type));
  }

  /**
   * Generate a summary report in different formats
   */
  static generateSummaryReport(report: DocumentComparisonReport, format: 'text' | 'html' | 'json' = 'text'): string {
    switch (format) {
      case 'html':
        return this.generateHTMLReport(report);
      case 'json':
        return JSON.stringify(report, null, 2);
      default:
        return this.generateTextReport(report);
    }
  }

  private static generateTextReport(report: DocumentComparisonReport): string {
    let output = `# DOCUMENT COMPARISON REPORT\n`;
    output += `Generated: ${new Date(report.metadata.comparisonDate).toLocaleDateString()}\n\n`;
    
    // Summary section
    output += `## SUMMARY\n`;
    output += `Documents Compared: ${report.summary.totalDocuments} (${report.summary.documentsCompared.join(', ')})\n`;
    output += `Overall Consistency Score: ${(report.summary.overallConsistencyScore * 100).toFixed(1)}%\n`;
    output += `Risk Level: ${report.summary.riskLevel.toUpperCase()}\n`;
    output += `Consistent Fields: ${report.summary.consistentFields}/${report.summary.totalFieldsCompared}\n`;
    output += `Discrepant Fields: ${report.summary.discrepantFields}\n`;
    output += `Missing Fields: ${report.summary.missingFields}\n\n`;

    // Critical issues
    if (report.criticalIssues.length > 0) {
      output += `## CRITICAL ISSUES\n`;
      report.criticalIssues.forEach(issue => {
        output += `⚠️ ${issue.description}\n`;
        output += `   Impact: ${issue.impact}\n`;
        output += `   Affected Documents: ${issue.affectedDocuments.join(', ')}\n`;
        output += `   Action Required: ${issue.recommendedAction}\n\n`;
      });
    }

    // Field comparisons
    output += `## FIELD COMPARISON DETAILS\n`;
    report.fieldComparisons.forEach(field => {
      output += `### ${field.fieldName} (${field.category})\n`;
      output += `Status: ${field.isConsistent ? '✅ Consistent' : '❌ Discrepant'} (${field.discrepancyType})\n`;
      output += `Values:\n`;
      field.values.forEach(value => {
        output += `  - ${value.documentName}: ${value.formatted || value.value}\n`;
      });
      output += `Explanation: ${field.explanation}\n`;
      if (field.recommendedAction) {
        output += `Action: ${field.recommendedAction}\n`;
      }
      output += `\n`;
    });

    // Recommendations
    output += `## RECOMMENDATIONS\n`;
    report.recommendations.forEach(rec => {
      output += `• ${rec}\n`;
    });

    return output;
  }

  private static generateHTMLReport(report: DocumentComparisonReport): string {
    const riskColorMap = {
      low: '#10b981',
      medium: '#f59e0b', 
      high: '#ef4444'
    };

    const consistencyPercent = (report.summary.overallConsistencyScore * 100).toFixed(1);
    const riskColor = riskColorMap[report.summary.riskLevel];

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Document Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .summary-card { background: white; border: 1px solid #e5e7eb; padding: 15px; border-radius: 6px; text-align: center; }
        .risk-badge { color: white; padding: 4px 12px; border-radius: 20px; font-weight: bold; }
        .field-comparison { margin: 20px 0; border: 1px solid #e5e7eb; border-radius: 6px; }
        .field-header { background: #f8f9fa; padding: 15px; font-weight: bold; }
        .field-content { padding: 15px; }
        .value-list { margin: 10px 0; }
        .value-item { padding: 5px 0; border-bottom: 1px solid #f3f4f6; }
        .consistent { color: #10b981; }
        .discrepant { color: #ef4444; }
        .critical-issues { background: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .recommendations { background: #f0f9ff; border: 1px solid #bae6fd; padding: 20px; border-radius: 6px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Document Comparison Report</h1>
        <p>Generated: ${new Date(report.metadata.comparisonDate).toLocaleDateString()}</p>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <h3>Documents</h3>
            <p>${report.summary.totalDocuments}</p>
        </div>
        <div class="summary-card">
            <h3>Consistency Score</h3>
            <p>${consistencyPercent}%</p>
        </div>
        <div class="summary-card">
            <h3>Risk Level</h3>
            <span class="risk-badge" style="background-color: ${riskColor}">${report.summary.riskLevel.toUpperCase()}</span>
        </div>
        <div class="summary-card">
            <h3>Fields Compared</h3>
            <p>${report.summary.totalFieldsCompared}</p>
        </div>
    </div>

    ${report.criticalIssues.length > 0 ? `
    <div class="critical-issues">
        <h2>Critical Issues</h2>
        ${report.criticalIssues.map(issue => `
        <div style="margin: 10px 0;">
            <strong>⚠️ ${issue.description}</strong><br>
            Impact: ${issue.impact}<br>
            Affected: ${issue.affectedDocuments.join(', ')}<br>
            Action: ${issue.recommendedAction}
        </div>
        `).join('')}
    </div>
    ` : ''}

    <h2>Field Comparisons</h2>
    ${report.fieldComparisons.map(field => `
    <div class="field-comparison">
        <div class="field-header">
            ${field.fieldName} (${field.category})
            <span class="${field.isConsistent ? 'consistent' : 'discrepant'}">
                ${field.isConsistent ? '✅ Consistent' : '❌ Discrepant'}
            </span>
        </div>
        <div class="field-content">
            <div class="value-list">
                ${field.values.map(value => `
                <div class="value-item">
                    <strong>${value.documentName}:</strong> ${value.formatted || value.value}
                </div>
                `).join('')}
            </div>
            <p><strong>Analysis:</strong> ${field.explanation}</p>
            ${field.recommendedAction ? `<p><strong>Action:</strong> ${field.recommendedAction}</p>` : ''}
        </div>
    </div>
    `).join('')}

    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
</body>
</html>`;
  }
}