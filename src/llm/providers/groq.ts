import Groq from "groq-sdk";

export class GroqProvider {
  private client: Groq;

  constructor() {
    this.client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async chat(messages: any[]) {
    try {
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
    } catch (error) {
      console.error("Groq error:", error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test with a simple request
      await this.client.chat.completions.create({
        messages: [{ role: "user", content: "test" }],
        model: "llama-3.1-8b-instant",
        max_tokens: 1,
      });
      return true;
    } catch {
      return false;
    }
  }
} 