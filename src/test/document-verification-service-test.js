/**
 * Simple test script for DocumentVerificationService.
 * To run: `node src/test/document-verification-service-test.js`
 *
 * This test does not use a formal testing framework to keep dependencies minimal.
 * It uses Node.js's built-in `assert` module.
 */

import { DocumentVerificationService } from '../lib/document-verification-service.js';
import assert from 'assert';

// ===== MOCK DATA =====

const mockExtractionResults = [
  {
    fileName: 'invoice-123.pdf',
    success: true,
    data: {
      metadata: { documentType: 'invoice', extractionConfidence: 0.95 },
      identifiers: { invoiceNumber: 'INV-123', awbNumber: '123-4567890' },
      shipment: { grossWeight: { value: 100, unit: 'KG' } },
    },
  },
  {
    fileName: 'hawb-abc.pdf',
    success: true,
    data: {
      metadata: { documentType: 'house_waybill', extractionConfidence: 0.92 },
      identifiers: { hawbNumber: 'HAWB-ABC', awbNumber: '123-4567890' },
      shipment: { grossWeight: { value: 105, unit: 'KG' } }, // Discrepancy here
    },
  },
];

const mockVerificationReport = {
  summary: {
    shipmentIdentifier: '123-4567890',
    documentCount: 2,
    documentTypes: ['invoice', 'house_waybill'],
    consistencyScore: 0.8,
    riskAssessment: 'medium',
    expertSummary: 'Documents show a critical discrepancy in gross weight which requires immediate attention.',
  },
  discrepancies: [
    {
      fieldName: 'grossWeight',
      category: 'critical',
      impact: 'Affects freight charges and customs declarations.',
      documents: [
        { documentName: 'invoice-123.pdf', value: '100 KG' },
        { documentName: 'hawb-abc.pdf', value: '105 KG' },
      ],
      recommendation: 'Verify the actual gross weight of the shipment and correct the documents.',
    },
  ],
  insights: [
    {
      title: 'Weight Discrepancy',
      description: 'The difference in gross weight between the invoice and HAWB is a compliance risk.',
      category: 'customs',
      severity: 'critical',
    },
  ],
  recommendations: [
    {
      action: 'Confirm actual shipment weight.',
      priority: 'high',
      reasoning: 'To ensure accurate customs filing and freight charges.',
    },
  ],
  metadata: {
    analysisTimestamp: new Date().toISOString(),
    processingTime: 1.5,
  },
};


// ===== TEST RUNNER =====

async function runTests() {
  console.log('🚀 Starting DocumentVerificationService tests...');
  let testsPassed = 0;
  const service = new DocumentVerificationService();

  // --- Test 1: Prompt Generation ---
  try {
    console.log('\n🧪 Test 1: Should generate a valid verification prompt...');
    // Accessing private method for testing purposes
    const prompt = service['buildVerificationPrompt'](mockExtractionResults);

    assert.strictEqual(typeof prompt, 'string', 'Prompt should be a string.');
    assert.ok(prompt.length > 0, 'Prompt should not be empty.');
    assert.ok(prompt.includes('You are an expert logistics and customs compliance officer'), 'Prompt should contain the correct role instruction.');
    assert.ok(prompt.includes('invoice-123.pdf'), 'Prompt should include data from the first document.');
    assert.ok(prompt.includes('hawb-abc.pdf'), 'Prompt should include data from the second document.');
    assert.ok(prompt.includes('"riskAssessment": "string (\'low\', \'medium\', or \'high\')"'), 'Prompt should include the JSON schema for the response.');

    console.log('✅ Test 1 Passed!');
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 1 Failed:', error.message);
  }

  // --- Test 2: Document Verification Process (with mocked fetch) ---
  try {
    console.log('\n🧪 Test 2: Should process multiple documents and return a structured report...');

    // Mock the global fetch function
    global.fetch = async (url, options) => {
      assert.ok(url.includes('claude-api-proxy'), 'Should call the correct proxy URL.');
      assert.strictEqual(options.method, 'POST', 'Should use POST method.');
      return {
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(mockVerificationReport) }],
        }),
      };
    };

    const report = await service.verifyDocuments(mockExtractionResults);

    assert.deepStrictEqual(report.summary, mockVerificationReport.summary, 'Report summary should match mock data.');
    assert.strictEqual(report.discrepancies.length, 1, 'Should identify one discrepancy.');
    assert.strictEqual(report.discrepancies[0].fieldName, 'grossWeight', 'Should identify the correct discrepant field.');
    assert.strictEqual(report.insights.length, 1, 'Should provide one insight.');
    assert.strictEqual(report.recommendations[0].priority, 'high', 'Should provide high-priority recommendation.');

    console.log('✅ Test 2 Passed!');
    testsPassed++;
  } catch (error) {
    console.error('❌ Test 2 Failed:', error.message);
  } finally {
    // Clean up mock
    global.fetch = undefined;
  }

  // --- Summary ---
  console.log('\n--------------------');
  console.log(`📊 Test Summary: ${testsPassed}/2 tests passed.`);
  console.log('--------------------');

  if (testsPassed !== 2) {
    console.error('\n🔥 Some tests failed. Please review the logs.');
    process.exit(1); // Exit with error code if tests fail
  } else {
    console.log('\n🎉 All tests passed successfully!');
  }
}

runTests().catch(err => {
  console.error('An unexpected error occurred during testing:', err);
  process.exit(1);
});
