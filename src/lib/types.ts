// Document and analysis related types
export type DocumentType = 'pdf' | 'image' | 'csv' | 'excel' | 'doc' | 'txt' | 'unknown';

// Interface for parsed document content
export interface ParsedDocument {
  image?: File;
  text?: string;
  documentType?: DocumentType;
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
  verification: string;
  validation: string;
  review: string;
  analysis: string;
  summary: string;
  insights: string;
  recommendations: string;
  risks: string;
  issues: string;
}

export interface ComparisonTable {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface AnalysisSection {
  title: string;
  content: string;
}
