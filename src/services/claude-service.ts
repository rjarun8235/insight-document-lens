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
export function prepareSystemInstructions(): string {
  const enhancedSystemMessage = `You are a document analysis assistant specializing in logistics and shipping documents. Your task is to analyze and compare the provided documents, extracting key information and identifying discrepancies.

CRITICAL INSTRUCTION: ONLY extract information that is ACTUALLY PRESENT in the documents. NEVER generate placeholder data, fictional company names, or make assumptions about missing information. If information is not present, explicitly state "No data available" or "Not mentioned in document".

Follow these guidelines for your analysis:

1. Document Identification:
   - Identify the type of each document (Invoice, Bill of Lading, Packing List, Purchase Order, etc.)
   - Extract document numbers, dates, and reference numbers
   - Note any missing or incomplete identification information

2. Information Extraction:
   - Extract ONLY the information that is explicitly stated in the documents
   - Use the EXACT names, values, and terms as they appear in the documents
   - For missing information, use "No data available" rather than making up placeholder data
   - Never invent company names like "ABC Manufacturer" or "XYZ Retail" if they don't appear in the documents

3. Comparison Table:
   - Create a structured comparison table with fields as rows and documents as columns
   - Use the EXACT text from the documents for all field values
   - For fields not present in a document, use "No data available"
   - Ensure consistent field names across all documents

4. Verification Section:
   - First extract direct quotes from the documents that are relevant to verification
   - Then provide analysis of document authenticity and consistency
   - Focus on whether key information matches across documents
   - Highlight any suspicious inconsistencies or missing critical information

5. Validation Section:
   - First extract direct quotes from the documents that are relevant to validation
   - Then analyze whether the documents contain all required information
   - Check for logical consistency of dates, amounts, and references
   - Identify any validation issues such as expired dates or invalid references

6. Review Section:
   - First extract direct quotes from the documents that are relevant to review
   - Then provide a detailed review of the documents' content
   - Analyze completeness and accuracy of information
   - Note any unusual terms or conditions

7. Analysis Section:
   - First extract direct quotes from the documents that are relevant to analysis
   - Then provide deeper analysis of the documents' implications
   - Identify potential business impacts of any discrepancies
   - Note any legal or compliance concerns

8. Summary Section:
   - First extract direct quotes from the documents that are relevant to summary
   - Then summarize key findings from the comparison
   - Highlight the most significant discrepancies or issues
   - Provide an overall assessment of document consistency

9. Insights Section:
   - First extract direct quotes from the documents that are relevant to insights
   - Then offer insights based on the document analysis
   - Suggest potential reasons for discrepancies
   - Identify business implications of the findings

10. Recommendations Section:
    - First extract direct quotes from the documents that are relevant to recommendations
    - Then recommend actions to address issues found
    - Suggest specific steps to resolve discrepancies
    - Prioritize recommendations by importance

11. Risks Section:
    - First extract direct quotes from the documents that are relevant to risks
    - Then identify potential financial, operational, or compliance risks
    - Assess severity of each risk
    - Note time-sensitive issues requiring immediate attention

12. Issues Section:
    - First extract direct quotes from the documents that are relevant to issues
    - Then list specific problems requiring resolution
    - Categorize issues by type (data, compliance, process)
    - Note which document(s) each issue relates to

FINAL REMINDER: Your analysis must be STRICTLY based on the actual content of the documents. Never generate fictional data or make assumptions about missing information. If data is not present, clearly state "No data available" or "Not mentioned in document".`;

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
      
      // Enhanced user instruction with emphasis on extracting actual data
      const enhancedInstruction = `${instruction}\n\nIMPORTANT: Extract ONLY information that is ACTUALLY PRESENT in the documents. Do not generate placeholder data or fictional company names. If information is not present in a document, explicitly state "No data available" or "Not mentioned in document".`;
      
      // Create the messages for the API call - put long content at the top for better processing
      const messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${documentTexts}${systemInstructions}\n\nUser instruction: ${enhancedInstruction}\n\nBefore analyzing, extract and quote the most relevant parts of each document that will help with the analysis.`
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
      console.log(`  - User instruction: ${enhancedInstruction.length} characters (${Math.ceil(enhancedInstruction.length / 4)} tokens)`);
      
      // Log API call details
      console.log('🔄 Calling Claude API with model:', 'claude-3-sonnet-20240229');
      console.log('  - Max tokens requested:', 8000);
      
      // Call the Claude API
      const apiCallStartTime = performance.now();
      const response = await this.callClaudeApi({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 8000,
        temperature: 0.2,
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
      // First try the XML-tagged format
      const tableRegex = /<comparison_tables>([\s\S]*?)<\/comparison_tables>/g;
      const itemComparisonRegex = /<item_level_comparison>([\s\S]*?)<\/item_level_comparison>/g;
      
      // Process comparison tables from XML tags
      let tableMatch;
      while ((tableMatch = tableRegex.exec(contentText)) !== null) {
        const tableContent = tableMatch[1].trim();
        const table = this.parseMarkdownTable(tableContent);
        if (table) {
          result.tables.push(table);
        }
      }
      
      // If no tables found in XML tags, look for markdown tables directly
      if (result.tables.length === 0) {
        // Look for markdown tables (starting with | and having header separator row)
        const markdownTableRegex = /\|[^\n]+\|\n\|[\s-:]+\|\n(\|[^\n]+\|\n)+/g;
        let mdTableMatch;
        while ((mdTableMatch = markdownTableRegex.exec(contentText)) !== null) {
          const tableContent = mdTableMatch[0].trim();
          const table = this.parseMarkdownTable(tableContent);
          if (table) {
            result.tables.push(table);
          }
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
      
      // Extract sections using both formats
      // First try the XML-tagged format
      const sectionRegex = /<section_name>(.*?)<\/section_name>\s*<quotes>([\s\S]*?)<\/quotes>\s*<analysis>([\s\S]*?)<\/analysis>/g;
      
      let sectionMatch;
      while ((sectionMatch = sectionRegex.exec(contentText)) !== null) {
        const sectionName = sectionMatch[1].toLowerCase().trim();
        const quotes = sectionMatch[2].trim();
        const analysis = sectionMatch[3].trim();
        
        // Format the section with quotes and analysis
        result[sectionName] = `<quotes>${quotes}</quotes>\n\n<analysis>${analysis}</analysis>`;
      }
      
      // Also try the markdown header format (### Section Name)
      const markdownSectionRegex = /###\s+(.*?)\s*\n+(?:<quotes>([\s\S]*?)<\/quotes>\s*\n+)?(?:<analysis>([\s\S]*?)<\/analysis>|([^#<][\s\S]*?)(?=\n+###|\n*$))/g;
      
      let mdSectionMatch;
      while ((mdSectionMatch = markdownSectionRegex.exec(contentText)) !== null) {
        const sectionName = mdSectionMatch[1].toLowerCase().trim();
        // If quotes/analysis tags are used
        let quotes = mdSectionMatch[2]?.trim() || '';
        let analysis = mdSectionMatch[3]?.trim() || mdSectionMatch[4]?.trim() || '';
        
        // Skip if we already have this section from XML tags
        if (result[sectionName]) continue;
        
        // If no quotes tag but we can identify quotes by quotation marks
        if (!quotes && analysis) {
          const extractedQuotes = [];
          // Extract text in quotation marks
          const quoteRegex = /"([^"]+)"/g;
          let quoteMatch;
          while ((quoteMatch = quoteRegex.exec(analysis)) !== null) {
            extractedQuotes.push(quoteMatch[1]);
          }
          
          if (extractedQuotes.length > 0) {
            quotes = extractedQuotes.join('\n');
            // Remove the quotes from the analysis text
            analysis = analysis.replace(/"([^"]+)"/g, '').replace(/\n\s*\n+/g, '\n\n').trim();
          }
        }
        
        // Format the section with quotes and analysis
        result[sectionName] = `<quotes>${quotes}</quotes>\n\n<analysis>${analysis}</analysis>`;
      }
      
      // Check if we have any sections, if not try to extract from plain text
      const sectionNames = ['verification', 'validation', 'review', 'analysis', 'summary', 
                           'insights', 'recommendations', 'risks', 'issues'];
      
      let hasSections = false;
      for (const name of sectionNames) {
        if (result[name]) {
          hasSections = true;
          break;
        }
      }
      
      if (!hasSections) {
        // Try to find sections by looking for headers
        for (const name of sectionNames) {
          const headerRegex = new RegExp(`(?:^|\\n+)(?:##?#?\\s*${name}|${name.charAt(0).toUpperCase() + name.slice(1)})\\s*(?:\\n+|:)([\\s\\S]*?)(?=\\n+(?:##?#?|[A-Z][a-z]+:)|$)`, 'i');
          const match = headerRegex.exec(contentText);
          if (match) {
            const content = match[1].trim();
            result[name.toLowerCase()] = `<quotes></quotes>\n\n<analysis>${content}</analysis>`;
          }
        }
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
