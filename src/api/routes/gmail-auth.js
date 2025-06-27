const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/gmail/callback'
);

// Start Gmail OAuth flow
router.get('/auth/gmail', (req, res) => {
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

  console.log('🔐 Starting Gmail OAuth flow...');
  res.redirect(url);
});

// Handle Gmail OAuth callback
router.get('/auth/gmail/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'No authorization code received'
    });
  }
  
  try {
    console.log('🔄 Exchanging authorization code for tokens...');
    const { tokens } = await oauth2Client.getAccessToken(code);
    
    // Store tokens securely (in production, use database)
    // For now, return them to frontend
    res.json({
      success: true,
      tokens,
      message: 'Gmail connected successfully!',
      scopes: tokens.scope?.split(' ') || []
    });
    
    console.log('✅ Gmail OAuth completed successfully');
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

module.exports = router; 