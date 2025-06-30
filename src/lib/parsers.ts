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

// Parse CSV file to text with improved error handling
export const parseCSV = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || text.trim() === '') {
          throw new Error('Empty CSV file or corrupt data');
        }
        
        // Format CSV content for better readability
        try {
          const lines = text.split('\n');
          if (lines.length === 0) {
            throw new Error('No data rows found in CSV');
          }
          
          // Check if there are headers (first non-empty line)
          let headerIndex = 0;
          while (headerIndex < lines.length && !lines[headerIndex].trim()) {
            headerIndex++;
          }
          
          if (headerIndex >= lines.length) {
            throw new Error('No data found in CSV');
          }
          
          const headers = lines[headerIndex].split(',').map(header => header.trim());
          
          let formattedText = `CSV File: ${file.name}\n\n`;
          formattedText += `Headers: ${headers.join(', ')}\n\n`;
          formattedText += `Data:\n`;
          
          for (let i = headerIndex + 1; i < lines.length; i++) {
            if (lines[i].trim()) {
              const values = lines[i].split(',').map(value => value.trim());
              const row = headers.map((header, index) => `${header}: ${values[index] || ''}`).join(', ');
              formattedText += `Row ${i - headerIndex}: ${row}\n`;
            }
          }
          
          resolve(formattedText);
        } catch (formattingError) {
          console.warn('Error formatting CSV, returning raw content:', formattingError);
          // Fallback to raw text if formatting fails
          resolve(`CSV File: ${file.name}\n\n${text}`);
        }
      } catch (error) {
        console.error('Error parsing CSV:', error);
        // Fallback to raw text if parsing fails completely
        try {
          const text = e.target?.result as string;
          resolve(`CSV File: ${file.name} (Error processing structure)\n\n${text}`);
        } catch {
          reject(new Error('Failed to read CSV file: Corrupt or empty file'));
        }
      }
    };

    reader.onerror = (e) => {
      console.error('FileReader error:', e);
      reject(new Error('Failed to read CSV file: ' + (e.target?.error?.message || 'Unknown error')));
    };

    reader.readAsText(file);
  });
};

// Parse Excel file to text with improved error handling and formatting
export const parseExcel = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        if (!data || data.length === 0) {
          throw new Error('Empty Excel file or corrupt data');
        }
        
        try {
          // Use SheetJS to parse Excel data
          const workbook = XLSX.read(data, { 
            type: 'array',
            cellDates: true,  // Parse dates properly
            cellStyles: true, // Preserve styles for better parsing
            cellNF: true      // Keep number formats
          });
          
          if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('Invalid Excel file structure or no sheets found');
          }

          let result = `Excel File: ${file.name}\n\n`;
          
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            
            // Get sheet range
            if (!worksheet['!ref']) {
              result += `Sheet: ${sheetName} (empty)\n\n`;
              return;
            }
            
            // Parse the sheet reference range (e.g., 'A1:D10')
            const ref = worksheet['!ref'];
            // Check if sheet has minimal content
            if (ref === 'A1' || ref === 'A1:A1') {
              result += `Sheet: ${sheetName} (empty)\n\n`;
              return;
            }
            
            // Convert to JSON with headers
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
              if (!row || row.length === 0) continue;
              
              result += `Row ${i}: `;
              const rowData = headers.map((header, index) => {
                // Handle different data types properly
                let value = '';
                if (row[index] !== undefined) {
                  if (row[index] instanceof Date) {
                    value = row[index].toISOString().split('T')[0]; // Format dates as YYYY-MM-DD
                  } else {
                    value = String(row[index]);
                  }
                }
                return `${header}: ${value}`;
              }).join(', ');
              result += rowData + '\n';
            }
            result += '\n';
          });

          resolve(result);
        } catch (excelError) {
          console.error('Error processing Excel file:', excelError);
          // Try using a simpler method to extract at least some data
          try {
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            
            // Create a simple text representation of the sheet
            let sheetText = `Excel File: ${file.name} (Simplified parsing due to error)\n\n`;
            
            // Get all cell addresses
            const cellAddresses = Object.keys(worksheet).filter(key => !key.startsWith('!'));
            
            // Group cells by row
            const rows = {};
            cellAddresses.forEach(address => {
              // Extract row number from cell address (e.g., 'A1' -> 1)
              const rowNum = parseInt(address.match(/\d+/)[0]);
              if (!rows[rowNum]) rows[rowNum] = [];
              
              // Get cell value
              const cellValue = worksheet[address].v || '';
              rows[rowNum].push(cellValue);
            });
            
            // Convert rows to text
            Object.keys(rows).sort((a, b) => parseInt(a) - parseInt(b)).forEach(rowNum => {
              sheetText += rows[rowNum].join(', ') + '\n';
            });
            
            resolve(sheetText);
          } catch (fallbackError) {
            reject(new Error('Failed to parse Excel file: Structure may be corrupt'));
          }
        }
      } catch (error) {
        console.error('Error parsing Excel:', error);
        reject(new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = (e) => {
      console.error('FileReader error:', e);
      reject(new Error('Failed to read Excel file: ' + (e.target?.error?.message || 'Unknown error')));
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
    // Resize image if needed for optimal Claude processing
    const optimizedFile = await resizeImageForClaude(file);
    
    return {
      content: `Image file: ${file.name} (optimized for Claude vision)`,
      name: file.name,
      file: optimizedFile,
      type: 'image',
      
      // For backward compatibility
      image: optimizedFile,
      documentType: 'image' as DocumentType,
      text: `Image file: ${file.name} (optimized for Claude vision)`
    };
  } catch (error) {
    console.error('Error processing image:', error);
    return {
      content: `Image file: ${file.name} (Error optimizing: ${error instanceof Error ? error.message : 'Unknown error'})`,
      name: file.name,
      file: file,
      type: 'image',
      image: file,
      documentType: 'image' as DocumentType,
      text: `Image file: ${file.name} (Error optimizing)`
    };
  }
};

// Parse PDF file using Claude's document capabilities with improved error handling
export const parsePDF = async (file: File): Promise<ParsedDocument> => {
  try {
    // Check file size first - large PDFs need special handling
    if (file.size > 10 * 1024 * 1024) { // > 10MB
      console.warn(`Large PDF detected: ${file.name} (${Math.round(file.size/1024/1024)}MB). Special handling required.`);
      return {
        content: `Large PDF file: ${file.name} (${Math.round(file.size/1024/1024)}MB)`,
        name: file.name,
        file: file,
        type: 'pdf',
        documentType: 'pdf' as DocumentType,
        text: `Large PDF file: ${file.name} (${Math.round(file.size/1024/1024)}MB)`
      };
    }
    
    // Read the file as an ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Validate PDF structure - check for basic PDF header signature
    const firstBytes = new Uint8Array(arrayBuffer.slice(0, 5));
    const header = String.fromCharCode.apply(null, Array.from(firstBytes));
    
    if (!header.startsWith('%PDF-')) {
      throw new Error('Invalid PDF format: File does not have a PDF signature');
    }
    
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
      documentType: 'pdf' as DocumentType,
      text: `PDF file: ${file.name}`
    };
  } catch (error) {
    console.error('Error encoding PDF:', error);
    return {
      content: `PDF file: ${file.name} (Error: ${error instanceof Error ? error.message : 'Unknown error'})`,
      name: file.name,
      file: file,
      type: 'pdf',
      documentType: 'pdf' as DocumentType,
      text: `PDF file: ${file.name} (Error: ${error instanceof Error ? error.message : 'Unknown error'})`
    };
  }
};

// Parse DOC/DOCX file (simplified, would use a proper parser in production)
export const parseDoc = async (file: File): Promise<string> => {
  // In a real app, you would use a library like mammoth.js
  return `[Document content from ${file.name} - DOCX parsing would be implemented here]`;
};

// Parse TXT file with improved error handling
export const parseTxt = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || text.trim() === '') {
          resolve(`Text File: ${file.name} (Empty file)`);
          return;
        }
        
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

// Generate a document ID based on filename and timestamp
function generateDocumentId(fileName: string): string {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 7);
  // Clean the filename for use in an ID
  const cleanName = fileName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
  return `${cleanName}-${timestamp}-${randomPart}`;
}

// Main parser function that delegates to the appropriate parser with improved error handling
export async function parseDocument(file: DocumentFile): Promise<ParsedDocument> {
  const fileType = getDocumentType(file.file);
  // Generate a unique ID for this document
  const documentId = file.id || generateDocumentId(file.file.name);
  
  try {
    let content = '';
    let type = '';
    let base64Data = '';
    
    // Parse based on file type
    switch (fileType) {
      case 'pdf':
        const pdfResult = await parsePDF(file.file);
        content = typeof pdfResult.text === 'string' ? pdfResult.text : '';
        base64Data = pdfResult.base64Data || '';
        type = detectDocumentType(content, file.file.name);
        
        // Return full PDF parsed document
        return {
          id: documentId,
          content,
          name: file.file.name,
          file: file.file,
          base64Data,
          type,
          documentType: type as DocumentType,
          text: content
        };
        
      case 'image':
        // For images, use our improved image parser
        return {
          ...(await parseImage(file.file)),
          id: documentId
        };
        
      case 'csv':
        content = await parseCSV(file.file);
        type = detectDocumentType(content, file.file.name);
        break;
        
      case 'excel':
        content = await parseExcel(file.file);
        type = detectDocumentType(content, file.file.name);
        break;
        
      case 'doc':
        content = await parseDoc(file.file);
        type = detectDocumentType(content, file.file.name);
        break;
        
      case 'txt':
      default:
        content = await parseTxt(file.file);
        type = detectDocumentType(content, file.file.name);
        break;
    }
    
    // Return the parsed document with ID
    return {
      id: documentId,
      content,
      name: file.file.name,
      file: file.file,
      base64Data,
      type,
      
      // Backward compatibility
      text: content,
      documentType: type as DocumentType,
      image: (fileType as DocumentType) === 'image' ? file.file : undefined
    };
  } catch (error) {
    console.error(`Error parsing ${file.file.name}:`, error);
    
    // Return a error document with original file
    return {
      id: documentId,
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
 * Improved to handle more document types with better confidence
 */
function detectDocumentType(content: string, filename: string): string {
  const lowerContent = content.toLowerCase();
  const lowerFilename = filename.toLowerCase();
  
  // First, check for explicitly labeled document types in content
  if (lowerContent.includes('air waybill') || lowerContent.includes('house air waybill') || lowerContent.includes('hawb')) {
    return 'Air Waybill';
  }
  
  if (lowerContent.includes('bill of lading') || lowerContent.includes('bol')) {
    return 'Bill of Lading';
  }
  
  if (lowerContent.includes('commercial invoice') || 
      (lowerContent.includes('invoice') && !lowerContent.includes('waybill') && !lowerContent.includes('packing'))) {
    return 'Commercial Invoice';
  }
  
  if (lowerContent.includes('packing list')) {
    return 'Packing List';
  }
  
  if (lowerContent.includes('bill of entry') || lowerContent.includes('customs entry')) {
    return 'Bill of Entry';
  }
  
  if (lowerContent.includes('purchase order') || (lowerContent.includes('po') && lowerContent.includes('order'))) {
    return 'Purchase Order';
  }
  
  if (lowerContent.includes('certificate of origin')) {
    return 'Certificate of Origin';
  }
  
  // Then check filename
  if (lowerFilename.includes('awb') || lowerFilename.includes('waybill') || lowerFilename.includes('hawb')) {
    return 'Air Waybill';
  }
  
  if (lowerFilename.includes('bl') || lowerFilename.includes('b/l') || lowerFilename.includes('lading')) {
    return 'Bill of Lading';
  }
  
  if (lowerFilename.includes('inv') || lowerFilename.includes('invoice')) {
    return 'Commercial Invoice';
  }
  
  if (lowerFilename.includes('pl') || lowerFilename.includes('pack')) {
    return 'Packing List';
  }
  
  if (lowerFilename.includes('boe') || lowerFilename.includes('entry')) {
    return 'Bill of Entry';
  }
  
  if (lowerFilename.includes('po') || lowerFilename.includes('order')) {
    return 'Purchase Order';
  }
  
  // Check for common pattern of fields
  const fieldPatterns = {
    'Air Waybill': ['shipper', 'consignee', 'flight', 'carrier', 'airport'],
    'Commercial Invoice': ['invoice', 'seller', 'buyer', 'payment', 'item', 'quantity', 'price'],
    'Packing List': ['packing', 'carton', 'weight', 'dimensions', 'gross weight', 'net weight'],
    'Bill of Entry': ['importer', 'customs', 'duty', 'country of origin', 'hs code'],
    'Purchase Order': ['purchase', 'vendor', 'delivery date', 'payment terms']
  };
  
  let bestMatch = { type: 'Unknown Document', count: 0 };
  
  for (const [type, patterns] of Object.entries(fieldPatterns)) {
    let matchCount = 0;
    patterns.forEach(pattern => {
      if (lowerContent.includes(pattern)) {
        matchCount++;
      }
    });
    
    if (matchCount > bestMatch.count) {
      bestMatch = { type, count: matchCount };
    }
  }
  
  if (bestMatch.count >= 2) {
    return bestMatch.type;
  }
  
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

// Helper function to check if a PDF file is potentially empty or corrupted
export async function validatePDF(file: File): Promise<{isValid: boolean, message?: string}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Check file size
    if (arrayBuffer.byteLength < 100) {
      return { isValid: false, message: 'PDF file is too small to be valid' };
    }
    
    // Check for PDF header
    const header = new Uint8Array(arrayBuffer.slice(0, 8));
    const headerString = String.fromCharCode.apply(null, Array.from(header));
    
    if (!headerString.startsWith('%PDF-')) {
      return { isValid: false, message: 'Not a valid PDF file' };
    }
    
    // Check for EOF marker
    const trailer = new Uint8Array(arrayBuffer.slice(-6));
    const trailerString = String.fromCharCode.apply(null, Array.from(trailer));
    
    if (!trailerString.includes('%%EOF')) {
      return { 
        isValid: true, 
        message: 'PDF might be truncated (no EOF marker found)' 
      };
    }
    
    return { isValid: true };
  } catch (error) {
    return { 
      isValid: false, 
      message: `Could not validate PDF: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}