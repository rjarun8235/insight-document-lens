/**
 * Claude API Service
 * 
 * A dedicated service for handling all communication with the Claude API proxy.
 * This service is independent of React and UI components, providing a clean
 * interface for making requests to the Claude API.
 */

// Types for request/response
export interface ClaudeContent {
  type: string;
  text?: string;
  source?: {
    type: string;
    media_type: string;
    data: string;
  };
}

export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ClaudeContent[];
}

export interface ClaudeRequestOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  retry_count?: number;
  timeout_ms?: number;
}

export interface ClaudeExtractionRequest {
  messages: ClaudeMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
}

export interface ClaudeVerificationRequest {
  messages: ClaudeMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
}

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudeError {
  status: number;
  message: string;
  details?: any;
}

/**
 * Custom error class for Claude API errors
 */
export class ClaudeApiError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'ClaudeApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Service class for interacting with the Claude API
 */
export class ClaudeApiService {
  private proxyUrl: string;
  private defaultOptions: ClaudeRequestOptions;

  /**
   * Creates a new instance of the ClaudeApiService
   * 
   * @param proxyUrl - URL of the Claude API proxy
   * @param defaultOptions - Default options for requests
   */
  constructor(
    proxyUrl?: string, 
    defaultOptions?: ClaudeRequestOptions
  ) {
    this.proxyUrl = proxyUrl || 'https://cbrgpzdxttzlvvryysaf.supabase.co/functions/v1/claude-api-proxy';
    this.defaultOptions = {
      temperature: 0.1,
      max_tokens: 4000,
      retry_count: 2,
      timeout_ms: 30000,
      ...defaultOptions
    };
  }

  /**
   * Sends an extraction request to the Claude API
   * 
   * @param prompt - The prompt to send to Claude
   * @param options - Options for the request
   * @param documentFile - Optional PDF file as base64 string with mime type
   * @returns The Claude API response
   */
  async sendExtractionRequest(
    prompt: string, 
    options: ClaudeRequestOptions = {},
    documentFile?: { base64: string, mimeType: string }
  ): Promise<ClaudeResponse> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    // Create the request with appropriate content format
    const request: ClaudeExtractionRequest = {
      messages: [],
      temperature: mergedOptions.temperature,
      max_tokens: mergedOptions.max_tokens,
      top_p: mergedOptions.top_p,
      top_k: mergedOptions.top_k
    };
    
    // If document file is provided, use document content type
    if (documentFile && documentFile.base64 && documentFile.mimeType === 'application/pdf') {
      console.log('Using document content type for PDF extraction');
      request.messages = [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { 
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: documentFile.base64
            }
          }
        ]
      }];
    } else {
      // Otherwise use standard text content
      request.messages = [{ role: 'user', content: prompt }];
    }

    return this.executeWithRetry(
      () => this.sendRequest('/extraction', request),
      mergedOptions.retry_count || 2,
      mergedOptions.timeout_ms || 30000
    );
  }

  /**
   * Sends a verification request to the Claude API
   * 
   * @param prompt - The prompt to send to Claude
   * @param options - Options for the request
   * @returns The Claude API response
   */
  async sendVerificationRequest(
    prompt: string, 
    options: ClaudeRequestOptions = {}
  ): Promise<ClaudeResponse> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    const request: ClaudeVerificationRequest = {
      messages: [{ role: 'user', content: prompt }],
      temperature: mergedOptions.temperature,
      max_tokens: mergedOptions.max_tokens,
      top_p: mergedOptions.top_p,
      top_k: mergedOptions.top_k
    };

    return this.executeWithRetry(
      () => this.sendRequest('/verification', request),
      mergedOptions.retry_count || 2,
      mergedOptions.timeout_ms || 30000
    );
  }

  /**
   * Sends a custom request to the Claude API
   * 
   * @param endpoint - The endpoint to send the request to
   * @param messages - The messages to send to Claude
   * @param options - Options for the request
   * @returns The Claude API response
   */
  async sendCustomRequest(
    endpoint: string,
    messages: ClaudeMessage[],
    options: ClaudeRequestOptions = {}
  ): Promise<ClaudeResponse> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    const request = {
      messages,
      temperature: mergedOptions.temperature,
      max_tokens: mergedOptions.max_tokens,
      top_p: mergedOptions.top_p,
      top_k: mergedOptions.top_k
    };

    return this.executeWithRetry(
      () => this.sendRequest(endpoint, request),
      mergedOptions.retry_count || 2,
      mergedOptions.timeout_ms || 30000
    );
  }

  /**
   * Sends a request to the Claude API with retry logic
   * 
   * @param fn - The function to execute
   * @param retries - Number of retries
   * @param timeout - Timeout in milliseconds
   * @returns The Claude API response
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>, 
    retries: number, 
    timeout: number
  ): Promise<T> {
    let lastError: Error | null = null;
    
    // Create a promise that rejects after the timeout
    const timeoutPromise = new Promise<T>((_, reject) => {
      setTimeout(() => reject(new ClaudeApiError(
        `Request timed out after ${timeout}ms`, 
        408
      )), timeout);
    });

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Race between the request and the timeout
        return await Promise.race([fn(), timeoutPromise]);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't wait on the last attempt
        if (attempt < retries) {
          // Exponential backoff with jitter
          const delay = Math.min(1000 * 2 ** attempt, 10000) + Math.random() * 1000;
          console.warn(`Claude API request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${Math.round(delay)}ms:`, lastError);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // If we get here, all retries failed
    console.error(`Claude API request failed after ${retries + 1} attempts:`, lastError);
    throw lastError;
  }

  /**
   * Sends a request to the Claude API
   * 
   * @param endpoint - The endpoint to send the request to
   * @param body - The request body
   * @returns The Claude API response
   */
  private async sendRequest(endpoint: string, body: any): Promise<ClaudeResponse> {
    try {
      const response = await fetch(`${this.proxyUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errorDetails: any = {};
        
        try {
          errorDetails = await response.json();
        } catch (e) {
          // If we can't parse the response as JSON, use the status text
          errorDetails = { message: response.statusText };
        }
        
        throw new ClaudeApiError(
          `API Error: ${response.status} - ${errorDetails.message || response.statusText}`,
          response.status,
          errorDetails
        );
      }

      return await response.json();
    } catch (error) {
      // If it's already a ClaudeApiError, rethrow it
      if (error instanceof ClaudeApiError) {
        throw error;
      }
      
      // Otherwise, wrap it in a ClaudeApiError
      const message = error instanceof Error ? error.message : String(error);
      console.error('Claude API request failed:', message);
      throw new ClaudeApiError(`Failed to communicate with Claude API: ${message}`, 500);
    }
  }

  /**
   * Extracts the text content from a Claude API response
   * 
   * @param response - The Claude API response
   * @returns The extracted text content
   */
  extractTextContent(response: ClaudeResponse): string {
    if (!response.content || !Array.isArray(response.content)) {
      throw new Error('Invalid Claude API response format');
    }

    return response.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('');
  }
}
