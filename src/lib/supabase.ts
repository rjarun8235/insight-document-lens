import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch API key from Supabase Edge Function
 * @returns Promise with the API key
 */
export async function fetchApiKeyFromSupabase(): Promise<string | null> {
  try {
    // Use the Supabase client to invoke the Edge Function
    const { data, error } = await supabase.functions.invoke('serve-anthropic-api-key', {
      // No body needed for this function, but you could add parameters here if needed
    });
    
    if (error) {
      console.error('Supabase function error:', error);
      return null;
    }
    
    return data?.apiKey || null;
  } catch (error) {
    console.error('Error fetching API key from Supabase:', error);
    return null;
  }
}
