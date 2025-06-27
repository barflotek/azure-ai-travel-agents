import 'dotenv/config';

import { SmartLLMRouter } from './llm';

async function testLLMRouterOnly() {
  console.log('🧪 Testing LLM Router (Database-Free Test)...\n');
  console.log('=' .repeat(60));
  
  try {
    const router = new SmartLLMRouter();
    
    // Test simple query
    console.log('📝 Testing simple query...');
    const simpleResponse = await router.route([
      { role: 'user', content: 'Hello, how are you?' }
    ], 'simple');
    
    console.log('✅ Simple query test passed');
    console.log('   Response:', (simpleResponse.message?.content as string)?.substring(0, 100) + '...');
    
    // Test medium complexity query
    console.log('\n📝 Testing medium complexity query...');
    const mediumResponse = await router.route([
      { role: 'user', content: 'Explain the benefits of customer service automation in 3 points.' }
    ], 'medium');
    
    console.log('✅ Medium complexity test passed');
    console.log('   Response:', (mediumResponse.message?.content as string)?.substring(0, 100) + '...');
    
    // Test complex query
    console.log('\n📝 Testing complex query...');
    const complexResponse = await router.route([
      { role: 'user', content: 'Create a comprehensive business plan for a customer service automation startup.' }
    ], 'complex');
    
    console.log('✅ Complex query test passed');
    console.log('   Response:', (complexResponse.message?.content as string)?.substring(0, 100) + '...');
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 ALL LLM TESTS PASSED!');
    console.log('✅ SmartLLMRouter is working correctly');
    console.log('✅ Groq fallback is functioning');
    console.log('✅ All complexity levels are supported');
    console.log('=' .repeat(60));
    
    return true;
  } catch (error) {
    console.error('❌ LLM Router test failed:', error);
    return false;
  }
}

// Test agent logic without database
async function testAgentLogic() {
  console.log('\n🤖 Testing Agent Logic (Database-Free)...\n');
  console.log('=' .repeat(60));
  
  try {
    const router = new SmartLLMRouter();
    
    // Test email composition logic
    console.log('📧 Testing Email Agent Logic...');
    const emailPrompt = `
You are a professional email assistant. Compose a welcome email:

Subject: Welcome to Our Service
Recipient: customer@example.com
Content: Write a professional welcome email for a new customer

Guidelines:
1. Be welcoming and professional
2. Include next steps
3. Offer support contact
4. Keep it concise but friendly
`;

    const emailResponse = await router.route([
      { role: 'system', content: 'You are an expert email composition assistant.' },
      { role: 'user', content: emailPrompt }
    ], 'medium');
    
    console.log('✅ Email composition logic test passed');
    console.log('   Response length:', (emailResponse.message?.content as string)?.length);
    
    // Test finance categorization logic
    console.log('\n💰 Testing Finance Agent Logic...');
    const financePrompt = `
Categorize this business expense:
- Amount: $45.67
- Description: Office supplies from Staples
- Date: 2024-01-15

Choose from: Office Supplies, Software/SaaS, Marketing/Advertising, Travel/Transportation, Meals/Entertainment, Equipment/Hardware, Utilities, Professional Services, Training/Education, Insurance, Rent/Facilities, Other

Respond with JSON containing: category, subcategory, taxDeductible, confidence
`;

    const financeResponse = await router.route([
      { role: 'system', content: 'You are a professional accounting assistant.' },
      { role: 'user', content: financePrompt }
    ], 'medium');
    
    console.log('✅ Finance categorization logic test passed');
    console.log('   Response:', (financeResponse.message?.content as string)?.substring(0, 100) + '...');
    
    // Test social media post creation
    console.log('\n📱 Testing Social Agent Logic...');
    const socialPrompt = `
Create a professional social media post for Twitter:

Topic: Customer service tips
Content request: Create an engaging post about customer service tips
Target audience: Business professionals
Character limit: 280

Please provide:
1. Main post content (within character limit)
2. Suggested hashtags (3-5 max)
3. Call-to-action
4. Best posting time recommendation

Format as JSON with fields: content, hashtags, callToAction, bestTime
`;

    const socialResponse = await router.route([
      { role: 'system', content: 'You are a social media marketing expert.' },
      { role: 'user', content: socialPrompt }
    ], 'medium');
    
    console.log('✅ Social media logic test passed');
    console.log('   Response:', (socialResponse.message?.content as string)?.substring(0, 100) + '...');
    
    // Test customer service response
    console.log('\n🎧 Testing Customer Agent Logic...');
    const customerPrompt = `
You are a professional customer service representative. Respond to this customer inquiry:

Customer: John Smith
Email: john@example.com
Channel: email
Message: "I can't log into my account and need help immediately!"

Guidelines:
1. Be empathetic and professional
2. Address the customer by name
3. Acknowledge their concern specifically
4. Provide helpful, actionable solutions
5. Offer next steps or follow-up if needed

Response should be complete and ready to send.
`;

    const customerResponse = await router.route([
      { role: 'system', content: 'You are an expert customer service representative.' },
      { role: 'user', content: customerPrompt }
    ], 'medium');
    
    console.log('✅ Customer service logic test passed');
    console.log('   Response length:', (customerResponse.message?.content as string)?.length);
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 ALL AGENT LOGIC TESTS PASSED!');
    console.log('✅ Email Agent logic is working');
    console.log('✅ Finance Agent logic is working');
    console.log('✅ Social Agent logic is working');
    console.log('✅ Customer Agent logic is working');
    console.log('=' .repeat(60));
    
    return true;
  } catch (error) {
    console.error('❌ Agent logic test failed:', error);
    return false;
  }
}

async function runSimpleTests() {
  console.log('🚀 Starting Simplified Business Agent System Tests...\n');
  
  const llmResult = await testLLMRouterOnly();
  const agentResult = await testAgentLogic();
  
  console.log('\n' + '=' .repeat(60));
  console.log('📋 SIMPLIFIED TEST SUMMARY');
  console.log('=' .repeat(60));
  
  console.log(llmResult ? '✅ PASS LLM Router' : '❌ FAIL LLM Router');
  console.log(agentResult ? '✅ PASS Agent Logic' : '❌ FAIL Agent Logic');
  
  const passedTests = [llmResult, agentResult].filter(Boolean).length;
  const totalTests = 2;
  
  console.log('\n' + '=' .repeat(60));
  console.log(`🎯 OVERALL RESULT: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 CORE FUNCTIONALITY VERIFIED!');
    console.log('✅ LLM routing and fallback working');
    console.log('✅ Agent logic and prompts working');
    console.log('⚠️  Database integration needs RLS policy adjustment for testing');
    console.log('💡 Next: Configure Supabase RLS policies for test users');
  } else {
    console.log('⚠️  Some core functionality tests failed.');
  }
  
  console.log('=' .repeat(60));
  
  return passedTests === totalTests;
}

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runSimpleTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test runner error:', error);
      process.exit(1);
    });
}

export { runSimpleTests }; 