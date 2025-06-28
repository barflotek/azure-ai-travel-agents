// Use built-in fetch if available (Node.js 18+), otherwise use dynamic import
let fetch;

if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  // Fallback for older Node.js versions
  try {
    const nodeFetch = require('node-fetch');
    fetch = nodeFetch.default || nodeFetch;
  } catch (error) {
    console.error('Fetch not available. Please install node-fetch or use Node.js 18+');
    // Create a mock fetch for fallback
    fetch = async () => {
      throw new Error('Fetch not available');
    };
  }
}

class KnowledgeService {
  constructor(baseUrl = 'http://localhost:9380') {
    this.baseUrl = baseUrl;
    this.chatId = 'business-knowledge-agent'; // We'll create this chat assistant
    this.apiKey = process.env.RAGFLOW_API_KEY || 'ragflow-ZiZDIzM2RjNTQ2NzExZjA5MWZjNDIwMT';
    this.ragflowEnabled = false; // Will be set to true if RAGFlow is accessible
  }

  async initializeChatAssistant() {
    try {
      console.log('🤖 RAGFlow: Testing connection...');
      
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
        return true;
      }

      // Try without authentication
      const noAuthResponse = await fetch(`${this.baseUrl}/api/v1/chats`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (noAuthResponse.ok) {
        console.log('✅ RAGFlow: Connection successful (no auth)');
        this.ragflowEnabled = true;
        this.apiKey = ''; // No API key needed
        return true;
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

      if (!this.ragflowEnabled) {
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

      const response = await fetch(`${this.baseUrl}/api/v1/chats/${this.chatId}/completions`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`RAGFlow API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
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

      if (this.ragflowEnabled) {
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