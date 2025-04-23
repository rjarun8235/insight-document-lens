declare module '@anthropic-ai/sdk' {
  export default class Anthropic {
    constructor(options: { apiKey: string });
    
    messages: {
      create(params: {
        model: string;
        max_tokens: number;
        system?: any;
        messages: any[];
      }): Promise<{
        content: Array<{ text: string }>;
        usage?: {
          input_tokens: number;
          output_tokens: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
      }>;
    };
  }
}
