import type { EnhancedExtractionResult } from './LLMExtractionService';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface ValidationReport {
  timestamp: string;
  summary: {
    totalDocuments: number;
    successfulExtractions: number;
    averageQuality: number;
    averageCompliance: number;
    totalCriticalIssues: number;
    totalWarnings: number;
  };
  documentResults: Array<{
    documentIndex: number;
    documentType?: string;
    success: boolean;
    processingTime: number;
    quality?: {
      score: number;
      factors: Record<string, number>;
      recommendations: string[];
    };
    businessRules?: {
      compliance: number;
      criticalIssues: string[];
      warnings: string[];
      ruleResults: Array<{
        rule: string;
        passed: boolean;
        severity: string;
        message: string;
      }>;
    };
    hsnValidation?: {
      commercial?: { isValid: boolean; code?: string; issues: string[] };
      customs?: { isValid: boolean; code?: string; issues: string[] };
      mapping?: { isConsistent: boolean; explanation: string; recommendations: string[] };
    };
  }>;
}

export class ReportExporter {
  
  /**
   * Generate a comprehensive validation report from extraction results
   */
  static generateReport(results: EnhancedExtractionResult[]): ValidationReport {
    const timestamp = new Date().toISOString();
    
    // Calculate summary statistics
    const totalDocuments = results.length;
    const successfulExtractions = results.filter(r => r.success).length;
    const averageQuality = results.reduce((sum, r) => sum + (r.documentQuality?.score || 0), 0) / totalDocuments;
    const averageCompliance = results.reduce((sum, r) => sum + (r.businessRuleValidation?.overallCompliance || 0), 0) / totalDocuments;
    
    const allCriticalIssues = results.flatMap(r => r.businessRuleValidation?.criticalIssues || []);
    const allWarnings = results.flatMap(r => r.businessRuleValidation?.warnings || []);

    // Process individual document results
    const documentResults = results.map((result, index) => ({
      documentIndex: index + 1,
      documentType: result.data?.metadata?.documentType,
      success: result.success,
      processingTime: result.processingTime,
      quality: result.documentQuality ? {
        score: result.documentQuality.score,
        factors: result.documentQuality.factors,
        recommendations: result.documentQuality.recommendations
      } : undefined,
      businessRules: result.businessRuleValidation ? {
        compliance: result.businessRuleValidation.overallCompliance,
        criticalIssues: result.businessRuleValidation.criticalIssues,
        warnings: result.businessRuleValidation.warnings,
        ruleResults: result.businessRuleValidation.results
      } : undefined,
      hsnValidation: result.hsnValidation ? {
        commercial: result.hsnValidation.commercial ? {
          isValid: result.hsnValidation.commercial.isValid,
          code: result.hsnValidation.commercial.standardizedCode || undefined,
          issues: result.hsnValidation.commercial.issues
        } : undefined,
        customs: result.hsnValidation.customs ? {
          isValid: result.hsnValidation.customs.isValid,
          code: result.hsnValidation.customs.standardizedCode || undefined,
          issues: result.hsnValidation.customs.issues
        } : undefined,
        mapping: result.hsnValidation.mapping ? {
          isConsistent: result.hsnValidation.mapping.isConsistent,
          explanation: result.hsnValidation.mapping.explanation,
          recommendations: result.hsnValidation.mapping.recommendations
        } : undefined
      } : undefined
    }));

    return {
      timestamp,
      summary: {
        totalDocuments,
        successfulExtractions,
        averageQuality,
        averageCompliance,
        totalCriticalIssues: allCriticalIssues.length,
        totalWarnings: allWarnings.length
      },
      documentResults
    };
  }

  /**
   * Export validation report as JSON
   */
  static exportAsJSON(results: EnhancedExtractionResult[]): string {
    const report = this.generateReport(results);
    return JSON.stringify(report, null, 2);
  }

  /**
   * Export validation report as CSV
   */
  static exportAsCSV(results: EnhancedExtractionResult[]): string {
    const report = this.generateReport(results);
    
    const headers = [
      'Document',
      'Type',
      'Success',
      'Processing Time (s)',
      'Quality Score (%)',
      'Compliance (%)',
      'Critical Issues',
      'Warnings',
      'HSN Commercial Valid',
      'HSN Customs Valid',
      'HSN Mapping Consistent'
    ];

    const rows = report.documentResults.map(doc => [
      doc.documentIndex.toString(),
      doc.documentType || 'Unknown',
      doc.success ? 'Yes' : 'No',
      doc.processingTime.toFixed(2),
      doc.quality ? (doc.quality.score * 100).toFixed(1) : 'N/A',
      doc.businessRules ? (doc.businessRules.compliance * 100).toFixed(1) : 'N/A',
      doc.businessRules?.criticalIssues.length.toString() || '0',
      doc.businessRules?.warnings.length.toString() || '0',
      doc.hsnValidation?.commercial?.isValid ? 'Yes' : doc.hsnValidation?.commercial ? 'No' : 'N/A',
      doc.hsnValidation?.customs?.isValid ? 'Yes' : doc.hsnValidation?.customs ? 'No' : 'N/A',
      doc.hsnValidation?.mapping?.isConsistent ? 'Yes' : doc.hsnValidation?.mapping ? 'No' : 'N/A'
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Export validation report as PDF
   */
  static exportAsPDF(results: EnhancedExtractionResult[]): jsPDF {
    const report = this.generateReport(results);
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.text('Document Validation Report', 20, 20);

    // Timestamp
    doc.setFontSize(12);
    doc.text(`Generated: ${new Date(report.timestamp).toLocaleString()}`, 20, 35);

    // Summary Section
    doc.setFontSize(16);
    doc.text('Summary', 20, 55);
    
    const summaryData = [
      ['Total Documents', report.summary.totalDocuments.toString()],
      ['Successful Extractions', report.summary.successfulExtractions.toString()],
      ['Average Quality Score', `${(report.summary.averageQuality * 100).toFixed(1)}%`],
      ['Average Compliance', `${(report.summary.averageCompliance * 100).toFixed(1)}%`],
      ['Total Critical Issues', report.summary.totalCriticalIssues.toString()],
      ['Total Warnings', report.summary.totalWarnings.toString()]
    ];

    (doc as any).autoTable({
      startY: 65,
      head: [['Metric', 'Value']],
      body: summaryData,
      theme: 'striped',
      styles: { fontSize: 10 },
      columnStyles: { 0: { fontStyle: 'bold' } }
    });

    // Document Results Section
    let currentY = (doc as any).lastAutoTable.finalY + 20;
    
    doc.setFontSize(16);
    doc.text('Document Results', 20, currentY);
    currentY += 15;

    const documentData = report.documentResults.map(doc => [
      doc.documentIndex.toString(),
      doc.documentType || 'Unknown',
      doc.success ? 'Success' : 'Failed',
      `${doc.processingTime.toFixed(2)}s`,
      doc.quality ? `${(doc.quality.score * 100).toFixed(1)}%` : 'N/A',
      doc.businessRules ? `${(doc.businessRules.compliance * 100).toFixed(1)}%` : 'N/A',
      doc.businessRules ? doc.businessRules.criticalIssues.length.toString() : '0',
      doc.businessRules ? doc.businessRules.warnings.length.toString() : '0'
    ]);

    (doc as any).autoTable({
      startY: currentY,
      head: [['Doc', 'Type', 'Status', 'Time', 'Quality', 'Compliance', 'Critical', 'Warnings']],
      body: documentData,
      theme: 'striped',
      styles: { fontSize: 9 },
      columnStyles: { 
        2: { cellWidth: 20 },
        3: { cellWidth: 15 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 }
      }
    });

    // Issues Section (if any)
    const allCriticalIssues = report.documentResults.flatMap(doc => 
      doc.businessRules?.criticalIssues.map(issue => `Doc ${doc.documentIndex}: ${issue}`) || []
    );

    if (allCriticalIssues.length > 0) {
      currentY = (doc as any).lastAutoTable.finalY + 20;
      
      // Add new page if needed
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(16);
      doc.text('Critical Issues', 20, currentY);
      currentY += 10;

      doc.setFontSize(10);
      allCriticalIssues.forEach((issue, index) => {
        if (currentY > 280) {
          doc.addPage();
          currentY = 20;
        }
        doc.text(`${index + 1}. ${issue}`, 25, currentY);
        currentY += 7;
      });
    }

    return doc;
  }

  /**
   * Download file with given content and filename
   */
  static downloadFile(content: string | jsPDF, filename: string, type: 'json' | 'csv' | 'pdf') {
    let blob: Blob;
    
    if (type === 'pdf' && content instanceof jsPDF) {
      // For PDF, use jsPDF's save method
      content.save(filename);
      return;
    }
    
    // For JSON and CSV
    const mimeTypes = {
      json: 'application/json',
      csv: 'text/csv',
      pdf: 'application/pdf'
    };

    blob = new Blob([content as string], { type: mimeTypes[type] });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate timestamped filename
   */
  static generateFilename(prefix: string, extension: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    return `${prefix}_${timestamp}.${extension}`;
  }

  /**
   * Export validation results in specified format
   */
  static exportValidationResults(
    results: EnhancedExtractionResult[], 
    format: 'json' | 'csv' | 'pdf'
  ) {
    const filename = this.generateFilename('validation_report', format);
    
    switch (format) {
      case 'json':
        const jsonContent = this.exportAsJSON(results);
        this.downloadFile(jsonContent, filename, 'json');
        break;
        
      case 'csv':
        const csvContent = this.exportAsCSV(results);
        this.downloadFile(csvContent, filename, 'csv');
        break;
        
      case 'pdf':
        const pdfDoc = this.exportAsPDF(results);
        this.downloadFile(pdfDoc, filename, 'pdf');
        break;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}