/**
 * DocLens Application Types
 * Core type definitions for the TSV Global document processing application
 */

// Document Types
export type DocumentType = 
  | 'application/pdf' 
  | 'image/jpeg'
  | 'image/png'
  | 'text/csv' 
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  | 'application/vnd.ms-excel'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/plain'
  | 'unknown';

// Document Interfaces
export interface ParsedDocument {
  content: string;
  name: string;
  file?: File;
  base64Data?: string;
  type?: string;
  
  // For backward compatibility
  text?: string;
  documentType?: string;
  image?: File;
}

export interface DocumentFile {
  id: string;
  name: string;
  type: string;
  file: File;
  content?: ParsedDocument;
  parsed: boolean;
  parseError?: string;
  parseProgress?: number;
  preview?: string;
  metadata?: any;
}

// Analysis Result Interfaces
export interface ComparisonTable {
  title?: string;
  headers: string[];
  rows: string[][];
  isMultiDocument?: boolean;
  documentNames?: string[];
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
  [key: string]: any; // Allow for additional fields
}

export interface AnalysisSection {
  title: string;
  content: string;
}

// Token Usage Interface
export interface TokenUsage {
  input: number;
  output: number;
  cost: number;
  cacheSavings?: number;
}

// Processing Options Interface
export interface ProcessingOptions {
  showThinking?: boolean;
  useExtendedOutput?: boolean;
  skipValidation?: boolean;
  comparisonType?: string;
}

// Processing Result Interfaces
export interface ExtractionResult {
  result: {
    documentData: any[];
    documentTypes: string[];
    extractedFields: Record<string, any[]>;
    rawText?: string;
  };
  // Direct access to extracted fields for easier processing
  extractedFields?: Record<string, any>;
  // Array of document extraction results
  documents?: Array<{
    documentName: string;
    documentType: string;
    extractedFields: Record<string, any>;
  }>;
  tokenUsage: TokenUsage;
}

export interface AnalysisResult {
  result: {
    tables: ComparisonTable[];
    discrepancies?: string[];
    corrections?: string[];
  };
  confidenceScore?: number;
  tokenUsage: TokenUsage;
}

export interface ValidationResult {
  result: ComparisonResult;
  isValid?: boolean;
  confidenceScore: number;
  thinkingProcess?: string;
  finalResults?: string;
  tables?: ComparisonResult;
  rawText?: string;
  tokenUsage: TokenUsage;
}

export interface ProcessingResult {
  result: ComparisonResult;
  isValid?: boolean;
  confidenceScore?: number;
  thinkingProcess?: string;
  tokenUsage: TokenUsage;
  extractionResults?: any[];
  errors?: string[];
  stages?: {
    extraction: ExtractionResult;
    analysis: AnalysisResult;
    validation?: ValidationResult;
  };
}

// Claude API Types
export interface ContentBlock {
  type: string;
  text?: string;
  source?: {
    type: string;
    media_type: string;
    data: string;
  };
  cache_control?: {
    type: string;
  };
}

export interface ApiRequest {
  model: string;
  max_tokens: number;
  messages: Array<{
    role: string;
    content: string | ContentBlock[];
  }>;
  thinking?: {
    type: string;
    budget_tokens: number;
  };
}

export interface ApiResponse {
  content: Array<{
    type: string;
    text?: string;
    thinking?: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export interface ModelConfig {
  name: string;
  maxTokens: number;
  thinkingBudget?: number;
  costPerInputMToken: number;
  costPerOutputMToken: number;
}
