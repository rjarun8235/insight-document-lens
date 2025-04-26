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
   * Call the Claude API with the given parameters
   */
  async callApi(
    model: string,
    messages: Array<{ role: string; content: string | ContentBlock[] }>,
    maxTokens: number = 4000,
    thinking?: { type: string; budget_tokens: number }
  ): Promise<ApiResponse> {
    const modelConfig = this.getModelConfig(model);
    console.log(`🤖 Calling Claude API (${model})...`);
    
    try {
      const requestBody = {
        model,
        max_tokens: maxTokens,
        messages,
        thinking
      };
      
      // Log request size for debugging
      const requestSize = JSON.stringify(requestBody).length / 1024;
      console.log(`📦 Request size: ${requestSize.toFixed(2)} KB`);
      
      if (requestSize > 100) {
        console.warn(`⚠️ Large request size (${requestSize.toFixed(2)} KB) may cause issues`);
      }
      
      // Make the API call through the Supabase function proxy
      const response = await axios.post(this.proxyUrl, requestBody);
      
      // Extract the response data
      const data = response.data;
      
      // Calculate token usage and cost
      const inputTokens = data.usage.input_tokens;
      const outputTokens = data.usage.output_tokens;
      const cacheSavings = this.calculateCacheSavings(data.usage);
      
      const inputCost = (inputTokens / 1000000) * modelConfig.costPerInputMToken;
      const outputCost = (outputTokens / 1000000) * modelConfig.costPerOutputMToken;
      const totalCost = inputCost + outputCost;
      
      console.log(`📊 Token usage - Input: ${inputTokens}, Output: ${outputTokens}`);
      if (cacheSavings > 0) {
        console.log(`💰 Cache savings: ${cacheSavings} tokens (${(cacheSavings / inputTokens * 100).toFixed(1)}% of input)`);
      }
      console.log(`💵 Cost: $${totalCost.toFixed(6)} ($${inputCost.toFixed(6)} input + $${outputCost.toFixed(6)} output)`);
      
      // Extract the response content
      const responseContent = data.content[0].text;
      
      // Get thinking process if available
      const thinkingProcess = data.content.find((c: any) => c.type === 'thinking')?.thinking;
      if (thinkingProcess) {
        console.log(`🧠 Received thinking process (${thinkingProcess.length} characters)`);
      }
      
      // Return the formatted response
      return {
        content: data.content,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_creation_input_tokens: data.usage.cache_creation_input_tokens,
          cache_read_input_tokens: data.usage.cache_read_input_tokens
        }
      };
    } catch (error) {
      console.error('❌ Error calling Claude API:', error);
      
      // Extract error details for better debugging
      if (axios.isAxiosError(error) && error.response) {
        console.error(`❌ Status: ${error.response.status}`);
        console.error(`❌ Response data:`, error.response.data);
      }
      
      throw new Error(`Failed to call Claude API: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the model configuration for the given model name
   * @param model Model name
   * @returns Model configuration
   */
  private getModelConfig(model: string): ModelConfig {
    return this.MODELS[model];
  }

  /**
   * Calculate cache savings from the given usage data
   * @param usage Usage data
   * @returns Cache savings
   */
  private calculateCacheSavings(usage: any): number {
    return usage.cached_tokens || 0;
  }
}

// Export a singleton instance
export const claudeApi = new ClaudeApiService();
