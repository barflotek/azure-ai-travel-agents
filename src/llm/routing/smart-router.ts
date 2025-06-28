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
      try {
        return await this.groq.chat(messages);
      } catch (error: any) {
        if (error.message?.includes('Rate limit')) {
          throw new Error(`Groq rate limit: ${error.message}. Try using Ollama instead or wait for the cooldown.`);
        }
        throw error;
      }
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
    try {
      return await this.groq.chat(messages);
    } catch (error: any) {
      if (error.message?.includes('Rate limit')) {
        // Try Ollama as emergency fallback
        try {
          console.log('🚨 Groq rate limited, trying Ollama as emergency fallback...');
          const isAvailable = await this.ollama.isAvailable();
          if (isAvailable) {
            const result = await this.ollama.chat(messages);
            console.log('✅ Ollama emergency fallback succeeded');
            return result;
          }
        } catch (ollamaError) {
          console.log('❌ Ollama emergency fallback also failed:', ollamaError);
        }
        
        throw new Error(`All LLM providers are unavailable. Groq is rate limited: ${error.message}. Please wait or enable local Ollama.`);
      }
      throw error;
    }
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

    const groqRateLimit = this.groq.getRateLimitStatus();

    return {
      ollama: ollamaAvailable,
      groq: groqAvailable,
      groqRateLimit,
      localEnabled: process.env.LOCAL_LLM_ENABLED === 'true',
      recommendations: this.getRecommendations(ollamaAvailable, groqAvailable, groqRateLimit)
    };
  }

  private getRecommendations(ollamaAvailable: boolean, groqAvailable: boolean, groqRateLimit: any): string[] {
    const recommendations: string[] = [];
    
    if (!ollamaAvailable && !groqAvailable) {
      recommendations.push('No LLM providers available. Check your configuration.');
    }
    
    if (groqRateLimit.isInCooldown) {
      recommendations.push(`Groq is rate limited. Wait ${groqRateLimit.remainingSeconds} seconds or enable local Ollama.`);
    }
    
    if (!ollamaAvailable && process.env.LOCAL_LLM_ENABLED !== 'true') {
      recommendations.push('Enable local Ollama for better reliability and cost savings.');
    }
    
    return recommendations;
  }
} 