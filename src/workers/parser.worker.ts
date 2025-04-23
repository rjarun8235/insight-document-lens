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

      // PDF processing is now handled directly with Claude vision in the main thread
      case 'PARSE_PDF':
        // This case should no longer be reached, but just in case:
        self.postMessage({
          type: 'PARSE_ERROR',
          error: 'PDF processing now uses Claude vision directly',
          fileId: payload.fileId,
          needsFallback: true
        });
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

// PDF parsing has been removed as we now use Claude vision directly
