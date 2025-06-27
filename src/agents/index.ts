// Business agent implementations
// This directory contains specialized agents for different business functions:
// - email: Email processing and response agents
// - finance: Financial analysis and reporting agents  
// - social: Social media monitoring and engagement agents
// - customer: Customer service and support agents 
// - orchestrator: Master coordinator for multi-agent tasks

export { EmailAgent } from './email/email-agent';
export { FinanceAgent } from './finance/finance-agent';
export { SocialAgent } from './social/social-agent';
export { CustomerAgent } from './customer/customer-agent';
export { BusinessAgentOrchestrator } from './orchestrator';

// Agent types and interfaces
export type { EmailTask } from './email/email-agent';
export type { FinanceTask } from './finance/finance-agent';
export type { SocialTask } from './social/social-agent';
export type { CustomerTask } from './customer/customer-agent';
export type { BusinessTask, AgentTaskPlan } from './orchestrator'; 