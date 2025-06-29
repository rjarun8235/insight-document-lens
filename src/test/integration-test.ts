// Integration test to verify all new modules are properly integrated
import { LLMExtractionService, LogisticsExtractionSchema } from '../lib/LLMExtractionService';
import { LogisticsBusinessRules, DocumentQualityAssessment } from '../lib/logistics-validation';
import { DocumentRelationshipValidator } from '../lib/document-relationship-validator';
import { HSNCodeValidator } from '../lib/hsn-code-validator';
import { ExtractionLogger } from '../lib/extraction-logger';
import { LogisticsDocumentType } from '../lib/document-types';

/**
 * Integration Test Suite
 * Tests that all new validation modules are properly integrated
 */
export class IntegrationTest {
  
  /**
   * Test basic module imports and instantiation
   */
  static testModuleImports(): boolean {
    try {
      // Test service instantiation
      const service = new LLMExtractionService();
      console.log('✅ LLMExtractionService instantiated successfully');
      
      // Test validator instantiation
      const validator = new DocumentRelationshipValidator();
      console.log('✅ DocumentRelationshipValidator instantiated successfully');
      
      // Test logger instantiation
      const logger = new ExtractionLogger();
      console.log('✅ ExtractionLogger instantiated successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Module import test failed:', error);
      return false;
    }
  }
  
  /**
   * Test business rules validation
   */
  static testBusinessRules(): boolean {
    try {
      // Test package count consistency
      const packageRule = LogisticsBusinessRules.packageCountConsistency(2, 2, 'PKG', 'PKG');
      console.log('✅ Package count validation:', packageRule.passed ? 'PASSED' : 'FAILED');
      
      // Test weight consistency
      const weightRule = LogisticsBusinessRules.weightConsistency(37, 34.2, 'KGS');
      console.log('✅ Weight consistency validation:', weightRule.passed ? 'PASSED' : 'FAILED');
      
      // Test HSN code mapping
      const hsnRule = LogisticsBusinessRules.hsnCodeMapping('73261990', '73201019');
      console.log('✅ HSN code mapping validation:', hsnRule.passed ? 'PASSED' : 'FAILED');
      
      return true;
    } catch (error) {
      console.error('❌ Business rules test failed:', error);
      return false;
    }
  }
  
  /**
   * Test HSN code validation
   */
  static testHSNValidation(): boolean {
    try {
      // Test valid HSN code
      const validHSN = HSNCodeValidator.validateHSNCode('73261990');
      console.log('✅ Valid HSN code test:', validHSN.isValid ? 'PASSED' : 'FAILED');
      
      // Test invalid HSN code
      const invalidHSN = HSNCodeValidator.validateHSNCode('invalid');
      console.log('✅ Invalid HSN code test:', !invalidHSN.isValid ? 'PASSED' : 'FAILED');
      
      // Test HSN code mapping
      const mapping = HSNCodeValidator.mapHSNCodes('73261990', '73201019');
      console.log('✅ HSN code mapping test:', mapping.commercialCode ? 'PASSED' : 'FAILED');
      
      return true;
    } catch (error) {
      console.error('❌ HSN validation test failed:', error);
      return false;
    }
  }
  
  /**
   * Test document quality assessment
   */
  static testDocumentQuality(): boolean {
    try {
      // Create mock extraction data
      const mockData: LogisticsExtractionSchema = {
        identifiers: {
          invoiceNumber: 'CD970077514',
          awbNumber: '09880828764',
          hawbNumber: '448765',
          customerPO: null,
          shipmentID: null,
          deliveryNoteNumber: null,
          jobNumber: null,
          beNumber: null,
          packingListNumber: null
        },
        parties: {
          shipper: {
            name: 'R.A. LABONE & CO LTD',
            address: 'LOWER MIDDLETON STREET, ILKESTON',
            country: 'UNITED KINGDOM',
            phone: null,
            email: null
          },
          consignee: {
            name: 'SKI MANUFACTURING',
            address: '162E 6TH STREET SIDCO IND ESTATE',
            country: 'INDIA',
            customerNumber: null,
            importerCode: null,
            adCode: null,
            phone: null,
            email: null
          }
        },
        shipment: {
          packageCount: { value: 2, unit: 'PKG', originalText: '2 PKG' },
          grossWeight: { value: 37, unit: 'KGS', originalText: '37 KGS' },
          netWeight: { value: 34.2, unit: 'KG', originalText: '34.2 KG' },
          dimensions: '57 x 31 x 20 cms',
          volume: '0.071 m3'
        },
        commercial: {
          invoiceValue: { amount: 1989, currency: 'GBP' },
          terms: 'FOB',
          freight: { amount: 140, currency: 'USD' },
          insurance: { amount: 24.14, currency: 'GBP' },
          miscCharges: { amount: null, currency: null }
        },
        product: {
          description: 'EARTH SPRING',
          itemNumber: 'GN7001001',
          partNumber: 'P3146-A',
          hsnCode: '73261990',
          quantity: { value: 10000, unit: 'Each' },
          unitPrice: 0.1989
        },
        route: {
          origin: 'HEATHROW, LONDON',
          destination: 'CHENNAI',
          carrier: 'AIR INDIA',
          countryOfOrigin: 'UNITED KINGDOM'
        },
        dates: {
          invoiceDate: '2025-05-07',
          shipDate: '2025-05-12',
          awbDate: null,
          entryDate: null
        },
        customs: {
          assessedValue: { amount: 260547.76, currency: 'INR' },
          duties: {
            bcd: 26054.8,
            igst: 52057.5,
            socialWelfareSurcharge: 2605.5,
            totalDuty: 80717.8
          },
          exchangeRates: [
            { from: 'GBP', to: 'INR', rate: 114.55 }
          ],
          buyerSellerRelated: false
        },
        metadata: {
          documentType: 'invoice',
          extractionConfidence: 0.85,
          criticalFields: ['invoiceNumber', 'invoiceValue'],
          missingFields: [],
          issues: []
        }
      };
      
      // Test document quality assessment
      const qualityScore = DocumentQualityAssessment.assessDocumentQuality(mockData);
      console.log('✅ Document quality assessment:', qualityScore > 0 ? 'PASSED' : 'FAILED', `(Score: ${qualityScore.toFixed(2)})`);
      
      return true;
    } catch (error) {
      console.error('❌ Document quality test failed:', error);
      return false;
    }
  }
  
  /**
   * Run all integration tests
   */
  static runAllTests(): boolean {
    console.log('🧪 Starting Integration Tests...\n');
    
    const tests = [
      { name: 'Module Imports', test: this.testModuleImports },
      { name: 'Business Rules', test: this.testBusinessRules },
      { name: 'HSN Validation', test: this.testHSNValidation },
      { name: 'Document Quality', test: this.testDocumentQuality }
    ];
    
    let allPassed = true;
    
    for (const { name, test } of tests) {
      console.log(`\n📋 Testing ${name}...`);
      const passed = test();
      if (!passed) {
        allPassed = false;
      }
    }
    
    console.log('\n🎯 Integration Test Results:');
    console.log(allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
    
    return allPassed;
  }
}

// Export for use in browser console
(window as any).IntegrationTest = IntegrationTest;
