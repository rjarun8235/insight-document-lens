// FILE PARSER & BASE64 CONVERSION MODULE
// Handles all document formats: txt, csv, excel, word, pdf, images

import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { useState, useRef } from 'react';
import { analyzeDocument } from './document-types';

// ===== TYPES =====

export type FileFormat = 'txt' | 'csv' | 'excel' | 'word' | 'pdf' | 'image' | 'unknown';

export interface ParsedFileResult {
  success: boolean;
  file: File;
  format: FileFormat;
  content?: string;           // For text-based files
  base64?: string;           // For binary files (PDF, images)
  metadata: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileFormat: FileFormat;
    processingMethod: 'text_extraction' | 'base64_encoding';
    processingTime: number;
    charCount?: number;
    wordCount?: number;
    lineCount?: number;
    sheets?: string[];
    error?: string;          // Error details can be stored in metadata for more context
    issues?: string[];       // Document issues from analysis
  };
  error?: string;            // Top-level error for quick access
}

// ===== FILE FORMAT DETECTION =====

export const detectFileFormat = (fileName: string): FileFormat => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Text files
  if (['txt'].includes(extension)) return 'txt';
  if (['csv'].includes(extension)) return 'csv';
  
  // Office documents
  if (['xls', 'xlsx'].includes(extension)) return 'excel';
  if (['doc', 'docx'].includes(extension)) return 'word';
  
  // Binary files (need base64)
  if (['pdf'].includes(extension)) return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'].includes(extension)) return 'image';
  
  return 'unknown';
};

// ===== BASE64 CONVERSION UTILITY =====

export const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64Content = result.split(',')[1];
        
        if (!base64Content) {
          throw new Error('Failed to extract base64 content');
        }
        
        resolve(base64Content);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    // Read file as data URL to get base64
    reader.readAsDataURL(file);
  });
};

// ===== TEXT FILE PARSER =====

class TextFileParser {
  static canParse(format: FileFormat): boolean {
    return format === 'txt';
  }
  
  static async parse(file: File): Promise<string> {
    try {
      const content = await file.text();
      
      if (!content || content.trim().length === 0) {
        throw new Error('File appears to be empty');
      }
      
      return content;
    } catch (error) {
      throw new Error(`Failed to parse text file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// ===== CSV FILE PARSER =====

class CSVFileParser {
  static canParse(format: FileFormat): boolean {
    return format === 'csv';
  }
  
  static async parse(file: File): Promise<string> {
    try {
      const content = await file.text();
      
      if (!content || content.trim().length === 0) {
        throw new Error('CSV file appears to be empty');
      }
      
      // Convert CSV to readable format
      const lines = content.split('\n');
      const header = lines[0];
      const dataLines = lines.slice(1);
      
      let formattedContent = `CSV FILE: ${file.name}\n`;
      formattedContent += `=== HEADER ===\n${header}\n\n`;
      formattedContent += `=== DATA (${dataLines.length} rows) ===\n`;
      
      // Add first 50 rows to avoid overwhelming the LLM
      const limitedLines = dataLines.slice(0, 50);
      limitedLines.forEach((line, index) => {
        if (line.trim()) {
          formattedContent += `Row ${index + 1}: ${line}\n`;
        }
      });
      
      if (dataLines.length > 50) {
        formattedContent += `\n... and ${dataLines.length - 50} more rows\n`;
      }
      
      return formattedContent;
    } catch (error) {
      throw new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// ===== EXCEL FILE PARSER =====

class ExcelFileParser {
  static canParse(format: FileFormat): boolean {
    return format === 'excel';
  }
  
  static async parse(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {
        cellStyles: true,
        cellFormulas: true,
        cellDates: true,
        cellNF: true,
        sheetStubs: true
      });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('No sheets found in Excel file');
      }
      
      let extractedContent = `EXCEL FILE: ${file.name}\n`;
      extractedContent += `Total Sheets: ${workbook.SheetNames.length}\n\n`;
      
      // Process each sheet
      for (const sheetName of workbook.SheetNames) {
        extractedContent += `=== SHEET: ${sheetName} ===\n`;
        
        const worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet || !worksheet['!ref']) {
          extractedContent += 'Sheet is empty\n\n';
          continue;
        }
        
        // Convert sheet to array of arrays
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: '' // Default value for empty cells
        });
        
        if (jsonData.length === 0) {
          extractedContent += 'No data found in sheet\n\n';
          continue;
        }
        
        // Add sheet metadata
        // Parse the range reference manually since decode_range might not be available in all versions
        const rangeRef = worksheet['!ref'] || '';
        const match = rangeRef.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        
        if (match) {
          const [, startCol, startRow, endCol, endRow] = match;
          const rowCount = parseInt(endRow) - parseInt(startRow) + 1;
          const colCount = endCol.charCodeAt(0) - startCol.charCodeAt(0) + 1;
          extractedContent += `Range: ${rangeRef} (${rowCount} rows, ${colCount} columns)\n`;
        } else {
          extractedContent += `Range: ${rangeRef}\n`;
        }
        
        // Process rows (limit to 100 rows to avoid overwhelming)
        const limitedData = jsonData.slice(0, 100);
        
        limitedData.forEach((row: any[], rowIndex) => {
          // Only include rows that have some content
          if (row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
            const cleanRow = row.map(cell => 
              cell === null || cell === undefined ? '' : String(cell)
            );
            extractedContent += `Row ${rowIndex + 1}: ${cleanRow.join(' | ')}\n`;
          }
        });
        
        if (jsonData.length > 100) {
          extractedContent += `... and ${jsonData.length - 100} more rows\n`;
        }
        
        extractedContent += '\n';
      }
      
      return extractedContent;
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// ===== WORD DOCUMENT PARSER =====

class WordDocumentParser {
  static canParse(format: FileFormat): boolean {
    return format === 'word';
  }
  
  static async parse(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Extract raw text using mammoth
      const result = await mammoth.extractRawText({ arrayBuffer });
      
      if (!result.value || result.value.trim().length === 0) {
        throw new Error('No text content found in Word document');
      }
      
      let extractedContent = `WORD DOCUMENT: ${file.name}\n`;
      extractedContent += `=== EXTRACTED TEXT ===\n`;
      extractedContent += result.value;
      
      // Add any messages from mammoth (warnings, etc.)
      if (result.messages && result.messages.length > 0) {
        extractedContent += `\n\n=== PROCESSING NOTES ===\n`;
        result.messages.forEach(message => {
          extractedContent += `${message.type}: ${message.message}\n`;
        });
      }
      
      return extractedContent;
    } catch (error) {
      throw new Error(`Failed to parse Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// ===== MAIN FILE PARSER CLASS =====

export class FileParser {
  private static parsers = [
    TextFileParser,
    CSVFileParser,
    ExcelFileParser,
    WordDocumentParser
  ];
  
  /**
   * Parse a file and return either text content or base64 encoding
   */
  static async parseFile(file: File): Promise<ParsedFileResult> {
    const startTime = Date.now();
    const fileFormat = detectFileFormat(file.name);
    
    // Analyze filename to suggest document type and identify any issues
    const analysis = analyzeDocument(file.name);
    
    // Prepare common metadata including any issues from document analysis
    const metadata = {
      fileName: file.name,
      fileSize: file.size,
      fileFormat,
      mimeType: file.type || 'application/octet-stream', // Default MIME type if not available
      processingMethod: 'text_extraction' as const,
      processingTime: 0,
      issues: analysis.suggestions // Add document issues from analysis
    };
    
    try {
      // For text-based files, extract content
      if (['txt', 'csv', 'excel', 'word'].includes(fileFormat)) {
        
        // Find a parser that can handle this format
        const parser = FileParser.parsers.find(p => p.canParse(fileFormat));
        
        if (!parser) {
          throw new Error(`No parser available for format: ${fileFormat}`);
        }
        
        const content = await parser.parse(file);
        const processingTime = (Date.now() - startTime) / 1000;
        
        return {
          success: true,
          file,
          format: fileFormat,
          content,
          metadata: {
            ...metadata,
            processingMethod: 'text_extraction',
            processingTime,
            charCount: content.length,
            wordCount: content.split(/\s+/).filter(Boolean).length,
            lineCount: content.split('\n').length
          }
        };
      }
      
      // For binary files (PDF, images), convert to base64
      else if (['pdf', 'image'].includes(fileFormat)) {
        const base64 = await convertFileToBase64(file);
        const processingTime = (Date.now() - startTime) / 1000;
        
        return {
          success: true,
          file,
          format: fileFormat,
          base64,
          metadata: {
            ...metadata,
            processingMethod: 'base64_encoding',
            processingTime,
          }
        };
      }
      
      // Unknown file format
      else {
        throw new Error(`Unsupported file format: ${fileFormat}`);
      }
      
    } catch (error) {
      const processingTime = (Date.now() - startTime) / 1000;
      const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
      
      return {
        success: false,
        file,
        format: fileFormat,
        metadata: {
          ...metadata,
          processingTime,
          error: errorMessage
        },
        error: errorMessage
      };
    }
  }
  
  /**
   * Parse multiple files in sequence
   */
  static async parseFiles(files: File[]): Promise<ParsedFileResult[]> {
    const results: ParsedFileResult[] = [];
    
    console.log(`🔄 Starting to parse ${files.length} files...`);
    
    for (const [index, file] of files.entries()) {
      console.log(`📄 Parsing file ${index + 1}/${files.length}: ${file.name}`);
      
      const result = await this.parseFile(file);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ Successfully parsed ${file.name} (${result.metadata.processingMethod})`);
      } else {
        console.log(`❌ Failed to parse ${file.name}: ${result.metadata.error}`);
      }
    }
    
    const successful = results.filter(r => r.success).length;
    console.log(`📊 Parsing complete: ${successful}/${files.length} successful`);
    
    return results;
  }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Get file size in human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Validate file before parsing
 */
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: `File too large: ${formatFileSize(file.size)} (max ${formatFileSize(maxSize)})` };
  }
  
  // Check file format
  const format = detectFileFormat(file.name);
  if (format === 'unknown') {
    return { valid: false, error: `Unsupported file format: ${file.name.split('.').pop()}` };
  }
  
  return { valid: true };
};

// ===== REACT HOOK FOR FILE PARSING =====

export const useFileParsing = () => {
  const [isParsing, setIsParsing] = useState(false);
  const [results, setResults] = useState<ParsedFileResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  
  // Function to cancel ongoing processing
  const cancelProcessing = () => {
    if (isParsing) {
      cancelRef.current.cancelled = true;
      console.log('Cancelling file processing...');
    }
  };

  const parseFiles = async (files: File[]) => {
    // Reset state
    setIsParsing(true);
    setProgress(0);
    setResults([]);
    setCurrentFileName(null);
    cancelRef.current.cancelled = false;
    
    try {
      const validFiles = [];
      const errors = [];
      
      // Validate all files first
      for (const file of files) {
        // Check if processing was cancelled
        if (cancelRef.current.cancelled) {
          console.log('Processing cancelled during validation');
          throw new Error('Processing cancelled by user');
        }
        
        const validation = validateFile(file);
        if (validation.valid) {
          validFiles.push(file);
        } else {
          errors.push(`${file.name}: ${validation.error}`);
        }
      }
      
      if (errors.length > 0) {
        console.warn('File validation errors:', errors);
      }
      
      if (validFiles.length === 0) {
        throw new Error('No valid files to parse');
      }
      
      // Parse files with progress tracking
      const parsedResults = [];
      
      for (const [index, file] of validFiles.entries()) {
        // Check if processing was cancelled
        if (cancelRef.current.cancelled) {
          console.log('Processing cancelled during parsing');
          throw new Error('Processing cancelled by user');
        }
        
        // Update current file being processed
        setCurrentFileName(file.name);
        console.log(`Processing file ${index + 1}/${validFiles.length}: ${file.name}`);
        
        const result = await FileParser.parseFile(file);
        parsedResults.push(result);
        
        const progress = ((index + 1) / validFiles.length) * 100;
        setProgress(progress);
      }
      
      setResults(parsedResults);
      setCurrentFileName(null);
      return parsedResults;
      
    } catch (error) {
      console.error('File parsing failed:', error);
      throw error;
    } finally {
      setIsParsing(false);
    }
  };
  
  return {
    parseFiles,
    isParsing,
    results,
    progress,
    currentFileName,
    cancelProcessing,
  };
};

export default FileParser;
