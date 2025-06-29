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
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.openaiUrl = 'https://api.openai.com/v1/chat/completions';
    this.knowledgeBase = []; // Simple in-memory knowledge base
    this.openaiEnabled = false;
    
    // Check if OpenAI is configured
    if (this.openaiApiKey) {
      this.openaiEnabled = true;
      console.log('✅ OpenAI API key found');
    } else {
      console.log('⚠️ OpenAI API key not found, using fallback mode');
    }
  }

  async askQuestion(question, sessionId = null) {
    try {
      console.log(`🤖 Processing question: "${question}"`);
      
      // Search knowledge base for relevant context
      const relevantChunks = this.searchKnowledgeBase(question, 3);
      const context = relevantChunks.length > 0 ? 
        relevantChunks.map(chunk => chunk.content).join('\n\n') : '';
      
      if (this.openaiEnabled) {
        return await this.askWithOpenAI(question, context);
      } else {
        return this.generateFallbackResponse(question, context);
      }
    } catch (error) {
      console.error(`❌ Knowledge service error: ${error.message}`);
      return this.generateFallbackResponse(question, '');
    }
  }

  async askWithOpenAI(question, context = '') {
    try {
      console.log(`🤖 OpenAI: Asking question with ${context.length} chars of context`);
      
      const messages = [
        {
          role: "system",
          content: "You are a helpful business knowledge assistant. Answer questions based on the provided context. If the context doesn't contain relevant information, say so clearly. Be concise but helpful."
        }
      ];

      if (context) {
        messages.push({
          role: "user",
          content: `Context: ${context}\n\nQuestion: ${question}`
        });
      } else {
        messages.push({
          role: "user",
          content: question
        });
      }

      const response = await fetch(this.openaiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: messages,
          max_tokens: 1000,
          temperature: 0.1
        })
      });

      if (response.ok) {
        const result = await response.json();
        const answer = result.choices[0]?.message?.content || 'No response generated';
        
        console.log(`✅ OpenAI: Received response with ${answer.length} characters`);
        
        return {
          success: true,
          answer: answer,
          sources: context ? [{
            filename: 'knowledge_base',
            excerpt: context.substring(0, 200) + '...'
          }] : [],
          citations: [],
          confidence: context ? 'high' : 'medium',
          sessionId: `openai-${Date.now()}`,
          model: 'gpt-3.5-turbo'
        };
      } else {
        const errorData = await response.json();
        throw new Error(`OpenAI error: ${errorData.error?.message || response.statusText}`);
      }
    } catch (error) {
      console.error(`❌ OpenAI error: ${error.message}`);
      throw error;
    }
  }

  generateFallbackResponse(question, context = '') {
    if (context) {
      return {
        success: true,
        answer: `I found some relevant information in your knowledge base:\n\n${context.substring(0, 300)}...\n\n[Note: This is a basic response. Configure OpenAI API key for better AI responses.]`,
        sources: [{
          filename: 'knowledge_base',
          excerpt: context.substring(0, 200) + '...'
        }],
        citations: [],
        confidence: 'low',
        sessionId: `fallback-${Date.now()}`
      };
    } else {
      return {
        success: true,
        answer: `I received your question: "${question}". I don't have any relevant information in my knowledge base yet. Please upload some documents first, and configure your OpenAI API key for better AI responses.`,
        sources: [],
        citations: [],
        confidence: 'none',
        sessionId: `fallback-${Date.now()}`
      };
    }
  }

  searchKnowledgeBase(query, limit = 5) {
    if (this.knowledgeBase.length === 0) {
      return [];
    }

    const queryWords = query.toLowerCase().split(/\W+/);
    
    const scored = this.knowledgeBase.map(chunk => {
      const chunkWords = chunk.content.toLowerCase().split(/\W+/);
      let score = 0;
      
      queryWords.forEach(word => {
        const matches = chunkWords.filter(w => w.includes(word) || word.includes(w));
        score += matches.length;
      });
      
      return { chunk, score };
    });
    
    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.chunk);
  }

  addToKnowledgeBase(content, filename = 'uploaded-document') {
    const chunk = {
      id: `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: content,
      filename: filename,
      uploadedAt: new Date().toISOString()
    };
    
    this.knowledgeBase.push(chunk);
    console.log(`✅ Added chunk to knowledge base: ${chunk.id}`);
    return chunk;
  }

  async getKnowledgeBaseStatus() {
    return {
      success: true,
      status: this.openaiEnabled ? 'operational' : 'fallback',
      error: this.openaiEnabled ? 'Using OpenAI for AI responses' : 'OpenAI not configured, using fallback system',
      openaiEnabled: this.openaiEnabled,
      localKnowledgeBase: {
        totalChunks: this.knowledgeBase.length,
        documents: this.knowledgeBase.map(chunk => chunk.filename).filter((v, i, a) => a.indexOf(v) === i)
      }
    };
  }

  async uploadDocument(fileBuffer, fileName) {
    try {
      console.log(`📄 Processing document: ${fileName}`);
      
      // Convert buffer to text (assuming it's a text file or PDF)
      let text = '';
      try {
        // Try to parse as PDF first
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(fileBuffer);
        text = pdfData.text;
      } catch (error) {
        // If not PDF, try as text
        text = fileBuffer.toString('utf8');
      }
      
      if (!text || text.trim().length < 50) {
        return {
          success: false,
          error: 'Document appears to be empty or unreadable'
        };
      }
      
      // Split text into chunks
      const chunks = this.chunkText(text);
      
      // Add chunks to knowledge base
      chunks.forEach((chunk, index) => {
        this.addToKnowledgeBase(chunk, `${fileName}_chunk_${index}`);
      });
      
      console.log(`✅ Successfully processed ${fileName}: ${chunks.length} chunks added to knowledge base`);
      
      return {
        success: true,
        message: `Successfully processed ${fileName}`,
        chunksAdded: chunks.length,
        totalChunks: this.knowledgeBase.length,
        note: this.openaiEnabled ? 'Document added to knowledge base for OpenAI queries' : 'Document added to knowledge base'
      };
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  chunkText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end);
      
      // Try to break at sentence boundaries
      const lastSentence = chunk.lastIndexOf('.');
      const finalChunk = lastSentence > start + chunkSize * 0.5 ? 
        chunk.slice(0, lastSentence + 1) : chunk;
      
      if (finalChunk.trim().length > 50) {
        chunks.push(finalChunk.trim());
      }
      
      start += chunkSize - overlap;
    }
    
    return chunks;
  }
}

module.exports = KnowledgeService; 