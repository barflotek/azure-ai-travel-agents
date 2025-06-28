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
          result = await this.categorizeEmailTask(task);
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

    console.log('🚀 Starting optimized email check...');
    
    // Use the faster list method for initial load
    const emails = await this.gmailClient.getEmailList(50);
    const unreadEmails = emails.filter(email => !email.isRead);

    console.log(`📧 Loaded ${emails.length} emails (${unreadEmails.length} unread)`);

    // Only summarize a few unread emails to avoid performance issues
    const emailsToSummarize = unreadEmails.slice(0, 5); // Limit to 5 emails
    const summaries = await Promise.all(
      emailsToSummarize.map(email => this.summarizeRealEmail(email))
    );

    return {
      totalEmails: emails.length,
      unreadCount: unreadEmails.length,
      summaries,
      recentEmails: emails.map(email => ({
        id: email.id,
        from: email.from || this.extractFromFromSnippet(email.snippet),
        subject: email.subject || this.extractSubjectFromSnippet(email.snippet),
        date: email.date,
        body: email.body,
        snippet: email.snippet,
        isRead: email.isRead,
        labels: email.labels,
        priority: this.calculatePriority(email),
        category: this.categorizeEmail(email)
      }))
    };
  }

  // Fast email loading without AI processing
  async getEmailsFast(maxResults: number = 50): Promise<GmailCheckResult> {
    if (!this.gmailClient) {
      throw new Error('Gmail not connected. Please authenticate first.');
    }

    console.log(`🚀 Fast loading ${maxResults} emails...`);
    
    const emails = await this.gmailClient.getEmailList(maxResults);
    const unreadEmails = emails.filter(email => !email.isRead);

    console.log(`✅ Fast load complete: ${emails.length} emails`);

    return {
      totalEmails: emails.length,
      unreadCount: unreadEmails.length,
      summaries: [], // No AI processing for speed
      recentEmails: emails.map(email => ({
        id: email.id,
        from: email.from,
        subject: email.subject,
        date: email.date,
        body: email.body,
        snippet: email.snippet,
        isRead: email.isRead,
        labels: email.labels,
        priority: this.calculatePriority(email),
        category: this.categorizeEmail(email)
      }))
    };
  }

  // Progressive loading - load basic info first, then details on demand
  async getEmailsProgressive(maxResults: number = 50): Promise<GmailCheckResult> {
    if (!this.gmailClient) {
      throw new Error('Gmail not connected. Please authenticate first.');
    }

    console.log(`🚀 Progressive loading ${maxResults} emails...`);
    
    // First, get basic list quickly
    const basicEmails = await this.gmailClient.getEmailList(maxResults);
    const unreadEmails = basicEmails.filter(email => !email.isRead);

    console.log(`📧 Basic info loaded, processing ${basicEmails.length} emails...`);

    // Process emails with basic info first
    const processedEmails = basicEmails.map(email => ({
      id: email.id,
      from: email.from || this.extractFromFromSnippet(email.snippet),
      subject: email.subject || this.extractSubjectFromSnippet(email.snippet),
      date: email.date,
      body: email.body,
      snippet: email.snippet,
      isRead: email.isRead,
      labels: email.labels,
      priority: this.calculatePriority(email),
      category: this.categorizeEmail(email)
    }));

    return {
      totalEmails: processedEmails.length,
      unreadCount: unreadEmails.length,
      summaries: [], // Will be loaded on demand
      recentEmails: processedEmails
    };
  }

  // Helper methods for extracting info from snippets
  private extractFromFromSnippet(snippet: string | undefined): string {
    if (!snippet) return 'Unknown Sender';
    
    // Try to extract sender from snippet if available
    const fromMatch = snippet.match(/From:\s*([^\n]+)/i);
    return fromMatch ? fromMatch[1].trim() : 'Unknown Sender';
  }

  private extractSubjectFromSnippet(snippet: string | undefined): string {
    if (!snippet) return 'No Subject';
    
    // Try to extract subject from snippet if available
    const subjectMatch = snippet.match(/Subject:\s*([^\n]+)/i);
    return subjectMatch ? subjectMatch[1].trim() : snippet.substring(0, 50) + '...';
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
Analyze this email comprehensively and provide structured analysis:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.body.substring(0, 1000)}

Provide analysis in this JSON format:
{
  "summary": "2-3 sentence summary",
  "priority": "high/medium/low",
  "category": "work/personal/newsletter/promotional/urgent/meeting",
  "sentiment": "positive/neutral/negative",
  "requiresAction": true/false,
  "suggestedResponse": "brief response suggestion",
  "extractedInfo": {
    "dates": ["any dates mentioned"],
    "people": ["people mentioned"],
    "companies": ["companies mentioned"],
    "actionItems": ["specific actions needed"]
  }
}
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are an expert email analysis AI. Provide structured analysis in JSON format.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'medium');
    
    try {
      const content = response.message?.content || '{}';
      const jsonMatch = typeof content === 'string' ? content.match(/\{[\s\S]*\}/) : null;
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          id: email.id,
          from: email.from,
          subject: email.subject,
          summary: parsed.summary || 'No summary available',
          requiresAction: parsed.requiresAction || false,
          date: email.date,
          priority: parsed.priority || 'medium',
          category: parsed.category || 'personal',
          sentiment: parsed.sentiment || 'neutral',
          suggestedResponse: parsed.suggestedResponse || '',
          extractedInfo: parsed.extractedInfo || { dates: [], people: [], companies: [], actionItems: [] }
        };
      }
    } catch (error) {
      console.warn('Failed to parse AI analysis, using fallback');
    }

    // Fallback analysis
    return {
      id: email.id,
      from: email.from,
      subject: email.subject,
      summary: email.body.substring(0, 100) + '...',
      priority: this.calculatePriority(email),
      category: this.categorizeEmail(email),
      sentiment: 'neutral',
      requiresAction: email.body.toLowerCase().includes('please') || email.body.includes('?'),
      date: email.date,
      suggestedResponse: 'Thank you for your email. I will review and respond accordingly.',
      extractedInfo: {
        dates: [],
        people: [],
        companies: [],
        actionItems: []
      }
    };
  }

  // Generate AI reply suggestions
  async generateAIReply(emailId: string, replyType: 'quick' | 'detailed' | 'decline'): Promise<any> {
    if (!this.gmailClient) {
      throw new Error('Gmail not connected. Please authenticate first.');
    }

    const email = await this.gmailClient.getEmailById(emailId);
    if (!email) {
      throw new Error('Email not found');
    }
    
    const prompts = {
      quick: `Generate a brief, professional reply to this email: ${email.body.substring(0, 500)}`,
      detailed: `Generate a comprehensive, professional reply addressing all points in this email: ${email.body}`,
      decline: `Generate a polite decline/rejection response to this email: ${email.body.substring(0, 500)}`
    };

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a professional email assistant. Generate appropriate email replies.' },
      { role: 'user', content: prompts[replyType] }
    ];

    const response = await this.llmRouter.route(messages, 'medium');
    
    return {
      replyType,
      subject: `Re: ${email.subject}`,
      body: response.message?.content || 'Error generating reply',
      originalEmail: {
        id: emailId,
        from: email.from,
        subject: email.subject
      }
    };
  }

  // Bulk email actions
  async performBulkAction(emailIds: string[], action: 'read' | 'delete' | 'archive' | 'important'): Promise<any> {
    if (!this.gmailClient) {
      throw new Error('Gmail not connected. Please authenticate first.');
    }

    const results: Array<{ emailId: string; success: boolean; action: string; error?: string }> = [];
    
    for (const emailId of emailIds) {
      try {
        let success = false;
        
        switch (action) {
          case 'read':
            success = await this.gmailClient.markAsRead(emailId);
            break;
          case 'delete':
            success = await this.gmailClient.deleteEmail(emailId);
            break;
          case 'archive':
            success = await this.gmailClient.archiveEmail(emailId);
            break;
          case 'important':
            success = await this.gmailClient.markAsImportant(emailId);
            break;
        }
        
        results.push({ emailId, success, action });
      } catch (error: any) {
        results.push({ emailId, success: false, action, error: error.message });
      }
    }
    
    return {
      action,
      totalProcessed: emailIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results
    };
  }

  // Email analytics
  async getEmailAnalytics(): Promise<any> {
    if (!this.gmailClient) {
      throw new Error('Gmail not connected. Please authenticate first.');
    }

    const emails = await this.gmailClient.getRecentEmails(100);
    
    return {
      totalEmails: emails.length,
      unreadCount: emails.filter(e => !e.isRead).length,
      todayCount: emails.filter(e => this.isToday(e.date)).length,
      thisWeekCount: emails.filter(e => this.isThisWeek(e.date)).length,
      
      // Priority distribution
      priorityBreakdown: {
        high: emails.filter(e => this.calculatePriority(e) === 'high').length,
        medium: emails.filter(e => this.calculatePriority(e) === 'medium').length,
        low: emails.filter(e => this.calculatePriority(e) === 'low').length
      },
      
      // Category distribution
      categoryBreakdown: this.getCategoryBreakdown(emails),
      
      // Response time analytics
      averageResponseTime: this.calculateAverageResponseTime(emails),
      
      // Sender analytics
      topSenders: this.getTopSenders(emails),
      
      // Time analytics
      emailsByHour: this.getEmailsByHour(emails),
      emailsByDay: this.getEmailsByDay(emails)
    };
  }

  // Generate AI suggestions based on email patterns
  generateAISuggestions(emails: GmailMessage[]): string[] {
    const suggestions: string[] = [];
    const urgentCount = emails.filter(e => this.calculatePriority(e) === 'high').length;
    const unreadCount = emails.filter(e => !e.isRead).length;
    const oldestUnread = emails.filter(e => !e.isRead).sort((a, b) => a.date.getTime() - b.date.getTime())[0];
    
    if (urgentCount > 3) {
      suggestions.push(`You have ${urgentCount} high-priority emails. Consider addressing them first.`);
    }
    
    if (unreadCount > 20) {
      suggestions.push(`${unreadCount} unread emails detected. Consider using bulk actions to manage your inbox.`);
    }
    
    if (oldestUnread && this.daysSince(oldestUnread.date) > 3) {
      suggestions.push(`Your oldest unread email is ${this.daysSince(oldestUnread.date)} days old. Consider reviewing older emails.`);
    }
    
    // Pattern-based suggestions
    const newsletterCount = emails.filter(e => this.categorizeEmail(e) === 'newsletter').length;
    if (newsletterCount > 10) {
      suggestions.push('Consider unsubscribing from newsletters you no longer read to reduce inbox clutter.');
    }
    
    return suggestions;
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

  private async categorizeEmailTask(task: EmailTask) {
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
    const content = response.message?.content;
    return {
      category: typeof content === 'string' ? content.trim().toLowerCase() : 'personal',
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
    const content = response.message?.content;
    return {
      summary: typeof content === 'string' ? content.trim() : 'No summary available',
      actionRequired: typeof content === 'string' ? (content.includes('action') || content.includes('reply')) : false
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

  // Helper methods
  private calculatePriority(email: GmailMessage): 'high' | 'medium' | 'low' {
    const urgentWords = ['urgent', 'important', 'asap', 'deadline', 'emergency'];
    const body = email.body.toLowerCase();
    const subject = email.subject.toLowerCase();
    
    if (urgentWords.some(word => body.includes(word) || subject.includes(word))) {
      return 'high';
    }
    
    if (email.body.includes('?') || subject.includes('re:') || subject.includes('fwd:')) {
      return 'medium';
    }
    
    return 'low';
  }

  private categorizeEmail(email: GmailMessage): string {
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    const from = email.from.toLowerCase();
    
    if (from.includes('noreply') || from.includes('newsletter') || subject.includes('unsubscribe')) {
      return 'newsletter';
    }
    
    if (subject.includes('meeting') || subject.includes('calendar') || body.includes('schedule')) {
      return 'meeting';
    }
    
    if (subject.includes('urgent') || subject.includes('important')) {
      return 'urgent';
    }
    
    if (from.includes('.com') && (subject.includes('offer') || subject.includes('sale') || subject.includes('discount'))) {
      return 'promotional';
    }
    
    if (body.includes('work') || body.includes('project') || body.includes('business')) {
      return 'work';
    }
    
    return 'personal';
  }

  private getCategoryBreakdown(emails: GmailMessage[]): any {
    const categories = {};
    emails.forEach(email => {
      const category = this.categorizeEmail(email);
      categories[category] = (categories[category] || 0) + 1;
    });
    return categories;
  }

  private calculateAverageResponseTime(emails: GmailMessage[]): number {
    // This would require tracking response times in a database
    // For now, return a placeholder
    return 24; // hours
  }

  private getTopSenders(emails: GmailMessage[]): any[] {
    const senders = {};
    emails.forEach(email => {
      const domain = email.from.split('@')[1] || 'unknown';
      senders[domain] = (senders[domain] || 0) + 1;
    });
    
    return Object.entries(senders)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => (b.count as number) - (a.count as number))
      .slice(0, 10);
  }

  private getEmailsByHour(emails: GmailMessage[]): any[] {
    const hours = {};
    emails.forEach(email => {
      const hour = email.date.getHours();
      hours[hour] = (hours[hour] || 0) + 1;
    });
    
    return Object.entries(hours)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => a.hour - b.hour);
  }

  private getEmailsByDay(emails: GmailMessage[]): any[] {
    const days = {};
    emails.forEach(email => {
      const day = email.date.toLocaleDateString('en-US', { weekday: 'long' });
      days[day] = (days[day] || 0) + 1;
    });
    
    return Object.entries(days)
      .map(([day, count]) => ({ day, count }));
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  }

  private isThisWeek(date: Date): boolean {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return date >= weekAgo;
  }

  private daysSince(date: Date): number {
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  }
} 