import * as pdfParse from 'pdf-parse';
import { SmartLLMRouter } from '../../llm';
import { LLMMessage } from '../../llm';

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    filename: string;
    page: number;
    chunkIndex: number;
    wordCount: number;
    uploadedAt: Date;
  };
  embedding?: number[];
}

export class PDFProcessor {
  private llmRouter: SmartLLMRouter;

  constructor() {
    this.llmRouter = new SmartLLMRouter();
  }

  async processPDF(buffer: Buffer, filename: string): Promise<DocumentChunk[]> {
    try {
      console.log(`📄 Processing PDF: ${filename}`);
      
      // Parse PDF
      const pdfData = await pdfParse(buffer);
      const fullText = pdfData.text;
      
      // Split into chunks (important for better retrieval)
      const chunks = this.splitIntoChunks(fullText, 1000, 200); // 1000 chars with 200 overlap
      
      // Create document chunks
      const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => ({
        id: `${filename}-chunk-${index}`,
        content: chunk.trim(),
        metadata: {
          filename,
          page: Math.floor(index / 5) + 1, // Rough page estimation
          chunkIndex: index,
          wordCount: chunk.split(' ').length,
          uploadedAt: new Date()
        }
      }));

      console.log(`✅ Processed ${documentChunks.length} chunks from ${filename}`);
      return documentChunks;

    } catch (error) {
      console.error(`❌ Error processing PDF ${filename}:`, error);
      throw new Error(`Failed to process PDF: ${error.message}`);
    }
  }

  private splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      const endIndex = Math.min(startIndex + chunkSize, text.length);
      const chunk = text.slice(startIndex, endIndex);
      
      // Try to break at sentence boundaries
      const lastSentence = chunk.lastIndexOf('.');
      const finalChunk = lastSentence > startIndex + chunkSize * 0.5 ? 
        chunk.slice(0, lastSentence + 1) : chunk;
      
      chunks.push(finalChunk);
      startIndex += chunkSize - overlap;
    }

    return chunks.filter(chunk => chunk.length > 50); // Filter out tiny chunks
  }

  async generateSummary(chunks: DocumentChunk[], filename: string): Promise<string> {
    // Combine first few chunks for summary
    const sampleText = chunks.slice(0, 5).map(c => c.content).join('\n\n');
    
    const prompt = `
Analyze this business book/document and provide a comprehensive summary:

Document: ${filename}
Content Sample: ${sampleText.substring(0, 2000)}

Provide:
1. Main topic/subject
2. Key concepts and frameworks
3. Target audience (entrepreneurs, marketers, etc.)
4. Practical applications
5. Most valuable insights

Format as a professional summary that will help a business owner understand the value of this knowledge.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a business knowledge analyst who creates insightful summaries of business literature.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'complex');
    const content = typeof response.message?.content === 'string' 
      ? response.message.content 
      : JSON.stringify(response.message?.content);
    return content || `Summary of ${filename}`;
  }
} 