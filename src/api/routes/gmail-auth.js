import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

console.log('🔧 Gmail OAuth Configuration:');
console.log('  - Client ID:', process.env.GMAIL_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('  - Client Secret:', process.env.GMAIL_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
console.log('  - OAuth Type: Desktop Application');

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob' // Special URI for desktop apps
);

// Start Gmail OAuth flow for desktop app
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

  console.log('🔐 Starting Gmail OAuth flow for desktop app...');
  console.log('  - Auth URL:', url);
  
  // Return the auth URL for the frontend to open
  res.json({
    success: true,
    authUrl: url,
    message: 'Please open this URL in your browser to authorize Gmail access'
  });
});

// Handle authorization code from desktop app flow
router.post('/auth/gmail/callback', async (req, res) => {
  const { code } = req.body;
  
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
    
    res.json({
      success: true,
      tokens,
      message: 'Gmail connected successfully!',
      scopes: tokens.scope?.split(' ') || []
    });
    
  } catch (error) {
    console.error('❌ Gmail OAuth error:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to authenticate with Gmail',
      details: error.message
    });
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
    redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
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