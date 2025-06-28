const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const path = require('path');
const fs = require('fs');
const KnowledgeService = require('./ragflow-knowledge');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize RAGFlow knowledge service
const knowledgeService = new KnowledgeService();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Simple in-memory storage (replace with database later)
let knowledgeBase = [];
let documents = [];

// Multer setup for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files allowed'), false);
    }
  }
});

// Helper functions
function chunkText(text, chunkSize = 1000, overlap = 200) {
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

function simpleSearch(query, chunks, limit = 5) {
  const queryWords = query.toLowerCase().split(/\W+/);
  
  const scored = chunks.map(chunk => {
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

async function generateResponse(prompt) {
  // Simple response generation (replace with actual LLM API)
  const responses = {
    greeting: "Hello! I'm your business knowledge advisor. I can help you with information from your uploaded documents.",
    noKnowledge: "I don't have enough knowledge to answer that question. Please upload relevant documents first.",
    default: "Based on the available knowledge, here's what I can tell you about your question."
  };
  
  if (knowledgeBase.length === 0) {
    return responses.noKnowledge;
  }
  
  return responses.default + " Please implement actual LLM integration for better responses.";
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    knowledgeBase: {
      documents: documents.length,
      chunks: knowledgeBase.length
    }
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    status: 'success',
    message: 'Business Knowledge Agent API',
    version: '1.0.0',
    endpoints: [
      'GET /',
      'GET /health',
      'GET /api',
      'GET /knowledge',
      'POST /api/knowledge/upload',
      'POST /api/knowledge/ask',
      'POST /api/knowledge/search',
      'GET /api/knowledge/status'
    ],
    knowledgeBase: {
      documents: documents.length,
      chunks: knowledgeBase.length
    }
  });
});

// Knowledge base endpoints - NOW USING RAGFLOW!
app.post('/api/knowledge/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No PDF file uploaded'
      });
    }

    console.log(`📄 Processing PDF: ${req.file.originalname}`);
    
    // For now, keep the old system for upload tracking
    // In the future, we can integrate with RAGFlow's upload API
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text;
    
    if (!text || text.trim().length < 100) {
      return res.status(400).json({
        success: false,
        error: 'PDF appears to be empty or unreadable'
      });
    }
    
    // Create chunks
    const textChunks = chunkText(text);
    const documentId = `doc_${Date.now()}`;
    
    // Store chunks in knowledge base
    const chunks = textChunks.map((chunk, index) => ({
      id: `${documentId}_chunk_${index}`,
      content: chunk,
      filename: req.file.originalname,
      documentId,
      chunkIndex: index,
      uploadedAt: new Date().toISOString()
    }));
    
    knowledgeBase.push(...chunks);
    
    // Store document metadata
    const document = {
      id: documentId,
      filename: req.file.originalname,
      size: req.file.size,
      chunkCount: chunks.length,
      uploadedAt: new Date().toISOString(),
      summary: `Document with ${chunks.length} knowledge chunks`
    };
    
    documents.push(document);
    
    console.log(`✅ Successfully processed ${req.file.originalname}: ${chunks.length} chunks`);
    
    res.json({
      success: true,
      message: `Successfully processed ${req.file.originalname}`,
      document,
      chunkCount: chunks.length,
      totalChunks: knowledgeBase.length
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to process PDF: ${error.message}`
    });
  }
});

app.post('/api/knowledge/ask', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required'
      });
    }
    
    console.log(`🤖 Knowledge Agent: Processing question: "${question}"`);
    
    // Use RAGFlow for intelligent answers
    const result = await knowledgeService.askQuestion(question);
    
    if (result.success) {
      res.json({
        success: true,
        answer: result.answer,
        sources: result.sources,
        citations: result.citations,
        confidence: result.confidence,
        foundChunks: result.sources?.length || 0
      });
    } else {
      // Fallback to old system if RAGFlow fails
      if (knowledgeBase.length === 0) {
        return res.json({
          success: true,
          answer: "I don't have any knowledge yet. Please upload some PDF documents first so I can help answer your questions.",
          sources: [],
          confidence: 'none'
        });
      }
      
      // Search for relevant chunks
      const relevantChunks = simpleSearch(question, knowledgeBase, 5);
      
      if (relevantChunks.length === 0) {
        return res.json({
          success: true,
          answer: "I couldn't find relevant information in the uploaded documents to answer your question.",
          sources: [],
          confidence: 'low'
        });
      }
      
      // Generate response (placeholder - integrate with actual LLM)
      const context = relevantChunks.map(chunk => chunk.content).join('\n\n');
      const answer = `Based on your uploaded documents, here's what I found:\n\n${context.substring(0, 500)}...\n\n[Note: This is a basic response. RAGFlow integration is being set up.]`;
      
      res.json({
        success: true,
        answer,
        sources: relevantChunks.map(chunk => ({
          filename: chunk.filename,
          excerpt: chunk.content.substring(0, 100) + '...'
        })),
        confidence: relevantChunks.length >= 3 ? 'high' : 'medium',
        foundChunks: relevantChunks.length
      });
    }
    
  } catch (error) {
    console.error('Ask error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/knowledge/search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    const results = simpleSearch(query, knowledgeBase, 10);
    
    res.json({
      success: true,
      query,
      results: results.map(chunk => ({
        filename: chunk.filename,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        relevanceScore: Math.random() * 0.5 + 0.5 // Placeholder scoring
      })),
      totalResults: results.length
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/knowledge/status', async (req, res) => {
  try {
    // Try to get RAGFlow status first
    const ragflowStatus = await knowledgeService.getKnowledgeBaseStatus();
    
    if (ragflowStatus.success) {
      res.json({
        success: true,
        status: 'operational',
        knowledgeBase: {
          totalDocuments: ragflowStatus.totalDocuments,
          totalChunks: knowledgeBase.length, // Keep old system count for now
          documents: documents.map(doc => ({
            filename: doc.filename,
            chunkCount: doc.chunkCount,
            uploadedAt: doc.uploadedAt
          })),
          ragflowStatus: ragflowStatus.status
        }
      });
    } else {
      // Fallback to old system
      res.json({
        success: true,
        status: 'operational',
        knowledgeBase: {
          totalDocuments: documents.length,
          totalChunks: knowledgeBase.length,
          documents: documents.map(doc => ({
            filename: doc.filename,
            chunkCount: doc.chunkCount,
            uploadedAt: doc.uploadedAt
          })),
          ragflowStatus: 'fallback'
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/knowledge/documents', (req, res) => {
  res.json({
    success: true,
    documents: documents
  });
});

// Agent endpoints for chat interface
app.post('/api/email', async (req, res) => {
  try {
    const { userId, task } = req.body;
    
    // Simple email agent response
    const response = `📧 Email Agent: I can help you with "${task}". Here's what I can do:
    
• Compose professional emails
• Draft email templates
• Manage email campaigns
• Set up email automation
• Analyze email performance

Would you like me to help you compose an email or set up email management?`;
    
    res.json({
      status: 'success',
      agent: 'email',
      result: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      agent: 'email',
      message: error.message || 'Email agent error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/finance', async (req, res) => {
  try {
    const { userId, task } = req.body;
    
    // Simple finance agent response
    const response = `💰 Finance Agent: I can help you with "${task}". Here's what I can do:
    
• Generate financial reports
• Analyze expenses and revenue
• Create budgets and forecasts
• Track financial metrics
• Provide financial insights
• Manage invoices and payments

Would you like me to generate a financial report or analyze your data?`;
    
    res.json({
      status: 'success',
      agent: 'finance',
      result: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      agent: 'finance',
      message: error.message || 'Finance agent error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/social', async (req, res) => {
  try {
    const { userId, task } = req.body;
    
    // Simple social agent response
    const response = `📱 Social Agent: I can help you with "${task}". Here's what I can do:
    
• Create engaging social media posts
• Schedule content across platforms
• Analyze social media performance
• Generate hashtag strategies
• Monitor brand mentions
• Create social media campaigns

Would you like me to create a social media post or analyze your social performance?`;
    
    res.json({
      status: 'success',
      agent: 'social',
      result: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      agent: 'social',
      message: error.message || 'Social agent error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/customer', async (req, res) => {
  try {
    const { userId, task } = req.body;
    
    // Simple customer agent response
    const response = `🎧 Customer Agent: I can help you with "${task}". Here's what I can do:
    
• Handle customer inquiries
• Manage support tickets
• Provide customer service
• Create FAQ responses
• Analyze customer feedback
• Improve customer experience

Would you like me to help with customer support or create a response template?`;
    
    res.json({
      status: 'success',
      agent: 'customer',
      result: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      agent: 'customer',
      message: error.message || 'Customer agent error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/orchestrator', async (req, res) => {
  try {
    const { userId, task } = req.body;
    
    // Simple orchestrator response
    const response = `🎯 Orchestrator: I can coordinate multiple agents for "${task}". Here's what I can do:
    
• Coordinate multiple agents for complex tasks
• Create automated workflows
• Manage task dependencies
• Optimize agent collaboration
• Monitor multi-agent processes
• Generate comprehensive reports

Would you like me to coordinate multiple agents for your task?`;
    
    res.json({
      status: 'success',
      agent: 'orchestrator',
      result: response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      agent: 'orchestrator',
      message: error.message || 'Orchestrator error',
      timestamp: new Date().toISOString()
    });
  }
});

// Serve knowledge dashboard
app.get('/knowledge', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'knowledge-dashboard.html'));
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Business Knowledge Agent API',
    status: 'running',
    dashboards: {
      knowledge: '/knowledge',
      api: '/api'
    }
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api',
      'GET /knowledge',
      'POST /api/knowledge/upload',
      'POST /api/knowledge/ask',
      'POST /api/knowledge/search',
      'GET /api/knowledge/status'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Business Knowledge Agent running on port ${PORT}`);
  console.log(`📊 API Info: http://localhost:${PORT}/api`);
  console.log(`📚 Knowledge Dashboard: http://localhost:${PORT}/knowledge`);
  console.log(`💡 Health Check: http://localhost:${PORT}/health`);
});

module.exports = app; 