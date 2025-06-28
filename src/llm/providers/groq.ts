import Groq from "groq-sdk";

export class GroqProvider {
  private client: Groq;
  private lastRateLimitTime: number = 0;
  private rateLimitCooldown: number = 180000; // 3 minutes in milliseconds

  constructor() {
    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async chat(messages: any[]) {
    try {
      // Check if we're still in rate limit cooldown
      const now = Date.now();
      if (now - this.lastRateLimitTime < this.rateLimitCooldown) {
        const remainingTime = Math.ceil((this.rateLimitCooldown - (now - this.lastRateLimitTime)) / 1000);
        throw new Error(`Rate limit cooldown: Please wait ${remainingTime} seconds before trying again`);
      }

      const response = await this.client.chat.completions.create({
        messages: messages,
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
        max_tokens: 1000,
      });
      
      return {
        message: {
          content: response.choices[0]?.message?.content || "",
          role: "assistant"
        }
      };
    } catch (error: any) {
      console.error("Groq error:", error);
      
      // Handle rate limit specifically
      if (error.code === 'rate_limit_exceeded' || error.message?.includes('Rate limit')) {
        this.lastRateLimitTime = Date.now();
        
        // Extract wait time from error message if available
        let waitTime = 180; // Default 3 minutes
        const match = error.message?.match(/try again in (\d+)m(\d+\.?\d*)s/);
        if (match) {
          const minutes = parseInt(match[1]);
          const seconds = parseFloat(match[2]);
          waitTime = minutes * 60 + seconds;
        }
        
        throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime)} seconds before trying again. Consider using local Ollama for immediate responses.`);
      }
      
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if we're in rate limit cooldown
      const now = Date.now();
      if (now - this.lastRateLimitTime < this.rateLimitCooldown) {
        return false;
      }

      // Test with a simple request
      await this.client.chat.completions.create({
        messages: [{ role: "user", content: "test" }],
        model: "llama-3.1-8b-instant",
        max_tokens: 1,
      });
      return true;
    } catch (error: any) {
      if (error.code === 'rate_limit_exceeded') {
        this.lastRateLimitTime = Date.now();
      }
      return false;
    }
  }

  getRateLimitStatus() {
    const now = Date.now();
    const timeSinceLastLimit = now - this.lastRateLimitTime;
    const remainingCooldown = Math.max(0, this.rateLimitCooldown - timeSinceLastLimit);
    
    return {
      isInCooldown: remainingCooldown > 0,
      remainingSeconds: Math.ceil(remainingCooldown / 1000),
      lastRateLimit: this.lastRateLimitTime > 0 ? new Date(this.lastRateLimitTime).toISOString() : null
    };
  }
} 