declare module '@/lib/types' {
  export type DocumentType = 'pdf' | 'image' | 'csv' | 'excel' | 'doc' | 'unknown';

  export interface DocumentFile {
    id: string;
    name: string;
    type: DocumentType;
    file: File;
    content?: string;
    parsed?: boolean;
    parseError?: string;
  }

  export interface ComparisonTable {
    title: string;
    headers: string[];
    rows: string[][];
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
}

declare module '@/services/claude-service' {
  import { ComparisonResult } from '@/lib/types';
  
  export function analyzeDocuments(
    documents: (string | { image: File, text?: string })[], 
    instruction: string,
    useCache?: boolean
  ): Promise<ComparisonResult>;
  
  export function prepareInstructions(comparisonType: string): string;
}

declare module '@/lib/parsers' {
  import { DocumentFile, DocumentType } from '@/lib/types';
  
  export function getDocumentType(file: File): DocumentType;
  export function parseCSV(file: File): Promise<string>;
  export function parseExcel(file: File): Promise<string>;
  export function parseImage(file: File): Promise<{ image: File, text?: string }>;
  export function parsePDF(file: File): Promise<string | { image: File, text?: string }>;
  export function parseDoc(file: File): Promise<string>;
  export function parseDocument(documentFile: DocumentFile): Promise<string | { image: File, text?: string }>;
}
