/**
 * WhatsApp Bot Server
 * 
 * This file serves as the entry point for the WhatsApp bot when deployed to Render.
 * It provides a web interface to view the QR code and monitor the bot status.
 */

// Load environment variables
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');

// Import our custom modules
const { processMessage, MESSAGE_CATEGORIES, isGroupMessage, isDirectMessage } = require('./messageHandler');
const { formatMessage } = require('./messageUI');
const { handleNotification } = require('./notificationHandler');
const { loadPreferences, addCustomCategoryRule } = require('./userPreferences');
const { isReplyToMessage, getQuotedMessageInfo, formatQuotedMessage, sendReply } = require('./replyHandler');
const MessageStore = require('./messageStore');

// Create Express app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Set up middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Create public directory if it doesn't exist
if (!fs.existsSync('./public')) {
  fs.mkdirSync('./public');
}

// Create a custom logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

// Global variables
let sock = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let lastError = null;
let messageStore = new MessageStore({ maxSize: 200 });
let userPrefs = null;

// Initialize WhatsApp connection
async function startWhatsAppBot() {
  try {
    logger.info('Starting WhatsApp bot...');
    
    // Create auth state
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const { version } = await fetchLatestBaileysVersion();
    
    // Create socket with improved options
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true, // Also print to terminal for debugging
      logger: logger,
      browser: ['Chrome (Windows)', 'Chrome', '10.0'],
      connectTimeoutMs: 60000,
      retryRequestDelayMs: 250
    });
    
    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);
    
    // Handle connection updates
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Update connection status
      if (connection) {
        connectionStatus = connection;
      }
      
      // Connection closed
      if (connection === 'close') {
        // Check if we should reconnect
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.output?.payload?.error;
        
        lastError = `Connection closed. Status code: ${statusCode}, Reason: ${reason || 'Unknown'}`;
        logger.error(lastError);
        
        // Don't reconnect if logged out
        if (statusCode !== DisconnectReason.loggedOut) {
          logger.info('Reconnecting...');
          setTimeout(startWhatsAppBot, 3000); // Wait 3 seconds before reconnecting
        } else {
          logger.warn('Logged out. Please restart the bot manually.');
        }
      }
      // Connection opened successfully
      else if (connection === 'open') {
        logger.info('✅ Successfully connected to WhatsApp!');
      }
      
      // QR code received - save it for the web interface
      if (qr) {
        logger.info('New QR code received');
        // Generate QR code as data URL
        QRCode.toDataURL(qr, { scale: 8 }, (err, url) => {
          if (err) {
            logger.error('Failed to generate QR code', err);
            return;
          }
          qrCodeData = url;
          
          // Also save QR code as image file for the web interface
          QRCode.toFile('./public/qrcode.png', qr, { scale: 8 }, (err) => {
            if (err) {
              logger.error('Failed to save QR code image', err);
            }
          });
        });
      }
    });
    
    // Load user preferences
    userPrefs = loadPreferences();
    
    // Example of adding a custom category rule
    addCustomCategoryRule((message) => {
      // Example: categorize messages containing "urgent" as important
      const messageText = message.message?.conversation ||
                         message.message?.extendedTextMessage?.text || '';
      if (messageText.toLowerCase().includes('urgent')) {
        return MESSAGE_CATEGORIES.IMPORTANT;
      }
      
      // Example: categorize messages from specific contacts as work-related
      const sender = message.key.remoteJid;
      const workContacts = userPrefs.workContacts || [];
      if (workContacts.includes(sender)) {
        return MESSAGE_CATEGORIES.WORK;
      }
      
      // Return null to use default categorization
      return null;
    });
    
    // Handle incoming messages
    sock.ev.on('messages.upsert', async (m) => {
      try {
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
          // Process the message with our custom handler
          const processedMsg = await processMessage(msg, sock, userPrefs);
          
          // Store the message for future reference
          const storedMsgId = messageStore.add(processedMsg);
          logger.info(`Message stored with ID: ${storedMsgId}`);
          
          // Check if this message is a reply to another message
          let quotedInfo = null;
          let replyContext = '';
          
          if (isReplyToMessage(processedMsg)) {
            quotedInfo = getQuotedMessageInfo(processedMsg);
            replyContext = formatQuotedMessage(processedMsg, quotedInfo);
            logger.info(`Reply context: ${replyContext}`);
          }
          
          // Format and log the message
          const formattedMessage = formatMessage(processedMsg, userPrefs);
          logger.info(formattedMessage);
          
          // Handle notifications
          handleNotification(processedMsg, userPrefs);
          
          // Implement different reply behaviors for group vs individual messages
          const sender = msg.key.remoteJid;
          
          // Check if auto-replies are enabled
          const enableAutoReply = process.env.ENABLE_AUTO_REPLY === 'true';
          const enableGroupAutoReply = process.env.ENABLE_GROUP_AUTO_REPLY === 'true';
          const enableDirectAutoReply = process.env.ENABLE_DIRECT_AUTO_REPLY === 'true';
          
          // Check if the message is from a group
          if (isGroupMessage(msg) && enableAutoReply && enableGroupAutoReply) {
            // Send automatic reply to group messages
            logger.info('Sending automatic reply to group message');
            
            // Get the group name for a more personalized response
            const groupName = processedMsg.metadata.groupName || 'the group';
            
            // Get sender's name/number for personalized response
            const senderName = processedMsg.key.participant ?
                              processedMsg.key.participant.split('@')[0] :
                              'Unknown';
            
            // Send reply with quoted message if it's a reply
            if (quotedInfo) {
              await sendReply(sock, sender,
                `Hello ${senderName}, I see you're replying to a message in ${groupName}. Your reply has been received and will be processed accordingly.`,
                processedMsg);
            } else {
              await sendReply(sock, sender,
                `Hello ${senderName}, this is an automatic reply to your message in ${groupName}. Your message has been received and will be processed accordingly.`,
                processedMsg);
            }
          } else if (isDirectMessage(msg) && enableAutoReply && enableDirectAutoReply) {
            // For individual/direct messages
            logger.info('Direct message received, sending automatic reply');
            
            // Get sender information
            const senderNumber = msg.key.remoteJid.split('@')[0];
            
            // Send automatic reply for direct messages
            if (quotedInfo) {
              await sendReply(sock, sender,
                `Hello ${senderNumber}, I see you're replying to a previous message. Your reply has been received and will be processed accordingly.`,
                processedMsg);
            } else {
              await sendReply(sock, sender,
                `Hello ${senderNumber}, this is an automatic reply to your message. Your message has been received and will be processed accordingly.`,
                processedMsg);
            }
          } else {
            // Handle any other types of messages (status updates, etc.)
            logger.info('Received a message that is neither group nor direct message, or auto-replies are disabled');
          }
        }
      } catch (error) {
        logger.error('Error handling message:', error);
      }
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to start WhatsApp bot:', error);
    lastError = error.message;
    return false;
  }
}

// Define routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to get the QR code
app.get('/api/qrcode', (req, res) => {
  if (qrCodeData) {
    res.json({ qrcode: qrCodeData });
  } else {
    res.status(404).json({ error: 'QR code not available yet' });
  }
});

// API endpoint to get bot status
app.get('/api/status', (req, res) => {
  res.json({
    status: connectionStatus,
    error: lastError,
    messagesStored: messageStore.size()
  });
});

// Create a basic HTML page for the web interface
const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp Bot Dashboard</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background-color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #4CAF50;
      text-align: center;
    }
    .status-container {
      margin: 20px 0;
      padding: 15px;
      border-radius: 4px;
    }
    .connected {
      background-color: #e8f5e9;
      border-left: 5px solid #4CAF50;
    }
    .disconnected {
      background-color: #ffebee;
      border-left: 5px solid #f44336;
    }
    .connecting {
      background-color: #fff8e1;
      border-left: 5px solid #ffc107;
    }
    .qrcode-container {
      text-align: center;
      margin: 30px 0;
    }
    .qrcode-container img {
      max-width: 300px;
      border: 1px solid #ddd;
    }
    .refresh-button {
      background-color: #4CAF50;
      color: white;
      border: none;
      padding: 10px 15px;
      text-align: center;
      text-decoration: none;
      display: inline-block;
      font-size: 16px;
      margin: 10px 0;
      cursor: pointer;
      border-radius: 4px;
    }
    .error {
      color: #f44336;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>WhatsApp Bot Dashboard</h1>
    
    <div id="status-container" class="status-container disconnected">
      <h2>Status: <span id="connection-status">Disconnected</span></h2>
      <p>Messages stored: <span id="messages-count">0</span></p>
      <div id="error-message" class="error"></div>
    </div>
    
    <div class="qrcode-container">
      <h2>Scan QR Code to Connect</h2>
      <p>If you're already connected, no QR code will be displayed.</p>
      <img id="qrcode" src="/qrcode.png" alt="QR Code" style="display: none;">
      <div id="qrcode-placeholder">Waiting for QR code...</div>
    </div>
    
    <div style="text-align: center;">
      <button class="refresh-button" onclick="refreshStatus()">Refresh Status</button>
    </div>
  </div>

  <script>
    // Function to update the status display
    function updateStatusDisplay(status) {
      const statusContainer = document.getElementById('status-container');
      const connectionStatus = document.getElementById('connection-status');
      
      // Remove all status classes
      statusContainer.classList.remove('connected', 'disconnected', 'connecting');
      
      // Update based on current status
      if (status === 'open') {
        statusContainer.classList.add('connected');
        connectionStatus.textContent = 'Connected';
      } else if (status === 'connecting') {
        statusContainer.classList.add('connecting');
        connectionStatus.textContent = 'Connecting...';
      } else {
        statusContainer.classList.add('disconnected');
        connectionStatus.textContent = 'Disconnected';
      }
    }
    
    // Function to fetch and display the QR code
    async function fetchQRCode() {
      try {
        const response = await fetch('/api/qrcode');
        if (response.ok) {
          const data = await response.json();
          const qrcodeImg = document.getElementById('qrcode');
          const placeholder = document.getElementById('qrcode-placeholder');
          
          qrcodeImg.src = data.qrcode;
          qrcodeImg.style.display = 'inline-block';
          placeholder.style.display = 'none';
        } else {
          // If no QR code is available, check if we're connected
          await fetchStatus();
        }
      } catch (error) {
        console.error('Error fetching QR code:', error);
      }
    }
    
    // Function to fetch the bot status
    async function fetchStatus() {
      try {
        const response = await fetch('/api/status');
        if (response.ok) {
          const data = await response.json();
          
          // Update status display
          updateStatusDisplay(data.status);
          
          // Update messages count
          document.getElementById('messages-count').textContent = data.messagesStored;
          
          // Show error if any
          const errorElement = document.getElementById('error-message');
          if (data.error) {
            errorElement.textContent = 'Error: ' + data.error;
            errorElement.style.display = 'block';
          } else {
            errorElement.style.display = 'none';
          }
          
          // If connected, hide QR code
          if (data.status === 'open') {
            document.getElementById('qrcode').style.display = 'none';
            document.getElementById('qrcode-placeholder').textContent = 'Connected! No QR code needed.';
          } else {
            // Try to fetch QR code again
            fetchQRCode();
          }
        }
      } catch (error) {
        console.error('Error fetching status:', error);
      }
    }
    
    // Function to refresh the status
    function refreshStatus() {
      fetchStatus();
      fetchQRCode();
    }
    
    // Initial fetch
    document.addEventListener('DOMContentLoaded', () => {
      refreshStatus();
      
      // Set up periodic refresh
      setInterval(refreshStatus, 10000); // Refresh every 10 seconds
    });
  </script>
</body>
</html>
`;

// Create the index.html file in the public directory
fs.writeFileSync('./public/index.html', indexHtml);

// Start the server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  
  // Start the WhatsApp bot
  startWhatsAppBot();
});
