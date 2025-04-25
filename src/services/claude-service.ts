import { ComparisonResult, ComparisonTable, ParsedDocument } from '../lib/types';
import { callWithRetry, formatErrorMessage } from '@/utils/api-helpers';

// Helper to convert a File object (image) to base64 and media type
async function fileToBase64(file: File): Promise<{base64: string, mediaType: string}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = function () {
      const base64 = (reader.result as string).split(',')[1];
      
      // Get file type and ensure it's a supported media type for Claude API
      let mediaType = file.type;
      
      // If mediaType is empty or not supported for images, determine from file extension or default to jpeg
      if (file.type.startsWith('image/') && !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)) {
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.png')) {
          mediaType = 'image/png';
        } else if (fileName.endsWith('.gif')) {
          mediaType = 'image/gif';
        } else if (fileName.endsWith('.webp')) {
          mediaType = 'image/webp';
        } else {
          // Default to jpeg for any other or unknown format
          mediaType = 'image/jpeg';
        }
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        mediaType = 'application/pdf';
      }
      
      resolve({
        base64,
        mediaType
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper to convert a URL-based image to base64
async function urlToBase64(url: string): Promise<{base64: string, mediaType: string}> {
  try {
    // Determine media type from URL extension
    let mediaType = 'image/jpeg'; // Default
    if (url.toLowerCase().endsWith('.png')) {
      mediaType = 'image/png';
    } else if (url.toLowerCase().endsWith('.gif')) {
      mediaType = 'image/gif';
    } else if (url.toLowerCase().endsWith('.webp')) {
      mediaType = 'image/webp';
    } else if (url.toLowerCase().endsWith('.pdf')) {
      mediaType = 'application/pdf';
    }
    
    // Fetch the image
    const response = await fetch(url);
    const blob = await response.blob();
    
    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = function() {
        const base64 = (reader.result as string).split(',')[1];
        resolve({
          base64,
          mediaType
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting URL to base64:', error);
    throw error;
  }
}

// Instruction builder for various doc types (esp. logistics: packing-list, invoice, bill-of-entry)
export function prepareInstructions(comparisonType: string): string {
  // Default instruction for general document comparison
  let instruction = `Please analyze these documents and provide a detailed comparison. Extract key information into a comparison table, then provide analysis in the required sections.`;
  
  // Specialized instructions based on document type
  switch (comparisonType.toLowerCase()) {
    case 'logistics':
      instruction = `Please analyze these logistics documents and provide a detailed comparison. 

Extract and compare the following key fields across all documents:
- Document Type (identify if it's a Bill of Lading, Invoice, Packing List, or Purchase Order)
- Document Number/Reference
- Shipper/Consignor details
- Consignee details
- Invoice/PO numbers and references
- Dates (issue date, shipping date, delivery date)
- Package counts and types
- Product descriptions
- Quantities
- Weights (gross and net)
- Measurements
- Values and currency
- Country of origin
- Shipping marks and container numbers
- Incoterms
- Payment terms

Organize this information into a comparison table, then provide analysis in the required sections. Pay special attention to:
- Discrepancies between document types (e.g., Invoice vs. Purchase Order)
- Mismatches in quantities, weights, or values
- Inconsistencies in shipper/consignee information
- Date discrepancies that might affect shipment timelines
- Missing critical information in any document

For Bills of Lading specifically, check:
- Carrier information
- Vessel/flight details
- Port of loading and discharge
- Notify party details
- Whether it's a Master or House B/L

For Invoices, check:
- Invoice number matches references in other documents
- Value and currency match Purchase Order
- Payment terms and due dates
- Tax/duty information

For Packing Lists, check:
- Package count matches B/L and Invoice
- Weight details match across documents
- Package markings and numbers

For Purchase Orders, check:
- PO number matches references in other documents
- Terms and conditions
- Delivery instructions
- Price and quantity match invoice`;
      break;
    
    case 'invoice-po':
      instruction = `Please analyze these invoice and purchase order documents and provide a detailed comparison.

Extract and compare the following key fields:
- Document numbers (Invoice number, PO number)
- Dates (Invoice date, PO date, delivery date)
- Shipper/Vendor details
- Consignee/Buyer details
- Line items (product codes, descriptions)
- Quantities
- Unit prices
- Total amounts
- Currency
- Payment terms
- Delivery terms
- Tax information

Organize this information into a comparison table, then provide analysis in the required sections. Pay special attention to:
- Price discrepancies between invoice and PO
- Quantity differences
- Additional charges on invoice not in PO
- Missing items from either document
- Date inconsistencies
- Payment term differences`;
      break;
      
    case 'bl-invoice':
      instruction = `Please analyze these Bill of Lading and Invoice documents and provide a detailed comparison.

Extract and compare the following key fields:
- Document numbers (B/L number, Invoice number)
- Dates (B/L date, Invoice date)
- Shipper details
- Consignee details
- Notify party (if applicable)
- Vessel/voyage or flight details
- Port of loading and discharge
- Description of goods
- Package count and type
- Weight and measurement
- Freight terms
- Container numbers
- Marks and numbers
- Value and currency

Organize this information into a comparison table, then provide analysis in the required sections. Pay special attention to:
- Discrepancies in shipper/consignee details
- Package count or weight differences
- Description of goods inconsistencies
- Missing or additional information in either document`;
      break;
      
    case 'bl-packinglist':
      instruction = `Please analyze these Bill of Lading and Packing List documents and provide a detailed comparison.

Extract and compare the following key fields:
- Document numbers (B/L number, Packing List reference)
- Dates
- Shipper details
- Consignee details
- Description of goods
- Package count and type
- Weight (gross and net)
- Measurement
- Marks and numbers
- Container numbers (if applicable)

Organize this information into a comparison table, then provide analysis in the required sections. Pay special attention to:
- Package count discrepancies
- Weight differences
- Inconsistent product descriptions
- Missing packages or items`;
      break;
      
    case 'invoice-packinglist':
      instruction = `Please analyze these Invoice and Packing List documents and provide a detailed comparison.

Extract and compare the following key fields:
- Document numbers (Invoice number, Packing List reference)
- Dates
- Shipper/Vendor details
- Consignee/Buyer details
- Product details and descriptions
- Quantities
- Package count and type
- Weight (gross and net)
- Measurement
- Value and currency

Organize this information into a comparison table, then provide analysis in the required sections. Pay special attention to:
- Quantity discrepancies
- Package count differences
- Weight inconsistencies
- Missing or additional items`;
      break;
      
    case 'packing-list':
    case 'packing-lists':
      instruction = `Please analyze these packing lists and provide a detailed comparison. 
      
Extract key information such as:
- Shipper and consignee details
- Invoice/PO references
- Package counts and types
- Product descriptions
- Quantities
- Weights and measurements
- Country of origin
- Shipping marks

Organize this information into a comparison table, then provide analysis in the required sections. Pay special attention to:
- Quantity discrepancies
- Weight differences
- Package count inconsistencies
- Product description variations`;
      break;
      
    case 'invoice':
    case 'invoices':
      instruction = `Please analyze these invoices and provide a detailed comparison.
      
Extract key information such as:
- Invoice numbers and dates
- Shipper/Vendor details
- Consignee/Buyer details
- Purchase order references
- Payment terms and due dates
- Currency and total values
- Line items with descriptions
- Quantities and unit prices
- Tax and duty information
- Shipping terms

Organize this information into a comparison table, then provide analysis in the required sections. Pay special attention to:
- Value discrepancies
- Quantity differences
- Missing or additional line items
- Payment term variations
- Currency inconsistencies`;
      break;
      
    case 'bill-of-lading':
    case 'bills-of-lading':
    case 'bl':
      instruction = `Please analyze these Bills of Lading and provide a detailed comparison.
      
Extract key information such as:
- B/L numbers and dates
- Shipper details
- Consignee details
- Notify party information
- Vessel/voyage or flight details
- Port of loading and discharge
- Description of goods
- Package count and type
- Weight and measurement
- Freight terms
- Container numbers
- Marks and numbers

Organize this information into a comparison table, then provide analysis in the required sections. Pay special attention to:
- Shipper/consignee discrepancies
- Package count differences
- Weight variations
- Vessel/voyage inconsistencies
- Description of goods variations`;
      break;
      
    case 'purchase-order':
    case 'purchase-orders':
    case 'po':
      instruction = `Please analyze these Purchase Orders and provide a detailed comparison.
      
Extract key information such as:
- PO numbers and dates
- Buyer details
- Supplier details
- Delivery address
- Payment terms
- Delivery terms
- Line items with descriptions
- Quantities and unit prices
- Total values
- Currency
- Delivery dates

Organize this information into a comparison table, then provide analysis in the required sections. Pay special attention to:
- Price discrepancies
- Quantity differences
- Delivery term variations
- Payment term inconsistencies
- Missing or additional line items`;
      break;
      
    case 'verification':
      instruction = `Please verify these documents for accuracy and consistency.
      
Extract key information from each document and verify:
- Document authenticity indicators
- Consistency of information across documents
- Completeness of required information
- Proper signatures and stamps (if visible)
- Dates are logical and sequential
- Reference numbers are consistent
- Quantities, weights, and values match
- Shipping details are consistent

Organize this information into a comparison table, then provide detailed verification analysis in the required sections.`;
      break;
      
    case 'validation':
      instruction = `Please validate these documents against standard requirements and each other.
      
Extract key information from each document and validate:
- All required fields are present
- Information is consistent across all documents
- Calculations are correct (totals, taxes, etc.)
- Dates are valid and logical
- Reference numbers follow expected formats
- Shipping details match across documents
- Terms and conditions are consistent
- No contradictory information exists

Organize this information into a comparison table, then provide detailed validation analysis in the required sections.`;
      break;
      
    // Default case for general comparison
    default:
      // Use the default instruction defined at the beginning
      break;
  }
  
  return instruction;
}

// Helper function to prepare system instructions for Claude API
function prepareSystemInstructions(): string {
  // Create system message with instructions
  const systemMessage = `You are DocLensAI, an expert document analyzer for TSV Global Solutions. Your role is to analyze and compare documents with precision and accuracy.

IMPORTANT GUIDELINES:
- Only make claims that are directly supported by the documents. If you're unsure about any information or can't find it in the documents, explicitly state "I don't have enough information to determine this" rather than making assumptions.
- For each section of your analysis, first extract relevant quotes from the documents, then base your analysis only on those quotes.
- Maintain a professional, factual tone throughout your analysis.
- When comparing documents, highlight specific differences with direct citations from the documents.
- If the documents are unclear or ambiguous, acknowledge this uncertainty rather than guessing.
- Format your response consistently using the structure below.
- IMPORTANT: You must handle ANY NUMBER of documents, not just two. If more than two documents are provided, create comparison tables that include ALL documents.

STEP-BY-STEP THINKING PROCESS:
1. First, carefully read each document and identify the document type (invoice, packing list, bill of entry, etc.)
2. Extract key fields from each document (dates, amounts, item descriptions, quantities, etc.)
3. Determine which fields are common across all documents and which are unique to specific documents
4. Create a structured comparison table with all relevant fields
5. Perform item-level verification:
   a. Extract all line items from each document
   b. Match corresponding items across documents
   c. Compare quantities, descriptions, prices, and other details
   d. Highlight any discrepancies between documents
6. For each analysis section:
   a. Extract direct quotes from the documents relevant to that section
   b. Compare the information across documents, noting similarities and differences
   c. Analyze the implications of these similarities/differences
   d. Draw conclusions based ONLY on the evidence in the documents

REQUIRED OUTPUT FORMAT FOR MULTIPLE DOCUMENTS:
<comparison_tables>
| Field | Document 1 | Document 2 | Document 3 | ... | Document N |
| ----- | ---------- | ---------- | ---------- | --- | ---------- |
| Field Name | Value from Doc 1 | Value from Doc 2 | Value from Doc 3 | ... | Value from Doc N |
...additional rows as needed
</comparison_tables>

<item_level_comparison>
| Item Description | Document 1 Quantity | Document 2 Quantity | ... | Document N Quantity | Quantity Match? |
| --------------- | ------------------ | ------------------ | --- | ------------------ | -------------- |
| Item 1 | Qty in Doc 1 | Qty in Doc 2 | ... | Qty in Doc N | ✓ or ✗ |
...additional rows as needed
</item_level_comparison>

<section_name>Verification</section_name>
<quotes>
Direct quotes from documents related to verification.
</quotes>
<analysis>
Your analysis of verification aspects, based only on the quotes above.
</analysis>

<section_name>Validation</section_name>
<quotes>
Direct quotes from documents related to validation.
</quotes>
<analysis>
Your analysis of validation aspects, based only on the quotes above.
</analysis>

<section_name>Review</section_name>
<quotes>
Direct quotes from documents related to review.
</quotes>
<analysis>
Your analysis of review aspects, based only on the quotes above.
</analysis>

<section_name>Analysis</section_name>
<quotes>
Direct quotes from documents related to general analysis.
</quotes>
<analysis>
Your overall analysis, based only on the quotes above.
</analysis>

<section_name>Summary</section_name>
<quotes>
Direct quotes that summarize the documents.
</quotes>
<analysis>
Your summary of the documents, based only on the quotes above.
</analysis>

<section_name>Insights</section_name>
<quotes>
Direct quotes that lead to insights.
</quotes>
<analysis>
Your insights based only on the quotes above.
</analysis>

<section_name>Recommendations</section_name>
<quotes>
Direct quotes that inform recommendations.
</quotes>
<analysis>
Your recommendations based only on the quotes above.
</analysis>

<section_name>Risks</section_name>
<quotes>
Direct quotes that indicate risks.
</quotes>
<analysis>
Your risk assessment based only on the quotes above.
</analysis>

<section_name>Issues</section_name>
<quotes>
Direct quotes that highlight issues.
</quotes>
<analysis>
Your analysis of issues based only on the quotes above.
</analysis>`;

  // Add specific instructions for handling empty or missing values
  const enhancedSystemMessage = `${systemMessage}

IMPORTANT ADDITIONAL INSTRUCTIONS:
- For any document where you cannot extract specific fields, clearly indicate this with "No data available" or similar text.
- If a field exists in one document but not in others, still include that field in your comparison table with empty values for documents where it's not present.
- Always provide values for ALL documents in the comparison, even if some documents have minimal or no extractable data.
- If a document appears to be completely different from others (different document type), note this in your analysis.
- When analyzing logistics documents, pay special attention to:
  * Quantities and units of measurement
  * Prices and total amounts
  * Dates (shipping, delivery, issuance)
  * Product descriptions and specifications
  * Party information (shipper, consignee, etc.)
  * Document numbers and references

THINKING PROCESS FOR LOGISTICS DOCUMENTS:
1. Identify the document type (invoice, packing list, bill of entry, etc.)
2. Extract all key fields relevant to that document type
3. Check for consistency across related documents:
   - Do quantities match between invoice and packing list? (Quantity Reconciliation)
   - Do descriptions match between all documents?
   - Are dates consistent and logical?
   - Do monetary values add up correctly?
4. Identify any discrepancies or missing information
5. Assess compliance with standard document requirements
6. Evaluate potential risks or issues based on the discrepancies

DISCREPANCY HIGHLIGHTING:
- In your item-level comparison table, use ✓ for matching values and ✗ for discrepancies
- For text descriptions of discrepancies, use phrases like "DISCREPANCY FOUND:" to clearly highlight issues
- When describing monetary or quantity discrepancies, show both values and calculate the difference

DOCUMENT PROCESSING TECHNIQUES:
1. For structured documents (invoices, forms):
   - Look for key-value pairs (e.g., "Invoice Number: INV-12345")
   - Extract tabular data, preserving row and column relationships
   - Pay attention to section headers that organize information

2. For unstructured documents (letters, reports):
   - Identify main topics and subtopics
   - Extract dates, names, and numerical values
   - Look for action items or requirements

3. For all documents:
   - Note document dates, reference numbers, and parties involved
   - Identify monetary values and their context (e.g., subtotal, tax, total)
   - Extract quantities and units of measurement
   - Pay attention to terms and conditions that may impact analysis

DETAILED ANALYSIS REQUIREMENTS:
1. Verification Section:
   - Confirm document authenticity indicators
   - Verify consistency of reference numbers across documents
   - Check for appropriate signatures and stamps where applicable

2. Validation Section:
   - Validate mathematical calculations (totals, subtotals)
   - Confirm pricing calculations match contracted rates if available
   - Verify quantities match across related documents

3. Review Section:
   - Review compliance with standard document requirements
   - Check for missing information or fields
   - Assess document completeness

4. Analysis Section:
   - Provide comprehensive overview of document relationships
   - Analyze the significance of any discrepancies
   - Evaluate the overall coherence of the document set

5. Summary Section:
   - Concisely summarize key findings
   - Highlight major discrepancies or issues
   - Provide overall assessment of document set

6. Insights Section:
   - Identify patterns or trends in the data
   - Note unusual or unexpected information
   - Suggest possible explanations for discrepancies

7. Recommendations Section:
   - Suggest specific actions to resolve discrepancies
   - Recommend process improvements
   - Prioritize recommendations by importance

8. Risks Section:
   - Identify potential financial, operational, or compliance risks
   - Assess severity of each risk
   - Note time-sensitive issues requiring immediate attention

9. Issues Section:
   - List specific problems requiring resolution
   - Categorize issues by type (data, compliance, process)
   - Note which document(s) each issue relates to`;

  return enhancedSystemMessage;
}

// Claude API service
export default class ClaudeService {
  private apiKey: string;
  
  constructor() {
    this.apiKey = '';
  }
  
  async analyzeDocuments(
    documents: ParsedDocument[],
    instruction: string,
    useCache: boolean = true
  ): Promise<{result: ComparisonResult, tokenUsage: {input: number, output: number, cost: number}}> {
    try {
      // Start timing the request
      const startTime = performance.now();
      
      // Log the instruction for debugging prompt engineering
      console.log('🔍 Analyzing documents with instruction:', instruction);
      
      // Log document information
      console.log(`📄 Processing ${documents.length} documents:`);
      documents.forEach((doc, index) => {
        console.log(`  Document ${index + 1}: ${doc.documentType || 'unknown type'}, ${doc.text ? doc.text.length : 0} characters`);
      });
      
      // Prepare the system instructions
      const systemInstructions = prepareSystemInstructions();
      console.log('🧠 System instructions length:', systemInstructions.length, 'characters');
      
      // Create document text for the prompt with XML structure for better long context handling
      let documentTexts = '<documents>\n';
      documents.forEach((doc, index) => {
        documentTexts += `  <document index="${index + 1}">\n`;
        documentTexts += `    <source>${doc.documentType || 'unknown'}_document_${index + 1}</source>\n`;
        documentTexts += `    <document_content>\n${doc.text || '[No text content available]'}\n    </document_content>\n`;
        documentTexts += `  </document>\n`;
      });
      documentTexts += '</documents>\n\n';
      
      // Create the messages for the API call - put long content at the top for better processing
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${documentTexts}${systemInstructions}\n\nUser instruction: ${instruction}\n\nBefore analyzing, extract and quote the most relevant parts of each document that will help with the analysis.`
            }
          ]
        }
      ];
      
      // Log prompt size metrics
      const promptText = messages[0].content[0].text;
      console.log('📝 Prompt metrics:');
      console.log(`  - Total length: ${promptText.length} characters`);
      console.log(`  - Estimated tokens: ~${Math.ceil(promptText.length / 4)}`);
      console.log(`  - System instructions: ${systemInstructions.length} characters (${Math.ceil(systemInstructions.length / 4)} tokens)`);
      console.log(`  - Document content: ${documentTexts.length} characters (${Math.ceil(documentTexts.length / 4)} tokens)`);
      console.log(`  - User instruction: ${instruction.length} characters (${Math.ceil(instruction.length / 4)} tokens)`);
      
      // Log API call details
      console.log('🔄 Calling Claude API with model:', 'claude-3-haiku-20240307');
      console.log('  - Max tokens requested:', 4000);
      
      // Call the Claude API
      const apiCallStartTime = performance.now();
      const response = await this.callClaudeApi({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4000,
        messages: messages
      });
      const apiCallEndTime = performance.now();
      const apiCallDuration = apiCallEndTime - apiCallStartTime;
      
      console.log('✅ Claude API response received');
      console.log(`⏱️ API call duration: ${apiCallDuration.toFixed(2)}ms (${(apiCallDuration / 1000).toFixed(2)}s)`);
      
      // Log token usage with detailed breakdown
      console.log('📊 Token usage:');
      console.log(`  - Input tokens: ${response.tokenUsage.input}`);
      console.log(`  - Output tokens: ${response.tokenUsage.output}`);
      console.log(`  - Total tokens: ${response.tokenUsage.input + response.tokenUsage.output}`);
      console.log(`  - Estimated cost: $${response.tokenUsage.cost.toFixed(6)}`);
      
      // Calculate tokens per second
      const tokensPerSecond = response.tokenUsage.output / (apiCallDuration / 1000);
      console.log(`  - Generation speed: ${tokensPerSecond.toFixed(2)} tokens/second`);
      
      // Log a sample of the response for debugging
      const result = response.result;
      console.log('🔍 Response content analysis:');
      
      // Log tables information
      if (result.tables && result.tables.length > 0) {
        console.log(`  - Tables: ${result.tables.length}`);
        result.tables.forEach((table, tableIndex) => {
          console.log(`    Table ${tableIndex + 1}:`);
          console.log(`      - Headers: ${table.headers ? table.headers.join(', ') : 'None'}`);
          console.log(`      - Rows: ${table.rows ? table.rows.length : 0}`);
          
          // Log the first few rows of each table
          if (table.rows && table.rows.length > 0) {
            console.log('      - Sample data (first 2 rows):');
            const sampleRows = table.rows.slice(0, 2);
            sampleRows.forEach((row, i) => {
              console.log(`        Row ${i + 1}:`, JSON.stringify(row).substring(0, 100) + (JSON.stringify(row).length > 100 ? '...' : ''));
            });
          }
        });
      } else {
        console.log('  - Tables: None found');
      }
      
      // Log item-level comparison if available
      if (result.itemComparison) {
        console.log('  - Item-level comparison:');
        console.log(`    - Items compared: ${result.itemComparison.length}`);
        if (result.itemComparison.length > 0) {
          console.log('    - Sample items (first 2):');
          result.itemComparison.slice(0, 2).forEach((item, i) => {
            console.log(`      Item ${i + 1}:`, JSON.stringify(item).substring(0, 100) + (JSON.stringify(item).length > 100 ? '...' : ''));
          });
        }
      } else {
        console.log('  - Item-level comparison: None found');
      }
      
      // Log a sample of each analysis section with character counts
      console.log('  - Analysis sections:');
      const sectionKeys = ['verification', 'validation', 'review', 'analysis', 'summary', 'insights', 'recommendations', 'risks', 'issues'];
      
      let totalAnalysisLength = 0;
      let sectionsFound = 0;
      
      sectionKeys.forEach(key => {
        if (result[key]) {
          const text = result[key] as string;
          sectionsFound++;
          totalAnalysisLength += text.length;
          
          console.log(`    - ${key.charAt(0).toUpperCase() + key.slice(1)} (${text.length} chars):`);
          
          // Check if the section has quotes and analysis subsections
          const hasQuotes = text.includes('<quotes>') && text.includes('</quotes>');
          const hasAnalysis = text.includes('<analysis>') && text.includes('</analysis>');
          
          if (hasQuotes && hasAnalysis) {
            console.log('      ✅ Contains proper quotes and analysis structure');
          } else {
            console.log('      ⚠️ Missing proper structure:', 
              !hasQuotes ? 'no quotes section' : '', 
              !hasAnalysis ? 'no analysis section' : '');
          }
          
          // Show a preview of the content
          console.log(`      Preview: ${text.substring(0, 100)}...`);
        }
      });
      
      console.log(`  - Total analysis content: ${totalAnalysisLength} characters`);
      console.log(`  - Sections found: ${sectionsFound}/${sectionKeys.length}`);
      
      // Evaluate response quality
      const hasTabularData = result.tables && result.tables.length > 0 && result.tables[0].rows && result.tables[0].rows.length > 0;
      const hasItemComparison = result.itemComparison && result.itemComparison.length > 0;
      const hasAnalysisText = sectionKeys.some(key => result[key] && (result[key] as string).length > 100);
      const hasStructuredAnalysis = sectionKeys.some(key => {
        if (!result[key]) return false;
        const text = result[key] as string;
        return text.includes('<quotes>') && text.includes('</quotes>') && 
               text.includes('<analysis>') && text.includes('</analysis>');
      });
      
      console.log('📋 Response quality assessment:');
      console.log('  - Has tabular data:', hasTabularData ? '✅ Yes' : '❌ No');
      console.log('  - Has item comparison:', hasItemComparison ? '✅ Yes' : '❌ No');
      console.log('  - Has detailed analysis:', hasAnalysisText ? '✅ Yes' : '❌ No');
      console.log('  - Has structured analysis with quotes:', hasStructuredAnalysis ? '✅ Yes' : '❌ No');
      console.log('  - Overall completeness:', 
        (hasTabularData && hasAnalysisText && hasStructuredAnalysis) ? '✅ Excellent' : 
        (hasTabularData && hasAnalysisText) ? '✅ Good' : 
        (hasTabularData || hasAnalysisText) ? '⚠️ Partial' : '❌ Poor');
      
      // Calculate and log total processing time
      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      console.log(`⏱️ Total processing time: ${totalDuration.toFixed(2)}ms (${(totalDuration / 1000).toFixed(2)}s)`);
      
      return { result, tokenUsage: response.tokenUsage };
    } catch (error) {
      console.error('❌ Error analyzing documents:', error);
      
      // Provide more detailed error information
      if (error instanceof Error) {
        console.error('  - Error name:', error.name);
        console.error('  - Error message:', error.message);
        console.error('  - Stack trace:', error.stack);
      }
      
      throw new Error(`Failed to analyze documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async callClaudeApi(payload: any): Promise<any> {
    let responseData;
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;

    // Log the API request (without sensitive data)
    console.log('📤 Claude API request:', {
      model: payload.model,
      max_tokens: payload.max_tokens,
      messageCount: payload.messages?.length || 0
    });

    while (retryCount < maxRetries) {
      try {
        const startTime = performance.now();
        
        // Call the Claude API proxy
        const response = await fetch('https://cbrgpzdxttzlvvryysaf.supabase.co/functions/v1/claude-api-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        const endTime = performance.now();
        const requestDuration = endTime - startTime;
        
        // Check if the response is OK
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Claude API error (HTTP ${response.status}):`, errorText);
          
          // Log detailed error information
          console.error('  - Status:', response.status);
          console.error('  - Status Text:', response.statusText);
          console.error('  - Response Time:', `${requestDuration.toFixed(2)}ms`);
          
          // Handle specific HTTP status codes
          if (response.status === 429) {
            console.error('  - Rate limit exceeded. Waiting before retry...');
            await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
            retryCount++;
            continue;
          } else if (response.status >= 500) {
            console.error('  - Server error. Attempting retry...');
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            retryCount++;
            continue;
          } else {
            throw new Error(`Claude API HTTP error: ${response.status} ${response.statusText} - ${errorText}`);
          }
        }

        // Parse the response
        responseData = await response.json();
        
        // Log success and timing information
        console.log(`✅ Claude API request successful (${requestDuration.toFixed(2)}ms)`);
        
        // Process the response
        const result = this.processClaudeResponse(responseData);
        
        // Calculate token usage and cost
        const inputTokens = responseData.usage?.input_tokens || 0;
        const outputTokens = responseData.usage?.output_tokens || 0;
        
        // Calculate cost based on Claude 3 Haiku pricing
        // Input: $0.25/1M tokens, Output: $1.25/1M tokens
        const inputCost = (inputTokens / 1000000) * 0.25;
        const outputCost = (outputTokens / 1000000) * 1.25;
        const totalCost = inputCost + outputCost;
        
        const tokenUsage = {
          input: inputTokens,
          output: outputTokens,
          cost: totalCost
        };
        
        return { result, tokenUsage };
      } catch (error) {
        lastError = error;
        console.error(`❌ Claude API call failed (attempt ${retryCount + 1}/${maxRetries}):`, error);
        
        // Log detailed error information
        if (error instanceof Error) {
          console.error('  - Error name:', error.name);
          console.error('  - Error message:', error.message);
          
          // Check for network errors
          if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.error('  - Network error detected. Attempting retry...');
          } else if (error.message.includes('timeout')) {
            console.error('  - Timeout error detected. Attempting retry with longer timeout...');
          }
        }
        
        // Exponential backoff
        const backoffTime = 1000 * Math.pow(2, retryCount);
        console.log(`⏱️ Retrying in ${backoffTime/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        retryCount++;
      }
    }
    
    // If we've exhausted all retries, throw the last error
    console.error('❌ All retry attempts failed for Claude API call');
    throw lastError || new Error('Failed to call Claude API after multiple retries');
  }

  /**
   * Process the Claude API response and extract the comparison result
   */
  private processClaudeResponse(response: any): ComparisonResult {
    try {
      // Log raw response for debugging (truncated for brevity)
      const contentText = response.content?.[0]?.text || '';
      console.log(`📥 Claude response content (${contentText.length} chars):`);
      console.log(contentText.substring(0, 200) + (contentText.length > 200 ? '...' : ''));
      
      // Initialize the result object
      const result: ComparisonResult = {
        tables: [],
      };
      
      // Extract tables from the response
      const tableRegex = /<comparison_tables>([\s\S]*?)<\/comparison_tables>/g;
      const itemComparisonRegex = /<item_level_comparison>([\s\S]*?)<\/item_level_comparison>/g;
      
      // Process comparison tables
      let tableMatch;
      while ((tableMatch = tableRegex.exec(contentText)) !== null) {
        const tableContent = tableMatch[1].trim();
        const table = this.parseMarkdownTable(tableContent);
        if (table) {
          result.tables.push(table);
        }
      }
      
      // Process item-level comparison
      let itemMatch;
      while ((itemMatch = itemComparisonRegex.exec(contentText)) !== null) {
        const itemContent = itemMatch[1].trim();
        const itemTable = this.parseMarkdownTable(itemContent);
        if (itemTable) {
          result.itemComparison = itemTable.rows;
        }
      }
      
      // Extract sections
      const sectionRegex = /<section_name>(.*?)<\/section_name>\s*<quotes>([\s\S]*?)<\/quotes>\s*<analysis>([\s\S]*?)<\/analysis>/g;
      
      let sectionMatch;
      while ((sectionMatch = sectionRegex.exec(contentText)) !== null) {
        const sectionName = sectionMatch[1].toLowerCase().trim();
        const quotes = sectionMatch[2].trim();
        const analysis = sectionMatch[3].trim();
        
        // Format the section with quotes and analysis
        result[sectionName] = `<quotes>${quotes}</quotes>\n\n<analysis>${analysis}</analysis>`;
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error processing Claude response:', error);
      if (error instanceof Error) {
        console.error('  - Error details:', error.message);
      }
      
      // Return a minimal result to avoid breaking the UI
      return {
        tables: [],
        analysis: `Error processing Claude response: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Parse a markdown table string into a structured ComparisonTable object
   * @param tableText Markdown table text
   * @returns ComparisonTable object or null if parsing fails
   */
  private parseMarkdownTable(tableText: string): ComparisonTable | null {
    try {
      // Split the table into lines
      const lines = tableText.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length < 3) {
        console.warn('❌ Table parsing failed: Not enough lines for a valid table');
        return null;
      }
      
      // Extract headers from the first row
      const headerLine = lines[0];
      const headers = headerLine
        .split('|')
        .filter(cell => cell.trim() !== '')
        .map(cell => cell.trim());
      
      // Skip the separator line (line 1)
      
      // Extract rows
      const rows: string[][] = [];
      for (let i = 2; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('|')) {
          const cells = line
            .split('|')
            .filter(cell => cell.trim() !== '')
            .map(cell => cell.trim());
          
          rows.push(cells);
        }
      }
      
      // Determine if this is a multi-document table
      const isMultiDocument = headers.length > 2;
      
      // Create document names if it's a multi-document table
      let documentNames: string[] | undefined;
      if (isMultiDocument) {
        // Extract document names from headers (skip the first header which is usually "Field")
        documentNames = headers.slice(1);
      }
      
      // Log table parsing results
      console.log(`📊 Parsed table with ${headers.length} columns and ${rows.length} rows`);
      
      return {
        title: 'Document Comparison',
        headers,
        rows,
        isMultiDocument,
        documentNames
      };
    } catch (error) {
      console.error('❌ Error parsing markdown table:', error);
      return null;
    }
  }
}
