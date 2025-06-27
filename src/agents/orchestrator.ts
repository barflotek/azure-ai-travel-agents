import { EmailAgent } from './email/email-agent';
import { FinanceAgent } from './finance/finance-agent';
import { SocialAgent } from './social/social-agent';
import { CustomerAgent } from './customer/customer-agent';
import { SmartLLMRouter, LLMMessage } from '../llm';
import { SupabaseClient } from '../database';

export interface BusinessTask {
  id?: string;
  type: 'multi_agent' | 'single_agent';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requiredAgents?: ('email' | 'finance' | 'social' | 'customer')[];
  context?: any;
  deadline?: string;
  userId: string;
}

export interface AgentTaskPlan {
  agentType: 'email' | 'finance' | 'social' | 'customer';
  taskType: string;
  taskData: any;
  dependencies?: string[];
  estimatedDuration?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export class BusinessAgentOrchestrator {
  private emailAgent: EmailAgent;
  private financeAgent: FinanceAgent;
  private socialAgent: SocialAgent;
  private customerAgent: CustomerAgent;
  private llmRouter: SmartLLMRouter;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.emailAgent = new EmailAgent(userId);
    this.financeAgent = new FinanceAgent(userId);
    this.socialAgent = new SocialAgent(userId);
    this.customerAgent = new CustomerAgent(userId);
    this.llmRouter = new SmartLLMRouter();
  }

  async processBusinessTask(task: BusinessTask): Promise<any> {
    console.log(`🎯 Orchestrator processing: ${task.description}`);
    console.log(`📊 Priority: ${task.priority} | Type: ${task.type}`);

    // Save orchestration state
    const orchestrationState = await SupabaseClient.saveConversation({
      user_id: this.userId,
      agent_type: 'orchestrator',
      state: { task, status: 'planning' },
      messages: []
    });

    try {
      // Step 1: Plan the task execution
      const executionPlan = await this.planExecution(task);
      console.log(`📋 Execution plan created with ${executionPlan.length} steps`);

      // Step 2: Execute the plan
      const results = await this.executePlan(executionPlan, task);
      console.log(`✅ Plan executed successfully`);

      // Step 3: Synthesize results
      const finalResult = await this.synthesizeResults(results, task);
      console.log(`🎯 Results synthesized`);

      // Update orchestration state
      await SupabaseClient.saveConversation({
        ...orchestrationState,
        state: { 
          task, 
          status: 'completed', 
          executionPlan, 
          results, 
          finalResult 
        },
        messages: [
          { type: 'plan', content: executionPlan },
          { type: 'results', content: results },
          { type: 'synthesis', content: finalResult }
        ]
      });

      return {
        taskId: task.id || `TASK-${Date.now()}`,
        description: task.description,
        status: 'completed',
        executionPlan,
        agentResults: results,
        finalResult,
        completedAt: new Date().toISOString(),
        totalSteps: executionPlan.length,
        successfulSteps: results.filter((r: any) => r.success).length
      };

    } catch (error) {
      console.error('❌ Orchestrator error:', error);
      
      await SupabaseClient.saveConversation({
        ...orchestrationState,
        state: { task, status: 'failed', error: error.message }
      });
      
      throw error;
    }
  }

  private async planExecution(task: BusinessTask): Promise<AgentTaskPlan[]> {
    console.log('🧠 Creating execution plan...');

    const prompt = `
Analyze this business task and create an execution plan using available agents:

Task: "${task.description}"
Priority: ${task.priority}
Context: ${JSON.stringify(task.context, null, 2)}
Deadline: ${task.deadline || 'Not specified'}

Available Agents:
1. EMAIL AGENT - Compose emails, reply to emails, categorize emails, summarize emails
2. FINANCE AGENT - Categorize expenses, generate reports, analyze transactions, budget forecasts, generate invoices
3. SOCIAL AGENT - Create posts, schedule content, analyze engagement, respond to comments, hashtag research, competitor analysis
4. CUSTOMER AGENT - Respond to inquiries, categorize tickets, escalate issues, follow up, satisfaction surveys, knowledge base search

Create a step-by-step execution plan:
1. Identify which agents are needed
2. Determine the sequence of agent tasks
3. Specify the task type for each agent
4. Include any dependencies between tasks
5. Estimate duration for each step

Format as JSON array with this structure:
[
  {
    "agentType": "email|finance|social|customer",
    "taskType": "specific_task_name",
    "taskData": { "task_specific_data": "here" },
    "dependencies": ["previous_step_ids"],
    "estimatedDuration": "time_estimate",
    "priority": "priority_level"
  }
]

Return ONLY the JSON array, no additional text.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are an AI task planning specialist. Analyze business tasks and create optimal execution plans using available agents.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'complex');
    
    try {
      const content = response.message?.content || '[]';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]);
        return this.validateAndEnhancePlan(plan, task);
      }
      
      // Fallback: create simple plan
      return this.createFallbackPlan(task);
      
    } catch (error) {
      console.warn('Plan parsing failed, using fallback:', error);
      return this.createFallbackPlan(task);
    }
  }

  private async executePlan(executionPlan: AgentTaskPlan[], task: BusinessTask): Promise<any[]> {
    console.log(`🚀 Executing plan with ${executionPlan.length} steps...`);
    
    const results: any[] = [];
    const completedSteps: string[] = [];

    for (const [index, step] of executionPlan.entries()) {
      console.log(`📍 Step ${index + 1}/${executionPlan.length}: ${step.agentType} - ${step.taskType}`);
      
      // Check dependencies
      if (step.dependencies && step.dependencies.length > 0) {
        const unmetDependencies = step.dependencies.filter(dep => !completedSteps.includes(dep));
        if (unmetDependencies.length > 0) {
          console.log(`⏳ Waiting for dependencies: ${unmetDependencies.join(', ')}`);
          // In a real implementation, this would wait or reorder tasks
        }
      }

      try {
        const stepResult = await this.executeAgentTask(step);
        results.push({
          stepIndex: index,
          agentType: step.agentType,
          taskType: step.taskType,
          success: true,
          result: stepResult,
          completedAt: new Date().toISOString()
        });
        
        completedSteps.push(`step_${index}`);
        console.log(`✅ Step ${index + 1} completed successfully`);
        
      } catch (error) {
        console.error(`❌ Step ${index + 1} failed:`, error);
        results.push({
          stepIndex: index,
          agentType: step.agentType,
          taskType: step.taskType,
          success: false,
          error: error.message,
          completedAt: new Date().toISOString()
        });
        
        // Decide whether to continue or abort based on priority
        if (step.priority === 'urgent' || step.priority === 'high') {
          console.log('🛑 Critical step failed, aborting execution');
          break;
        }
      }
    }

    return results;
  }

  private async executeAgentTask(step: AgentTaskPlan): Promise<any> {
    switch (step.agentType) {
      case 'email':
        return await this.emailAgent.processTask(step.taskData);
      
      case 'finance':
        return await this.financeAgent.processTask(step.taskData);
      
      case 'social':
        return await this.socialAgent.processTask(step.taskData);
      
      case 'customer':
        return await this.customerAgent.processTask(step.taskData);
      
      default:
        throw new Error(`Unknown agent type: ${step.agentType}`);
    }
  }

  private async synthesizeResults(results: any[], task: BusinessTask): Promise<any> {
    console.log('🔄 Synthesizing results from all agents...');

    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    const prompt = `
Synthesize the results from multiple AI agents working on this business task:

Original Task: "${task.description}"
Priority: ${task.priority}

Successful Agent Results:
${JSON.stringify(successfulResults, null, 2)}

Failed Agent Results:
${JSON.stringify(failedResults, null, 2)}

Provide a comprehensive summary including:
1. Executive summary of what was accomplished
2. Key outcomes and deliverables
3. Any issues or failures and their impact
4. Recommendations for next steps
5. Overall success assessment
6. Lessons learned for future tasks

Format as a professional business report.
`;

    const messages: LLMMessage[] = [
      { role: 'system', content: 'You are an executive assistant providing comprehensive summaries of multi-agent business task execution.' },
      { role: 'user', content: prompt }
    ];

    const response = await this.llmRouter.route(messages, 'complex');
    
    return {
      summary: response.message?.content || 'Error synthesizing results',
      totalSteps: results.length,
      successfulSteps: successfulResults.length,
      failedSteps: failedResults.length,
      successRate: Math.round((successfulResults.length / results.length) * 100),
      overallStatus: failedResults.length === 0 ? 'success' : 
                   successfulResults.length > failedResults.length ? 'partial_success' : 'failure',
      agentPerformance: this.analyzeAgentPerformance(results),
      recommendations: this.extractRecommendations(response.message?.content || ''),
      synthesizedAt: new Date().toISOString()
    };
  }

  private validateAndEnhancePlan(plan: any[], task: BusinessTask): AgentTaskPlan[] {
    // Add default values and validation
    return plan.map((step, index) => ({
      agentType: step.agentType,
      taskType: step.taskType,
      taskData: step.taskData || {},
      dependencies: step.dependencies || [],
      estimatedDuration: step.estimatedDuration || '5-10 minutes',
      priority: step.priority || task.priority
    }));
  }

  private createFallbackPlan(task: BusinessTask): AgentTaskPlan[] {
    // Simple fallback plan based on keywords in task description
    const description = task.description.toLowerCase();
    const plan: AgentTaskPlan[] = [];

    if (description.includes('email') || description.includes('message')) {
      plan.push({
        agentType: 'email',
        taskType: 'compose',
        taskData: { content: task.description, type: 'compose' },
        priority: task.priority,
        estimatedDuration: '5 minutes'
      });
    }

    if (description.includes('social') || description.includes('post')) {
      plan.push({
        agentType: 'social',
        taskType: 'create_post',
        taskData: { content: task.description, type: 'create_post' },
        priority: task.priority,
        estimatedDuration: '10 minutes'
      });
    }

    if (description.includes('finance') || description.includes('money') || description.includes('cost')) {
      plan.push({
        agentType: 'finance',
        taskType: 'analyze_transaction',
        taskData: { description: task.description, type: 'analyze_transaction' },
        priority: task.priority,
        estimatedDuration: '8 minutes'
      });
    }

    if (description.includes('customer') || description.includes('support')) {
      plan.push({
        agentType: 'customer',
        taskType: 'respond_inquiry',
        taskData: { 
          customerMessage: { content: task.description },
          type: 'respond_inquiry' 
        },
        priority: task.priority,
        estimatedDuration: '7 minutes'
      });
    }

    // If no specific agents identified, default to customer service
    if (plan.length === 0) {
      plan.push({
        agentType: 'customer',
        taskType: 'knowledge_base',
        taskData: { 
          knowledgeQuery: task.description,
          type: 'knowledge_base' 
        },
        priority: task.priority,
        estimatedDuration: '5 minutes'
      });
    }

    return plan;
  }

  private analyzeAgentPerformance(results: any[]) {
    const agentStats = {
      email: { total: 0, successful: 0 },
      finance: { total: 0, successful: 0 },
      social: { total: 0, successful: 0 },
      customer: { total: 0, successful: 0 }
    };

    results.forEach(result => {
      const agent = result.agentType as keyof typeof agentStats;
      if (agentStats[agent]) {
        agentStats[agent].total++;
        if (result.success) {
          agentStats[agent].successful++;
        }
      }
    });

    return Object.entries(agentStats).map(([agent, stats]) => ({
      agent,
      successRate: stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0,
      totalTasks: stats.total
    }));
  }

  private extractRecommendations(content: string): string[] {
    return content.split('\n')
      .filter(line => 
        line.includes('recommend') || 
        line.includes('suggest') || 
        line.includes('next step') ||
        line.includes('should')
      )
      .slice(0, 5);
  }

  // Quick task methods for common business scenarios
  async handleCustomerComplaint(customerData: any) {
    return this.processBusinessTask({
      type: 'multi_agent',
      description: `Handle customer complaint from ${customerData.name}: ${customerData.complaint}`,
      priority: 'high',
      requiredAgents: ['customer', 'email'],
      context: customerData,
      userId: this.userId
    });
  }

  async launchSocialCampaign(campaignData: any) {
    return this.processBusinessTask({
      type: 'multi_agent',
      description: `Launch social media campaign: ${campaignData.title}`,
      priority: 'medium',
      requiredAgents: ['social', 'email'],
      context: campaignData,
      userId: this.userId
    });
  }

  async monthlyFinancialReport(reportData: any) {
    return this.processBusinessTask({
      type: 'multi_agent',
      description: `Generate monthly financial report and email to stakeholders`,
      priority: 'medium',
      requiredAgents: ['finance', 'email'],
      context: reportData,
      userId: this.userId
    });
  }

  async getAgentStatus() {
    const status = await this.llmRouter.getProviderStatus();
    return {
      orchestrator: 'active',
      agents: {
        email: 'active',
        finance: 'active',
        social: 'active',
        customer: 'active'
      },
      llmProviders: status,
      userId: this.userId,
      timestamp: new Date().toISOString()
    };
  }
} 