import express from 'express';
import multer from 'multer';
import path from 'path';
import { KnowledgeAgent } from '../agents/knowledge/knowledge-agent';

const router = express.Router();

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
router.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/knowledge-dashboard.html'));
});

// Upload document
router.post('/upload', upload.single('document'), async (req, res) => {
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

// Ask question
router.post('/ask', async (req, res) => {
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

// Search knowledge base
router.post('/search', async (req, res) => {
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

// Get business advice
router.post('/advice', async (req, res) => {
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

// Summarize document
router.post('/summarize', async (req, res) => {
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
      documentContent: documentContent
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

// Get knowledge base status
router.get('/status', async (req, res) => {
  try {
    const userId = req.query.userId as string || 'default-user';
    const agent = new KnowledgeAgent(userId);

    const documents = await agent.getAllDocuments();
    
    res.json({
      status: 'success',
      knowledgeBase: {
        documentCount: documents.length,
        totalSize: documents.reduce((sum: number, doc: any) => sum + doc.size, 0),
        lastUpdated: documents.length > 0 ? 
          new Date(Math.max(...documents.map((doc: any) => doc.uploadDate.getTime()))) : 
          null,
        documentTypes: [...new Set(documents.map((doc: any) => doc.type))]
      }
    });

  } catch (error: any) {
    console.error('Status error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to get knowledge base status'
    });
  }
});

// Get all documents
router.get('/documents', async (req, res) => {
  try {
    const userId = req.query.userId as string || 'default-user';
    const agent = new KnowledgeAgent(userId);

    const documents = await agent.getAllDocuments();
    
    res.json({
      status: 'success',
      documents: documents
    });

  } catch (error: any) {
    console.error('Documents error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to get documents'
    });
  }
});

export default router; 