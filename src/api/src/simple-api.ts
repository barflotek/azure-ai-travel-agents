import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { SmartLLMRouter } from '../../llm';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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

// Email composition endpoint
app.post('/api/email/compose', async (req, res) => {
  try {
    const { subject, recipient, content } = req.body;
    
    if (!subject || !recipient || !content) {
      return res.status(400).json({
        status: 'error',
        message: 'subject, recipient, and content are required'
      });
    }
    
    const router = new SmartLLMRouter();
    const prompt = `
You are a professional email assistant. Compose a welcome email:

Subject: ${subject}
Recipient: ${recipient}
Content: ${content}

Guidelines:
1. Be welcoming and professional
2. Include next steps
3. Offer support contact
4. Keep it concise but friendly

Write a complete email ready to send.
`;

    const response = await router.route([
      { role: 'system', content: 'You are an expert email composition assistant.' },
      { role: 'user', content: prompt }
    ], 'medium');
    
    res.json({
      status: 'success',
      agent: 'email',
      task: 'compose',
      result: {
        subject,
        recipient,
        content: response.message?.content,
        timestamp: new Date().toISOString()
      },
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

// Finance categorization endpoint
app.post('/api/finance/categorize', async (req, res) => {
  try {
    const { amount, description, date } = req.body;
    
    if (!amount || !description) {
      return res.status(400).json({
        status: 'error',
        message: 'amount and description are required'
      });
    }
    
    const router = new SmartLLMRouter();
    const prompt = `
Categorize this business expense:
- Amount: $${amount}
- Description: ${description}
- Date: ${date || 'Not specified'}

Choose from these business expense categories:
- Office Supplies
- Software/SaaS
- Marketing/Advertising
- Travel/Transportation
- Meals/Entertainment
- Equipment/Hardware
- Utilities
- Professional Services
- Training/Education
- Insurance
- Rent/Facilities
- Other

Respond with JSON containing:
- category: the category name
- subcategory: more specific classification
- taxDeductible: boolean
- notes: any relevant notes for accounting
- confidence: your confidence level (high/medium/low)
`;

    const response = await router.route([
      { role: 'system', content: 'You are a professional accounting assistant specializing in business expense categorization.' },
      { role: 'user', content: prompt }
    ], 'medium');
    
    res.json({
      status: 'success',
      agent: 'finance',
      task: 'categorize_expense',
      result: {
        amount,
        description,
        date,
        categorization: response.message?.content,
        timestamp: new Date().toISOString()
      },
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

// Social media post creation endpoint
app.post('/api/social/create-post', async (req, res) => {
  try {
    const { platform, content, topic } = req.body;
    
    if (!platform || !content) {
      return res.status(400).json({
        status: 'error',
        message: 'platform and content are required'
      });
    }
    
    const router = new SmartLLMRouter();
    const prompt = `
Create a professional social media post for ${platform}:

Topic: ${topic || 'General business'}
Content request: ${content}
Character limit: ${platform === 'twitter' ? 280 : platform === 'linkedin' ? 1300 : 2200}

Please provide:
1. Main post content (within character limit)
2. Suggested hashtags (3-5 max)
3. Call-to-action
4. Best posting time recommendation

Format as JSON with fields: content, hashtags, callToAction, bestTime
`;

    const response = await router.route([
      { role: 'system', content: `You are a social media marketing expert specializing in ${platform} content creation.` },
      { role: 'user', content: prompt }
    ], 'medium');
    
    res.json({
      status: 'success',
      agent: 'social',
      task: 'create_post',
      result: {
        platform,
        content: response.message?.content,
        topic,
        timestamp: new Date().toISOString()
      },
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

// Customer service response endpoint
app.post('/api/customer/respond', async (req, res) => {
  try {
    const { customerName, email, channel, message } = req.body;
    
    if (!customerName || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'customerName and message are required'
      });
    }
    
    const router = new SmartLLMRouter();
    const prompt = `
You are a professional customer service representative. Respond to this customer inquiry:

Customer: ${customerName}
Email: ${email || 'Not provided'}
Channel: ${channel || 'email'}
Message: "${message}"

Guidelines:
1. Be empathetic and professional
2. Address the customer by name
3. Acknowledge their concern specifically
4. Provide helpful, actionable solutions
5. Offer next steps or follow-up if needed

Response should be complete and ready to send.
`;

    const response = await router.route([
      { role: 'system', content: 'You are an expert customer service representative known for exceptional communication and problem-solving skills.' },
      { role: 'user', content: prompt }
    ], 'medium');
    
    res.json({
      status: 'success',
      agent: 'customer',
      task: 'respond_inquiry',
      result: {
        customerName,
        email,
        channel,
        originalMessage: message,
        response: response.message?.content,
        timestamp: new Date().toISOString()
      },
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

// System status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const router = new SmartLLMRouter();
    
    res.json({
      status: 'success',
      system: {
        orchestrator: 'active',
        agents: {
          email: 'active',
          finance: 'active',
          social: 'active',
          customer: 'active'
        },
        llmProviders: {
          ollama: 'configured',
          groq: 'configured'
        },
        timestamp: new Date().toISOString()
      },
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
      'POST /api/email/compose',
      'POST /api/finance/categorize',
      'POST /api/social/create-post',
      'POST /api/customer/respond'
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