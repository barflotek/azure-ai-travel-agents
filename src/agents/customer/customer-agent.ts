import { SmartLLMRouter, LLMMessage } from '../../llm';
import { SupabaseClient, AgentConversation } from '../../database';

export interface CustomerTask {
  type: 'respond_inquiry' | 'categorize_ticket' | 'escalate_issue' | 'follow_up' | 'satisfaction_survey' | 'knowledge_base';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'technical' | 'billing' | 'general' | 'complaint' | 'feature_request' | 'bug_report';
  customerMessage?: {
    content: string;
    customerName: string;
    email: string;
    channel: 'email' | 'chat' | 'phone' | 'social';
    timestamp: string;
  };
  ticketId?: string;
  context?: string;
  previousConversation?: any[];
  productInfo?: any;
  escalationReason?: string;
  satisfactionData?: any;
  knowledgeQuery?: string;
}

export class CustomerAgent {
  private llmRouter: SmartLLMRouter;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.llmRouter = new SmartLLMRouter();
  }

  async processTask(task: CustomerTask): Promise<any> {
    console.log(`🎧 Customer Agent processing ${task.type} task (Priority: ${task.priority})...`);

    // Save conversation state
    const conversation = await SupabaseClient.saveConversation({
      user_id: this.userId,
      agent_type: 'customer',
      state: { task, status: 'processing' },
      messages: []
    });

    try {
      let result;
      
      switch (task.type) {
        case 'respond_inquiry':
          result = await this.respondToInquiry(task);
          break;
        case 'categorize_ticket':
          result = await this.categorizeTicket(task);
          break;
        case 'escalate_issue':
          result = await this.escalateIssue(task);
          break;
        case 'follow_up':
          result = await this.followUp(task);
          break;
        case 'satisfaction_survey':
          result = await this.processSatisfactionSurvey(task);
          break;
        case 'knowledge_base':
          result = await this.searchKnowledgeBase(task);
          break;
        default:
          throw new Error(`Unknown customer service task type: ${task.type}`);
      }

      // Update conversation with result
      await SupabaseClient.saveConversation({
        ...conversation,
        state: { task, status: 'completed', result },
        messages: [...(conversation.messages || []), { type: 'result', content: result }]
      });

      return result;

    } catch (error) {
      console.error('❌ Customer Agent error:', error);
      
      await SupabaseClient.saveConversation({
        ...conversation,
        state: { task, status: 'failed', error: error.message }
      });
      
      throw error;
    }
  }

  private async respondToInquiry(task: CustomerTask) {
    const { customerMessage } = task;
    if (!customerMessage) throw new Error('Customer message required');

    const conversationHistory = this.formatConversationHistory(task.previousConversation || []);
    
    const prompt = `
You are a professional customer service representative. Respond to this customer inquiry:

Customer: ${customerMessage.customerName}
Email: ${customerMessage.email}
Channel: ${customerMessage.channel}
Message: "${customerMessage.content}"

Context: ${task.context || 'No additional context'}
Product Info: ${JSON.stringify(task.productInfo, null, 2)}

Previous Conversation:
${conversationHistory}

Guidelines:
1. Be empathetic and professional
2. Address the customer by name
3. Acknowledge their concern specifically
4. Provide helpful, actionable solutions
5. Offer next steps or follow-up if needed
6. Match the tone to the channel (formal for email, casual for chat)
7. Include relevant product information if applicable

Response should be complete and ready to send.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are an expert customer service representative known for exceptional communication and problem-solving skills.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'medium');
    
    return {
      ticketId: task.ticketId || `TICKET-${Date.now()}`,
      customerName: customerMessage.customerName,
      customerEmail: customerMessage.email,
      channel: customerMessage.channel,
      response: response.message?.content || 'Error generating response',
      sentiment: this.analyzeSentiment(customerMessage.content),
      urgency: this.assessUrgency(customerMessage.content),
      suggestedActions: this.extractSuggestedActions(response.message?.content || ''),
      estimatedResolutionTime: this.estimateResolutionTime(customerMessage.content),
      followUpRequired: this.requiresFollowUp(customerMessage.content),
      timestamp: new Date().toISOString()
    };
  }

  private async categorizeTicket(task: CustomerTask) {
    const { customerMessage } = task;
    if (!customerMessage) throw new Error('Customer message required');

    const prompt = `
Categorize this customer support ticket:

Customer Message: "${customerMessage.content}"
Channel: ${customerMessage.channel}

Categorize into:
1. Primary Category: technical, billing, general, complaint, feature_request, bug_report, account, shipping, refund
2. Secondary Category: More specific subcategory
3. Priority Level: low, medium, high, urgent
4. Department: support, technical, billing, sales, management
5. Estimated Resolution Time: immediate, 1-24 hours, 1-3 days, 1 week+
6. Required Skills: basic, intermediate, advanced, specialist
7. Automation Potential: fully_automated, partially_automated, manual_only

Also identify:
- Key issues mentioned
- Customer sentiment
- Urgency indicators
- Required information to resolve

Format as JSON with clear categorization.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a ticket categorization specialist with expertise in customer service operations.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'simple');
    const parsed = this.parseCustomerResponse(response);
    
    return {
      ticketId: task.ticketId || `TICKET-${Date.now()}`,
      customerMessage: customerMessage,
      categorization: parsed,
      autoAssignment: this.suggestAssignment(parsed),
      slaDeadline: this.calculateSLA(parsed.priority || 'medium'),
      similarTickets: this.findSimilarTickets(customerMessage.content),
      suggestedResponse: this.suggestQuickResponse(parsed),
      timestamp: new Date().toISOString()
    };
  }

  private async escalateIssue(task: CustomerTask) {
    const { customerMessage, escalationReason } = task;
    if (!customerMessage) throw new Error('Customer message required');

    const prompt = `
Create an escalation summary for this customer issue:

Customer: ${customerMessage.customerName}
Original Issue: "${customerMessage.content}"
Escalation Reason: ${escalationReason}
Previous Conversation: ${JSON.stringify(task.previousConversation, null, 2)}

Create escalation documentation including:
1. Executive summary (2-3 sentences)
2. Issue timeline and previous attempts
3. Customer impact assessment
4. Recommended resolution approach
5. Required resources/expertise
6. Success metrics for resolution
7. Communication plan with customer

Format as a professional escalation brief.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a customer success manager specializing in issue escalation and resolution planning.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'complex');
    
    return {
      escalationId: `ESC-${Date.now()}`,
      ticketId: task.ticketId,
      customerInfo: {
        name: customerMessage.customerName,
        email: customerMessage.email,
        channel: customerMessage.channel
      },
      escalationBrief: response.message?.content || 'Error generating escalation brief',
      priority: 'high',
      assignedTo: this.getEscalationAssignee(escalationReason || ''),
      slaDeadline: this.calculateEscalationSLA(),
      stakeholderNotifications: this.getStakeholderList(escalationReason || ''),
      resolutionPlan: this.createResolutionPlan(response.message?.content || ''),
      timestamp: new Date().toISOString()
    };
  }

  private async followUp(task: CustomerTask) {
    const prompt = `
Create a follow-up message for this customer interaction:

Ticket ID: ${task.ticketId}
Context: ${task.context}
Previous Conversation: ${JSON.stringify(task.previousConversation, null, 2)}

Follow-up should:
1. Check if the previous solution worked
2. Ask about customer satisfaction
3. Offer additional assistance
4. Provide relevant resources
5. Set expectations for future support

Tone should be helpful and genuinely concerned about resolution.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a customer success specialist focused on ensuring complete issue resolution and customer satisfaction.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'simple');
    
    return {
      ticketId: task.ticketId,
      followUpMessage: response.message?.content || 'Error generating follow-up',
      followUpType: this.determineFollowUpType(task.context || ''),
      scheduledDate: this.calculateFollowUpDate(task.context || ''),
      expectedOutcome: 'resolution_confirmation',
      additionalResources: this.suggestResources(task.context || ''),
      satisfactionSurveyIncluded: true,
      timestamp: new Date().toISOString()
    };
  }

  private async processSatisfactionSurvey(task: CustomerTask) {
    const prompt = `
Analyze this customer satisfaction survey data:

Survey Data: ${JSON.stringify(task.satisfactionData, null, 2)}
Ticket Context: ${task.context}

Provide analysis including:
1. Overall satisfaction score interpretation
2. Key positive feedback themes
3. Areas for improvement identified
4. Impact on customer relationship
5. Actionable recommendations
6. Follow-up actions required
7. Process improvement suggestions

Generate insights for continuous improvement.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a customer experience analyst specializing in satisfaction data interpretation and service improvement.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'medium');
    
    return {
      ticketId: task.ticketId,
      satisfactionScore: this.extractSatisfactionScore(task.satisfactionData),
      analysis: response.message?.content || 'Error analyzing satisfaction data',
      sentimentTrend: this.analyzeSatisfactionTrend(task.satisfactionData),
      improvementActions: this.extractImprovementActions(response.message?.content || ''),
      customerRetentionRisk: this.assessRetentionRisk(task.satisfactionData),
      teamFeedback: this.generateTeamFeedback(response.message?.content || ''),
      timestamp: new Date().toISOString()
    };
  }

  private async searchKnowledgeBase(task: CustomerTask) {
    const prompt = `
Search for relevant knowledge base articles for this query:

Query: ${task.knowledgeQuery}
Context: ${task.context}

Find articles related to:
1. Direct solutions to the query
2. Related troubleshooting steps
3. Best practices and tips
4. Common questions in this area
5. Product documentation links

Provide relevant article summaries and direct links where applicable.
Format as structured knowledge base results.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a knowledge base search specialist helping customers find relevant documentation and solutions.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'simple');
    
    return {
      query: task.knowledgeQuery,
      searchResults: this.parseKnowledgeResults(response),
      relevanceScore: this.calculateRelevanceScore(task.knowledgeQuery || '', response.message?.content || ''),
      suggestedArticles: this.extractArticleSuggestions(response.message?.content || ''),
      relatedQueries: this.generateRelatedQueries(task.knowledgeQuery || ''),
      contentGaps: this.identifyContentGaps(task.knowledgeQuery || '', response.message?.content || ''),
      timestamp: new Date().toISOString()
    };
  }

  // Helper methods
  private formatConversationHistory(conversation: any[]): string {
    return conversation
      .map(msg => `${msg.timestamp}: ${msg.sender}: ${msg.content}`)
      .join('\n');
  }

  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' | 'frustrated' {
    const frustrationWords = ['frustrated', 'angry', 'terrible', 'awful', 'worst', 'hate'];
    const positiveWords = ['great', 'love', 'thank', 'excellent', 'perfect'];
    
    if (frustrationWords.some(word => text.toLowerCase().includes(word))) return 'frustrated';
    if (positiveWords.some(word => text.toLowerCase().includes(word))) return 'positive';
    if (text.includes('!') && text.includes('?')) return 'frustrated';
    return 'neutral';
  }

  private assessUrgency(text: string): 'low' | 'medium' | 'high' | 'urgent' {
    const urgentWords = ['urgent', 'immediately', 'asap', 'emergency', 'critical'];
    const highWords = ['important', 'soon', 'quickly', 'problem'];
    
    if (urgentWords.some(word => text.toLowerCase().includes(word))) return 'urgent';
    if (highWords.some(word => text.toLowerCase().includes(word))) return 'high';
    if (text.includes('when possible') || text.includes('no rush')) return 'low';
    return 'medium';
  }

  private extractSuggestedActions(content: string): string[] {
    return content.split('\n')
      .filter(line => 
        line.includes('next step') || 
        line.includes('action') || 
        line.includes('recommend') ||
        line.includes('should')
      )
      .slice(0, 3);
  }

  private estimateResolutionTime(content: string): string {
    const urgency = this.assessUrgency(content);
    const timeMap = {
      urgent: '1-2 hours',
      high: '4-8 hours',
      medium: '1-2 business days',
      low: '3-5 business days'
    };
    return timeMap[urgency];
  }

  private requiresFollowUp(content: string): boolean {
    const followUpIndicators = ['call back', 'follow up', 'check in', 'update me', 'let me know'];
    return followUpIndicators.some(indicator => content.toLowerCase().includes(indicator));
  }

  private parseCustomerResponse(response: any) {
    try {
      const content = response.message?.content || '';
      if (content.includes('{') && content.includes('}')) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      return { category: 'general', priority: 'medium', department: 'support' };
    } catch {
      return { category: 'general', priority: 'medium', department: 'support' };
    }
  }

  private suggestAssignment(categorization: any): string {
    const assignmentMap = {
      technical: 'Technical Support Team',
      billing: 'Billing Department',
      bug_report: 'Engineering Team',
      feature_request: 'Product Team',
      complaint: 'Customer Success Manager'
    };
    return assignmentMap[categorization.category as keyof typeof assignmentMap] || 'General Support';
  }

  private calculateSLA(priority: string): string {
    const slaMap = {
      urgent: '2 hours',
      high: '8 hours',
      medium: '24 hours',
      low: '72 hours'
    };
    return slaMap[priority as keyof typeof slaMap] || '24 hours';
  }

  private findSimilarTickets(content: string): string[] {
    // Simplified similar ticket matching
    return [`Similar: ${content.substring(0, 30)}...`];
  }

  private suggestQuickResponse(categorization: any): string {
    const responseMap = {
      billing: 'Thank you for contacting us about your billing inquiry. I\'ll review your account and get back to you within 24 hours.',
      technical: 'I understand you\'re experiencing a technical issue. Let me help you troubleshoot this step by step.',
      general: 'Thank you for reaching out. I\'m here to help resolve your inquiry promptly.'
    };
    return responseMap[categorization.category as keyof typeof responseMap] || responseMap.general;
  }

  // Additional helper methods...
  private getEscalationAssignee(reason: string): string {
    if (reason.includes('billing')) return 'Billing Manager';
    if (reason.includes('technical')) return 'Technical Lead';
    return 'Customer Success Manager';
  }

  private calculateEscalationSLA(): string {
    return '4 hours'; // Escalated issues get faster SLA
  }

  private getStakeholderList(reason: string): string[] {
    return ['Customer Success Manager', 'Support Team Lead', 'Department Manager'];
  }

  private createResolutionPlan(content: string): string {
    return content.split('\n').find(line => line.includes('resolution') || line.includes('plan')) || 'Custom resolution plan required';
  }

  private determineFollowUpType(context: string): string {
    if (context.includes('technical')) return 'solution_verification';
    if (context.includes('billing')) return 'payment_confirmation';
    return 'satisfaction_check';
  }

  private calculateFollowUpDate(context: string): string {
    const date = new Date();
    date.setDate(date.getDate() + 2); // 2 days from now
    return date.toISOString().split('T')[0];
  }

  private suggestResources(context: string): string[] {
    return ['Knowledge Base', 'User Guide', 'FAQ Section', 'Video Tutorials'];
  }

  private extractSatisfactionScore(data: any): number {
    return data?.rating || data?.score || 7; // Default to 7/10
  }

  private analyzeSatisfactionTrend(data: any): 'improving' | 'stable' | 'declining' {
    return data?.trend || 'stable';
  }

  private extractImprovementActions(content: string): string[] {
    return content.split('\n')
      .filter(line => line.includes('improve') || line.includes('enhance') || line.includes('better'))
      .slice(0, 3);
  }

  private assessRetentionRisk(data: any): 'low' | 'medium' | 'high' {
    const score = this.extractSatisfactionScore(data);
    if (score <= 5) return 'high';
    if (score <= 7) return 'medium';
    return 'low';
  }

  private generateTeamFeedback(content: string): string {
    return content.split('\n').find(line => line.includes('team') || line.includes('training')) || 'No specific team feedback identified';
  }

  private parseKnowledgeResults(response: any) {
    return {
      articles: [],
      totalResults: 0,
      searchTime: '0.2s',
      suggestions: []
    };
  }

  private calculateRelevanceScore(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(' ');
    const contentLower = content.toLowerCase();
    const matches = queryWords.filter(word => contentLower.includes(word)).length;
    return Math.round((matches / queryWords.length) * 100);
  }

  private extractArticleSuggestions(content: string): string[] {
    return content.split('\n')
      .filter(line => line.includes('article') || line.includes('guide') || line.includes('documentation'))
      .slice(0, 5);
  }

  private generateRelatedQueries(query: string): string[] {
    return [
      `How to ${query}`,
      `${query} troubleshooting`,
      `${query} best practices`
    ];
  }

  private identifyContentGaps(query: string, content: string): string[] {
    if (content.length < 100) {
      return [`Need more documentation for: ${query}`];
    }
    return [];
  }
} 