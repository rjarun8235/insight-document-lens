// Web Worker for document parsing
import * as XLSX from 'xlsx';

// Define message types for worker communication
interface WorkerMessage {
  type: string;
  payload: any;
}

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;
  
  try {
    switch (type) {
      case 'PARSE_CSV':
        const csvResult = await parseCSV(payload.fileData);
        self.postMessage({ type: 'PARSE_COMPLETE', result: csvResult, fileId: payload.fileId });
        break;
        
      case 'PARSE_EXCEL':
        const excelResult = await parseExcel(payload.fileData);
        self.postMessage({ type: 'PARSE_COMPLETE', result: excelResult, fileId: payload.fileId });
        break;
        
      case 'PARSE_PDF':
        try {
          // Import PDF.js dynamically within the worker
          // @ts-ignore - Dynamic import in worker
          importScripts('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
          // @ts-ignore - PDF.js in worker context
          const pdfjsLib = self.pdfjsLib;
          
          const pdfResult = await parsePDF(payload.fileData, pdfjsLib);
          self.postMessage({ type: 'PARSE_COMPLETE', result: pdfResult, fileId: payload.fileId });
        } catch (pdfError) {
          // If PDF.js fails, notify main thread to try fallback
          self.postMessage({ 
            type: 'PARSE_ERROR', 
            error: 'PDF parsing failed in worker', 
            fileId: payload.fileId,
            needsFallback: true 
          });
        }
        break;
        
      default:
        self.postMessage({ 
          type: 'PARSE_ERROR', 
          error: `Unknown message type: ${type}`, 
          fileId: payload.fileId 
        });
    }
  } catch (error) {
    self.postMessage({ 
      type: 'PARSE_ERROR', 
      error: error instanceof Error ? error.message : 'Unknown error', 
      fileId: payload.fileId 
    });
  }
};

// Parse CSV file
async function parseCSV(fileData: ArrayBuffer): Promise<string> {
  // Convert ArrayBuffer to string
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(fileData);
  
  // Send progress updates
  self.postMessage({ type: 'PARSE_PROGRESS', progress: 50 });
  
  // Process the CSV (simple implementation)
  const lines = text.split('\n');
  const result = lines.join('\n');
  
  self.postMessage({ type: 'PARSE_PROGRESS', progress: 100 });
  return result;
}

// Parse Excel file
async function parseExcel(fileData: ArrayBuffer): Promise<string> {
  try {
    // Send initial progress
    self.postMessage({ type: 'PARSE_PROGRESS', progress: 25 });
    
    // Use XLSX to parse the Excel file
    const data = new Uint8Array(fileData);
    const workbook = XLSX.read(data, { type: 'array' });
    
    self.postMessage({ type: 'PARSE_PROGRESS', progress: 75 });
    
    let result = '';
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      result += `Sheet: ${sheetName}\n`;
      json.forEach((row: any) => {
        result += row.join(',') + '\n';
      });
      result += '\n';
    });
    
    self.postMessage({ type: 'PARSE_PROGRESS', progress: 100 });
    return result;
  } catch (error) {
    throw new Error(`Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Parse PDF file
async function parsePDF(fileData: ArrayBuffer, pdfjsLib: any): Promise<string> {
  try {
    // Send initial progress
    self.postMessage({ type: 'PARSE_PROGRESS', progress: 10 });
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: fileData });
    const pdf = await loadingTask.promise;
    
    self.postMessage({ 
      type: 'PARSE_PROGRESS', 
      progress: 20,
      metadata: { numPages: pdf.numPages }
    });
    
    let fullText = '';
    
    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      // Update progress for each page
      const pageProgress = 20 + Math.round((i / pdf.numPages) * 80);
      self.postMessage({ 
        type: 'PARSE_PROGRESS', 
        progress: pageProgress,
        currentPage: i
      });
      
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      
      fullText += `Page ${i}:\n${pageText}\n\n`;
      
      // Send preview of first page
      if (i === 1) {
        self.postMessage({ 
          type: 'PAGE_PREVIEW', 
          pageNumber: i, 
          text: pageText.substring(0, 200) + '...'
        });
      }
    }
    
    self.postMessage({ type: 'PARSE_PROGRESS', progress: 100 });
    return fullText;
  } catch (error) {
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
