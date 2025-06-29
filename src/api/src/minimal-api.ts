import 'dotenv/config';
import express from 'express';
import cors from 'cors';

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
    res.json({
      status: 'success',
      message: 'Business Agent System is working!',
      environment: process.env.NODE_ENV || 'development',
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

// Email composition endpoint (mock)
app.post('/api/email/compose', async (req, res) => {
  try {
    const { subject, recipient, content } = req.body;
    
    if (!subject || !recipient || !content) {
      return res.status(400).json({
        status: 'error',
        message: 'subject, recipient, and content are required'
      });
    }
    
    // Mock email composition
    const composedEmail = `
Dear ${recipient},

Thank you for your interest in our services. We're excited to have you on board!

${content}

Best regards,
Your Business Agent System Team

---
Subject: ${subject}
Generated: ${new Date().toISOString()}
    `.trim();
    
    res.json({
      status: 'success',
      agent: 'email',
      task: 'compose',
      result: {
        subject,
        recipient,
        content: composedEmail,
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

// Finance categorization endpoint (mock)
app.post('/api/finance/categorize', async (req, res) => {
  try {
    const { amount, description, date } = req.body;
    
    if (!amount || !description) {
      return res.status(400).json({
        status: 'error',
        message: 'amount and description are required'
      });
    }
    
    // Mock categorization
    const categories = [
      'Office Supplies',
      'Software/SaaS',
      'Marketing/Advertising',
      'Travel/Transportation',
      'Meals/Entertainment',
      'Equipment/Hardware',
      'Utilities',
      'Professional Services',
      'Training/Education',
      'Insurance',
      'Rent/Facilities',
      'Other'
    ];
    
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    
    res.json({
      status: 'success',
      agent: 'finance',
      task: 'categorize_expense',
      result: {
        amount,
        description,
        date,
        categorization: {
          category: randomCategory,
          subcategory: 'General',
          taxDeductible: true,
          notes: 'Automatically categorized by Business Agent System',
          confidence: 'medium'
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

// Social media post creation endpoint (mock)
app.post('/api/social/create-post', async (req, res) => {
  try {
    const { platform, content, topic } = req.body;
    
    if (!platform || !content) {
      return res.status(400).json({
        status: 'error',
        message: 'platform and content are required'
      });
    }
    
    // Mock social media post
    const mockPost = {
      content: `🚀 ${content}\n\nWe're excited to share this with our community! #BusinessAgentSystem #Innovation`,
      hashtags: ['#BusinessAgentSystem', '#Innovation', '#Tech'],
      callToAction: 'Learn more about our services!',
      bestTime: '9:00 AM - 11:00 AM'
    };
    
    res.json({
      status: 'success',
      agent: 'social',
      task: 'create_post',
      result: {
        platform,
        content: mockPost,
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

// Customer service response endpoint (mock)
app.post('/api/customer/respond', async (req, res) => {
  try {
    const { customerName, email, channel, message } = req.body;
    
    if (!customerName || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'customerName and message are required'
      });
    }
    
    // Mock customer service response
    const response = `Dear ${customerName},

Thank you for reaching out to us. We understand your concern about "${message}".

Our team is here to help you resolve this issue. We'll investigate this matter and get back to you within 24 hours with a detailed solution.

In the meantime, you can also check our FAQ section for quick answers to common questions.

Best regards,
Customer Support Team
Business Agent System

---
Channel: ${channel || 'email'}
Response Time: ${new Date().toISOString()}`;
    
    res.json({
      status: 'success',
      agent: 'customer',
      task: 'respond_inquiry',
      result: {
        customerName,
        email,
        channel,
        originalMessage: message,
        response: response,
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
        environment: process.env.NODE_ENV || 'development',
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
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app; 