import { SmartLLMRouter, LLMMessage } from '../../llm';
import { EmailAgent } from '../email/email-agent';
import { FinanceAgent } from '../finance/finance-agent';
import { SocialAgent } from '../social/social-agent';
import { CustomerAgent } from '../customer/customer-agent';
import { BusinessAgentOrchestrator } from '../orchestrator';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    intent?: string;
    confidence?: number;
    agentsUsed?: string[];
    parameters?: Record<string, any>;
  };
}

export interface ConversationContext {
  sessionId: string;
  messages: ChatMessage[];
  currentTask?: {
    type: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    parameters: Record<string, any>;
    results?: any[];
  };
  userPreferences?: {
    emailTemplate?: string;
    financeCategories?: string[];
    socialPlatforms?: string[];
    responseStyle?: 'formal' | 'casual' | 'professional';
  };
}

export interface IntentAnalysis {
  primaryIntent: string;
  confidence: number;
  entities: Record<string, any>;
  suggestedAgents: string[];
  requiresClarification: boolean;
  clarificationQuestions?: string[];
}

export class MainConversationalAgent {
  private llmRouter: SmartLLMRouter;
  private emailAgent: EmailAgent;
  private financeAgent: FinanceAgent;
  private socialAgent: SocialAgent;
  private customerAgent: CustomerAgent;
  private orchestrator: BusinessAgentOrchestrator;
  private conversations: Map<string, ConversationContext> = new Map();

  constructor() {
    this.llmRouter = new SmartLLMRouter();
    this.emailAgent = new EmailAgent('default-user');
    this.financeAgent = new FinanceAgent('default-user');
    this.socialAgent = new SocialAgent('default-user');
    this.customerAgent = new CustomerAgent('default-user');
    this.orchestrator = new BusinessAgentOrchestrator('default-user');
  }

  /**
   * Main entry point for conversational interactions
   */
  async processMessage(sessionId: string, userMessage: string): Promise<ChatMessage> {
    // Get or create conversation context
    const context = this.getOrCreateContext(sessionId);
    
    // Add user message to context
    const userChatMessage: ChatMessage = {
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
      const assistantMessage: ChatMessage = {
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
      
      const errorMessage: ChatMessage = {
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

  /**
   * Analyze user intent and extract entities
   */
  private async analyzeIntent(message: string, context: ConversationContext): Promise<IntentAnalysis> {
    const prompt = `
You are an intent recognition system for a Business Agent System. Analyze the user message and identify:

1. Primary intent (email, finance, social, customer, orchestrator, general)
2. Confidence level (0-1)
3. Entities (email addresses, amounts, dates, names, etc.)
4. Suggested agents to use
5. Whether clarification is needed

User message: "${message}"

Previous context: ${context.messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}

Respond in JSON format:
{
  "primaryIntent": "email|finance|social|customer|orchestrator|general",
  "confidence": 0.95,
  "entities": {
    "email": "john@example.com",
    "amount": 299.99,
    "date": "2024-01-15",
    "name": "John Doe",
    "platform": "linkedin"
  },
  "suggestedAgents": ["email"],
  "requiresClarification": false,
  "clarificationQuestions": []
}
`;

    try {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are an intent recognition system for a Business Agent System.' },
        { role: 'user', content: prompt }
      ];
      
      const response = await this.llmRouter.route(messages, 'medium');
      const analysis = JSON.parse(response.message?.content || '{}');
      
      return {
        primaryIntent: analysis.primaryIntent || 'general',
        confidence: analysis.confidence || 0.5,
        entities: analysis.entities || {},
        suggestedAgents: analysis.suggestedAgents || [],
        requiresClarification: analysis.requiresClarification || false,
        clarificationQuestions: analysis.clarificationQuestions || []
      };
    } catch (error) {
      console.error('Error analyzing intent:', error);
      return {
        primaryIntent: 'general',
        confidence: 0.3,
        entities: {},
        suggestedAgents: [],
        requiresClarification: true,
        clarificationQuestions: ['Could you please clarify what you would like me to help you with?']
      };
    }
  }

  /**
   * Generate response based on intent analysis
   */
  private async generateResponse(intentAnalysis: IntentAnalysis, context: ConversationContext): Promise<{ content: string; actions?: any[] }> {
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
      
      case 'orchestrator':
        return await this.handleOrchestratorIntent(intentAnalysis, context);
      
      default:
        return await this.handleGeneralIntent(intentAnalysis, context);
    }
  }

  /**
   * Handle email-related intents
   */
  private async handleEmailIntent(intentAnalysis: IntentAnalysis, context: ConversationContext): Promise<{ content: string; actions?: any[] }> {
    const { entities } = intentAnalysis;
    
    if (!entities.email) {
      return {
        content: "I'd be happy to help you with email composition. Who would you like to send the email to?"
      };
    }

    try {
      const result = await this.emailAgent.processTask({
        type: 'compose',
        recipient: entities.email,
        subject: entities.subject || 'Message from Business Agent System',
        content: entities.content || 'I hope this message finds you well.'
      });

      return {
        content: `I've composed an email for you:\n\n**To:** ${entities.email}\n**Subject:** ${result.subject}\n\n${result.body}\n\nWould you like me to make any adjustments before sending?`,
        actions: [{ type: 'email_composed', data: result }]
      };
    } catch (error) {
      return {
        content: "I encountered an error while composing your email. Please try again with more specific details."
      };
    }
  }

  /**
   * Handle finance-related intents
   */
  private async handleFinanceIntent(intentAnalysis: IntentAnalysis, context: ConversationContext): Promise<{ content: string; actions?: any[] }> {
    const { entities } = intentAnalysis;
    
    if (entities.amount && entities.description) {
      try {
        const result = await this.financeAgent.processTask({
          type: 'categorize_expense',
          amount: entities.amount,
          description: entities.description,
          date: entities.date || new Date().toISOString()
        });

        return {
          content: `I've categorized your expense:\n\n**Amount:** $${entities.amount}\n**Description:** ${entities.description}\n**Category:** ${result.category}\n**Tax Deductible:** ${result.taxDeductible ? 'Yes' : 'No'}\n**Confidence:** ${result.confidence}`,
          actions: [{ type: 'expense_categorized', data: result }]
        };
      } catch (error) {
        return {
          content: "I encountered an error while categorizing your expense. Please try again."
        };
      }
    }

    return {
      content: "I can help you with expense categorization, financial reporting, and budget analysis. What specific financial task would you like assistance with?"
    };
  }

  /**
   * Handle social media intents
   */
  private async handleSocialIntent(intentAnalysis: IntentAnalysis, context: ConversationContext): Promise<{ content: string; actions?: any[] }> {
    const { entities } = intentAnalysis;
    
    if (entities.content && entities.platform) {
      try {
        const result = await this.socialAgent.processTask({
          type: 'create_post',
          platform: entities.platform,
          content: entities.content,
          topic: entities.topic || 'Business Update'
        });

        return {
          content: `I've created a ${entities.platform} post for you:\n\n${result.content}\n\n**Hashtags:** ${result.hashtags?.join(' ')}\n**Best Time to Post:** ${result.bestTime}`,
          actions: [{ type: 'post_created', data: result }]
        };
      } catch (error) {
        return {
          content: "I encountered an error while creating your social media post. Please try again."
        };
      }
    }

    return {
      content: "I can help you create engaging social media posts for various platforms. What platform would you like to post on and what's your message about?"
    };
  }

  /**
   * Handle customer service intents
   */
  private async handleCustomerIntent(intentAnalysis: IntentAnalysis, context: ConversationContext): Promise<{ content: string; actions?: any[] }> {
    const { entities } = intentAnalysis;
    
    if (entities.message && entities.name) {
      try {
        const result = await this.customerAgent.processTask({
          type: 'respond_inquiry',
          customerMessage: {
            content: entities.message,
            customerName: entities.name,
            email: entities.email || 'customer@example.com',
            channel: entities.channel || 'web',
            timestamp: new Date().toISOString()
          }
        });

        return {
          content: `I've prepared a customer service response:\n\n${result.response}`,
          actions: [{ type: 'response_generated', data: result }]
        };
      } catch (error) {
        return {
          content: "I encountered an error while generating the customer service response. Please try again."
        };
      }
    }

    return {
      content: "I can help you respond to customer inquiries and complaints. What's the customer's message and their name?"
    };
  }

  /**
   * Handle complex multi-agent tasks through orchestrator
   */
  private async handleOrchestratorIntent(intentAnalysis: IntentAnalysis, context: ConversationContext): Promise<{ content: string; actions?: any[] }> {
    try {
      const result = await this.orchestrator.processBusinessTask({
        type: 'multi_agent',
        description: intentAnalysis.primaryIntent,
        priority: 'medium',
        context: intentAnalysis.entities,
        userId: 'default-user'
      });

      return {
        content: `I've completed the complex task for you:\n\n${result.finalResult}\n\n**Agents Used:** ${result.agentResults.map((r: any) => r.agentType).join(', ')}\n**Status:** ${result.status}`,
        actions: [{ type: 'orchestrator_task_completed', data: result }]
      };
    } catch (error) {
      return {
        content: "I encountered an error while processing your complex request. Please try breaking it down into simpler tasks."
      };
    }
  }

  /**
   * Handle general conversation and help
   */
  private async handleGeneralIntent(intentAnalysis: IntentAnalysis, context: ConversationContext): Promise<{ content: string; actions?: any[] }> {
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

  /**
   * Get conversation history
   */
  getConversationHistory(sessionId: string): ChatMessage[] {
    const context = this.conversations.get(sessionId);
    return context?.messages || [];
  }

  /**
   * Clear conversation history
   */
  clearConversation(sessionId: string): void {
    this.conversations.delete(sessionId);
  }

  /**
   * Get or create conversation context
   */
  private getOrCreateContext(sessionId: string): ConversationContext {
    if (!this.conversations.has(sessionId)) {
      this.conversations.set(sessionId, {
        sessionId,
        messages: [],
        userPreferences: {}
      });
    }
    return this.conversations.get(sessionId)!;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
} 