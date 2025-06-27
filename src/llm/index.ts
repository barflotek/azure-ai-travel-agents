// Large Language Model (LLM) management and routing
// This directory contains LLM provider integrations and routing logic:
// - providers: Integration with different LLM providers (Ollama, Groq, OpenAI)
// - routing: Intelligent routing between LLM providers based on query complexity

// LLM exports
export { SmartLLMRouter } from './routing/smart-router';
export { OllamaProvider } from './providers/ollama';
export { GroqProvider } from './providers/groq';
export type { QueryComplexity, LLMMessage } from './routing/smart-router'; 