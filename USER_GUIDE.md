# Document Insight Lens - User Guide

## Introduction

Document Insight Lens is a powerful document comparison and analysis application powered by Claude AI. It allows you to upload various document types, compare them, and receive AI-generated insights, verification, validation, and recommendations.

## Getting Started

1. Access the application through your web browser
2. You'll see the main interface with two tabs: "Upload Documents" and "Analysis Results"

## Uploading Documents

1. In the "Upload Documents" tab, select the comparison type from the dropdown menu:
   - General Documents - For comparing any type of documents
   - Contracts - For legal agreements and contracts
   - Invoices - For financial invoices and bills
   - Packing Lists - For shipping and logistics documents
   - Bills of Entry - For customs and import/export documents
   - Resumes - For comparing job applications and CVs
   - Reports - For comparing business or technical reports

2. Upload your documents using one of these methods:
   - Drag and drop files into the upload area
   - Click "Browse files" to select files from your computer

3. Supported file formats:
   - PDF files
   - Images (JPG, PNG, GIF, etc.)
   - CSV files
   - Excel spreadsheets (XLS, XLSX)
   - Word documents (DOC, DOCX)

4. After uploading, you'll see your documents listed below the upload area
   - You can remove any document by clicking on it

5. Click the "Analyze Documents" button to start the analysis process
   - A progress bar will show the status of the analysis
   - First, the documents are parsed (extracting text and content)
   - Then, Claude AI analyzes the documents and generates insights

## Viewing Analysis Results

Once the analysis is complete, you'll be automatically taken to the "Analysis Results" tab, which includes:

1. **Comparison Tables**
   - Structured tables showing key fields from the documents side by side
   - Makes it easy to spot differences and similarities

2. **Analysis Sections** (accessible via tabs):
   - **Summary** - High-level overview of the document comparison
   - **Verification** - Confirms if the documents are consistent with each other
   - **Validation** - Checks if the documents meet standard requirements
   - **Review** - Detailed review of the documents
   - **Analysis** - In-depth analysis of content, patterns, and discrepancies
   - **Insights** - Highlights non-obvious information and connections
   - **Recommendations** - Suggests actions based on the document analysis
   - **Risks** - Identifies potential issues or concerns
   - **Issues** - Lists specific problems found in the documents

3. **Export Options**
   - Export PDF - Save the analysis as a PDF file
   - Copy Text - Copy the analysis text to clipboard
   - Print Report - Print the analysis results
   - Save Report - Save the analysis for future reference

4. **Follow-up Questions**
   - Ask additional questions about the documents without reprocessing them
   - Uses prompt caching for faster responses and reduced token usage
   - Great for exploring different aspects of the documents

## Tips for Best Results

1. **Choose the right comparison type** for your documents to get more relevant insights
2. **Upload clear, high-quality documents** for better analysis
3. **Compare similar document types** when possible (e.g., invoice to invoice)
4. **Try different comparison types** if you're not satisfied with the initial results
5. **Check all analysis sections** for comprehensive insights

## Technical Details

- The application uses Claude 3.5 Haiku for document analysis
- PDF processing uses a multi-layered approach with automatic fallbacks:
  - Primary method: Extract text using pdf.js library with a custom worker
  - Secondary method: Process PDF with worker disabled
  - Tertiary method: Simple text extraction using FileReader.readAsText
  - Quaternary method: Data URL conversion using FileReader.readAsDataURL
  - Final fallback: If all text extraction methods fail, the PDF is processed using Claude's vision capabilities
  - Each method automatically tries the next if it fails, with detailed progress reporting
- Images are processed directly by Claude's vision system
- CSV, Excel, and Word documents are parsed to extract text content
- The application handles documents up to 32MB in size
- PDF documents can be up to 100 pages
- Prompt caching is used to efficiently reuse document content for follow-up questions
  - This reduces token usage and speeds up response times
  - The cached content is stored temporarily and not persisted between sessions

## AI Accuracy and Reliability

- The application implements several techniques to reduce AI hallucinations and improve accuracy:
  - **Quote-based Analysis**: The AI extracts direct quotes from documents before providing analysis, ensuring all insights are grounded in the actual document content
  - **Explicit Uncertainty**: When the AI is unsure about information, it will clearly state "I don't have enough information" rather than making assumptions
  - **Structured Output**: The AI follows a consistent format for all analyses, making results more reliable and easier to interpret
  - **Chain of Thought**: The AI shows its reasoning process, making it easier to understand how it reached its conclusions
  - **Verification**: The analysis includes a verification section that specifically checks for consistency between documents

## Troubleshooting

If you encounter issues:

1. **Document fails to parse** - The application will automatically try alternative parsing methods:
   - For PDFs: If text extraction fails, the PDF will be processed as an image using Claude's vision capabilities
   - If all parsing methods fail, try a different file format or check if the file is corrupted

2. **Analysis takes too long** - Large or complex documents may take longer to process
   - PDFs with many pages or complex layouts may require more processing time
   - Consider splitting large documents into smaller parts

3. **Missing information in results** - Try a different comparison type or check document quality
   - Some document formats may not extract all information correctly
   - Try uploading clearer or higher-quality versions of the documents

4. **Error messages** - Note the specific error and try again with different documents
   - If you see "Failed to parse" messages, the application will still attempt to process the document using fallback methods

For additional help, contact support or refer to the documentation.
