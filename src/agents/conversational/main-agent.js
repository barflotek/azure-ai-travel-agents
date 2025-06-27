// Simple JavaScript version of Main Conversational Agent
export class MainConversationalAgent {
  constructor() {
    this.conversations = new Map();
  }

  async processMessage(sessionId, userMessage) {
    // Get or create conversation context
    const context = this.getOrCreateContext(sessionId);
    
    // Add user message to context
    const userChatMessage = {
      id: this.generateMessageId(),
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    context.messages.push(userChatMessage);

    try {
      // Analyze user intent
      const intentAnalysis = await this.analyzeIntent(userMessage, context);
      
      // Generate response based on intent
      const response = await this.generateResponse(intentAnalysis, context);
      
      // Add assistant response to context
      const assistantMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        metadata: {
          intent: intentAnalysis.primaryIntent,
          confidence: intentAnalysis.confidence,
          agentsUsed: intentAnalysis.suggestedAgents,
          parameters: intentAnalysis.entities
        }
      };
      context.messages.push(assistantMessage);

      return assistantMessage;
    } catch (error) {
      console.error('Error processing message:', error);
      
      const errorMessage = {
        id: this.generateMessageId(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error processing your request. Please try again or rephrase your message.",
        timestamp: new Date(),
        metadata: {
          intent: 'error',
          confidence: 0
        }
      };
      context.messages.push(errorMessage);
      
      return errorMessage;
    }
  }

  async analyzeIntent(message, context) {
    // Simple intent analysis based on keywords
    const lowerMessage = message.toLowerCase();
    
    let primaryIntent = 'general';
    let confidence = 0.5;
    let entities = {};
    let suggestedAgents = [];
    let requiresClarification = false;
    let clarificationQuestions = [];

    // Email intent detection
    if (lowerMessage.includes('email') || lowerMessage.includes('send') || lowerMessage.includes('compose')) {
      primaryIntent = 'email';
      confidence = 0.8;
      suggestedAgents = ['email'];
      
      // Extract email address
      const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
      if (emailMatch) {
        entities.email = emailMatch[0];
      }
      
      // Extract subject/content
      if (lowerMessage.includes('about')) {
        const aboutIndex = lowerMessage.indexOf('about');
        entities.content = message.substring(aboutIndex + 6).trim();
      }
    }
    
    // Finance intent detection
    else if (lowerMessage.includes('expense') || lowerMessage.includes('categorize') || lowerMessage.includes('finance') || lowerMessage.includes('money')) {
      primaryIntent = 'finance';
      confidence = 0.7;
      suggestedAgents = ['finance'];
      
      // Extract amount
      const amountMatch = message.match(/\$?(\d+(?:\.\d{2})?)/);
      if (amountMatch) {
        entities.amount = parseFloat(amountMatch[1]);
      }
      
      // Extract description
      let descMatch = null;
      // Try 'on ...'
      descMatch = message.match(/on ([\w\s\-\&]+)/i);
      if (descMatch) {
        entities.description = descMatch[1].replace(/yesterday|today|last week|this week|last month|this month|\d{4}-\d{2}-\d{2}/gi, '').trim();
      } else {
        // Try 'for ...'
        descMatch = message.match(/for ([\w\s\-\&]+)/i);
        if (descMatch) {
          entities.description = descMatch[1].replace(/yesterday|today|last week|this week|last month|this month|\d{4}-\d{2}-\d{2}/gi, '').trim();
        } else {
          // Try 'about ...'
          descMatch = message.match(/about ([\w\s\-\&]+)/i);
          if (descMatch) {
            entities.description = descMatch[1].replace(/yesterday|today|last week|this week|last month|this month|\d{4}-\d{2}-\d{2}/gi, '').trim();
          } else {
            // Try 'worth of ...'
            descMatch = message.match(/worth of ([\w\s\-\&]+)/i);
            if (descMatch) {
              entities.description = descMatch[1].replace(/yesterday|today|last week|this week|last month|this month|\d{4}-\d{2}-\d{2}/gi, '').trim();
            }
          }
        }
      }
    }
    
    // Social media intent detection
    else if (lowerMessage.includes('post') || lowerMessage.includes('social') || lowerMessage.includes('linkedin') || lowerMessage.includes('twitter') || lowerMessage.includes('facebook')) {
      primaryIntent = 'social';
      confidence = 0.7;
      suggestedAgents = ['social'];
      
      // Extract platform
      if (lowerMessage.includes('linkedin')) entities.platform = 'linkedin';
      else if (lowerMessage.includes('twitter')) entities.platform = 'twitter';
      else if (lowerMessage.includes('facebook')) entities.platform = 'facebook';
      else if (lowerMessage.includes('instagram')) entities.platform = 'instagram';
      else entities.platform = 'linkedin'; // default
      
      // Extract content
      if (lowerMessage.includes('about')) {
        const aboutIndex = lowerMessage.indexOf('about');
        entities.content = message.substring(aboutIndex + 6).trim();
      }
    }
    
    // Customer service intent detection
    else if (lowerMessage.includes('customer') || lowerMessage.includes('complaint') || lowerMessage.includes('inquiry') || lowerMessage.includes('support')) {
      primaryIntent = 'customer';
      confidence = 0.7;
      suggestedAgents = ['customer'];
      
      // Extract customer name
      const nameMatch = message.match(/(?:customer|from)\s+([A-Za-z]+)/i);
      if (nameMatch) {
        entities.name = nameMatch[1];
      }
      
      // Extract message
      if (lowerMessage.includes('saying') || lowerMessage.includes('message')) {
        const sayingIndex = Math.max(lowerMessage.indexOf('saying'), lowerMessage.indexOf('message'));
        entities.message = message.substring(sayingIndex + 7).trim();
      }
    }

    // Check if clarification is needed
    if (confidence < 0.6) {
      requiresClarification = true;
      clarificationQuestions = ['Could you please provide more details about what you need help with?'];
    }

    return {
      primaryIntent,
      confidence,
      entities,
      suggestedAgents,
      requiresClarification,
      clarificationQuestions
    };
  }

  async generateResponse(intentAnalysis, context) {
    // If clarification is needed, ask for it
    if (intentAnalysis.requiresClarification) {
      return {
        content: intentAnalysis.clarificationQuestions?.join('\n') || 'Could you please provide more details?'
      };
    }

    // Route to appropriate agent(s) based on intent
    switch (intentAnalysis.primaryIntent) {
      case 'email':
        return await this.handleEmailIntent(intentAnalysis, context);
      
      case 'finance':
        return await this.handleFinanceIntent(intentAnalysis, context);
      
      case 'social':
        return await this.handleSocialIntent(intentAnalysis, context);
      
      case 'customer':
        return await this.handleCustomerIntent(intentAnalysis, context);
      
      default:
        return await this.handleGeneralIntent(intentAnalysis, context);
    }
  }

  async handleEmailIntent(intentAnalysis, context) {
    const { entities } = intentAnalysis;
    
    if (!entities.email) {
      return {
        content: "I'd be happy to help you with email composition. Who would you like to send the email to?"
      };
    }

    const subject = entities.subject || 'Message from Business Agent System';
    const content = entities.content || 'I hope this message finds you well.';
    
    const composedEmail = `Dear ${entities.email.split('@')[0]},

${content}

Best regards,
Your Business Agent System Team

---
Subject: ${subject}
Generated: ${new Date().toISOString()}`;

    return {
      content: `I've composed an email for you:\n\n**To:** ${entities.email}\n**Subject:** ${subject}\n\n${composedEmail}\n\nWould you like me to make any adjustments before sending?`,
      actions: [{ type: 'email_composed', data: { subject, content: composedEmail } }]
    };
  }

  async handleFinanceIntent(intentAnalysis, context) {
    const { entities } = intentAnalysis;
    
    if (entities.amount && entities.description) {
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
      
      return {
        content: `I've categorized your expense:\n\n**Amount:** $${entities.amount}\n**Description:** ${entities.description}\n**Category:** ${randomCategory}\n**Tax Deductible:** Yes\n**Confidence:** Medium`,
        actions: [{ type: 'expense_categorized', data: { category: randomCategory, amount: entities.amount } }]
      };
    }

    return {
      content: "I can help you with expense categorization, financial reporting, and budget analysis. What specific financial task would you like assistance with?"
    };
  }

  async handleSocialIntent(intentAnalysis, context) {
    const { entities } = intentAnalysis;
    
    if (entities.content && entities.platform) {
      const mockPost = {
        content: `🚀 ${entities.content}\n\nWe're excited to share this with our community! #BusinessAgentSystem #Innovation`,
        hashtags: ['#BusinessAgentSystem', '#Innovation', '#Tech'],
        bestTime: '9:00 AM - 11:00 AM'
      };

      return {
        content: `I've created a ${entities.platform} post for you:\n\n${mockPost.content}\n\n**Hashtags:** ${mockPost.hashtags.join(' ')}\n**Best Time to Post:** ${mockPost.bestTime}`,
        actions: [{ type: 'post_created', data: mockPost }]
      };
    }

    return {
      content: "I can help you create engaging social media posts for various platforms. What platform would you like to post on and what's your message about?"
    };
  }

  async handleCustomerIntent(intentAnalysis, context) {
    const { entities } = intentAnalysis;
    
    if (entities.message && entities.name) {
      const response = `Dear ${entities.name},

Thank you for reaching out to us. We understand your concern about "${entities.message}".

Our team is here to help you resolve this issue. We'll investigate this matter and get back to you within 24 hours with a detailed solution.

In the meantime, you can also check our FAQ section for quick answers to common questions.

Best regards,
Customer Support Team
Business Agent System

---
Response Time: ${new Date().toISOString()}`;

      return {
        content: `I've prepared a customer service response:\n\n${response}`,
        actions: [{ type: 'response_generated', data: { response } }]
      };
    }

    return {
      content: "I can help you respond to customer inquiries and complaints. What's the customer's message and their name?"
    };
  }

  async handleGeneralIntent(intentAnalysis, context) {
    const helpMessage = `
I'm your Business Agent System assistant! I can help you with:

📧 **Email Management**
- Compose professional emails
- Send emails to contacts
- Email template management

💰 **Finance & Accounting**
- Expense categorization
- Financial reporting
- Budget analysis

📱 **Social Media**
- Create posts for LinkedIn, Twitter, Facebook, Instagram
- Generate engaging content
- Social media strategy

🎧 **Customer Service**
- Respond to customer inquiries
- Handle complaints
- Generate professional responses

🤖 **Complex Tasks**
- Multi-step business processes
- Cross-agent coordination
- Automated workflows

What would you like to work on today?
`;

    return {
      content: helpMessage
    };
  }

  getConversationHistory(sessionId) {
    const context = this.conversations.get(sessionId);
    return context?.messages || [];
  }

  clearConversation(sessionId) {
    this.conversations.delete(sessionId);
  }

  getOrCreateContext(sessionId) {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, {
        sessionId,
        messages: [],
        userPreferences: {}
      });
    }
    return this.conversations.get(sessionId);
  }

  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
} 