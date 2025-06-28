import { SmartLLMRouter, LLMMessage } from '../../llm/index.js';
import { SupabaseClient, AgentConversation } from '../../database/index.js';

export interface KnowledgeTask {
  type: 'upload_document' | 'ask_question' | 'search' | 'get_advice' | 'summarize_document' | 'extract_key_points';
  content?: string;
  documentId?: string;
  question?: string;
  searchQuery?: string;
  documentType?: 'pdf' | 'txt' | 'doc' | 'docx';
  documentContent?: string;
  context?: any;
}

export interface DocumentInfo {
  id: string;
  title: string;
  type: string;
  size: number;
  uploadDate: Date;
  summary?: string;
  keyPoints?: string[];
  embeddings?: number[];
}

export interface KnowledgeResponse {
  answer: string;
  confidence: number;
  sources: DocumentInfo[];
  relatedQuestions?: string[];
  followUpSuggestions?: string[];
}

export class KnowledgeAgent {
  private llmRouter: SmartLLMRouter;
  private userId: string;
  private documents: Map<string, DocumentInfo> = new Map();

  constructor(userId: string) {
    this.userId = userId;
    this.llmRouter = new SmartLLMRouter();
  }

  async processTask(task: KnowledgeTask): Promise<any> {
    console.log(`📚 Knowledge Agent processing ${task.type} task...`);

    // Save conversation state (optional - Supabase might not be configured)
    let conversation;
    try {
      conversation = await SupabaseClient.saveConversation({
        user_id: this.userId,
        agent_type: 'knowledge',
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
        case 'upload_document':
          result = await this.uploadDocument(task);
          break;
        case 'ask_question':
          result = await this.askQuestion(task);
          break;
        case 'search':
          result = await this.searchKnowledge(task);
          break;
        case 'get_advice':
          result = await this.getAdvice(task);
          break;
        case 'summarize_document':
          result = await this.summarizeDocument(task);
          break;
        case 'extract_key_points':
          result = await this.extractKeyPoints(task);
          break;
        default:
          throw new Error(`Unknown knowledge task type: ${task.type}`);
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
      console.error('❌ Knowledge Agent error:', error);
      
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

  // Document upload and processing
  async uploadDocument(task: KnowledgeTask): Promise<DocumentInfo> {
    if (!task.documentContent || !task.documentType) {
      throw new Error('Document content and type are required for upload');
    }

    console.log(`📄 Processing ${task.documentType} document...`);
    
    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Process document content
    const summary = await this.generateDocumentSummary(task.documentContent);
    const keyPoints = await this.extractKeyPointsFromContent(task.documentContent);
    
    const documentInfo: DocumentInfo = {
      id: documentId,
      title: task.content || `Document ${documentId}`,
      type: task.documentType,
      size: task.documentContent.length,
      uploadDate: new Date(),
      summary,
      keyPoints
    };

    // Store document in memory (in production, this would be in a database)
    this.documents.set(documentId, documentInfo);

    console.log(`✅ Document uploaded successfully: ${documentInfo.title}`);
    
    return documentInfo;
  }

  // Question answering
  async askQuestion(task: KnowledgeTask): Promise<KnowledgeResponse> {
    if (!task.question) {
      throw new Error('Question is required for ask_question task');
    }

    console.log(`❓ Processing question: ${task.question}`);
    
    // Search through available documents
    const relevantDocs = await this.findRelevantDocuments(task.question);
    
    if (relevantDocs.length === 0) {
      return {
        answer: "I don't have enough information in my knowledge base to answer this question. Please upload relevant documents first.",
        confidence: 0.1,
        sources: [],
        followUpSuggestions: [
          "Upload a document related to this topic",
          "Try rephrasing your question",
          "Ask a more general question"
        ]
      };
    }

    // Generate answer using LLM
    const context = relevantDocs.map(doc => `${doc.title}:\n${doc.summary}`).join('\n\n');
    
    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a knowledgeable business advisor. Answer questions based on the provided document context. Be concise but thorough.' },
      { role: 'user', content: `Context:\n${context}\n\nQuestion: ${task.question}` }
    ];

    const response = await this.llmRouter.route(messages, 'medium');
    const answer = (response.message?.content as string) || 'Unable to generate answer';

    // Generate follow-up suggestions
    const followUpSuggestions = await this.generateFollowUpQuestions(task.question, relevantDocs);

    return {
      answer,
      confidence: this.calculateConfidence(relevantDocs, task.question),
      sources: relevantDocs,
      followUpSuggestions
    };
  }

  // Knowledge search
  async searchKnowledge(task: KnowledgeTask): Promise<KnowledgeResponse[]> {
    if (!task.searchQuery) {
      throw new Error('Search query is required for search task');
    }

    console.log(`🔍 Searching knowledge base: ${task.searchQuery}`);
    
    const relevantDocs = await this.findRelevantDocuments(task.searchQuery);
    
    const results: KnowledgeResponse[] = [];
    
    for (const doc of relevantDocs) {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'Extract relevant information from the document based on the search query.' },
        { role: 'user', content: `Document: ${doc.summary}\n\nSearch Query: ${task.searchQuery}` }
      ];

      const response = await this.llmRouter.route(messages, 'simple');
      const extractedInfo = (response.message?.content as string) || 'No relevant information found';

      results.push({
        answer: extractedInfo,
        confidence: this.calculateConfidence([doc], task.searchQuery),
        sources: [doc]
      });
    }

    return results;
  }

  // Business advice generation
  async getAdvice(task: KnowledgeTask): Promise<KnowledgeResponse> {
    console.log(`💡 Generating business advice...`);
    
    const context = task.context || {};
    const question = task.question || task.content || 'Provide general business advice';
    
    // Get relevant documents for context
    const relevantDocs = await this.findRelevantDocuments(question);
    const documentContext = relevantDocs.length > 0 
      ? `\n\nRelevant documents:\n${relevantDocs.map(doc => `- ${doc.title}: ${doc.summary}`).join('\n')}`
      : '';

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are an experienced business consultant. Provide practical, actionable advice based on the context provided.' },
      { role: 'user', content: `Business Context: ${JSON.stringify(context)}${documentContext}\n\nRequest: ${question}` }
    ];

    const response = await this.llmRouter.route(messages, 'complex');
    const advice = (response.message?.content as string) || 'Unable to generate advice';

    return {
      answer: advice,
      confidence: 0.8,
      sources: relevantDocs,
      relatedQuestions: [
        "What are the key risks to consider?",
        "What metrics should I track?",
        "What are the next steps?"
      ]
    };
  }

  // Document summarization
  async summarizeDocument(task: KnowledgeTask): Promise<{ summary: string; keyPoints: string[] }> {
    if (!task.documentContent) {
      throw new Error('Document content is required for summarization');
    }

    console.log(`📝 Summarizing document...`);
    
    const summary = await this.generateDocumentSummary(task.documentContent);
    const keyPoints = await this.extractKeyPointsFromContent(task.documentContent);

    return { summary, keyPoints };
  }

  // Key points extraction
  async extractKeyPoints(task: KnowledgeTask): Promise<string[]> {
    if (!task.documentContent) {
      throw new Error('Document content is required for key points extraction');
    }

    console.log(`🎯 Extracting key points...`);
    
    return await this.extractKeyPointsFromContent(task.documentContent);
  }

  // Helper methods
  private async generateDocumentSummary(content: string): Promise<string> {
    const messages: LLMMessage[] = [
      { role: 'system', content: 'Create a concise summary of the document, highlighting the main points and key insights.' },
      { role: 'user', content: `Document content:\n${content.substring(0, 4000)}...` }
    ];

    const response = await this.llmRouter.route(messages, 'medium');
    return (response.message?.content as string) || 'Summary not available';
  }

  private async extractKeyPointsFromContent(content: string): Promise<string[]> {
    const messages: LLMMessage[] = [
      { role: 'system', content: 'Extract 5-7 key points from the document. Return as a numbered list.' },
      { role: 'user', content: `Document content:\n${content.substring(0, 4000)}...` }
    ];

    const response = await this.llmRouter.route(messages, 'medium');
    const responseContent = (response.message?.content as string) || '';
    
    // Parse numbered list
    const keyPoints = responseContent
      .split('\n')
      .filter((line: string) => /^\d+\./.test(line.trim()))
      .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
      .filter((point: string) => point.length > 0);

    return keyPoints.length > 0 ? keyPoints : ['Key points extraction failed'];
  }

  private async findRelevantDocuments(query: string): Promise<DocumentInfo[]> {
    // Simple keyword matching (in production, use vector similarity search)
    const queryLower = query.toLowerCase();
    const relevantDocs: DocumentInfo[] = [];

    for (const doc of this.documents.values()) {
      const searchableText = `${doc.title} ${doc.summary} ${doc.keyPoints?.join(' ')}`.toLowerCase();
      if (searchableText.includes(queryLower) || 
          queryLower.split(' ').some(word => searchableText.includes(word))) {
        relevantDocs.push(doc);
      }
    }

    return relevantDocs.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());
  }

  private calculateConfidence(docs: DocumentInfo[], query: string): number {
    // Simple confidence calculation based on document relevance
    if (docs.length === 0) return 0.1;
    if (docs.length >= 3) return 0.9;
    return 0.5 + (docs.length * 0.2);
  }

  private async generateFollowUpQuestions(originalQuestion: string, docs: DocumentInfo[]): Promise<string[]> {
    const messages: LLMMessage[] = [
      { role: 'system', content: 'Generate 3 relevant follow-up questions based on the original question and available documents.' },
      { role: 'user', content: `Original question: ${originalQuestion}\n\nAvailable documents: ${docs.map(d => d.title).join(', ')}` }
    ];

    const response = await this.llmRouter.route(messages, 'simple');
    const responseContent = (response.message?.content as string) || '';
    
    // Parse questions
    const questions = responseContent
      .split('\n')
      .filter((line: string) => line.trim().length > 0 && line.includes('?'))
      .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
      .slice(0, 3);

    return questions.length > 0 ? questions : [
      "What are the main takeaways?",
      "How can I apply this information?",
      "What should I do next?"
    ];
  }

  // Get all documents
  async getAllDocuments(): Promise<DocumentInfo[]> {
    return Array.from(this.documents.values());
  }

  // Get document by ID
  async getDocumentById(documentId: string): Promise<DocumentInfo | null> {
    return this.documents.get(documentId) || null;
  }

  // Delete document
  async deleteDocument(documentId: string): Promise<boolean> {
    return this.documents.delete(documentId);
  }
} 