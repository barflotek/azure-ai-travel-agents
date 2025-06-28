# 🎙️ ElevenLabs Integration Setup Guide

## 📋 Overview
This guide will help you set up ElevenLabs with spending limits and usage tracking to stay within your $10 budget.

## 🆓 Free Tier Benefits
- **10,000 characters per month** (approximately 7-10 minutes of speech)
- **$0.00 cost** - No credit card required
- **High-quality AI voices** with natural sound
- **Automatic fallback** to browser TTS when limit is reached

## 🚀 Setup Steps

### 1. Create ElevenLabs Account
1. Go to [elevenlabs.io](https://elevenlabs.io/)
2. Click "Sign Up" and create a free account
3. Verify your email address
4. **No credit card required** for free tier

### 2. Get Your API Key
1. Log into your ElevenLabs dashboard
2. Go to "Profile" → "API Key"
3. Copy your API key (starts with `xi-api-...`)

### 3. Add Environment Variable

#### For Local Development:
Add to your `.env` file:
```bash
ELEVENLABS_API_KEY=xi-api-your-key-here
```

#### For Railway Deployment:
1. Go to your Railway project dashboard
2. Navigate to "Variables" tab
3. Add new variable:
   - **Name**: `ELEVENLABS_API_KEY`
   - **Value**: `xi-api-your-key-here`

### 4. Test the Integration
1. Start your application
2. Go to the email dashboard
3. Look for the "🎙️ ElevenLabs Usage" section
4. Try voice commands like "usage" or "voice quality"

## 💰 Cost Management Features

### Built-in Protection:
- ✅ **Monthly character limit**: 10,000 characters
- ✅ **Automatic usage tracking**: Real-time monitoring
- ✅ **Graceful fallback**: Browser TTS when limit reached
- ✅ **Usage dashboard**: Visual progress bar and statistics
- ✅ **Voice alerts**: Notifications when approaching limits

### Usage Monitoring:
- **Real-time tracking** of characters used
- **Visual progress bar** with color coding:
  - 🟢 Green (0-60%): Safe usage
  - 🟡 Yellow (60-80%): Moderate usage
  - 🔴 Red (80-100%): High usage
- **Monthly reset** on the 1st of each month
- **Voice commands** to check usage

## 🎯 Voice Commands

### Email Commands:
- "Check emails" - Refresh email list
- "Send email" - Open email composer
- "Mark read" - Mark selected emails as read
- "Delete email" - Delete selected emails
- "Analytics" - Load email analytics

### Voice System Commands:
- "Usage" - Check ElevenLabs usage statistics
- "Voice quality" - Switch between browser and premium TTS
- "Disconnect" - Disconnect from Gmail

## 📊 Usage Statistics

### What's Tracked:
- **Characters used** this month
- **Characters remaining** this month
- **Percentage used** of monthly limit
- **Monthly reset date**
- **Recent requests** (last 10)

### API Endpoints:
- `GET /api/tts/usage` - Get usage statistics
- `POST /api/tts/elevenlabs` - Text-to-speech with usage tracking

## 🔒 Security Features

### API Key Protection:
- ✅ **Server-side only** - API key never exposed to frontend
- ✅ **Secure endpoints** - All requests go through your backend
- ✅ **Error handling** - Graceful fallback on API failures
- ✅ **Usage limits** - Prevents exceeding monthly limits

## 🎨 Voice Quality Options

### Browser TTS (Free):
- ✅ Always available
- ✅ No character limits
- ✅ Basic voice quality
- ✅ Works offline

### ElevenLabs Premium (Free Tier):
- ✅ High-quality AI voices
- ✅ Natural speech patterns
- ✅ 10,000 characters/month
- ✅ Automatic fallback

## 🚨 Troubleshooting

### Common Issues:

#### "ElevenLabs not configured"
- Check if `ELEVENLABS_API_KEY` is set in environment variables
- Verify the API key is correct
- Restart your application after adding the key

#### "Monthly character limit exceeded"
- This is normal for free tier
- System automatically falls back to browser TTS
- Wait until next month for reset, or upgrade to paid plan

#### "Text too long for single request"
- ElevenLabs has a 2,500 character limit per request
- Break longer text into smaller chunks
- Use browser TTS for very long text

### Error Messages:
- **429**: Monthly limit exceeded
- **400**: Text too long or invalid request
- **401**: Invalid API key
- **500**: Server error (check logs)

## 📈 Upgrade Options

### If you need more usage:
1. **Starter Plan**: $22/month for 30,000 characters
2. **Creator Plan**: $99/month for 250,000 characters
3. **Independent Publisher**: $330/month for 1,000,000 characters

### Features unlocked with paid plans:
- Custom voice cloning
- Voice generation
- Higher character limits
- Priority support

## 🎉 Success Indicators

You'll know it's working when:
- ✅ Usage dashboard shows "Free Tier • $0.00/month"
- ✅ Progress bar displays current usage
- ✅ Voice quality dropdown shows both options
- ✅ Voice commands respond with premium TTS
- ✅ Usage statistics update in real-time

## 💡 Tips for Optimal Usage

1. **Use browser TTS for testing** - Save premium characters for important interactions
2. **Keep responses concise** - Shorter text uses fewer characters
3. **Monitor usage regularly** - Check the dashboard to stay within limits
4. **Use voice commands** - "Usage" command gives you quick stats
5. **Plan for monthly reset** - Usage resets on the 1st of each month

## 🔄 Monthly Reset

- **Reset Date**: 1st of each month
- **Reset Time**: Midnight UTC
- **What Resets**: Character count, usage statistics
- **What Persists**: API key, settings, voice preferences

---

**Need Help?** Check the console logs for detailed error messages or contact support if issues persist. 