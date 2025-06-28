import express from 'express';
import multer from 'multer';
import path from 'path';
import { KnowledgeAgent } from '../agents/knowledge';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
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

// Upload PDF document
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ 
        success: false, 
        error: 'No PDF file uploaded' 
      });
      return;
    }

    const agent = getOrCreateAgent(req.body.userId);
    
    const result = await agent.processTask({
      type: 'upload_document',
      document: req.file.buffer,
      filename: req.file.originalname
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Ask a question
router.post('/ask', async (req, res) => {
  try {
    const { question, context, userId } = req.body;
    
    if (!question) {
      res.status(400).json({ 
        success: false, 
        error: 'Question is required' 
      });
      return;
    }

    const agent = getOrCreateAgent(userId);
    
    const result = await agent.processTask({
      type: 'ask_question',
      query: question,
      context
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Question error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Search knowledge base
router.post('/search', async (req, res) => {
  try {
    const { query, userId } = req.body;
    
    if (!query) {
      res.status(400).json({ 
        success: false, 
        error: 'Search query is required' 
      });
      return;
    }

    const agent = getOrCreateAgent(userId);
    
    const result = await agent.processTask({
      type: 'search_knowledge',
      query
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get business advice
router.post('/advice', async (req, res) => {
  try {
    const { situation, goal, userId } = req.body;
    
    if (!situation) {
      res.status(400).json({ 
        success: false, 
        error: 'Business situation is required' 
      });
      return;
    }

    const agent = getOrCreateAgent(userId);
    
    const result = await agent.processTask({
      type: 'get_advice',
      query: situation,
      businessGoal: goal
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Advice error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Summarize topic
router.post('/summarize', async (req, res) => {
  try {
    const { topic, userId } = req.body;
    
    if (!topic) {
      res.status(400).json({ 
        success: false, 
        error: 'Topic is required' 
      });
      return;
    }

    const agent = getOrCreateAgent(userId);
    
    const result = await agent.processTask({
      type: 'summarize_topic',
      query: topic
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Summarize error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get knowledge base status
router.get('/status/:userId?', async (req, res) => {
  try {
    const userId = req.params.userId || 'default';
    const agent = getOrCreateAgent(userId);
    
    const documents = agent.getDocuments();
    const summary = await agent.getKnowledgeSummary();
    
    res.json({
      success: true,
      documents,
      summary,
      totalDocuments: documents.length,
      totalChunks: documents.reduce((sum, doc) => sum + doc.chunkCount, 0),
      topics: [...new Set(documents.flatMap(doc => doc.topics))]
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router; 