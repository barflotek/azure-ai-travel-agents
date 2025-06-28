import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import gmailAuthRoutes from './src/api/routes/gmail-auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the frontend at root
app.get('/', (req, res) => {
  const mainPage = `
    <div style="text-align: center; padding: 50px;">
      <h1>🤖 Business Agent System</h1>
      <div style="margin: 30px;">
        <a href="/email-dashboard" style="display: inline-block; margin: 10px; padding: 15px 30px; background: #3B82F6; color: white; text-decoration: none; border-radius: 8px;">
          📧 Advanced Email Management
        </a>
        <a href="/index.html" style="display: inline-block; margin: 10px; padding: 15px 30px; background: #10B981; color: white; text-decoration: none; border-radius: 8px;">
          🎯 Agent Dashboard
        </a>
      </div>
    </div>
  `;
  res.send(mainPage);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Business Agent System',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to verify system functionality
app.get('/test', (req, res) => {
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
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Gmail Authentication Routes
app.use('/api', gmailAuthRoutes);

// Gmail-specific endpoints
app.post('/api/gmail/check-emails', async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({
        status: 'error',
        message: 'Gmail access token required'
      });
    }

    // Import and use Email Agent with Gmail
    const { EmailAgent } = await import('./src/agents/email/email-agent.ts');
    const emailAgent = new EmailAgent('gmail-user');
    emailAgent.setGmailAccess(accessToken);
    
    const result = await emailAgent.checkEmails();
    
    res.json({
      status: 'success',
      agent: 'email',
      task: 'check_emails',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Gmail check emails error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to check emails',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/gmail/send-email', async (req, res) => {
  try {
    const { accessToken, to, subject, content } = req.body;
    
    if (!accessToken || !to || !subject || !content) {
      return res.status(400).json({
        status: 'error',
        message: 'accessToken, to, subject, and content are required'
      });
    }

    // Import and use Email Agent with Gmail
    const { EmailAgent } = await import('./src/agents/email/email-agent.ts');
    const emailAgent = new EmailAgent('gmail-user');
    emailAgent.setGmailAccess(accessToken);
    
    const result = await emailAgent.sendRealEmail({
      type: 'send_real_email',
      recipient: to,
      subject,
      content
    });
    
    res.json({
      status: 'success',
      agent: 'email',
      task: 'send_real_email',
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Gmail send email error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to send email',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/gmail/search-emails', async (req, res) => {
  try {
    const { accessToken, query } = req.body;
    
    if (!accessToken || !query) {
      return res.status(400).json({
        status: 'error',
        message: 'accessToken and query are required'
      });
    }

    // Import and use Email Agent with Gmail
    const { EmailAgent } = await import('./src/agents/email/email-agent.ts');
    const emailAgent = new EmailAgent('gmail-user');
    emailAgent.setGmailAccess(accessToken);
    
    const result = await emailAgent.searchEmails(query);
    
    res.json({
      status: 'success',
      agent: 'email',
      task: 'search_emails',
      result: {
        query,
        emails: result,
        count: result.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Gmail search emails error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to search emails',
      timestamp: new Date().toISOString()
    });
  }
});

// Email composition endpoint (mock)
app.post('/api/email/compose', (req, res) => {
  try {
    const { subject, recipient, content } = req.body;
    
    if (!subject || !recipient || !content) {
      return res.status(400).json({
        status: 'error',
        message: 'subject, recipient, and content are required'
      });
    }
    
    // Mock email composition
    const composedEmail = `Dear ${recipient},

Thank you for your interest in our services. We're excited to have you on board!

${content}

Best regards,
Your Business Agent System Team

---
Subject: ${subject}
Generated: ${new Date().toISOString()}`;
    
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
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Finance categorization endpoint (mock)
app.post('/api/finance/categorize', (req, res) => {
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
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Social media post creation endpoint (mock)
app.post('/api/social/create-post', (req, res) => {
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
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Customer service response endpoint (mock)
app.post('/api/customer/respond', (req, res) => {
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
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// System status endpoint
app.get('/api/status', (req, res) => {
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
        integrations: {
          gmail: process.env.GMAIL_CLIENT_ID ? 'configured' : 'not_configured'
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
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced Chat endpoint with Gmail support
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId = 'default-session', gmailAccessToken } = req.body;
    
    if (!message) {
      return res.status(400).json({
        status: 'error',
        message: 'message is required'
      });
    }

    // Import the Main Conversational Agent
    const { MainConversationalAgent } = await import('./src/agents/conversational/main-agent.js');
    const conversationalAgent = new MainConversationalAgent();
    
    // Set Gmail access if provided
    if (gmailAccessToken) {
      const { EmailAgent } = await import('./src/agents/email/email-agent.ts');
      const emailAgent = new EmailAgent(sessionId);
      emailAgent.setGmailAccess(gmailAccessToken);
      conversationalAgent.setEmailAgent(emailAgent);
    }
    
    // Process the message
    const response = await conversationalAgent.processMessage(sessionId, message);
    
    res.json({
      status: 'success',
      sessionId,
      response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get conversation history
app.get('/api/chat/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { MainConversationalAgent } = await import('./src/agents/conversational/main-agent.js');
    const conversationalAgent = new MainConversationalAgent();
    
    const history = conversationalAgent.getConversationHistory(sessionId);
    
    res.json({
      status: 'success',
      sessionId,
      history,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Clear conversation history
app.delete('/api/chat/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { MainConversationalAgent } = await import('./src/agents/conversational/main-agent.js');
    const conversationalAgent = new MainConversationalAgent();
    
    conversationalAgent.clearConversation(sessionId);
    
    res.json({
      status: 'success',
      message: 'Conversation history cleared',
      sessionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Clear chat history error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Serve the advanced email dashboard
app.get('/email-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/email-dashboard.html'));
});

// Advanced Gmail API routes
app.post('/api/gmail/bulk-action', async (req, res) => {
  try {
    const { accessToken, emailIds, action } = req.body;
    
    if (!accessToken || !emailIds || !action) {
      return res.json({ status: 'error', message: 'Missing required parameters' });
    }

    const emailAgent = new EmailAgent('user-1');
    emailAgent.setGmailAccess(accessToken);
    
    const result = await emailAgent.performBulkAction(emailIds, action);
    
    res.json({ status: 'success', result });
  } catch (error) {
    console.error('Bulk action error:', error);
    res.json({ status: 'error', message: error.message });
  }
});

app.post('/api/gmail/ai-suggestions', async (req, res) => {
  try {
    const { accessToken, emails } = req.body;
    
    if (!accessToken || !emails) {
      return res.json({ status: 'error', message: 'Missing required parameters' });
    }

    const emailAgent = new EmailAgent('user-1');
    emailAgent.setGmailAccess(accessToken);
    
    const suggestions = emailAgent.generateAISuggestions(emails);
    
    res.json({ status: 'success', suggestions });
  } catch (error) {
    console.error('AI suggestions error:', error);
    res.json({ status: 'error', message: error.message });
  }
});

app.post('/api/gmail/ai-reply', async (req, res) => {
  try {
    const { accessToken, emailId, replyType = 'quick' } = req.body;
    
    if (!accessToken || !emailId) {
      return res.json({ status: 'error', message: 'Missing required parameters' });
    }

    const emailAgent = new EmailAgent('user-1');
    emailAgent.setGmailAccess(accessToken);
    
    const reply = await emailAgent.generateAIReply(emailId, replyType);
    
    res.json({ status: 'success', reply });
  } catch (error) {
    console.error('AI reply error:', error);
    res.json({ status: 'error', message: error.message });
  }
});

app.post('/api/gmail/analytics', async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.json({ status: 'error', message: 'Missing access token' });
    }

    const emailAgent = new EmailAgent('user-1');
    emailAgent.setGmailAccess(accessToken);
    
    const analytics = await emailAgent.getEmailAnalytics();
    
    res.json({ status: 'success', analytics });
  } catch (error) {
    console.error('Analytics error:', error);
    res.json({ status: 'error', message: error.message });
  }
});

app.post('/api/gmail/mark-read', async (req, res) => {
  try {
    const { accessToken, emailId } = req.body;
    
    if (!accessToken || !emailId) {
      return res.json({ status: 'error', message: 'Missing required parameters' });
    }

    const emailAgent = new EmailAgent('user-1');
    emailAgent.setGmailAccess(accessToken);
    
    const success = await emailAgent.markEmailAsRead(emailId);
    
    res.json({ status: success ? 'success' : 'error', message: success ? 'Email marked as read' : 'Failed to mark email as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.json({ status: 'error', message: error.message });
  }
});

app.post('/api/gmail/delete-email', async (req, res) => {
  try {
    const { accessToken, emailId } = req.body;
    
    if (!accessToken || !emailId) {
      return res.json({ status: 'error', message: 'Missing required parameters' });
    }

    const emailAgent = new EmailAgent('user-1');
    emailAgent.setGmailAccess(accessToken);
    
    const success = await emailAgent.deleteEmail(emailId);
    
    res.json({ status: success ? 'success' : 'error', message: success ? 'Email deleted' : 'Failed to delete email' });
  } catch (error) {
    console.error('Delete email error:', error);
    res.json({ status: 'error', message: error.message });
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
      'GET /api/auth/gmail',
      'GET /api/auth/gmail/callback',
      'POST /api/auth/gmail/refresh',
      'GET /api/auth/gmail/status',
      'POST /api/auth/gmail/revoke',
      'POST /api/gmail/check-emails',
      'POST /api/gmail/send-email',
      'POST /api/gmail/search-emails',
      'POST /api/email/compose',
      'POST /api/finance/categorize',
      'POST /api/social/create-post',
      'POST /api/customer/respond',
      'POST /api/chat',
      'GET /api/chat/history/:sessionId',
      'DELETE /api/chat/history/:sessionId',
      'GET /email-dashboard',
      'POST /api/gmail/bulk-action',
      'POST /api/gmail/ai-suggestions',
      'POST /api/gmail/ai-reply',
      'POST /api/gmail/analytics',
      'POST /api/gmail/mark-read',
      'POST /api/gmail/delete-email'
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
  console.log(`📧 Gmail auth: http://localhost:${PORT}/api/auth/gmail`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app; 