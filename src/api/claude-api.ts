/**
 * Claude API Service
 * Handles interactions with the Claude API for TSV Global's document processing
 */

import axios from 'axios';
import { 
  ContentBlock, 
  ApiRequest, 
  ApiResponse, 
  TokenUsage,
  ModelConfig
} from '../types/app-types';

// Available Claude models
export const MODELS = {
  EXTRACTION: {
    name: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    thinkingBudget: 8000, // Enable extended thinking by default
    costPerInputMToken: 3.0,
    costPerOutputMToken: 15.0
  },
  ANALYSIS: {
    name: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    thinkingBudget: 16000, // Enable extended thinking by default
    costPerInputMToken: 3.0,
    costPerOutputMToken: 15.0
  },
  VALIDATION: {
    name: 'claude-3-5-sonnet-20241022', // Changed to 3.5 to avoid extended thinking issues
    maxTokens: 8192,
    costPerInputMToken: 3.0,
    costPerOutputMToken: 15.0
  }
};

/**
 * Claude API Service
 * Handles interactions with the Claude API
 */
export class ClaudeApiService {
  // Make MODELS available as a class property
  public MODELS = MODELS;
  
  // Supabase function URL for Claude API proxy
  private proxyUrl = 'https://cbrgpzdxttzlvvryysaf.supabase.co/functions/v1/claude-api-proxy';
  
  /**
   * Call the Claude API
   * @param request API request parameters
   * @returns API response
   */
  async callApi(request: ApiRequest): Promise<ApiResponse> {
    try {
      console.log(`Calling Claude API (${request.model})...`);
      
      // Log request size for debugging
      const requestSize = JSON.stringify(request).length;
      console.log(`Request size: ${(requestSize / 1024).toFixed(2)} KB`);
      
      // Make direct axios call to the Supabase function URL
      const response = await axios.post(this.proxyUrl, request);
      
      // Check if response is valid
      if (!response.data) {
        throw new Error('Empty response from Claude API');
      }
      
      // Log token usage metrics if available
      if (response.data?.usage) {
        const usage = response.data.usage;
        if (usage.cached_tokens) {
          console.log(`Cache metrics - Cached tokens: ${usage.cached_tokens}`);
        }
        console.log(`Token usage - Input: ${usage.input_tokens}, Output: ${usage.output_tokens}`);
        
        // Log thinking tokens if available
        if (response.data.thinking?.thinking_tokens) {
          console.log(`Thinking tokens used: ${response.data.thinking.thinking_tokens}`);
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('Error calling Claude API:', error);
      
      // Extract detailed error information if available
      let errorMessage = 'Unknown error';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.details) {
        errorMessage = error.response.data.details;
      } else if (error.response?.status) {
        errorMessage = `HTTP ${error.response.status}: ${error.response.statusText}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Log more details for debugging
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      throw new Error(`Claude API error: ${errorMessage}`);
    }
  }
  
  /**
   * Calculate token usage and cost
   * @param usage Token usage from API response
   * @param model Model configuration
   * @returns Token usage and cost
   */
  calculateTokenUsage(usage: any, model: ModelConfig): TokenUsage {
    // Default to zero if usage is not available
    const inputTokens = usage?.input_tokens || 0;
    const outputTokens = usage?.output_tokens || 0;
    
    // Calculate costs
    const inputCost = (inputTokens / 1000000) * model.costPerInputMToken;
    const outputCost = (outputTokens / 1000000) * model.costPerOutputMToken;
    const totalCost = inputCost + outputCost;
    
    // Calculate cache savings if applicable
    let cacheSavings = 0;
    if (usage?.cached_tokens) {
      const cachedInputCost = (usage.cached_tokens / 1000000) * model.costPerInputMToken;
      cacheSavings = cachedInputCost;
    }
    
    return {
      input: inputTokens,
      output: outputTokens,
      cost: totalCost,
      cacheSavings: cacheSavings > 0 ? cacheSavings : undefined
    };
  }
}

// Export a singleton instance
export const claudeApi = new ClaudeApiService();
