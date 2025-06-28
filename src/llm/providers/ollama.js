import { Ollama } from "@llamaindex/ollama";
export class OllamaProvider {
    constructor() {
        this.ollama = new Ollama({
            model: "llama3.1:8b",
            config: { host: process.env.OLLAMA_BASE_URL }
        });
    }
    async chat(messages) {
        try {
            const response = await this.ollama.chat({ messages });
            return {
                message: {
                    content: response.message?.content || "",
                    role: "assistant"
                }
            };
        }
        catch (error) {
            console.error("Ollama error:", error);
            throw error;
        }
    }
    async isAvailable() {
        try {
            const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/version`);
            return response.ok;
        }
        catch {
            return false;
        }
    }
}
