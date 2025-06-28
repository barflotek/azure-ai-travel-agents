// Business agent implementations
// This directory contains specialized agents for different business functions:
// - email: Email processing and response agents
// - finance: Financial analysis and reporting agents  
// - social: Social media monitoring and engagement agents
// - customer: Customer service and support agents 
// - knowledge: Business knowledge and document processing agents
// - orchestrator: Master coordinator for multi-agent tasks

export { EmailAgent } from './email/email-agent.js';
export { FinanceAgent } from './finance/finance-agent.js';
export { SocialAgent } from './social/social-agent.js';
export { CustomerAgent } from './customer/customer-agent.js';
export { KnowledgeAgent } from './knowledge/knowledge-agent.js';
export { BusinessAgentOrchestrator } from './orchestrator.js';

// Agent types and interfaces
export type { EmailTask } from './email/email-agent';
export type { FinanceTask } from './finance/finance-agent';
export type { SocialTask } from './social/social-agent';
export type { CustomerTask } from './customer/customer-agent';
export type { KnowledgeTask, DocumentInfo, KnowledgeResponse } from './knowledge/knowledge-agent';
export type { BusinessTask, AgentTaskPlan } from './orchestrator'; 