// Import with type safety
import * as XLSX from 'xlsx';
import { ParsedDocument, DocumentFile } from './types';

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
  // In a real implementation, this would use OCR to extract text from the image
  // For now, we'll just return placeholder text
  
  return {
    content: `Image file: ${file.name} (OCR not implemented yet)`,
    name: file.name,
    file: file,
    type: 'image',
    
    // For backward compatibility
    image: file,
    documentType: 'image' as DocumentType,
    text: `Image file: ${file.name} (OCR not implemented yet)`
  };
};

// Parse PDF file using Claude's document capabilities
export const parsePDF = async (file: File): Promise<ParsedDocument> => {
  try {
    // Read the file as an ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Convert ArrayBuffer to Base64
    const base64Data = arrayBufferToBase64(arrayBuffer);
    
    // Log success
    console.log(`Successfully encoded PDF: ${file.name} (${(base64Data.length / 1024).toFixed(2)}KB base64 data)`);
    
    return {
      content: `PDF file: ${file.name}`,
      name: file.name,
      file: file,
      base64Data: `data:application/pdf;base64,${base64Data}`,
      type: 'pdf',
      
      // For backward compatibility
      text: `PDF file: ${file.name}`,
      documentType: 'pdf' as DocumentType
    };
  } catch (error) {
    console.error('Error encoding PDF:', error);
    return {
      content: `PDF file: ${file.name} (Error: ${error instanceof Error ? error.message : 'Unknown error'})`,
      name: file.name,
      file: file,
      type: 'pdf',
      
      // For backward compatibility
      text: `PDF file: ${file.name} (Error: ${error instanceof Error ? error.message : 'Unknown error'})`,
      documentType: 'pdf' as DocumentType
    };
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
export async function parseDocument(file: DocumentFile): Promise<ParsedDocument> {
  const fileType = getDocumentType(file.file);
  
  try {
    let content = '';
    let type = '';
    let base64Data = '';
    
    // Parse based on file type
    switch (fileType) {
      case 'pdf':
        const pdfResult = await parsePDF(file.file);
        content = pdfResult.text;
        base64Data = pdfResult.base64Data || '';
        type = detectDocumentType(content, file.file.name);
        break;
        
      case 'image':
        // For images, we'll use OCR in the future
        content = `Image file: ${file.file.name}`;
        type = detectDocumentType(content, file.file.name);
        break;
        
      case 'csv':
        content = await parseCSV(file.file);
        type = detectDocumentType(content, file.file.name);
        break;
        
      case 'excel':
        content = await parseExcel(file.file);
        type = detectDocumentType(content, file.file.name);
        break;
        
      case 'doc':
      case 'docx':
        content = await parseDoc(file.file);
        type = detectDocumentType(content, file.file.name);
        break;
        
      case 'txt':
      default:
        content = await parseTxt(file.file);
        type = detectDocumentType(content, file.file.name);
        break;
    }
    
    // For backward compatibility
    return {
      content,
      name: file.file.name,
      file: file.file,
      base64Data,
      type,
      
      // Backward compatibility
      text: content,
      documentType: type as DocumentType,
      image: fileType === 'image' ? file.file : undefined
    };
  } catch (error) {
    console.error(`Error parsing ${file.file.name}:`, error);
    return {
      content: `Error parsing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      name: file.file.name,
      file: file.file,
      type: 'unknown',
      
      // Backward compatibility
      text: `Error parsing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      documentType: 'unknown' as DocumentType
    };
  }
}

/**
 * Detect document type based on content and filename
 */
function detectDocumentType(content: string, filename: string): string {
  const lowerContent = content.toLowerCase();
  const lowerFilename = filename.toLowerCase();
  
  // Check filename first
  if (lowerFilename.includes('invoice')) return 'Invoice';
  if (lowerFilename.includes('bill of lading') || lowerFilename.includes('bol')) return 'Bill of Lading';
  if (lowerFilename.includes('packing list')) return 'Packing List';
  if (lowerFilename.includes('purchase order') || lowerFilename.includes('po')) return 'Purchase Order';
  
  // Then check content
  if (lowerContent.includes('invoice')) return 'Invoice';
  if (lowerContent.includes('bill of lading') || lowerContent.includes('bol')) return 'Bill of Lading';
  if (lowerContent.includes('packing list')) return 'Packing List';
  if (lowerContent.includes('purchase order') || lowerContent.includes('po number')) return 'Purchase Order';
  
  // Default to unknown
  return 'Unknown Document';
}

// Update DocumentType enum to include all document types
export type DocumentType = 
  | 'pdf' 
  | 'image' 
  | 'csv' 
  | 'excel' 
  | 'doc' 
  | 'docx' 
  | 'txt' 
  | 'unknown';

// Helper function to convert ArrayBuffer to Base64
function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(arrayBuffer);
  const binaryString = uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), '');
  return btoa(binaryString);
}
