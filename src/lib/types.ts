// Document and analysis related types
export type DocumentType = 
  | 'pdf' 
  | 'image' 
  | 'csv' 
  | 'excel' 
  | 'doc' 
  | 'docx' 
  | 'txt' 
  | 'rtf'
  | 'xml'
  | 'json'
  | 'html'
  | 'ppt'
  | 'pptx'
  | 'xls'
  | 'xlsx'
  | 'zip'
  | 'unknown';

// Interface for parsed document content
export interface ParsedDocument {
  id?: string;  // Document ID, generated when parsed
  content: string;
  name: string;
  file?: File;
  base64Data?: string;
  type?: string;
  
  // For backward compatibility
  text?: string;
  documentType?: DocumentType;
  image?: File;
}

export interface DocumentFile {
  id: string;
  name: string;
  type: DocumentType;
  file: File;
  content?: ParsedDocument;
  parsed: boolean;
  parseError?: string;
  parseProgress?: number;
  preview?: string;
  metadata?: any;
}

export interface ComparisonResult {
  tables: ComparisonTable[];
  itemComparison?: string[][];
  verification?: string;
  validation?: string;
  review?: string;
  analysis?: string;
  summary?: string;
  insights?: string;
  recommendations?: string;
  risks?: string;
  issues?: string;
  extractedFields?: Record<string, any>;
  confidence?: number;
  [key: string]: any;
}

export interface ComparisonTable {
  title: string;
  headers: string[];
  rows: string[][];
  // Flag to indicate if this table is a multi-document comparison table
  isMultiDocument?: boolean;
  // Document names for multi-document tables
  documentNames?: string[];
}

export interface AnalysisSection {
  title: string;
  content: string;
}

export interface FileUploadProps {
  onFilesSelected: (files: DocumentFile[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  showFileList?: boolean;
  maxFileSize?: number;
  accept?: string;  // File types to accept, e.g. '.pdf,.jpg'
  multiple?: boolean; // Allow multiple file selection
}

/**
 * Processing stage in the document workflow
 */
export type ProcessingStage = 'upload' | 'extraction' | 'analysis' | 'validation' | 'results';
