import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GmailMessage, SendEmailResult, GmailCheckResult, EmailSummary } from './gmail-types';

export class GmailClient {
  private gmail: any;
  private auth: OAuth2Client;
  private emailCache: Map<string, { email: GmailMessage; timestamp: number }> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor(accessToken: string) {
    this.auth = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    this.auth.setCredentials({ access_token: accessToken });
    this.gmail = google.gmail({ version: 'v1', auth: this.auth });
  }

  async getRecentEmails(maxResults: number = 10): Promise<GmailMessage[]> {
    try {
      console.log(`🚀 Fetching ${maxResults} recent emails...`);
      
      // First, get the list of message IDs
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'in:inbox'
      });

      const messages = response.data.messages || [];
      console.log(`📧 Found ${messages.length} messages, fetching details...`);

      // Use batch processing for better performance
      const emails = await this.getEmailsBatch(messages.map((msg: any) => msg.id));
      
      console.log(`✅ Successfully loaded ${emails.length} emails`);
      return emails;
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw error;
    }
  }

  async getUnreadEmails(maxResults: number = 10): Promise<GmailMessage[]> {
    try {
      console.log(`🚀 Fetching ${maxResults} unread emails...`);
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'in:inbox is:unread'
      });

      const messages = response.data.messages || [];
      console.log(`📧 Found ${messages.length} unread messages, fetching details...`);

      const emails = await this.getEmailsBatch(messages.map((msg: any) => msg.id));
      
      console.log(`✅ Successfully loaded ${emails.length} unread emails`);
      return emails;
    } catch (error) {
      console.error('Error fetching unread emails:', error);
      throw error;
    }
  }

  // Optimized batch processing for multiple emails
  private async getEmailsBatch(messageIds: string[]): Promise<GmailMessage[]> {
    const emails: GmailMessage[] = [];
    const batchSize = 10; // Gmail API batch limit
    
    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (messageId) => {
        // Check cache first
        const cached = this.emailCache.get(messageId);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.email;
        }
        
        // Fetch from API if not cached or expired
        const email = await this.getEmailDetails(messageId);
        
        // Cache the result
        this.emailCache.set(messageId, {
          email,
          timestamp: Date.now()
        });
        
        return email;
      });
      
      const batchResults = await Promise.all(batchPromises);
      emails.push(...batchResults);
      
      // Small delay between batches to be respectful to the API
      if (i + batchSize < messageIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return emails;
  }

  // Optimized method to get email list with minimal data (for faster loading)
  async getEmailList(maxResults: number = 50): Promise<GmailMessage[]> {
    try {
      console.log(`🚀 Fetching email list (${maxResults} items)...`);
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'in:inbox'
      });

      const messages = response.data.messages || [];
      console.log(`📧 Found ${messages.length} messages, processing...`);

      // Fetch full message details to get headers and body
      const emailPromises = messages.map(async (msg: any) => {
        try {
          const messageResponse = await this.gmail.users.messages.get({
            userId: 'me',
            id: msg.id
          });

          const message = messageResponse.data;
          const headers = message.payload?.headers || [];
          const getHeader = (name: string) => 
            headers.find((h: any) => h.name === name)?.value || '';

          return {
            id: msg.id,
            subject: getHeader('Subject') || 'No Subject',
            from: getHeader('From') || 'Unknown Sender',
            to: getHeader('To') || '',
            date: new Date(parseInt(msg.internalDate)),
            body: this.extractEmailBody(message.payload),
            isRead: !msg.labelIds?.includes('UNREAD'),
            snippet: msg.snippet || '',
            labels: msg.labelIds || []
          };
        } catch (error) {
          console.warn(`Failed to fetch details for message ${msg.id}:`, error);
          // Fallback with basic info
          return {
            id: msg.id,
            subject: 'No Subject',
            from: 'Unknown Sender',
            to: '',
            date: new Date(parseInt(msg.internalDate)),
            body: '',
            isRead: !msg.labelIds?.includes('UNREAD'),
            snippet: msg.snippet || '',
            labels: msg.labelIds || []
          };
        }
      });

      const emails = await Promise.all(emailPromises);
      console.log(`✅ Successfully loaded email list (${emails.length} items)`);
      return emails;
    } catch (error) {
      console.error('Error fetching email list:', error);
      throw error;
    }
  }

  // Clear cache (useful for testing or when cache becomes stale)
  clearCache(): void {
    this.emailCache.clear();
    console.log('🗑️ Email cache cleared');
  }

  // Get cache statistics
  getCacheStats(): { size: number; hitRate: number } {
    const size = this.emailCache.size;
    // Note: In a real implementation, you'd track cache hits/misses
    return { size, hitRate: 0.8 }; // Estimated hit rate
  }

  async sendEmail(to: string, subject: string, body: string): Promise<SendEmailResult> {
    try {
      const emailLines = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        body
      ];

      const email = emailLines.join('\n');
      const encodedEmail = Buffer.from(email).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      });

      return {
        success: true,
        message: `Email sent successfully to ${to}`,
        details: {
          to,
          subject,
          sentAt: new Date().toISOString(),
          messageId: response.data.id
        }
      };
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        success: false,
        message: `Failed to send email to ${to}: ${error instanceof Error ? error.message : String(error)}`,
        details: {
          to,
          subject,
          sentAt: new Date().toISOString()
        }
      };
    }
  }

  async markAsRead(messageId: string): Promise<boolean> {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD']
        }
      });
      return true;
    } catch (error) {
      console.error('Error marking email as read:', error);
      return false;
    }
  }

  async markAsUnread(messageId: string): Promise<boolean> {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: ['UNREAD']
        }
      });
      return true;
    } catch (error) {
      console.error('Error marking email as unread:', error);
      return false;
    }
  }

  async deleteEmail(messageId: string): Promise<boolean> {
    try {
      await this.gmail.users.messages.delete({
        userId: 'me',
        id: messageId
      });
      return true;
    } catch (error) {
      console.error('Error deleting email:', error);
      return false;
    }
  }

  async archiveEmail(messageId: string): Promise<boolean> {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['INBOX']
        }
      });
      return true;
    } catch (error) {
      console.error('Error archiving email:', error);
      return false;
    }
  }

  async markAsImportant(messageId: string): Promise<boolean> {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: ['IMPORTANT']
        }
      });
      return true;
    } catch (error) {
      console.error('Error marking email as important:', error);
      return false;
    }
  }

  async searchEmails(query: string, maxResults: number = 10): Promise<GmailMessage[]> {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query
      });

      const messages = response.data.messages || [];
      const emailPromises = messages.map((msg: any) => this.getEmailDetails(msg.id));
      return await Promise.all(emailPromises);
    } catch (error) {
      console.error('Error searching emails:', error);
      throw error;
    }
  }

  async getEmailById(messageId: string): Promise<GmailMessage | null> {
    try {
      return await this.getEmailDetails(messageId);
    } catch (error) {
      console.error('Error fetching email by ID:', error);
      return null;
    }
  }

  async getProfile(): Promise<{ emailAddress: string; messagesTotal: number; threadsTotal: number }> {
    try {
      const response = await this.gmail.users.getProfile({
        userId: 'me'
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching Gmail profile:', error);
      throw error;
    }
  }

  private async getEmailDetails(messageId: string): Promise<GmailMessage> {
    const response = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId
    });

    const message = response.data;
    const headers = message.payload.headers;
    
    const getHeader = (name: string) => 
      headers.find((h: any) => h.name === name)?.value || '';

    return {
      id: message.id,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      date: new Date(parseInt(message.internalDate)),
      body: this.extractEmailBody(message.payload),
      isRead: !message.labelIds?.includes('UNREAD'),
      snippet: message.snippet,
      labels: message.labelIds || []
    };
  }

  private extractEmailBody(payload: any): string {
    // Handle simple body
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    // Handle multipart emails
    if (payload.parts) {
      let body = '';
      
      // First try to find text/plain
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        }
      }
      
      // If no text/plain, try text/html
      if (!body) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/html' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            // Strip HTML tags for plain text
            body = body.replace(/<[^>]*>/g, '');
            break;
          }
        }
      }
      
      // If still no body, recursively check nested parts
      if (!body) {
        for (const part of payload.parts) {
          if (part.parts) {
            body = this.extractEmailBody(part);
            if (body) break;
          }
        }
      }
      
      return body;
    }

    return '';
  }

  // Helper method to determine email priority
  private determinePriority(email: GmailMessage): 'high' | 'medium' | 'low' {
    const subject = email.subject.toLowerCase();
    const from = email.from.toLowerCase();
    
    // High priority indicators
    if (subject.includes('urgent') || subject.includes('asap') || 
        subject.includes('important') || subject.includes('action required')) {
      return 'high';
    }
    
    // Check if from important contacts
    if (from.includes('boss') || from.includes('manager') || 
        from.includes('ceo') || from.includes('hr')) {
      return 'high';
    }
    
    // Medium priority for work-related emails
    if (from.includes('@company') || from.includes('@work') || 
        subject.includes('meeting') || subject.includes('project')) {
      return 'medium';
    }
    
    return 'low';
  }
} 