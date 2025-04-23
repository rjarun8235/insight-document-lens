
import * as XLSX from 'xlsx';
import { DocumentType, DocumentFile } from './types';

// Determine document type from file extension
export const getDocumentType = (file: File): DocumentType => {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (extension === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension)) return 'image';
  if (extension === 'csv') return 'csv';
  if (['xlsx', 'xls'].includes(extension)) return 'excel';
  if (['doc', 'docx'].includes(extension)) return 'doc';

  return 'unknown';
};

// Parse CSV file to text
export const parseCSV = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(text);
    };

    reader.onerror = (e) => {
      reject(new Error('Failed to read CSV file'));
    };

    reader.readAsText(file);
  });
};

// Parse Excel file to text
export const parseExcel = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        let result = '';
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          result += `Sheet: ${sheetName}\n`;
          json.forEach((row: any) => {
            result += row.join(',') + '\n';
          });
          result += '\n';
        });

        resolve(result);
      } catch (error) {
        reject(new Error('Failed to parse Excel file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

// Parse image using Claude's vision capabilities
export const parseImage = async (file: File): Promise<{ image: File, text?: string }> => {
  // For images, we'll return the file directly to be processed by Claude's vision capabilities
  // We're returning an object with the image file to be handled specially in the Claude service
  return { image: file };
};

// Parse PDF file using pdf.js
export const parsePDF = async (file: File): Promise<string | { image: File, text?: string }> => {
  try {
    // Import pdf.js dynamically
    const pdfjs = await import('pdfjs-dist');

    // Import the worker directly from node_modules
    // This is a more reliable approach than using CDN
    const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.entry');

    // Set the worker source
    pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Load the PDF document
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';

    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');

      fullText += `Page ${i}:\n${pageText}\n\n`;
    }

    return fullText;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    console.log('Falling back to treating PDF as an image...');

    // Fallback: Treat the PDF as an image to be processed by Claude's vision capabilities
    return { image: file, text: `[PDF content from ${file.name} - Using Claude's vision capabilities to process this PDF]` };
  }
};

// Parse DOC/DOCX file (simplified, would use a proper parser in production)
export const parseDoc = async (file: File): Promise<string> => {
  // In a real app, you would use a library like mammoth.js
  return `[Document content from ${file.name} - DOCX parsing would be implemented here]`;
};

// Main parser function that delegates to the appropriate parser
export const parseDocument = async (documentFile: DocumentFile): Promise<string | { image: File, text?: string }> => {
  const { type, file } = documentFile;

  try {
    switch (type) {
      case 'pdf':
        return await parsePDF(file);
      case 'image':
        return await parseImage(file);
      case 'csv':
        return await parseCSV(file);
      case 'excel':
        return await parseExcel(file);
      case 'doc':
        return await parseDoc(file);
      default:
        throw new Error(`Unsupported file type: ${type}`);
    }
  } catch (error) {
    console.error('Error parsing document:', error);

    // If it's a PDF and parsing failed, try the fallback method of treating it as an image
    if (type === 'pdf') {
      console.log('Attempting fallback for PDF as image...');
      return { image: file, text: `[PDF content from ${file.name} - Using Claude's vision capabilities to process this PDF]` };
    }

    throw error;
  }
};
