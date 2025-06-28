export interface GmailMessage {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  body: string;
  isRead: boolean;
  snippet?: string;
  labels?: string[];
}

export interface GmailAuthTokens {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date?: number;
}

export interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  summary: string;
  requiresAction: boolean;
  date: Date;
  priority: 'high' | 'medium' | 'low';
  category?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  suggestedResponse?: string;
  extractedInfo?: {
    dates: string[];
    people: string[];
    companies: string[];
    actionItems: string[];
  };
}

export interface SendEmailResult {
  success: boolean;
  message: string;
  details: {
    to: string;
    subject: string;
    sentAt: string;
    messageId?: string;
  };
}

export interface GmailCheckResult {
  totalEmails: number;
  unreadCount: number;
  summaries: EmailSummary[];
  recentEmails: Array<{
    id: string;
    from: string;
    subject: string;
    date: Date;
    body: string;
    snippet?: string;
    isRead: boolean;
    labels?: string[];
    priority: 'high' | 'medium' | 'low';
    category: string;
  }>;
}

export interface GmailAuthStatus {
  isConnected: boolean;
  email?: string;
  scopes?: string[];
  lastSync?: Date;
} 