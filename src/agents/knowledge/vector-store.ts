import { DocumentChunk } from './pdf-processor';
import { SupabaseClient } from '../../database';

export class VectorStore {
  private chunks: DocumentChunk[] = [];

  async addDocuments(chunks: DocumentChunk[]): Promise<void> {
    // Generate embeddings for each chunk
    for (const chunk of chunks) {
      chunk.embedding = await this.generateEmbedding(chunk.content);
    }
    
    this.chunks.push(...chunks);
    
    // Store in database
    await this.persistToDatabase(chunks);
    console.log(`📚 Added ${chunks.length} chunks to knowledge base`);
  }

  async searchSimilar(query: string, limit: number = 5): Promise<DocumentChunk[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Calculate similarity scores
    const scoredChunks = this.chunks.map(chunk => ({
      chunk,
      similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding || [])
    }));

    // Sort by similarity and return top results
    return scoredChunks
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => item.chunk);
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Simple embedding using text characteristics (for demo)
    // In production, use OpenAI embeddings or similar
    const words = text.toLowerCase().split(/\W+/);
    const embedding = new Array(100).fill(0);
    
    words.forEach((word, index) => {
      const hash = this.simpleHash(word) % 100;
      embedding[hash] += 1 / (index + 1); // Weight by position
    });
    
    return embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async persistToDatabase(chunks: DocumentChunk[]): Promise<void> {
    // Store chunks in Supabase for persistence
    try {
      for (const chunk of chunks) {
        await SupabaseClient.saveConversation({
          user_id: 'knowledge-system',
          agent_type: 'knowledge',
          state: { type: 'document_chunk', chunk },
          messages: []
        });
      }
    } catch (error) {
      console.warn('Failed to persist to database:', error);
    }
  }

  // Get all chunks for a specific document
  getChunksByDocument(filename: string): DocumentChunk[] {
    return this.chunks.filter(chunk => chunk.metadata.filename === filename);
  }

  // Get total chunk count
  getTotalChunks(): number {
    return this.chunks.length;
  }

  // Get unique documents
  getUniqueDocuments(): string[] {
    return [...new Set(this.chunks.map(chunk => chunk.metadata.filename))];
  }
} 