import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

console.log('🔧 Gmail OAuth Configuration:');
console.log('  - Client ID:', process.env.GMAIL_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('  - Client Secret:', process.env.GMAIL_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
console.log('  - OAuth Type: Web Application');

// Determine redirect URI based on environment
const getRedirectUri = () => {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/auth/gmail/callback`;
  }
  return 'http://localhost:3000/api/auth/gmail/callback';
};

const redirectUri = getRedirectUri();
console.log('  - Redirect URI:', redirectUri);

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  redirectUri
);

// Start Gmail OAuth flow for web app
router.get('/auth/gmail', (req, res) => {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    return res.status(500).json({
      success: false,
      error: 'Gmail OAuth not configured. Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables.'
    });
  }

  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent' // Force consent to get refresh token
  });

  console.log('🔐 Starting Gmail OAuth flow for web app...');
  console.log('  - Auth URL:', url);
  
  // Return the auth URL for the frontend to open
  res.json({
    success: true,
    authUrl: url,
    message: 'Please open this URL in your browser to authorize Gmail access'
  });
});

// Handle authorization callback from Google OAuth
router.get('/auth/gmail/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Authorization code is required'
    });
  }
  
  try {
    console.log('🔄 Exchanging authorization code for tokens...');
    const { tokens } = await oauth2Client.getAccessToken(code);
    
    console.log('✅ Gmail OAuth completed successfully');
    
    // Redirect to frontend with success message
    const frontendUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'http://localhost:4200';
    
    res.redirect(`${frontendUrl}?gmail_auth=success&access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token || ''}`);
    
  } catch (error) {
    console.error('❌ Gmail OAuth error:', error);
    
    const frontendUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : 'http://localhost:4200';
    
    res.redirect(`${frontendUrl}?gmail_auth=error&error=${encodeURIComponent(error.message)}`);
  }
});

// Refresh Gmail access token
router.post('/auth/gmail/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  
  if (!refresh_token) {
    return res.status(400).json({
      success: false,
      error: 'Refresh token required'
    });
  }
  
  try {
    oauth2Client.setCredentials({ refresh_token });
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    res.json({
      success: true,
      tokens: credentials,
      message: 'Access token refreshed successfully'
    });
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to refresh access token',
      details: error.message
    });
  }
});

// Check Gmail connection status
router.get('/auth/gmail/status', (req, res) => {
  const { access_token } = req.query;
  
  if (!access_token) {
    return res.json({
      isConnected: false,
      message: 'No access token provided'
    });
  }
  
  // In a real app, you'd validate the token with Google
  res.json({
    isConnected: true,
    message: 'Gmail is connected',
    scopes: ['gmail.readonly', 'gmail.send', 'gmail.modify']
  });
});

// Revoke Gmail access
router.post('/auth/gmail/revoke', async (req, res) => {
  const { access_token } = req.body;
  
  if (!access_token) {
    return res.status(400).json({
      success: false,
      error: 'Access token required'
    });
  }
  
  try {
    await oauth2Client.revokeToken(access_token);
    
    res.json({
      success: true,
      message: 'Gmail access revoked successfully'
    });
  } catch (error) {
    console.error('❌ Token revocation error:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to revoke access token',
      details: error.message
    });
  }
});

// Debug endpoint to check OAuth configuration
router.get('/auth/gmail/debug', (req, res) => {
  const config = {
    clientId: process.env.GMAIL_CLIENT_ID ? '✅ Set' : '❌ Missing',
    clientSecret: process.env.GMAIL_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
    redirectUri: redirectUri,
    environment: process.env.NODE_ENV || 'development',
    railwayDomain: process.env.RAILWAY_PUBLIC_DOMAIN || 'Not set',
    gmailRedirectUri: process.env.GMAIL_REDIRECT_URI || 'Not set'
  };
  
  res.json({
    success: true,
    config,
    message: 'Gmail OAuth Configuration Debug Info'
  });
});

export default router; 