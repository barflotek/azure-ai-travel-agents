import express from 'express';
import { google } from 'googleapis';

const router = express.Router();

// Get the correct redirect URI based on environment
const getRedirectUri = () => {
  if (process.env.NODE_ENV === 'production') {
    // Use Railway URL in production
    return process.env.RAILWAY_PUBLIC_DOMAIN 
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api/auth/gmail/callback`
      : process.env.GMAIL_REDIRECT_URI;
  }
  return process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/auth/gmail/callback';
};

const redirectUri = getRedirectUri();

console.log('🔧 Gmail OAuth Configuration:');
console.log('  - Client ID:', process.env.GMAIL_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('  - Client Secret:', process.env.GMAIL_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
console.log('  - Redirect URI:', redirectUri);

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  redirectUri
);

// Start Gmail OAuth flow
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
    prompt: 'consent', // Force consent to get refresh token
    redirect_uri: redirectUri // Explicitly set redirect URI
  });

  console.log('🔐 Starting Gmail OAuth flow...');
  console.log('  - Redirect URI:', redirectUri);
  console.log('  - Auth URL:', url);
  
  res.redirect(url);
});

// Handle Gmail OAuth callback
router.get('/auth/gmail/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    console.error('❌ Gmail OAuth error:', error);
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail Authentication Error</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
          .error { color: red; margin: 20px 0; }
          .button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2>❌ Gmail Authentication Failed</h2>
        <div class="error">Error: ${error}</div>
        <p>Please try again or check your Gmail OAuth configuration.</p>
        <button class="button" onclick="window.close()">Close</button>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'gmail_auth_error',
              error: '${error}'
            }, '*');
          }
        </script>
      </body>
      </html>
    `;
    return res.send(errorHtml);
  }
  
  if (!code) {
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail Authentication Error</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
          .error { color: red; margin: 20px 0; }
          .button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2>❌ Gmail Authentication Failed</h2>
        <div class="error">No authorization code received</div>
        <p>Please try again.</p>
        <button class="button" onclick="window.close()">Close</button>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'gmail_auth_error',
              error: 'No authorization code received'
            }, '*');
          }
        </script>
      </body>
      </html>
    `;
    return res.send(errorHtml);
  }
  
  try {
    console.log('🔄 Exchanging authorization code for tokens...');
    const { tokens } = await oauth2Client.getAccessToken(code);
    
    console.log('✅ Gmail OAuth completed successfully');
    
    // Return HTML that communicates with parent window
    const successHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail Authentication Success</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
          .success { color: green; margin: 20px 0; }
          .button { background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2>✅ Gmail Connected Successfully!</h2>
        <div class="success">Your Gmail account has been connected.</div>
        <p>You can now close this window and use Gmail features.</p>
        <button class="button" onclick="window.close()">Close</button>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'gmail_auth_success',
              tokens: ${JSON.stringify(tokens)}
            }, '*');
          }
          // Auto-close after 2 seconds
          setTimeout(() => {
            window.close();
          }, 2000);
        </script>
      </body>
      </html>
    `;
    
    res.send(successHtml);
    
  } catch (error) {
    console.error('❌ Gmail OAuth error:', error);
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gmail Authentication Error</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
          .error { color: red; margin: 20px 0; }
          .button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2>❌ Gmail Authentication Failed</h2>
        <div class="error">Failed to authenticate with Gmail</div>
        <p>Error: ${error.message}</p>
        <button class="button" onclick="window.close()">Close</button>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'gmail_auth_error',
              error: '${error.message}'
            }, '*');
          }
        </script>
      </body>
      </html>
    `;
    res.send(errorHtml);
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