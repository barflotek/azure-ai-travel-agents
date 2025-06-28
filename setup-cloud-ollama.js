#!/usr/bin/env node

// Cloud Ollama Setup Helper Script
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Cloud Ollama Setup Helper\n');

async function setupCloudOllama() {
  console.log('Choose your cloud Ollama setup option:\n');
  console.log('1. RunPod (Recommended - Easiest, Free credits)');
  console.log('2. Railway Ollama Service');
  console.log('3. Test existing Ollama URL');
  console.log('4. Exit\n');

  const choice = await askQuestion('Enter your choice (1-4): ');

  switch (choice) {
    case '1':
      await setupRunPod();
      break;
    case '2':
      await setupRailwayOllama();
      break;
    case '3':
      await testOllamaURL();
      break;
    case '4':
      console.log('Goodbye! 👋');
      process.exit(0);
    default:
      console.log('Invalid choice. Please try again.');
      await setupCloudOllama();
  }
}

async function setupRunPod() {
  console.log('\n🎯 RunPod Setup Instructions:\n');
  console.log('1. Go to https://runpod.io and sign up (get $10 free credits)');
  console.log('2. Click "Deploy" and search for "Ollama"');
  console.log('3. Select the Ollama template');
  console.log('4. Choose GPU: RTX 4090 or A100 for best performance');
  console.log('5. Click "Deploy" and wait for it to start');
  console.log('6. Copy the HTTP URL (e.g., https://abc123.runpod.io)');
  
  const ollamaUrl = await askQuestion('\nEnter your RunPod Ollama URL: ');
  
  if (ollamaUrl) {
    await testAndConfigureOllama(ollamaUrl);
  }
}

async function setupRailwayOllama() {
  console.log('\n🚂 Railway Ollama Setup Instructions:\n');
  console.log('1. Go to https://railway.app and create a new project');
  console.log('2. Choose "Deploy from GitHub repo"');
  console.log('3. Use the docker-compose.ollama.yml file from this repo');
  console.log('4. Deploy and get the service URL');
  
  const ollamaUrl = await askQuestion('\nEnter your Railway Ollama URL: ');
  
  if (ollamaUrl) {
    await testAndConfigureOllama(ollamaUrl);
  }
}

async function testOllamaURL() {
  const ollamaUrl = await askQuestion('\nEnter your Ollama URL to test: ');
  
  if (ollamaUrl) {
    await testAndConfigureOllama(ollamaUrl);
  }
}

async function testAndConfigureOllama(ollamaUrl) {
  console.log(`\n🔍 Testing Ollama at: ${ollamaUrl}`);
  
  try {
    // Test version endpoint
    const versionResponse = await fetch(`${ollamaUrl}/api/version`);
    if (versionResponse.ok) {
      const version = await versionResponse.json();
      console.log(`✅ Ollama is running! Version: ${version.version}`);
    } else {
      throw new Error(`HTTP ${versionResponse.status}`);
    }

    // Test model availability
    const modelsResponse = await fetch(`${ollamaUrl}/api/tags`);
    if (modelsResponse.ok) {
      const models = await modelsResponse.json();
      const hasLlama = models.models?.some(m => m.name.includes('llama3.1:8b'));
      
      if (hasLlama) {
        console.log('✅ llama3.1:8b model is available');
      } else {
        console.log('⚠️  llama3.1:8b model not found. You may need to pull it:');
        console.log(`   curl -X POST ${ollamaUrl}/api/pull -d '{"name": "llama3.1:8b"}'`);
      }
    }

    // Test chat functionality
    console.log('\n🧪 Testing chat functionality...');
    const chatResponse = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1:8b',
        messages: [{ role: 'user', content: 'Hello, test' }],
        stream: false
      })
    });

    if (chatResponse.ok) {
      const chat = await chatResponse.json();
      console.log('✅ Chat test successful!');
      console.log(`   Response: ${chat.message?.content?.substring(0, 50)}...`);
    } else {
      console.log('⚠️  Chat test failed. Model might not be loaded.');
    }

    // Configuration instructions
    console.log('\n🔧 Configuration Instructions:');
    console.log('1. Go to your Railway project dashboard');
    console.log('2. Go to the "Variables" tab');
    console.log('3. Add these environment variables:');
    console.log(`   OLLAMA_BASE_URL=${ollamaUrl}`);
    console.log('   LOCAL_LLM_ENABLED=true');
    console.log('\n4. Redeploy your application');
    console.log('\n5. Test the configuration:');
    console.log('   curl -s "https://azure-ai-travel-agents-production.up.railway.app/api/llm/status" | jq .');

  } catch (error) {
    console.log(`❌ Error testing Ollama: ${error.message}`);
    console.log('\n🔍 Troubleshooting:');
    console.log('1. Make sure the URL is correct');
    console.log('2. Ensure Ollama is running');
    console.log('3. Check if the service is accessible');
  }
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Start the setup
setupCloudOllama().catch(console.error); 