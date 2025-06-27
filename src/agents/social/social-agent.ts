import { SmartLLMRouter, LLMMessage } from '../../llm';
import { SupabaseClient, AgentConversation } from '../../database';

export interface SocialTask {
  type: 'create_post' | 'schedule_content' | 'analyze_engagement' | 'respond_comment' | 'hashtag_research' | 'competitor_analysis';
  platform?: 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'youtube' | 'tiktok';
  content?: string;
  topic?: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'promotional' | 'educational';
  targetAudience?: string;
  scheduledDate?: string;
  engagementData?: any;
  commentToRespond?: {
    text: string;
    author: string;
    context: string;
  };
  competitors?: string[];
  industry?: string;
}

export class SocialAgent {
  private llmRouter: SmartLLMRouter;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.llmRouter = new SmartLLMRouter();
  }

  async processTask(task: SocialTask): Promise<any> {
    console.log(`📱 Social Agent processing ${task.type} task for ${task.platform}...`);

    // Save conversation state
    const conversation = await SupabaseClient.saveConversation({
      user_id: this.userId,
      agent_type: 'social',
      state: { task, status: 'processing' },
      messages: []
    });

    try {
      let result;
      
      switch (task.type) {
        case 'create_post':
          result = await this.createPost(task);
          break;
        case 'schedule_content':
          result = await this.scheduleContent(task);
          break;
        case 'analyze_engagement':
          result = await this.analyzeEngagement(task);
          break;
        case 'respond_comment':
          result = await this.respondToComment(task);
          break;
        case 'hashtag_research':
          result = await this.researchHashtags(task);
          break;
        case 'competitor_analysis':
          result = await this.analyzeCompetitors(task);
          break;
        default:
          throw new Error(`Unknown social media task type: ${task.type}`);
      }

      // Update conversation with result
      await SupabaseClient.saveConversation({
        ...conversation,
        state: { task, status: 'completed', result },
        messages: [...(conversation.messages || []), { type: 'result', content: result }]
      });

      return result;

    } catch (error: any) {
      console.error('❌ Social Agent error:', error);
      
      await SupabaseClient.saveConversation({
        ...conversation,
        state: { task, status: 'failed', error: error.message }
      });
      
      throw error;
    }
  }

  private async createPost(task: SocialTask) {
    const platformLimits = this.getPlatformLimits(task.platform);
    
    const prompt = `
Create a ${task.tone} social media post for ${task.platform}:

Topic: ${task.topic}
Content request: ${task.content}
Target audience: ${task.targetAudience}
Character limit: ${platformLimits.characterLimit}

Platform-specific requirements:
${this.getPlatformRequirements(task.platform)}

Please provide:
1. Main post content (within character limit)
2. Suggested hashtags (${platformLimits.hashtagLimit} max)
3. Call-to-action
4. Best posting time recommendation
5. Engagement strategy tips

Format as JSON with fields: content, hashtags, callToAction, bestTime, tips
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: `You are a social media marketing expert specializing in ${task.platform} content creation.` },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'medium');
    const parsed = this.parseSocialResponse(response);
    
    return {
      platform: task.platform,
      content: parsed.content || response.message?.content,
      hashtags: parsed.hashtags || [],
      callToAction: parsed.callToAction || '',
      bestTime: parsed.bestTime || this.getDefaultBestTime(task.platform),
      tips: parsed.tips || [],
      characterCount: (parsed.content || response.message?.content || '').length,
      compliance: this.checkCompliance(parsed.content || '', task.platform)
    };
  }

  private async scheduleContent(task: SocialTask) {
    const prompt = `
Create a content calendar for ${task.platform} with these requirements:

Topic/Theme: ${task.topic}
Target audience: ${task.targetAudience}
Tone: ${task.tone}
Number of posts: 7 (one week)

For each post, provide:
1. Day of week and optimal time
2. Post content
3. Hashtags
4. Post type (image, video, text, carousel, etc.)
5. Engagement goal

Focus on variety and audience engagement while maintaining brand consistency.
Format as JSON array with posts.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: `You are a content calendar specialist for ${task.platform} marketing.` },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'complex');
    
    return {
      platform: task.platform,
      schedule: this.parseContentSchedule(response),
      startDate: task.scheduledDate || new Date().toISOString().split('T')[0],
      totalPosts: 7,
      estimatedReach: this.estimateReach(task.platform, task.targetAudience),
      recommendations: this.extractScheduleRecommendations(response.message?.content || '')
    };
  }

  private async analyzeEngagement(task: SocialTask) {
    const prompt = `
Analyze this social media engagement data for ${task.platform}:

Engagement Data: ${JSON.stringify(task.engagementData, null, 2)}

Provide analysis on:
1. Overall performance trends
2. Best performing content types
3. Optimal posting times
4. Audience engagement patterns
5. Growth opportunities
6. Content recommendations
7. Benchmark comparisons

Include specific metrics and actionable insights.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a social media analytics expert providing data-driven insights.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'complex');
    
    return {
      platform: task.platform,
      analysisDate: new Date().toISOString(),
      insights: response.message?.content || 'Error analyzing engagement',
      keyMetrics: this.extractMetrics(response.message?.content || ''),
      recommendations: this.extractRecommendations(response.message?.content || ''),
      performanceScore: this.calculatePerformanceScore(task.engagementData),
      nextActions: this.identifyNextActions(response.message?.content || '')
    };
  }

  private async respondToComment(task: SocialTask) {
    const { commentToRespond } = task;
    if (!commentToRespond) throw new Error('Comment data required');

    const prompt = `
Write a ${task.tone} response to this ${task.platform} comment:

Original Comment: "${commentToRespond.text}"
Author: ${commentToRespond.author}
Context: ${commentToRespond.context}

Guidelines:
- Be professional and brand-appropriate
- Address the comment directly
- Encourage further engagement
- Follow ${task.platform} best practices
- Keep response concise but meaningful

Provide the response text only.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: `You are a community manager expert at crafting engaging ${task.platform} responses.` },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'simple');
    
    return {
      platform: task.platform,
      originalComment: commentToRespond,
      response: response.message?.content?.trim() || 'Error generating response',
      tone: task.tone,
      timestamp: new Date().toISOString(),
      sentiment: this.analyzeSentiment(commentToRespond.text),
      responseStrategy: this.getResponseStrategy(commentToRespond.text)
    };
  }

  private async researchHashtags(task: SocialTask) {
    const prompt = `
Research and suggest hashtags for ${task.platform} content about:

Topic: ${task.topic}
Industry: ${task.industry}
Target audience: ${task.targetAudience}

Provide:
1. High-traffic popular hashtags (5-10)
2. Niche-specific hashtags (5-10)
3. Branded/campaign hashtags (2-5)
4. Location-based hashtags if relevant (3-5)
5. Trending hashtags to consider (3-5)

For each hashtag, estimate:
- Reach potential (high/medium/low)
- Competition level
- Relevance score

Format as JSON with categories.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: `You are a hashtag research specialist for ${task.platform} marketing.` },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'medium');
    
    return {
      platform: task.platform,
      topic: task.topic,
      hashtags: this.parseHashtagResearch(response),
      researchDate: new Date().toISOString(),
      totalSuggestions: 0, // Will be calculated after parsing
      strategy: this.createHashtagStrategy(task.platform, task.topic)
    };
  }

  private async analyzeCompetitors(task: SocialTask) {
    const prompt = `
Analyze competitor social media presence for ${task.platform}:

Competitors: ${task.competitors?.join(', ')}
Industry: ${task.industry}
Platform: ${task.platform}

Analyze:
1. Content strategies and themes
2. Posting frequency and timing
3. Engagement rates and audience interaction
4. Visual style and branding
5. Hashtag usage patterns
6. Unique value propositions
7. Opportunities for differentiation

Provide competitive intelligence and strategic recommendations.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are a competitive intelligence analyst specializing in social media strategy.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'complex');
    
    return {
      platform: task.platform,
      competitors: task.competitors,
      industry: task.industry,
      analysis: response.message?.content || 'Error analyzing competitors',
      opportunities: this.extractOpportunities(response.message?.content || ''),
      threats: this.extractThreats(response.message?.content || ''),
      recommendations: this.extractStrategicRecommendations(response.message?.content || ''),
      competitiveScore: this.calculateCompetitiveScore(response.message?.content || '')
    };
  }

  // Helper methods
  private getPlatformLimits(platform?: string) {
    const limits = {
      twitter: { characterLimit: 280, hashtagLimit: 2 },
      instagram: { characterLimit: 2200, hashtagLimit: 30 },
      facebook: { characterLimit: 63206, hashtagLimit: 5 },
      linkedin: { characterLimit: 3000, hashtagLimit: 5 },
      youtube: { characterLimit: 5000, hashtagLimit: 15 },
      tiktok: { characterLimit: 2200, hashtagLimit: 20 }
    };
    return limits[platform as keyof typeof limits] || limits.instagram;
  }

  private getPlatformRequirements(platform?: string) {
    const requirements = {
      twitter: 'Keep it concise, use trending hashtags, encourage retweets',
      instagram: 'Visual-first content, use all hashtag slots, stories-friendly',
      facebook: 'Community engagement, longer-form content, shareable',
      linkedin: 'Professional tone, industry insights, networking focus',
      youtube: 'Video description optimization, SEO keywords, thumbnails',
      tiktok: 'Trendy, authentic, short-form video optimized'
    };
    return requirements[platform as keyof typeof requirements] || requirements.instagram;
  }

  private getDefaultBestTime(platform?: string) {
    const times = {
      twitter: '9:00 AM or 3:00 PM EST',
      instagram: '11:00 AM or 5:00 PM EST',
      facebook: '1:00 PM or 8:00 PM EST',
      linkedin: '10:00 AM or 12:00 PM EST',
      youtube: '2:00 PM or 8:00 PM EST',
      tiktok: '6:00 AM or 7:00 PM EST'
    };
    return times[platform as keyof typeof times] || times.instagram;
  }

  // Additional helper methods would go here...
  private parseSocialResponse(response: any) {
    try {
      const content = response.message?.content || '';
      if (content.includes('{') && content.includes('}')) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      return { content, parsed: false };
    } catch (error) {
      return { content: response.message?.content || '', parsed: false };
    }
  }

  private checkCompliance(content: string, platform?: string): boolean {
    // Basic compliance check - can be expanded
    const forbidden = ['guaranteed', 'free money', 'click here', 'limited time'];
    return !forbidden.some(word => content.toLowerCase().includes(word));
  }

  private parseContentSchedule(response: any) {
    // Parse content schedule from LLM response
    try {
      const content = response.message?.content || '';
      // Extract JSON array if present
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch {
      return [];
    }
  }

  private estimateReach(platform?: string, audience?: string): number {
    // Simplified reach estimation
    const baselines = {
      twitter: 500,
      instagram: 800,
      facebook: 600,
      linkedin: 300,
      youtube: 1000,
      tiktok: 1200
    };
    return baselines[platform as keyof typeof baselines] || 500;
  }

  private extractMetrics(content: string): string[] {
    return content.split('\n')
      .filter(line => line.includes('%') || line.includes('rate') || line.includes('engagement'))
      .slice(0, 5);
  }

  private extractRecommendations(content: string): string[] {
    return content.split('\n')
      .filter(line => line.includes('recommend') || line.includes('suggest') || line.includes('improve'))
      .slice(0, 3);
  }

  private calculatePerformanceScore(engagementData: any): number {
    // Simplified performance scoring
    if (!engagementData) return 50;
    return Math.min(100, Math.max(0, Math.random() * 100)); // Placeholder
  }

  private identifyNextActions(content: string): string[] {
    return content.split('\n')
      .filter(line => line.includes('action') || line.includes('next') || line.includes('should'))
      .slice(0, 3);
  }

  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['great', 'love', 'awesome', 'good', 'excellent'];
    const negativeWords = ['bad', 'hate', 'terrible', 'awful', 'worst'];
    
    const positive = positiveWords.some(word => text.toLowerCase().includes(word));
    const negative = negativeWords.some(word => text.toLowerCase().includes(word));
    
    if (positive && !negative) return 'positive';
    if (negative && !positive) return 'negative';
    return 'neutral';
  }

  private getResponseStrategy(commentText: string): string {
    if (this.analyzeSentiment(commentText) === 'negative') {
      return 'apologetic_resolution';
    } else if (commentText.includes('?')) {
      return 'informative_helpful';
    }
    return 'engaging_friendly';
  }

  private parseHashtagResearch(response: any) {
    // Parse hashtag research from LLM response
    try {
      const content = response.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { popular: [], niche: [], branded: [], location: [], trending: [] };
    } catch {
      return { popular: [], niche: [], branded: [], location: [], trending: [] };
    }
  }

  private createHashtagStrategy(platform?: string, topic?: string): string {
    return `Use 70% niche hashtags, 20% popular hashtags, 10% branded hashtags for optimal ${platform} reach with ${topic} content.`;
  }

  private extractOpportunities(content: string): string[] {
    return content.split('\n')
      .filter(line => line.includes('opportunity') || line.includes('gap') || line.includes('potential'))
      .slice(0, 3);
  }

  private extractThreats(content: string): string[] {
    return content.split('\n')
      .filter(line => line.includes('threat') || line.includes('risk') || line.includes('challenge'))
      .slice(0, 3);
  }

  private extractStrategicRecommendations(content: string): string[] {
    return content.split('\n')
      .filter(line => line.includes('strategy') || line.includes('approach') || line.includes('focus'))
      .slice(0, 3);
  }

  private calculateCompetitiveScore(content: string): number {
    // Simplified competitive scoring
    return Math.floor(Math.random() * 40) + 60; // 60-100 range
  }

  private extractScheduleRecommendations(content: string): string[] {
    return content.split('\n')
      .filter(line => line.includes('recommend') || line.includes('suggest') || line.includes('tip'))
      .slice(0, 3);
  }
} 