import { OllamaProvider } from '../providers/ollama';
import { GroqProvider } from '../providers/groq';

export type QueryComplexity = 'simple' | 'medium' | 'complex';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class SmartLLMRouter {
  private ollama: OllamaProvider;
  private groq: GroqProvider;

  constructor() {
    this.ollama = new OllamaProvider();
    this.groq = new GroqProvider();
  }

  async route(
    messages: LLMMessage[], 
    complexity: QueryComplexity = 'medium',
    forceProvider?: 'ollama' | 'groq'
  ) {
    // Force specific provider if requested
    if (forceProvider === 'groq') {
      return await this.groq.chat(messages);
    }
    if (forceProvider === 'ollama') {
      return await this.ollama.chat(messages);
    }

    // Try local first for cost savings (if enabled)
    if (process.env.LOCAL_LLM_ENABLED === 'true') {
      try {
        console.log(`🤖 Trying local Ollama for ${complexity} query...`);
        const isAvailable = await this.ollama.isAvailable();
        
        if (isAvailable) {
          const result = await this.ollama.chat(messages);
          console.log('✅ Ollama succeeded');
          return result;
        } else {
          console.log('⚠️  Ollama not available, falling back to Groq');
        }
      } catch (error: any) {
        console.log('❌ Ollama failed, falling back to Groq:', error.message);
      }
    }

    // Fallback to paid service
    console.log('💰 Using Groq (paid fallback)');
    return await this.groq.chat(messages);
  }

  async simpleQuery(prompt: string) {
    return this.route([{ role: 'user', content: prompt }], 'simple');
  }

  async complexQuery(prompt: string) {
    return this.route([{ role: 'user', content: prompt }], 'complex');
  }

  async getProviderStatus() {
    const [ollamaAvailable, groqAvailable] = await Promise.all([
      this.ollama.isAvailable(),
      this.groq.isAvailable()
    ]);

    return {
      ollama: ollamaAvailable,
      groq: groqAvailable,
      localEnabled: process.env.LOCAL_LLM_ENABLED === 'true'
    };
  }
} 