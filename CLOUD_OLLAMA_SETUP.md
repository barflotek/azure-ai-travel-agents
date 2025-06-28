# Cloud Ollama Setup Guide

## 🚀 Quick Setup Options

### Option 1: RunPod Ollama (Recommended - Easiest)

1. **Sign up for RunPod:**
   - Go to https://runpod.io
   - Create a free account (get $10 credit)

2. **Deploy Ollama Pod:**
   - Click "Deploy"
   - Search for "Ollama"
   - Select "Ollama" template
   - Choose GPU: RTX 4090 or A100 (for best performance)
   - Click "Deploy"

3. **Configure Ollama:**
   ```bash
   # Connect to your pod
   # Pull the model
   ollama pull llama3.1:8b
   
   # Test the model
   ollama run llama3.1:8b "Hello, test"
   ```

4. **Get the URL:**
   - Copy the HTTP URL from your pod (e.g., `https://abc123.runpod.io`)
   - Add `/api` to the end for the API endpoint

5. **Update Railway Environment:**
   - Go to Railway Dashboard
   - Add variable: `OLLAMA_BASE_URL=https://your-pod-url.runpod.io`
   - Add variable: `LOCAL_LLM_ENABLED=true`

### Option 2: Railway Ollama Service

1. **Create new Railway project:**
   - Go to https://railway.app
   - Click "New Project"
   - Choose "Deploy from GitHub repo"

2. **Use this repository:**
   - Fork this repo or create a new one with just the Ollama files
   - Railway will auto-detect the Docker setup

3. **Deploy:**
   - Railway will build and deploy Ollama
   - Get the service URL

4. **Update main app:**
   - Add `OLLAMA_BASE_URL=https://your-ollama-service.up.railway.app`
   - Add `LOCAL_LLM_ENABLED=true`

### Option 3: Google Cloud Run Ollama

1. **Enable Google Cloud:**
   - Go to https://console.cloud.google.com
   - Create a new project

2. **Deploy with Cloud Run:**
   ```bash
   # Build and deploy
   gcloud run deploy ollama-service \
     --image ollama/ollama:latest \
     --platform managed \
     --allow-unauthenticated \
     --port 11434
   ```

3. **Update environment:**
   - Use the Cloud Run URL
   - Add to Railway environment variables

## 🔧 Configuration Steps

### Step 1: Update Railway Environment Variables

Go to your Railway project dashboard and add these variables:

```bash
OLLAMA_BASE_URL=https://your-ollama-service-url.com
LOCAL_LLM_ENABLED=true
```

### Step 2: Test the Connection

```bash
# Test if Ollama is accessible
curl -s "https://your-ollama-service-url.com/api/version"

# Test if the model is available
curl -s "https://your-ollama-service-url.com/api/tags"
```

### Step 3: Verify in Your App

Check the LLM status:
```bash
curl -s "https://azure-ai-travel-agents-production.up.railway.app/api/llm/status" | jq .
```

## 💰 Cost Comparison

| Service | Cost | Performance | Setup Difficulty |
|---------|------|-------------|------------------|
| RunPod | $0.2-0.5/hour | Excellent | Easy |
| Railway | $5-20/month | Good | Medium |
| Google Cloud | $0.1-0.3/hour | Excellent | Hard |
| Local | Free | Good | Easy |

## 🎯 Recommended: RunPod Setup

**Why RunPod is best:**
- ✅ **Free credits** to start
- ✅ **GPU acceleration** included
- ✅ **Simple setup** (one-click deploy)
- ✅ **Pay-per-use** (only when running)
- ✅ **No server management**

**Quick RunPod Setup:**
1. Sign up at https://runpod.io
2. Deploy Ollama template
3. Get URL and update Railway
4. Done! 🎉

## 🔍 Troubleshooting

### Common Issues:

1. **"Connection refused"**
   - Check if Ollama service is running
   - Verify the URL is correct
   - Ensure CORS is enabled

2. **"Model not found"**
   - Pull the model: `ollama pull llama3.1:8b`
   - Check available models: `ollama list`

3. **"Rate limit"**
   - Ollama has no rate limits
   - Check if you're still hitting Groq

### Test Commands:

```bash
# Test Ollama service
curl -s "YOUR_OLLAMA_URL/api/version"

# Test model availability
curl -s "YOUR_OLLAMA_URL/api/tags"

# Test chat functionality
curl -s "YOUR_OLLAMA_URL/api/chat" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"model": "llama3.1:8b", "messages": [{"role": "user", "content": "Hello"}]}'
``` 