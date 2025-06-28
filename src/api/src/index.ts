import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { 
  EmailAgent, 
  FinanceAgent, 
  SocialAgent, 
  CustomerAgent, 
  KnowledgeAgent,
  BusinessAgentOrchestrator 
} from '../../agents';
import { SmartLLMRouter } from '../../llm';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept PDF, TXT, DOC, DOCX files
    if (file.mimetype === 'application/pdf' ||
        file.mimetype === 'text/plain' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, TXT, DOC, DOCX files are allowed.'));
    }
  }
});

// Store knowledge agents per user (in production, use proper session management)
const knowledgeAgents = new Map<string, KnowledgeAgent>();

function getOrCreateAgent(userId: string = 'default'): KnowledgeAgent {
  if (!knowledgeAgents.has(userId)) {
    knowledgeAgents.set(userId, new KnowledgeAgent(userId));
  }
  return knowledgeAgents.get(userId)!;
}

// Serve knowledge dashboard
app.get('/knowledge', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/knowledge-dashboard.html'));
});

// Knowledge routes
app.get('/api/knowledge/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../../../public/knowledge-dashboard.html'));
});

app.post('/api/knowledge/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({
        status: 'error',
        message: 'No file uploaded'
      });
      return;
    }

    const userId = req.body.userId || 'default-user';
    const agent = new KnowledgeAgent(userId);

    // Convert file buffer to text (simplified - in production, use proper PDF parsing)
    const documentContent = req.file.buffer.toString('utf-8');
    
    const result = await agent.processTask({
      type: 'upload_document',
      content: req.file.originalname,
      documentType: req.file.mimetype === 'application/pdf' ? 'pdf' : 
                   req.file.mimetype === 'text/plain' ? 'txt' : 'doc',
      documentContent: documentContent
    });

    res.json({
      status: 'success',
      message: 'Document uploaded successfully',
      document: result
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to upload document'
    });
  }
});

app.post('/api/knowledge/ask', async (req, res) => {
  try {
    const { userId, question } = req.body;

    if (!question) {
      res.status(400).json({
        status: 'error',
        message: 'Question is required'
      });
      return;
    }

    const agent = new KnowledgeAgent(userId || 'default-user');
    
    const result = await agent.processTask({
      type: 'ask_question',
      question: question
    });

    res.json({
      status: 'success',
      answer: result
    });

  } catch (error: any) {
    console.error('Question error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to process question'
    });
  }
});

app.post('/api/knowledge/search', async (req, res) => {
  try {
    const { userId, searchQuery } = req.body;

    if (!searchQuery) {
      res.status(400).json({
        status: 'error',
        message: 'Search query is required'
      });
      return;
    }

    const agent = new KnowledgeAgent(userId || 'default-user');
    
    const result = await agent.processTask({
      type: 'search',
      searchQuery: searchQuery
    });

    res.json({
      status: 'success',
      results: result
    });

  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to search knowledge base'
    });
  }
});

app.post('/api/knowledge/advice', async (req, res) => {
  try {
    const { userId, situation, context } = req.body;

    if (!situation) {
      res.status(400).json({
        status: 'error',
        message: 'Business situation is required'
      });
      return;
    }

    const agent = new KnowledgeAgent(userId || 'default-user');
    
    const result = await agent.processTask({
      type: 'get_advice',
      question: situation,
      context: context
    });

    res.json({
      status: 'success',
      advice: result
    });

  } catch (error: any) {
    console.error('Advice error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to generate advice'
    });
  }
});

app.post('/api/knowledge/summarize', async (req, res) => {
  try {
    const { userId, documentContent } = req.body;

    if (!documentContent) {
      res.status(400).json({
        status: 'error',
        message: 'Document content is required'
      });
      return;
    }

    const agent = new KnowledgeAgent(userId || 'default-user');
    
    const result = await agent.processTask({
      type: 'summarize_document',
      content: documentContent
    });

    res.json({
      status: 'success',
      summary: result
    });

  } catch (error: any) {
    console.error('Summarize error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to summarize document'
    });
  }
});

// Test knowledge route
app.get('/api/knowledge/test', (req, res) => {
  res.json({ 
    status: 'success', 
    message: 'Knowledge routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Business Agent System',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Health check for Railway
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Business Agent System',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to verify system functionality
app.get('/test', async (req, res) => {
  try {
    const router = new SmartLLMRouter();
    
    const response = await router.route([
      { role: 'user', content: 'Hello, how are you?' }
    ], 'simple');
    
    res.json({
      status: 'success',
      message: 'Business Agent System is working!',
      llmResponse: (response.message?.content as string)?.substring(0, 100) + '...',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'System test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Individual agent endpoints
app.post('/api/email', async (req, res) => {
  try {
    const { userId, task } = req.body;
    
    if (!userId || !task) {
      return res.status(400).json({
        status: 'error',
        message: 'userId and task are required'
      });
    }
    
    const emailAgent = new EmailAgent(userId);
    const result = await emailAgent.processTask(task);
    
    res.json({
      status: 'success',
      agent: 'email',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      agent: 'email',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/finance', async (req, res) => {
  try {
    const { userId, task } = req.body;
    
    if (!userId || !task) {
      return res.status(400).json({
        status: 'error',
        message: 'userId and task are required'
      });
    }
    
    const financeAgent = new FinanceAgent(userId);
    const result = await financeAgent.processTask(task);
    
    res.json({
      status: 'success',
      agent: 'finance',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      agent: 'finance',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/social', async (req, res) => {
  try {
    const { userId, task } = req.body;
    
    if (!userId || !task) {
      return res.status(400).json({
        status: 'error',
        message: 'userId and task are required'
      });
    }
    
    const socialAgent = new SocialAgent(userId);
    const result = await socialAgent.processTask(task);
    
    res.json({
      status: 'success',
      agent: 'social',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      agent: 'social',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/customer', async (req, res) => {
  try {
    const { userId, task } = req.body;
    
    if (!userId || !task) {
      return res.status(400).json({
        status: 'error',
        message: 'userId and task are required'
      });
    }
    
    const customerAgent = new CustomerAgent(userId);
    const result = await customerAgent.processTask(task);
    
    res.json({
      status: 'success',
      agent: 'customer',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      agent: 'customer',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/knowledge', async (req, res) => {
  try {
    const { userId, task } = req.body;
    
    if (!userId || !task) {
      return res.status(400).json({
        status: 'error',
        message: 'userId and task are required'
      });
    }
    
    const knowledgeAgent = new KnowledgeAgent(userId);
    const result = await knowledgeAgent.processTask(task);
    
    res.json({
      status: 'success',
      agent: 'knowledge',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      agent: 'knowledge',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Orchestrator endpoint for multi-agent tasks
app.post('/api/orchestrator', async (req, res) => {
  try {
    const { userId, task } = req.body;
    
    if (!userId || !task) {
      return res.status(400).json({
        status: 'error',
        message: 'userId and task are required'
      });
    }
    
    const orchestrator = new BusinessAgentOrchestrator(userId);
    const result = await orchestrator.processBusinessTask(task);
    
    res.json({
      status: 'success',
      agent: 'orchestrator',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      agent: 'orchestrator',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// System status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const orchestrator = new BusinessAgentOrchestrator('system');
    const status = await orchestrator.getAgentStatus();
    
    res.json({
      status: 'success',
      system: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Quick test endpoints for common scenarios
app.post('/api/quick/email-compose', async (req, res) => {
  try {
    const { userId, subject, recipient, content } = req.body;
    
    if (!userId || !subject || !recipient || !content) {
      return res.status(400).json({
        status: 'error',
        message: 'userId, subject, recipient, and content are required'
      });
    }
    
    const emailAgent = new EmailAgent(userId);
    const result = await emailAgent.processTask({
      type: 'compose',
      subject,
      recipient,
      content
    });
    
    res.json({
      status: 'success',
      agent: 'email',
      task: 'compose',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/quick/customer-complaint', async (req, res) => {
  try {
    const { userId, customerData } = req.body;
    
    if (!userId || !customerData) {
      return res.status(400).json({
        status: 'error',
        message: 'userId and customerData are required'
      });
    }
    
    const orchestrator = new BusinessAgentOrchestrator(userId);
    const result = await orchestrator.handleCustomerComplaint(customerData);
    
    res.json({
      status: 'success',
      agent: 'orchestrator',
      task: 'customer_complaint',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found',
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /test',
      'GET /api/status',
      'POST /api/email',
      'POST /api/finance',
      'POST /api/social',
      'POST /api/customer',
      'POST /api/orchestrator',
      'POST /api/quick/email-compose',
      'POST /api/quick/customer-complaint'
    ],
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Business Agent System API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`📋 API status: http://localhost:${PORT}/api/status`);
});

export default app;
