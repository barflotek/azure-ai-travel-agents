import { SmartLLMRouter, LLMMessage } from '../../llm';
import { SupabaseClient, AgentConversation } from '../../database';
import { GmailClient } from '../../integrations/gmail/gmail-client';
import { GmailMessage, GmailCheckResult, SendEmailResult, EmailSummary } from '../../integrations/gmail/gmail-types';

export interface EmailTask {
  type: 'compose' | 'reply' | 'categorize' | 'summarize' | 'check_emails' | 'send_real_email' | 'search_emails';
  content?: string;
  recipient?: string;
  subject?: string;
  originalEmail?: any;
  gmailAccessToken?: string;
  searchQuery?: string;
}

export class EmailAgent {
  private llmRouter: SmartLLMRouter;
  private userId: string;
  private gmailClient?: GmailClient;

  constructor(userId: string) {
    this.userId = userId;
    this.llmRouter = new SmartLLMRouter();
  }

  // Set Gmail access for real email operations
  setGmailAccess(accessToken: string) {
    this.gmailClient = new GmailClient(accessToken);
  }

  async processTask(task: EmailTask): Promise<any> {
    console.log(`📧 Email Agent processing ${task.type} task...`);

    // Save conversation state (optional - Supabase might not be configured)
    let conversation;
    try {
      conversation = await SupabaseClient.saveConversation({
        user_id: this.userId,
        agent_type: 'email',
        state: { task, status: 'processing' },
        messages: []
      });
    } catch (error) {
      console.log('⚠️ Supabase not configured, continuing without persistence');
      conversation = { id: 'temp-' + Date.now() };
    }

    try {
      let result;
      
      switch (task.type) {
        case 'compose':
          result = await this.composeEmail(task);
          break;
        case 'reply':
          result = await this.replyToEmail(task);
          break;
        case 'categorize':
          result = await this.categorizeEmail(task);
          break;
        case 'summarize':
          result = await this.summarizeEmail(task);
          break;
        case 'check_emails':
          result = await this.checkEmails();
          break;
        case 'send_real_email':
          result = await this.sendRealEmail(task);
          break;
        case 'search_emails':
          result = await this.searchEmails(task.searchQuery || '');
          break;
        default:
          throw new Error(`Unknown email task type: ${task.type}`);
      }

      // Update conversation with result (optional)
      try {
        if (conversation && conversation.id && !conversation.id.startsWith('temp-')) {
          await SupabaseClient.saveConversation({
            ...conversation,
            state: { task, status: 'completed', result },
            messages: [...(conversation.messages || []), { type: 'result', content: result }]
          });
        }
      } catch (error) {
        console.log('⚠️ Could not save conversation to Supabase');
      }

      return result;

    } catch (error: any) {
      console.error('❌ Email Agent error:', error);
      
      // Save error state (optional)
      try {
        if (conversation && conversation.id && !conversation.id.startsWith('temp-')) {
          await SupabaseClient.saveConversation({
            ...conversation,
            state: { task, status: 'failed', error: error.message }
          });
        }
      } catch (dbError) {
        console.log('⚠️ Could not save error state to Supabase');
      }
      
      throw error;
    }
  }

  // Real Gmail integration methods
  async checkEmails(): Promise<GmailCheckResult> {
    if (!this.gmailClient) {
      throw new Error('Gmail not connected. Please authenticate first.');
    }

    const emails = await this.gmailClient.getRecentEmails(10);
    const unreadEmails = emails.filter(email => !email.isRead);

    // Summarize unread emails with AI
    const summaries = await Promise.all(
      unreadEmails.map(email => this.summarizeRealEmail(email))
    );

    return {
      totalEmails: emails.length,
      unreadCount: unreadEmails.length,
      summaries,
      recentEmails: emails.slice(0, 5).map(email => ({
        from: email.from,
        subject: email.subject,
        date: email.date,
        preview: email.body.substring(0, 100) + '...',
        isRead: email.isRead
      }))
    };
  }

  async sendRealEmail(task: EmailTask): Promise<SendEmailResult> {
    if (!this.gmailClient) {
      throw new Error('Gmail not connected. Please authenticate first.');
    }

    if (!task.recipient || !task.subject || !task.content) {
      throw new Error('Missing required email fields: recipient, subject, or content');
    }

    const result = await this.gmailClient.sendEmail(
      task.recipient, 
      task.subject, 
      task.content
    );
    
    return result;
  }

  async searchEmails(query: string): Promise<GmailMessage[]> {
    if (!this.gmailClient) {
      throw new Error('Gmail not connected. Please authenticate first.');
    }

    return await this.gmailClient.searchEmails(query, 10);
  }

  async markEmailAsRead(messageId: string): Promise<boolean> {
    if (!this.gmailClient) {
      throw new Error('Gmail not connected. Please authenticate first.');
    }

    return await this.gmailClient.markAsRead(messageId);
  }

  async deleteEmail(messageId: string): Promise<boolean> {
    if (!this.gmailClient) {
      throw new Error('Gmail not connected. Please authenticate first.');
    }

    return await this.gmailClient.deleteEmail(messageId);
  }

  async getEmailById(messageId: string): Promise<GmailMessage | null> {
    if (!this.gmailClient) {
      throw new Error('Gmail not connected. Please authenticate first.');
    }

    return await this.gmailClient.getEmailById(messageId);
  }

  // AI-powered email summarization for real emails
  private async summarizeRealEmail(email: GmailMessage): Promise<EmailSummary> {
    const prompt = `
Summarize this email in 1-2 sentences, focusing on key points and any required actions:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.body.substring(0, 500)}

Also determine if this email requires action (reply, follow-up, etc.) and assign priority (high/medium/low).
Respond in JSON format: {"summary": "...", "requiresAction": true/false, "priority": "high/medium/low"}
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are an email summarization assistant. Respond in JSON format.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'simple');
    
    try {
      const content = response.message?.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          id: email.id,
          from: email.from,
          subject: email.subject,
          summary: parsed.summary || 'No summary available',
          requiresAction: parsed.requiresAction || false,
          date: email.date,
          priority: parsed.priority || 'medium'
        };
      }
    } catch (error) {
      console.error('Error parsing email summary:', error);
    }

    // Fallback summary
    return {
      id: email.id,
      from: email.from,
      subject: email.subject,
      summary: email.body.substring(0, 100) + '...',
      requiresAction: email.subject.toLowerCase().includes('urgent') || 
                     email.subject.toLowerCase().includes('action'),
      date: email.date,
      priority: 'medium'
    };
  }

  private async composeEmail(task: EmailTask) {
    const prompt = `
Compose a professional email with the following details:
- Recipient: ${task.recipient}
- Subject: ${task.subject}
- Content request: ${task.content}

Please write a clear, professional email that accomplishes this goal.
Format your response as JSON with "subject" and "body" fields.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a professional email writing assistant.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'medium');
    return this.parseEmailResponse(response);
  }

  private async replyToEmail(task: EmailTask) {
    const prompt = `
Please compose a reply to this email:

Original Email: ${JSON.stringify(task.originalEmail, null, 2)}

Reply instructions: ${task.content}

Write a professional reply that addresses the original message appropriately.
Format your response as JSON with "subject" and "body" fields.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a professional email assistant who writes thoughtful replies.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'medium');
    return this.parseEmailResponse(response);
  }

  private async categorizeEmail(task: EmailTask) {
    const prompt = `
Categorize this email into one of these categories:
- urgent
- important
- newsletter
- promotional
- personal
- business
- support
- spam

Email content: ${task.content}

Respond with just the category name.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are an email categorization assistant.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'simple');
    return {
      category: response.message?.content?.trim().toLowerCase(),
      confidence: 'high' // TODO: Add confidence scoring
    };
  }

  private async summarizeEmail(task: EmailTask) {
    const prompt = `
Summarize this email in 2-3 sentences, focusing on key points and any required actions:

${task.content}
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are an email summarization assistant.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'simple');
    return {
      summary: response.message?.content?.trim(),
      actionRequired: response.message?.content?.includes('action') || response.message?.content?.includes('reply')
    };
  }

  private parseEmailResponse(response: any) {
    try {
      const content = response.message?.content || '';
      // Try to parse as JSON first
      if (content.includes('{') && content.includes('}')) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      
      // Fallback: return as plain text
      return {
        subject: 'Generated Email',
        body: content
      };
    } catch (error) {
      return {
        subject: 'Generated Email',
        body: response.message?.content || 'Error generating email'
      };
    }
  }
} 