#!/usr/bin/env node

// Test RunPod Ollama Connection
const POD_ID = '4hap4ehdv95p1o';

// Common RunPod URL patterns
const urlPatterns = [
  `https://${POD_ID}.runpod.io`,
  `https://${POD_ID}-8080.proxy.runpod.net`,
  `https://${POD_ID}-11434.proxy.runpod.net`,
  `https://${POD_ID}.runpod.net`
];

async function testRunPod() {
  console.log('🔍 Testing RunPod Ollama connection...\n');
  
  for (const baseUrl of urlPatterns) {
    console.log(`Testing: ${baseUrl}`);
    
    try {
      // Test version endpoint
      const versionResponse = await fetch(`${baseUrl}/api/version`);
      
      if (versionResponse.ok) {
        const version = await versionResponse.json();
        console.log(`✅ SUCCESS! Ollama is running at: ${baseUrl}`);
        console.log(`   Version: ${version.version}`);
        
        // Test model availability
        try {
          const modelsResponse = await fetch(`${baseUrl}/api/tags`);
          if (modelsResponse.ok) {
            const models = await modelsResponse.json();
            const hasLlama = models.models?.some(m => m.name.includes('llama3.1:8b'));
            
            if (hasLlama) {
              console.log('✅ llama3.1:8b model is available');
            } else {
              console.log('⚠️  Model not found. You need to pull it:');
              console.log(`   curl -X POST ${baseUrl}/api/pull -d '{"name": "llama3.1:8b"}'`);
            }
          }
        } catch (modelError) {
          console.log('⚠️  Could not check models:', modelError.message);
        }
        
        // Configuration instructions
        console.log('\n🔧 Next Steps:');
        console.log('1. Go to Railway Dashboard: https://railway.app/dashboard');
        console.log('2. Select your azure-ai-travel-agents project');
        console.log('3. Go to "Variables" tab');
        console.log('4. Add these environment variables:');
        console.log(`   OLLAMA_BASE_URL=${baseUrl}`);
        console.log('   LOCAL_LLM_ENABLED=true');
        console.log('5. Redeploy your application');
        
        return baseUrl;
      } else {
        console.log(`   ❌ HTTP ${versionResponse.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('❌ Could not connect to any RunPod URL pattern');
  console.log('\n🔍 Troubleshooting:');
  console.log('1. Make sure your RunPod is running');
  console.log('2. Check the correct URL in RunPod dashboard');
  console.log('3. Wait for the pod to fully start (1-2 minutes)');
  console.log('4. Try connecting via RunPod web interface first');
}

testRunPod().catch(console.error); 