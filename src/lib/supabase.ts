import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch API key from Supabase Edge Function
 * @returns Promise with the API key
 */
export async function fetchApiKeyFromSupabase(): Promise<string | null> {
  try {
    // Fetch API key from the Supabase Edge Function
    const response = await fetch('https://cbrgpzdxttzlvvryysaf.supabase.co/functions/v1/serve-anthropic-api-key');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch API key: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.apiKey || null;
  } catch (error) {
    console.error('Error fetching API key from Supabase:', error);
    return null;
  }
}
