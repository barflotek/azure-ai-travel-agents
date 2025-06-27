# Business Agent System - Railway Deployment Guide

## 🚀 Quick Deploy to Railway

### Prerequisites
- Railway account (free tier available)
- GitHub repository with your code
- Environment variables configured

### Step 1: Connect to Railway
1. Go to [Railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository

### Step 2: Configure Environment Variables
In Railway dashboard, add these environment variables:

```bash
# LLM Providers
GROQ_API_KEY=your_groq_api_key
OLLAMA_BASE_URL=http://host.docker.internal:11434

# Database (Optional - for state persistence)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Application
NODE_ENV=production
PORT=3000
```

### Step 3: Deploy
1. Railway will automatically detect the Dockerfile
2. Build will start automatically
3. Deployment takes 2-5 minutes
4. Your API will be available at the provided Railway URL

## 📋 API Endpoints

### Health Checks
- `GET /` - Basic health check
- `GET /health` - Railway health check
- `GET /test` - System functionality test
- `GET /api/status` - System status

### Business Agent Endpoints

#### Email Agent
```bash
POST /api/email/compose
{
  "subject": "Welcome to our service",
  "recipient": "customer@example.com",
  "content": "We're excited to have you on board"
}
```

#### Finance Agent
```bash
POST /api/finance/categorize
{
  "amount": 299.99,
  "description": "Adobe Creative Suite subscription",
  "date": "2024-01-15"
}
```

#### Social Media Agent
```bash
POST /api/social/create-post
{
  "platform": "linkedin",
  "content": "Announcing our new product launch",
  "topic": "Product Launch"
}
```

#### Customer Service Agent
```bash
POST /api/customer/respond
{
  "customerName": "John Doe",
  "email": "john@example.com",
  "channel": "email",
  "message": "I'm having trouble accessing my account"
}
```

## 🔧 Local Development

### Prerequisites
- Node.js 18+
- Docker (for Ollama)
- Groq API key

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   cd src/api
   npm install
   ```

3. Create `.env` file:
   ```bash
   GROQ_API_KEY=your_groq_api_key
   OLLAMA_BASE_URL=http://localhost:11434
   ```

4. Start Ollama (if using local models):
   ```bash
   docker run -d -p 11434:11434 ollama/ollama
   ```

5. Run the API:
   ```bash
   npm start
   ```

### Test the API
```bash
# Health check
curl http://localhost:3000/health

# Test system
curl http://localhost:3000/test

# Email composition
curl -X POST http://localhost:3000/api/email/compose \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Welcome",
    "recipient": "user@example.com",
    "content": "Welcome to our platform"
  }'
```

## 🐳 Docker Deployment

### Build Image
```bash
docker build -t business-agent-system .
```

### Run Container
```bash
docker run -p 3000:3000 \
  -e GROQ_API_KEY=your_key \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  business-agent-system
```

## 📊 Monitoring

### Railway Dashboard
- View logs in real-time
- Monitor resource usage
- Set up alerts

### Health Checks
- `/health` endpoint for Railway health checks
- Automatic restarts on failure
- 300-second timeout for health checks

## 🔒 Security

### Environment Variables
- Never commit API keys to version control
- Use Railway's secure environment variable storage
- Rotate keys regularly

### API Security
- CORS enabled for web applications
- Input validation on all endpoints
- Error handling without sensitive data exposure

## 🚨 Troubleshooting

### Common Issues

1. **Build Fails**
   - Check Dockerfile syntax
   - Verify all dependencies in package.json
   - Check for TypeScript errors

2. **Runtime Errors**
   - Verify environment variables
   - Check API key validity
   - Review Railway logs

3. **LLM Provider Issues**
   - Verify Groq API key
   - Check Ollama connection (if using local models)
   - Test with `/test` endpoint

### Debug Commands
```bash
# Check Railway logs
railway logs

# SSH into Railway container
railway shell

# Check environment variables
railway variables
```

## 📈 Scaling

### Railway Free Tier
- 500 hours/month
- 512MB RAM
- Shared CPU
- Perfect for development and small production loads

### Paid Plans
- Dedicated resources
- Custom domains
- Advanced monitoring
- Team collaboration

## 🔄 Updates

### Automatic Deployments
- Railway automatically deploys on git push
- Zero-downtime deployments
- Rollback capability

### Manual Deployments
```bash
# Deploy specific branch
railway up

# Deploy with custom environment
railway up --environment production
```

## 📞 Support

- Railway Documentation: https://docs.railway.app
- GitHub Issues: Report bugs and feature requests
- Community: Join our Discord for help

---

**Ready to deploy?** Your Business Agent System is production-ready! 🎉 