// Quick test to verify DocumentFieldComparator functionality
import { DocumentFieldComparator } from './src/lib/document-field-comparator.js';

// Mock test data
const mockDocuments = [
  {
    name: "Invoice_001.pdf",
    type: "invoice",
    data: {
      identifiers: { 
        awbNumber: "123456789", 
        invoiceNumber: "INV-001" 
      },
      parties: {
        shipper: { name: "ABC Corp" },
        consignee: { name: "XYZ Ltd" }
      },
      shipment: {
        grossWeight: { value: 25.5 },
        packageCount: { value: 2 }
      },
      commercial: {
        invoiceValue: { amount: 1000, currency: "USD" }
      },
      product: { hsnCode: "123456" },
      metadata: { documentType: "invoice" }
    }
  },
  {
    name: "AWB_001.pdf", 
    type: "air_waybill",
    data: {
      identifiers: { 
        awbNumber: "123456789", 
        hawbNumber: "H789" 
      },
      parties: {
        shipper: { name: "ABC Corp" },
        consignee: { name: "XYZ Ltd" }
      },
      shipment: {
        grossWeight: { value: 25.0 },  // Slight difference
        packageCount: { value: 2 }
      },
      metadata: { documentType: "air_waybill" }
    }
  }
];

try {
  console.log('🧪 Testing DocumentFieldComparator...');
  
  const comparison = DocumentFieldComparator.compareDocuments(mockDocuments);
  
  console.log('✅ Comparison successful!');
  console.log(`📊 Overall consistency: ${(comparison.summary.overallConsistencyScore * 100).toFixed(1)}%`);
  console.log(`🎯 Risk level: ${comparison.summary.riskLevel}`);
  console.log(`⚠️ Critical issues: ${comparison.criticalIssues.length}`);
  console.log(`📝 Field comparisons: ${comparison.fieldComparisons.length}`);
  
  // Test report generation
  const textReport = DocumentFieldComparator.generateSummaryReport(comparison, 'text');
  console.log('\n📄 Text report generated successfully (', textReport.length, 'characters)');
  
  console.log('\n🎉 All tests passed!');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
}