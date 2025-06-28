import { SmartLLMRouter, LLMMessage } from '../../llm';
import { SupabaseClient } from '../../database';
import { PDFProcessor, DocumentChunk } from './pdf-processor';
import { VectorStore } from './vector-store';

export interface KnowledgeTask {
  type: 'ask_question' | 'upload_document' | 'search_knowledge' | 'get_advice' | 'summarize_topic';
  query?: string;
  document?: Buffer;
  filename?: string;
  context?: string;
  businessGoal?: string;
}

export interface KnowledgeDocument {
  id: string;
  filename: string;
  summary: string;
  chunkCount: number;
  uploadedAt: Date;
  topics: string[];
}

export class KnowledgeAgent {
  private llmRouter: SmartLLMRouter;
  private pdfProcessor: PDFProcessor;
  private vectorStore: VectorStore;
  private userId: string;
  private documents: KnowledgeDocument[] = [];

  constructor(userId: string) {
    this.userId = userId;
    this.llmRouter = new SmartLLMRouter();
    this.pdfProcessor = new PDFProcessor();
    this.vectorStore = new VectorStore();
  }

  async processTask(task: KnowledgeTask): Promise<any> {
    console.log(`🧠 Knowledge Agent processing ${task.type} task...`);

    const conversation = await SupabaseClient.saveConversation({
      user_id: this.userId,
      agent_type: 'knowledge',
      state: { task, status: 'processing' },
      messages: []
    });

    try {
      let result;

      switch (task.type) {
        case 'upload_document':
          result = await this.uploadDocument(task.document!, task.filename!);
          break;
        case 'ask_question':
          result = await this.askQuestion(task.query!, task.context);
          break;
        case 'search_knowledge':
          result = await this.searchKnowledge(task.query!);
          break;
        case 'get_advice':
          result = await this.getBusinessAdvice(task.query!, task.businessGoal);
          break;
        case 'summarize_topic':
          result = await this.summarizeTopic(task.query!);
          break;
        default:
          throw new Error(`Unknown knowledge task type: ${task.type}`);
      }

      await SupabaseClient.saveConversation({
        ...conversation,
        state: { task, status: 'completed', result },
        messages: [...(conversation.messages || []), { type: 'result', content: result }]
      });

      return result;

    } catch (error) {
      console.error('❌ Knowledge Agent error:', error);
      
      await SupabaseClient.saveConversation({
        ...conversation,
        state: { task, status: 'failed', error: error.message }
      });
      
      throw error;
    }
  }

  async uploadDocument(buffer: Buffer, filename: string): Promise<any> {
    console.log(`📚 Uploading document: ${filename}`);

    // Process PDF into chunks
    const chunks = await this.pdfProcessor.processPDF(buffer, filename);
    
    // Generate document summary
    const summary = await this.pdfProcessor.generateSummary(chunks, filename);
    
    // Extract key topics
    const topics = await this.extractTopics(chunks);
    
    // Add to vector store
    await this.vectorStore.addDocuments(chunks);
    
    // Store document metadata
    const document: KnowledgeDocument = {
      id: `doc-${Date.now()}`,
      filename,
      summary,
      chunkCount: chunks.length,
      uploadedAt: new Date(),
      topics
    };
    
    this.documents.push(document);
    
    return {
      success: true,
      document,
      message: `Successfully processed ${filename}. Added ${chunks.length} knowledge chunks.`,
      summary,
      topics,
      chunkCount: chunks.length
    };
  }

  async askQuestion(question: string, context?: string): Promise<any> {
    console.log(`❓ Answering question: ${question}`);

    // Search for relevant knowledge
    const relevantChunks = await this.vectorStore.searchSimilar(question, 5);
    
    if (relevantChunks.length === 0) {
      return {
        answer: "I don't have enough knowledge to answer that question. Please upload relevant documents first.",
        confidence: 0,
        sources: []
      };
    }

    // Build context from relevant chunks
    const knowledgeContext = relevantChunks
      .map(chunk => `From "${chunk.metadata.filename}":\n${chunk.content}`)
      .join('\n\n---\n\n');

    const prompt = `
Based on the business knowledge below, answer this question comprehensively:

Question: ${question}
${context ? `Additional Context: ${context}` : ''}

Relevant Knowledge:
${knowledgeContext}

Provide a detailed, actionable answer based on the knowledge provided. Include:
1. Direct answer to the question
2. Key insights from the sources
3. Practical recommendations
4. If applicable, specific frameworks or strategies mentioned in the sources

Be specific and cite which sources support your recommendations.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a business knowledge advisor. Provide insightful, actionable advice based on the knowledge provided.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'complex');
    const content = typeof response.message?.content === 'string' 
      ? response.message.content 
      : JSON.stringify(response.message?.content);
    
    return {
      answer: content || 'Unable to generate answer',
      confidence: relevantChunks.length >= 3 ? 'high' : relevantChunks.length >= 2 ? 'medium' : 'low',
      sources: relevantChunks.map(chunk => ({
        filename: chunk.metadata.filename,
        page: chunk.metadata.page,
        excerpt: chunk.content.substring(0, 150) + '...'
      })),
      relatedTopics: this.extractRelatedTopics(relevantChunks)
    };
  }

  async searchKnowledge(query: string): Promise<any> {
    const relevantChunks = await this.vectorStore.searchSimilar(query, 10);
    
    return {
      query,
      results: relevantChunks.map(chunk => ({
        filename: chunk.metadata.filename,
        content: chunk.content,
        page: chunk.metadata.page,
        relevanceScore: Math.random() * 0.3 + 0.7 // Placeholder scoring
      })),
      totalResults: relevantChunks.length,
      searchTime: '0.2s'
    };
  }

  async getBusinessAdvice(situation: string, goal?: string): Promise<any> {
    const relevantChunks = await this.vectorStore.searchSimilar(situation, 8);
    
    const knowledgeContext = relevantChunks
      .map(chunk => `Source: ${chunk.metadata.filename}\n${chunk.content}`)
      .join('\n\n---\n\n');

    const prompt = `
As a business advisor with access to expert knowledge, provide strategic advice for this situation:

Business Situation: ${situation}
${goal ? `Desired Outcome: ${goal}` : ''}

Available Knowledge Base:
${knowledgeContext}

Provide comprehensive business advice including:
1. Situation Analysis
2. Strategic Recommendations
3. Specific Action Steps
4. Potential Risks & Mitigation
5. Success Metrics
6. Timeline Recommendations

Base your advice on the frameworks and strategies from the knowledge sources provided.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a senior business strategist and advisor. Provide actionable, strategic advice based on proven business frameworks.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'complex');
    const content = typeof response.message?.content === 'string' 
      ? response.message.content 
      : JSON.stringify(response.message?.content);
    
    return {
      advice: content || 'Unable to generate advice',
      situation,
      goal,
      supportingSources: relevantChunks.map(chunk => chunk.metadata.filename),
      confidenceLevel: relevantChunks.length >= 5 ? 'high' : 'medium',
      recommendedActions: this.extractActionItems(content || ''),
      followUpQuestions: this.generateFollowUpQuestions(situation)
    };
  }

  async summarizeTopic(topic: string): Promise<any> {
    const relevantChunks = await this.vectorStore.searchSimilar(topic, 15);
    
    const knowledgeContent = relevantChunks
      .map(chunk => chunk.content)
      .join('\n\n');

    const prompt = `
Create a comprehensive summary of everything in the knowledge base related to: ${topic}

Knowledge Content:
${knowledgeContent}

Provide:
1. Executive Summary
2. Key Concepts & Frameworks
3. Best Practices
4. Common Pitfalls to Avoid
5. Implementation Guidelines
6. Recommended Reading/Sources

Make this a definitive guide to ${topic} based on the available knowledge.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a knowledge synthesizer who creates comprehensive guides from multiple sources.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'complex');
    const content = typeof response.message?.content === 'string' 
      ? response.message.content 
      : JSON.stringify(response.message?.content);
    
    return {
      topic,
      summary: content || 'Unable to generate summary',
      sourceCount: relevantChunks.length,
      sourcesUsed: [...new Set(relevantChunks.map(chunk => chunk.metadata.filename))],
      keyTerms: this.extractKeyTerms(knowledgeContent),
      relatedTopics: this.extractRelatedTopics(relevantChunks)
    };
  }

  // Helper methods
  private async extractTopics(chunks: DocumentChunk[]): Promise<string[]> {
    const sampleText = chunks.slice(0, 10).map(c => c.content).join(' ');
    const words = sampleText.toLowerCase().split(/\W+/);
    const businessTerms = ['marketing', 'strategy', 'leadership', 'sales', 'finance', 'operations', 'growth', 'innovation'];
    
    return businessTerms.filter(term => 
      words.some(word => word.includes(term) || term.includes(word))
    );
  }

  private extractRelatedTopics(chunks: DocumentChunk[]): string[] {
    const topics = chunks.flatMap(chunk => 
      chunk.metadata.filename.split(/[-_.]/))
      .filter(topic => topic.length > 3)
      .slice(0, 5);
    return [...new Set(topics)];
  }

  private extractActionItems(text: string): string[] {
    return text.split('\n')
      .filter(line => 
        line.includes('action') || 
        line.includes('step') || 
        line.includes('implement') ||
        line.includes('start') ||
        line.includes('should')
      )
      .slice(0, 5);
  }

  private generateFollowUpQuestions(situation: string): string[] {
    return [
      `What are the key risks in this ${situation} scenario?`,
      `What metrics should I track for ${situation}?`,
      `What are successful case studies related to ${situation}?`,
      `What resources do I need for ${situation}?`,
      `What's the typical timeline for ${situation}?`
    ];
  }

  private extractKeyTerms(text: string): string[] {
    const words = text.toLowerCase().split(/\W+/);
    const commonBusinessTerms = words
      .filter(word => word.length > 4)
      .filter(word => ['strategy', 'framework', 'process', 'system', 'method', 'approach', 'model', 'principle'].some(term => word.includes(term)))
      .slice(0, 10);
    return [...new Set(commonBusinessTerms)];
  }

  // Public methods for orchestrator integration
  getDocuments(): KnowledgeDocument[] {
    return this.documents;
  }

  async getKnowledgeSummary(): Promise<string> {
    const totalChunks = this.documents.reduce((sum, doc) => sum + doc.chunkCount, 0);
    const topics = [...new Set(this.documents.flatMap(doc => doc.topics))];
    
    return `Knowledge Base: ${this.documents.length} documents, ${totalChunks} knowledge chunks covering: ${topics.join(', ')}`;
  }
} 