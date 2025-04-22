
// Document and analysis related types
export type DocumentType = 'pdf' | 'image' | 'csv' | 'excel' | 'doc' | 'unknown';

export interface DocumentFile {
  id: string;
  name: string;
  type: DocumentType;
  file: File;
  content?: string;
  parsed: boolean;
  parseError?: string;
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
