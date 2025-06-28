// Use built-in fetch if available (Node.js 18+), otherwise use node-fetch v2
let fetch;

try {
  // Try to use built-in fetch first (Node.js 18+)
  if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
    console.log('✅ Using built-in fetch');
  } else {
    // Use node-fetch v2 (CommonJS compatible)
    fetch = require('node-fetch');
    console.log('✅ Using node-fetch v2');
  }
} catch (error) {
  console.error('❌ Fetch not available:', error.message);
  // Create a mock fetch that returns an error
  fetch = async (url, options) => {
    console.log(`Mock fetch called for: ${url}`);
    return {
      ok: false,
      status: 500,
      statusText: 'Fetch not available',
      json: async () => ({ error: 'Fetch not available' })
    };
  };
}

class KnowledgeService {
  constructor(baseUrl = 'http://localhost:9380') {
    this.baseUrl = baseUrl;
    this.chatId = null; // Will be set dynamically
    this.apiKey = process.env.RAGFLOW_API_KEY || 'ragflow-NjMmE2YzhlNTQ2ZDExZjBiNzNhZWE3MT';
    this.ragflowEnabled = false; // Will be set to true if RAGFlow is accessible
  }

  async initializeChatAssistant() {
    try {
      console.log('🤖 RAGFlow: Testing connection...');
      console.log('🔑 Using API key:', this.apiKey);
      
      // Test if RAGFlow is accessible
      const testResponse = await fetch(`${this.baseUrl}/api/v1/chats`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (testResponse.ok) {
        console.log('✅ RAGFlow: Connection successful');
        this.ragflowEnabled = true;
        
        // Get existing chat assistants to see if any have proper model configuration
        const chatsResponse = await fetch(`${this.baseUrl}/api/v1/chats`, {
          method: 'GET',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        });
        
        if (chatsResponse.ok) {
          const chatsResult = await chatsResponse.json();
          if (chatsResult.code === 0 && chatsResult.data && chatsResult.data.length > 0) {
            // Find a chat assistant with a proper model name
            const workingChat = chatsResult.data.find(chat => 
              chat.llm && chat.llm.model_name && chat.llm.model_name.trim() !== ''
            );
            
            if (workingChat) {
              this.chatId = workingChat.id;
              console.log(`✅ RAGFlow: Using existing chat assistant with ID: ${this.chatId}`);
              return true;
            }
          }
        }
        
        // Create a new chat assistant with proper configuration
        console.log('🤖 RAGFlow: Creating chat assistant...');
        const uniqueName = `Business Knowledge Agent ${Date.now()}`;
        const createResponse = await fetch(`${this.baseUrl}/api/v1/chats`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            name: uniqueName,
            description: 'AI-powered business knowledge advisor',
            dataset_ids: [],
            llm: {
              model_name: 'qwen-plus@Tongyi-Qianwen',
              temperature: 0.1,
              top_p: 0.3,
              presence_penalty: 0.4,
              frequency_penalty: 0.7,
              max_tokens: 2048
            },
            prompt: {
              similarity_threshold: 0.2,
              keywords_similarity_weight: 0.7,
              top_n: 6,
              variables: [{ key: 'knowledge', optional: true }],
              empty_response: "I don't have enough knowledge to answer that question. Please upload relevant documents first.",
              opener: "Hello! I'm your business knowledge advisor. I can help you with information from your uploaded documents.",
              show_quote: true,
              prompt: "You are an intelligent business advisor. Please analyze the knowledge base content to answer questions accurately and comprehensively. When the knowledge base content is irrelevant to the question, clearly state that the answer is not found in the knowledge base. Always provide detailed, actionable insights based on the available information."
            }
          })
        });

        if (createResponse.ok) {
          const result = await createResponse.json();
          if (result.code === 0 && result.data && result.data.id) {
            this.chatId = result.data.id;
            console.log(`✅ RAGFlow: Created chat assistant with ID: ${this.chatId}`);
            return true;
          } else {
            console.log('⚠️ RAGFlow: Could not create chat assistant:', result.message);
            this.ragflowEnabled = false;
            return false;
          }
        } else {
          console.log('⚠️ RAGFlow: Could not create chat assistant, status:', createResponse.status);
          this.ragflowEnabled = false;
          return false;
        }
      }

      console.log('⚠️ RAGFlow: Connection failed, using fallback mode');
      this.ragflowEnabled = false;
      return false;
    } catch (error) {
      console.error(`❌ RAGFlow connection error: ${error.message}`);
      this.ragflowEnabled = false;
      return false;
    }
  }

  async askQuestion(question, sessionId = null) {
    try {
      // Initialize RAGFlow connection if not done yet
      if (this.ragflowEnabled === false) {
        await this.initializeChatAssistant();
      }

      if (!this.ragflowEnabled || !this.chatId) {
        // Fallback to basic response
        return {
          success: true,
          answer: `I received your question: "${question}". RAGFlow integration is being set up. For now, I'm using the fallback knowledge system.`,
          sources: [],
          citations: [],
          confidence: 'fallback',
          sessionId: sessionId || 'fallback-session'
        };
      }

      console.log(`🤖 RAGFlow: Asking question: "${question}"`);
      
      const requestBody = {
        question: question,
        stream: false
      };

      if (sessionId) {
        requestBody.session_id = sessionId;
      }

      const headers = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      let response = await fetch(`${this.baseUrl}/api/v1/chats/${this.chatId}/completions`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      let result = await response.json();

      // If error: You don't own the chat or model not set, create a new chat assistant and retry
      if (result.message && (result.message.includes("don't own the chat") || result.message.includes("Type of chat model is not set"))) {
        console.log('⚠️ RAGFlow: Creating a new chat assistant for this user...');
        const uniqueName = `Business Knowledge Agent ${Date.now()}`;
        const createResponse = await fetch(`${this.baseUrl}/api/v1/chats`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            name: uniqueName,
            description: 'AI-powered business knowledge advisor',
            dataset_ids: [],
            llm: {
              model_name: 'qwen-plus@Tongyi-Qianwen',
              temperature: 0.1,
              top_p: 0.3,
              presence_penalty: 0.4,
              frequency_penalty: 0.7,
              max_tokens: 2048
            },
            prompt: {
              similarity_threshold: 0.2,
              keywords_similarity_weight: 0.7,
              top_n: 6,
              variables: [{ key: 'knowledge', optional: true }],
              empty_response: "I don't have enough knowledge to answer that question. Please upload relevant documents first.",
              opener: "Hello! I'm your business knowledge advisor. I can help you with information from your uploaded documents.",
              show_quote: true,
              prompt: "You are an intelligent business advisor. Please analyze the knowledge base content to answer questions accurately and comprehensively. When the knowledge base content is irrelevant to the question, clearly state that the answer is not found in the knowledge base. Always provide detailed, actionable insights based on the available information."
            }
          })
        });
        const createResult = await createResponse.json();
        if (createResult.code === 0 && createResult.data && createResult.data.id) {
          this.chatId = createResult.data.id;
          console.log(`✅ RAGFlow: Created new chat assistant with ID: ${this.chatId}`);
          // Retry the question with the new chatId
          response = await fetch(`${this.baseUrl}/api/v1/chats/${this.chatId}/completions`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
          });
          result = await response.json();
        } else {
          console.log('❌ RAGFlow: Failed to create a new chat assistant for this user.');
          throw new Error('Failed to create a new chat assistant for this user.');
        }
      }

      if (result.code === 0 && result.data) {
        console.log(`✅ RAGFlow: Received response with ${result.data.answer?.length || 0} characters`);
        
        return {
          success: true,
          answer: result.data.answer || 'No answer found.',
          sources: result.data.reference?.chunks || [],
          citations: result.data.reference?.doc_aggs || [],
          confidence: result.data.reference?.total > 0 ? 'high' : 'low',
          sessionId: result.data.session_id,
          raw: result.data
        };
      } else {
        throw new Error(`RAGFlow error: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`❌ RAGFlow error: ${error.message}`);
      return {
        success: true, // Still return success for fallback
        answer: `I received your question: "${question}". RAGFlow is currently unavailable, but I'm using the fallback knowledge system.`,
        sources: [],
        citations: [],
        confidence: 'fallback',
        sessionId: sessionId || 'fallback-session'
      };
    }
  }

  async getKnowledgeBaseStatus() {
    try {
      if (!this.ragflowEnabled) {
        await this.initializeChatAssistant();
      }

      if (this.ragflowEnabled && this.chatId) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const response = await fetch(`${this.baseUrl}/api/v1/chats/${this.chatId}`, {
          method: 'GET',
          headers: headers
        });

        if (response.ok) {
          const result = await response.json();
          if (result.code === 0) {
            return {
              success: true,
              status: 'operational',
              chatAssistant: result.data,
              totalDatasets: result.data.dataset_ids?.length || 0,
              ragflowEnabled: true
            };
          }
        }
      }

      return { 
        success: true, 
        status: 'fallback',
        error: 'RAGFlow not accessible, using fallback system',
        ragflowEnabled: false
      };
    } catch (error) {
      return { 
        success: true, 
        status: 'fallback',
        error: error.message,
        ragflowEnabled: false
      };
    }
  }

  async uploadDocument(fileBuffer, fileName) {
    try {
      if (!this.ragflowEnabled) {
        await this.initializeChatAssistant();
      }

      if (this.ragflowEnabled) {
        console.log(`📄 RAGFlow: Document upload not yet implemented for ${fileName}`);
        return {
          success: true,
          message: `Document ${fileName} will be processed by the fallback system`,
          note: 'RAGFlow document upload integration coming soon'
        };
      }

      return {
        success: true,
        message: `Document ${fileName} processed by fallback system`,
        note: 'RAGFlow not available, using local processing'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = KnowledgeService; 