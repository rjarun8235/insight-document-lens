// Import with type safety
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
  if (['txt', 'text'].includes(extension)) return 'txt';

  return 'unknown';
};

// Parse CSV file to text
export const parseCSV = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        
        // Format CSV content for better readability
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(header => header.trim());
        
        let formattedText = `CSV File: ${file.name}\n\n`;
        formattedText += `Headers: ${headers.join(', ')}\n\n`;
        formattedText += `Data:\n`;
        
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = lines[i].split(',').map(value => value.trim());
            const row = headers.map((header, index) => `${header}: ${values[index] || ''}`).join(', ');
            formattedText += `Row ${i}: ${row}\n`;
          }
        }
        
        resolve(formattedText);
      } catch (error) {
        console.error('Error formatting CSV:', error);
        // Fallback to raw text if formatting fails
        const text = e.target?.result as string;
        resolve(text);
      }
    };

    reader.onerror = () => {
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

        let result = `Excel File: ${file.name}\n\n`;
        
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (json.length === 0) {
            result += `Sheet: ${sheetName} (empty)\n\n`;
            return;
          }

          result += `Sheet: ${sheetName}\n`;
          
          // Identify headers (first row)
          const headers = json[0] as string[];
          
          // Format data in a more structured way
          for (let i = 1; i < json.length; i++) {
            const row = json[i] as any[];
            if (row.length === 0) continue;
            
            result += `Row ${i}: `;
            const rowData = headers.map((header, index) => 
              `${header}: ${row[index] !== undefined ? row[index] : ''}`
            ).join(', ');
            result += rowData + '\n';
          }
          result += '\n';
        });

        resolve(result);
      } catch (error) {
        console.error('Error parsing Excel:', error);
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
  return { 
    image: file,
    text: `[Image content from ${file.name} - Using Claude's vision capabilities to analyze this image]`
  };
};

// Parse PDF file using Claude's vision capabilities by default
export const parsePDF = async (file: File): Promise<string | { image: File, text?: string }> => {
  console.log(`Processing PDF: ${file.name} (${Math.round(file.size / 1024)} KB)`);
  console.log('Using Claude vision capabilities for PDF processing by default');

  // Use Claude's vision capabilities directly as the default approach
  return {
    image: file,
    text: `[PDF content from ${file.name} - Using Claude's vision capabilities to process this PDF]`
  };
};

// Parse DOC/DOCX file (simplified, would use a proper parser in production)
export const parseDoc = async (file: File): Promise<string> => {
  // In a real app, you would use a library like mammoth.js
  return `[Document content from ${file.name} - DOCX parsing would be implemented here]`;
};

// Parse TXT file
export const parseTxt = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const formattedText = `Text File: ${file.name}\n\n${text}`;
        resolve(formattedText);
      } catch (error) {
        console.error('Error parsing text file:', error);
        reject(new Error('Failed to parse text file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read text file'));
    };

    reader.readAsText(file);
  });
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
      case 'txt':
        return await parseTxt(file);
      default:
        // For unknown types, try to read as text
        console.log(`Unknown file type for ${file.name}, attempting to read as text`);
        try {
          return await parseTxt(file);
        } catch (e) {
          throw new Error(`Unsupported file type: ${type}`);
        }
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
