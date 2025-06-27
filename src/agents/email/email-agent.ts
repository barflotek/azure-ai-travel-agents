import { SmartLLMRouter, LLMMessage } from '../../llm';
import { SupabaseClient, AgentConversation } from '../../database';

export interface EmailTask {
  type: 'compose' | 'reply' | 'categorize' | 'summarize';
  content?: string;
  recipient?: string;
  subject?: string;
  originalEmail?: any;
}

export class EmailAgent {
  private llmRouter: SmartLLMRouter;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.llmRouter = new SmartLLMRouter();
  }

  async processTask(task: EmailTask): Promise<any> {
    console.log(`📧 Email Agent processing ${task.type} task...`);

    // Save conversation state
    const conversation = await SupabaseClient.saveConversation({
      user_id: this.userId,
      agent_type: 'email',
      state: { task, status: 'processing' },
      messages: []
    });

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
        default:
          throw new Error(`Unknown email task type: ${task.type}`);
      }

      // Update conversation with result
      await SupabaseClient.saveConversation({
        ...conversation,
        state: { task, status: 'completed', result },
        messages: [...(conversation.messages || []), { type: 'result', content: result }]
      });

      return result;

    } catch (error: any) {
      console.error('❌ Email Agent error:', error);
      
      // Save error state
      await SupabaseClient.saveConversation({
        ...conversation,
        state: { task, status: 'failed', error: error.message }
      });
      
      throw error;
    }
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