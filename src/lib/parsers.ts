// Import with type safety
import * as XLSX from 'xlsx';
import { DocumentType, DocumentFile, ParsedDocument } from './types';

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

// Helper to resize an image to optimal dimensions for Claude
export const resizeImageForClaude = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      // Clean up the object URL
      URL.revokeObjectURL(url);
      
      const { width, height } = img;
      
      // Check if image needs resizing (larger than 1568px in any dimension or more than 1.15 megapixels)
      if (width <= 1568 && height <= 1568 && (width * height) <= 1150000) {
        // Image is already within optimal size, return original
        resolve(file);
        return;
      }
      
      // Calculate new dimensions while preserving aspect ratio
      let newWidth = width;
      let newHeight = height;
      
      // If any dimension exceeds 1568px, scale down
      if (width > 1568 || height > 1568) {
        if (width > height) {
          newWidth = 1568;
          newHeight = Math.round(height * (1568 / width));
        } else {
          newHeight = 1568;
          newWidth = Math.round(width * (1568 / height));
        }
      }
      
      // Check if megapixels still exceed 1.15 after dimension adjustment
      if (newWidth * newHeight > 1150000) {
        const scale = Math.sqrt(1150000 / (newWidth * newHeight));
        newWidth = Math.round(newWidth * scale);
        newHeight = Math.round(newHeight * scale);
      }
      
      // Create a canvas for resizing
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      // Draw the image on the canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      
      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob from canvas'));
          return;
        }
        
        // Create a new file from the blob
        const resizedFile = new File([blob], file.name, {
          type: file.type,
          lastModified: file.lastModified
        });
        
        console.log(`Resized image from ${width}x${height} to ${newWidth}x${newHeight}`);
        resolve(resizedFile);
      }, file.type);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for resizing'));
    };
    
    img.src = url;
  });
};

// Parse image file to a format suitable for Claude's vision capabilities
export const parseImage = async (file: File): Promise<ParsedDocument> => {
  try {
    // Optimize image size for Claude
    const optimizedFile = await resizeImageForClaude(file);
    
    // Return the image file for Claude's vision API
    return {
      image: optimizedFile,
      documentType: 'image'
    };
  } catch (error) {
    console.error('Error parsing image:', error);
    throw new Error('Failed to parse image file');
  }
};

// Parse PDF file using Claude's document capabilities
export const parsePDF = async (file: File): Promise<ParsedDocument> => {
  try {
    // Check file size - Claude has a limit of 32MB for PDFs
    const MAX_PDF_SIZE = 32 * 1024 * 1024; // 32MB
    
    if (file.size > MAX_PDF_SIZE) {
      console.warn(`PDF file size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds Claude's 32MB limit`);
      throw new Error(`PDF file is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 32MB.`);
    }
    
    // Check if the file is actually a PDF
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Invalid PDF file format');
    }
    
    // For PDFs, we'll return the file to be processed by Claude's document capabilities
    return {
      image: file, // We use the image field to store the PDF file
      documentType: 'pdf',
      text: `[PDF document: ${file.name}]`
    };
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
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
export const parseDocument = async (documentFile: DocumentFile): Promise<ParsedDocument> => {
  const { type, file } = documentFile;

  try {
    switch (type) {
      case 'pdf':
        return await parsePDF(file);
      case 'image':
        return await parseImage(file);
      case 'csv': {
        const text = await parseCSV(file);
        return { text, documentType: 'csv' };
      }
      case 'excel': {
        const text = await parseExcel(file);
        return { text, documentType: 'excel' };
      }
      case 'doc': {
        const text = await parseDoc(file);
        return { text, documentType: 'doc' };
      }
      case 'txt': {
        const text = await parseTxt(file);
        return { text, documentType: 'txt' };
      }
      default:
        // For unknown types, try to read as text
        console.log(`Unknown file type for ${file.name}, attempting to read as text`);
        try {
          const text = await parseTxt(file);
          return { text, documentType: 'unknown' };
        } catch (e) {
          throw new Error(`Unsupported file type: ${type}`);
        }
    }
  } catch (error) {
    console.error(`Error parsing document ${file.name}:`, error);
    throw error;
  }
};
