#!/usr/bin/env node

import 'dotenv/config';

import { 
  EmailAgent, 
  FinanceAgent, 
  SocialAgent, 
  CustomerAgent, 
  BusinessAgentOrchestrator 
} from './agents/index.ts';
import { SmartLLMRouter } from './llm';
import { SupabaseClient } from './database';

const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000'; // Proper UUID format

async function testLLMRouter() {
  console.log('\n🧪 Testing LLM Router...');
  
  try {
    const router = new SmartLLMRouter();
    
    // Test simple query
    const simpleResponse = await router.route([
      { role: 'user', content: 'Hello, how are you?' }
    ], 'simple');
    
    console.log('✅ Simple query test passed');
    console.log('   Response:', simpleResponse.message?.content?.substring(0, 100) + '...');
    
    // Test medium complexity query
    const mediumResponse = await router.route([
      { role: 'user', content: 'Explain the benefits of customer service automation in 3 points.' }
    ], 'medium');
    
    console.log('✅ Medium complexity test passed');
    console.log('   Response:', mediumResponse.message?.content?.substring(0, 100) + '...');
    
    return true;
  } catch (error) {
    console.error('❌ LLM Router test failed:', error);
    return false;
  }
}

async function testDatabaseConnection() {
  console.log('\n🗄️ Testing Database Connection...');
  
  try {
    // Test basic connection
    const testConversation = await SupabaseClient.saveConversation({
      user_id: TEST_USER_ID,
      agent_type: 'test',
      state: { test: true },
      messages: [{ type: 'test', content: 'Database test message' }]
    });
    
    console.log('✅ Database save test passed');
    console.log('   Conversation ID:', testConversation.id);
    
    // Test retrieval
    const retrieved = await SupabaseClient.getConversation(testConversation.id);
    console.log('✅ Database retrieval test passed');
    console.log('   Retrieved conversation:', retrieved ? 'found' : 'not found');
    
    return true;
  } catch (error) {
    console.error('❌ Database test failed:', error);
    return false;
  }
}

async function testEmailAgent() {
  console.log('\n📧 Testing Email Agent...');
  
  try {
    const emailAgent = new EmailAgent(TEST_USER_ID);
    
    // Test email composition
    const composeResult = await emailAgent.processTask({
      type: 'compose',
      subject: 'Welcome to Our Service',
      recipient: 'customer@example.com',
      content: 'Write a professional welcome email for a new customer'
    });
    
    console.log('✅ Email composition test passed');
    console.log('   Subject:', composeResult.subject);
    console.log('   Content length:', composeResult.content.length);
    
    // Test email categorization
    const categorizeResult = await emailAgent.processTask({
      type: 'categorize',
      content: 'I need help with my billing statement from last month'
    });
    
    console.log('✅ Email categorization test passed');
    console.log('   Category:', categorizeResult.category);
    console.log('   Priority:', categorizeResult.priority);
    
    return true;
  } catch (error) {
    console.error('❌ Email Agent test failed:', error);
    return false;
  }
}

async function testFinanceAgent() {
  console.log('\n💰 Testing Finance Agent...');
  
  try {
    const financeAgent = new FinanceAgent(TEST_USER_ID);
    
    // Test expense categorization
    const categorizeResult = await financeAgent.processTask({
      type: 'categorize_expense',
      description: 'Office supplies from Staples - $45.67',
      amount: 45.67,
      date: new Date().toISOString()
    });
    
    console.log('✅ Expense categorization test passed');
    console.log('   Category:', categorizeResult.category);
    console.log('   Confidence:', categorizeResult.confidence);
    
    // Test report generation
    const reportResult = await financeAgent.processTask({
      type: 'generate_report',
      reportType: 'expense_summary',
      period: 'monthly'
    });
    
    console.log('✅ Report generation test passed');
    console.log('   Report type:', reportResult.reportType);
    console.log('   Summary length:', reportResult.summary.length);
    
    return true;
  } catch (error) {
    console.error('❌ Finance Agent test failed:', error);
    return false;
  }
}

async function testSocialAgent() {
  console.log('\n📱 Testing Social Agent...');
  
  try {
    const socialAgent = new SocialAgent(TEST_USER_ID);
    
    // Test post creation
    const createResult = await socialAgent.processTask({
      type: 'create_post',
      platform: 'twitter',
      content: 'Create an engaging post about customer service tips'
    });
    
    console.log('✅ Post creation test passed');
    console.log('   Platform:', createResult.platform);
    console.log('   Content length:', createResult.content.length);
    console.log('   Hashtags:', createResult.hashtags?.length || 0);
    
    // Test engagement analysis
    const analysisResult = await socialAgent.processTask({
      type: 'analyze_engagement',
      platform: 'instagram',
      engagementData: {
        likes: 150,
        comments: 25,
        shares: 10,
        reach: 2500
      }
    });
    
    console.log('✅ Engagement analysis test passed');
    console.log('   Platform:', analysisResult.platform);
    console.log('   Analysis length:', analysisResult.insights.length);
    
    return true;
  } catch (error) {
    console.error('❌ Social Agent test failed:', error);
    return false;
  }
}

async function testCustomerAgent() {
  console.log('\n🎧 Testing Customer Agent...');
  
  try {
    const customerAgent = new CustomerAgent(TEST_USER_ID);
    
    // Test inquiry response
    const responseResult = await customerAgent.processTask({
      type: 'respond_inquiry',
      priority: 'high',
      customerMessage: {
        content: 'I can\'t log into my account and need help immediately!',
        customerName: 'John Smith',
        email: 'john@example.com',
        channel: 'email',
        timestamp: new Date().toISOString()
      },
      context: 'Account access issue'
    });
    
    console.log('✅ Inquiry response test passed');
    console.log('   Ticket ID:', responseResult.ticketId);
    console.log('   Sentiment:', responseResult.sentiment);
    console.log('   Urgency:', responseResult.urgency);
    
    // Test ticket categorization
    const categorizeResult = await customerAgent.processTask({
      type: 'categorize_ticket',
      priority: 'medium',
      customerMessage: {
        content: 'I have a question about my monthly subscription',
        customerName: 'Jane Doe',
        email: 'jane@example.com',
        channel: 'chat',
        timestamp: new Date().toISOString()
      }
    });
    
    console.log('✅ Ticket categorization test passed');
    console.log('   Category:', categorizeResult.categorization?.category);
    console.log('   Priority:', categorizeResult.categorization?.priority);
    
    return true;
  } catch (error) {
    console.error('❌ Customer Agent test failed:', error);
    return false;
  }
}

async function testOrchestrator() {
  console.log('\n🎯 Testing Business Agent Orchestrator...');
  
  try {
    const orchestrator = new BusinessAgentOrchestrator(TEST_USER_ID);
    
    // Test simple multi-agent task
    const simpleResult = await orchestrator.processBusinessTask({
      type: 'multi_agent',
      description: 'Create a social media post about customer service and compose a follow-up email',
      priority: 'medium',
      requiredAgents: ['social', 'email'],
      context: {
        campaign: 'Customer Service Excellence',
        targetAudience: 'Business professionals'
      },
      userId: TEST_USER_ID
    });
    
    console.log('✅ Simple orchestrator test passed');
    console.log('   Task ID:', simpleResult.taskId);
    console.log('   Total steps:', simpleResult.totalSteps);
    console.log('   Successful steps:', simpleResult.successfulSteps);
    console.log('   Success rate:', simpleResult.successRate + '%');
    
    // Test complex business scenario
    const complexResult = await orchestrator.processBusinessTask({
      type: 'multi_agent',
      description: 'Handle a customer complaint about billing, generate a financial report, and send a professional response email',
      priority: 'high',
      requiredAgents: ['customer', 'finance', 'email'],
      context: {
        customerName: 'Sarah Johnson',
        issue: 'Double billing on invoice #12345',
        amount: '$299.99'
      },
      userId: TEST_USER_ID
    });
    
    console.log('✅ Complex orchestrator test passed');
    console.log('   Task ID:', complexResult.taskId);
    console.log('   Total steps:', complexResult.totalSteps);
    console.log('   Successful steps:', complexResult.successfulSteps);
    console.log('   Success rate:', complexResult.successRate + '%');
    
    // Test pre-built scenario
    const scenarioResult = await orchestrator.handleCustomerComplaint({
      name: 'Mike Wilson',
      complaint: 'Product not working as expected after recent update',
      email: 'mike@example.com'
    });
    
    console.log('✅ Pre-built scenario test passed');
    console.log('   Task ID:', scenarioResult.taskId);
    console.log('   Status:', scenarioResult.status);
    
    return true;
  } catch (error) {
    console.error('❌ Orchestrator test failed:', error);
    return false;
  }
}

async function testAgentStatus() {
  console.log('\n📊 Testing Agent Status...');
  
  try {
    const orchestrator = new BusinessAgentOrchestrator(TEST_USER_ID);
    const status = await orchestrator.getAgentStatus();
    
    console.log('✅ Agent status test passed');
    console.log('   Orchestrator:', status.orchestrator);
    console.log('   Agents:', Object.keys(status.agents).join(', '));
    console.log('   LLM Providers:', Object.keys(status.llmProviders || {}).join(', '));
    
    return true;
  } catch (error) {
    console.error('❌ Agent status test failed:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Business Agent System Tests...\n');
  console.log('=' .repeat(60));
  
  const testResults = {
    llmRouter: false,
    database: false,
    emailAgent: false,
    financeAgent: false,
    socialAgent: false,
    customerAgent: false,
    orchestrator: false,
    agentStatus: false
  };
  
  // Run tests in order
  testResults.llmRouter = await testLLMRouter();
  testResults.database = await testDatabaseConnection();
  testResults.emailAgent = await testEmailAgent();
  testResults.financeAgent = await testFinanceAgent();
  testResults.socialAgent = await testSocialAgent();
  testResults.customerAgent = await testCustomerAgent();
  testResults.orchestrator = await testOrchestrator();
  testResults.agentStatus = await testAgentStatus();
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('=' .repeat(60));
  
  const passedTests = Object.values(testResults).filter(Boolean).length;
  const totalTests = Object.keys(testResults).length;
  
  Object.entries(testResults).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test}`);
  });
  
  console.log('\n' + '=' .repeat(60));
  console.log(`🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Business Agent System is ready for deployment.');
  } else {
    console.log('⚠️  Some tests failed. Please check the errors above.');
  }
  
  console.log('=' .repeat(60));
  
  return passedTests === totalTests;
}

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner error:', error);
      process.exit(1);
    });
}

export { runAllTests }; 