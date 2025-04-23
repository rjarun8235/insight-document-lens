/**
 * Utility functions for API calls and error handling
 */

/**
 * Calls a function with exponential backoff retry logic
 * @param fn Function to call that returns a promise
 * @param maxRetries Maximum number of retry attempts
 * @param baseDelay Base delay in milliseconds
 * @returns Result of the function call
 * @throws Last error encountered after all retries fail
 */
export async function callWithRetry<T>(
  fn: () => Promise<T>, 
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.warn(`API call failed (attempt ${i + 1}/${maxRetries}):`, error);
      lastError = error;
      
      // Only wait if we're going to retry
      if (i < maxRetries - 1) {
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, i) * (0.5 + Math.random() * 0.5);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Formats an error message for display to the user
 * @param error Error object or message
 * @returns Formatted error message
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('API key')) {
      return 'Authentication error: Please check your Claude API key.';
    }
    if (error.message.includes('rate limit')) {
      return 'Rate limit exceeded: Please try again in a few minutes.';
    }
    if (error.message.includes('timeout')) {
      return 'Request timed out: The server took too long to respond.';
    }
    if (error.message.includes('network')) {
      return 'Network error: Please check your internet connection.';
    }
    
    return `Error: ${error.message}`;
  }
  
  if (typeof error === 'string') {
    return `Error: ${error}`;
  }
  
  return 'An unexpected error occurred. Please try again.';
}
