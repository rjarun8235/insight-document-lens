/**
 * Claude API Service
 * Handles interactions with the Claude API for TSV Global's document processing
 */

import axios from 'axios';
import {
  ContentBlock,
  ApiRequest,
  ApiResponse,
  TokenUsage
} from '../types/app-types';

// Proxy function endpoints
const ENDPOINTS = {
  EXTRACTION: 'extraction',
  ANALYSIS: 'analysis',
  VALIDATION: 'validation'
};

// Cost calculation constants
const COST_PER_INPUT_TOKEN = 0.000003; // $3 per million tokens
const COST_PER_OUTPUT_TOKEN = 0.000015; // $15 per million tokens

// Model configurations
export const MODELS = {
  EXTRACTION: {
    name: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    costPerInputMToken: 3, // $3 per million tokens
    costPerOutputMToken: 15 // $15 per million tokens
  },
  ANALYSIS: {
    name: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    costPerInputMToken: 3, // $3 per million tokens
    costPerOutputMToken: 15 // $15 per million tokens
  },
  VALIDATION: {
    name: 'claude-3-7-sonnet-20240307',
    maxTokens: 8192,
    thinkingBudget: 32000,
    costPerInputMToken: 3, // $3 per million tokens
    costPerOutputMToken: 15 // $15 per million tokens
  }
};

/**
 * Claude API Service
 * Handles interactions with the Claude API
 */
export class ClaudeApiService {
  // Make endpoints available as a class property
  public ENDPOINTS = ENDPOINTS;

  // Supabase function base URL for Claude API proxy
  private proxyUrl = 'https://cbrgpzdxttzlvvryysaf.supabase.co/functions/v1/claude-api-proxy';

  /**
   * Call the Claude API with the given parameters
   * @param modelName The Claude model name to use
   * @param messages The messages to send to the API
   * @param maxTokens Optional maximum number of tokens to generate
   * @param thinking Optional thinking configuration
   */
  async callApi(
    modelName: string,
    messages: Array<{ role: string; content: string | ContentBlock[] }>,
    maxTokens?: number,
    thinking?: any
  ): Promise<ApiResponse> {
    console.log(`🤖 Calling Claude API (${modelName})...`);

    try {
      // Determine which endpoint to use based on the model or operation
      // The Supabase function expects one of: extraction, analysis, validation
      let endpoint = 'extraction'; // Default to extraction endpoint

      // If the model name contains "3-7", use the validation endpoint which has thinking enabled
      if (modelName.includes('3-7')) {
        endpoint = 'validation';
      }

      console.log(`Using endpoint: ${endpoint} for model: ${modelName}`);

      // Create request body with messages
      const requestBody: any = {
        messages,
        endpoint // Use the determined endpoint, not the model name
      };

      // Add optional parameters if provided
      if (maxTokens) {
        requestBody.max_tokens = maxTokens;
      }

      if (thinking) {
        requestBody.thinking = thinking;
      }

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

      const inputCost = (inputTokens / 1000000) * COST_PER_INPUT_TOKEN;
      const outputCost = (outputTokens / 1000000) * COST_PER_OUTPUT_TOKEN;
      const totalCost = inputCost + outputCost;

      console.log(`📊 Token usage - Input: ${inputTokens}, Output: ${outputTokens}`);
      if (cacheSavings > 0) {
        console.log(`💰 Cache savings: ${cacheSavings} tokens (${(cacheSavings / inputTokens * 100).toFixed(1)}% of input)`);
      }
      console.log(`💵 Cost: $${totalCost.toFixed(6)} ($${inputCost.toFixed(6)} input + $${outputCost.toFixed(6)} output)`);

      // Extract the response content (for debugging if needed)
      // const responseContent = data.content[0].text;

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
   * Calculate cache savings from the given usage data
   * @param usage Usage data
   * @returns Cache savings
   */
  private calculateCacheSavings(usage: any): number {
    return usage.cache_read_input_tokens || 0;
  }
}

// Export a singleton instance
export const claudeApi = new ClaudeApiService();
