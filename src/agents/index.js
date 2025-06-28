// Business agent implementations
// This directory contains specialized agents for different business functions:
// - email: Email processing and response agents
// - finance: Financial analysis and reporting agents  
// - social: Social media monitoring and engagement agents
// - customer: Customer service and support agents 
// - orchestrator: Master coordinator for multi-agent tasks
export { EmailAgent } from './email/email-agent.js';
export { FinanceAgent } from './finance/finance-agent.js';
export { SocialAgent } from './social/social-agent.js';
export { CustomerAgent } from './customer/customer-agent.js';
export { BusinessAgentOrchestrator } from './orchestrator.js';
