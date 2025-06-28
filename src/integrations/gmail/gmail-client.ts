import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GmailMessage, SendEmailResult, GmailCheckResult, EmailSummary } from './gmail-types';

export class GmailClient {
  private gmail: any;
  private auth: OAuth2Client;

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
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'in:inbox'
      });

      const messages = response.data.messages || [];
      const emailPromises = messages.map(msg => this.getEmailDetails(msg.id));
      return await Promise.all(emailPromises);
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw error;
    }
  }

  async getUnreadEmails(maxResults: number = 10): Promise<GmailMessage[]> {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'in:inbox is:unread'
      });

      const messages = response.data.messages || [];
      const emailPromises = messages.map(msg => this.getEmailDetails(msg.id));
      return await Promise.all(emailPromises);
    } catch (error) {
      console.error('Error fetching unread emails:', error);
      throw error;
    }
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
        message: `Failed to send email to ${to}: ${error.message}`,
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
      const emailPromises = messages.map(msg => this.getEmailDetails(msg.id));
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
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString();
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
          return Buffer.from(part.body.data, 'base64').toString();
        }
        // Recursively check nested parts
        if (part.parts) {
          const nestedBody = this.extractEmailBody(part);
          if (nestedBody) return nestedBody;
        }
      }
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