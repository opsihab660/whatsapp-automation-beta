/**
 * WhatsApp Automation Server
 *
 * Main server file for WhatsApp automation
 */

// Import required packages
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const chalk = require('chalk');

// Import configuration
const config = require('./config/config');

// Import API routes
const {
  router: apiRouter,
  updateConnectionState,
  updateQRCode,
  updateError,
  updateMessagesCount
} = require('./routes/api');

// Create logger with configured level
const logger = pino({
  level: config.logging.level,
  transport: config.logging.prettyPrint ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

// Create express app
const app = express();
const port = config.server.port;

// Import our custom modules
const { processMessage } = require('./handlers/messageHandler');
const { formatMessage } = require('./utils/messageUI');
const { handleNotification } = require('./handlers/notificationHandler');
const { loadPreferences } = require('./config/userPreferences');
const {
  isReplyToMessage,
  getQuotedMessageInfo,
  createReplyInterface,
  processReplyCommand
} = require('./handlers/replyHandler');
// Quick replies are handled in replyHandler.js
const MessageStore = require('./core/messageStore');

// Create message store
const messageStore = new MessageStore();

// Load user preferences from config
const userPrefs = loadPreferences(config.bot);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', apiRouter);

// Main route
app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Health check endpoint
app.get('/health', (_, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start the server
app.listen(port, () => {
  console.log(chalk.green(`✅ Server running on port ${port} in ${config.server.env} mode`));
});

// Function to connect to WhatsApp
async function connectToWhatsApp() {
  let isConnecting = false;  // Add connection state tracking

  // Get authentication state
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  // Create WhatsApp socket
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,  // Disable deprecated QR printing
    logger: logger
  });

  // Save credentials when updated
  sock.ev.on('creds.update', saveCreds);

  // Handle connection updates
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Display QR code when available
      console.log(chalk.yellow('\n📱 Scan this QR code in WhatsApp to connect:'));
      require('qrcode-terminal').generate(qr, { small: true });
      console.log(chalk.gray('\nWaiting for QR code scan...'));
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom) &&
                             lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;

      console.log(chalk.red('Connection closed due to ', lastDisconnect?.error?.output?.payload?.error));

      // Only reconnect if not logged out and not already connecting
      if (shouldReconnect && !isConnecting) {
        isConnecting = true;
        console.log(chalk.yellow('Attempting to reconnect...'));
        setTimeout(() => {
          isConnecting = false;
          connectToWhatsApp();
        }, 5000); // Wait 5 seconds before reconnecting
      }
    } else if (connection === 'open') {
      isConnecting = false;
      console.log(chalk.green('✅ Connected to WhatsApp'));
    }
  });

  // Create reply interface
  const rl = createReplyInterface(sock, messageStore);

  // Show quick reply help on startup
  console.log(chalk.yellow('\n⚡ Fast Reply System Enabled'));
  console.log(chalk.gray('Type !qr to see available quick replies'));
  console.log(chalk.gray('Use quick reply shortcuts to send predefined messages instantly'));

  // Handle command line input
  rl.on('line', async (input) => {
    // Process the command
    const processed = await processReplyCommand(input, sock, messageStore);

    // If the command wasn't processed, show an error
    if (!processed && input.startsWith('!')) {
      console.log(chalk.red(`❌ Unknown command: ${input}`));
      console.log(chalk.yellow('Type !help for available commands'));
      console.log(chalk.yellow('Type !qr to see available quick replies'));
    }

    rl.prompt();
  });

  // Handle messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      // Skip messages sent by us
      if (msg.key.fromMe) continue;

      try {
        // Process the message
        const processedMsg = await processMessage(msg, sock, userPrefs);

        // Check if this is a reply to another message
        const quotedInfo = isReplyToMessage(msg) ? getQuotedMessageInfo(msg) : null;

        // Format and display the message
        const formattedMsg = formatMessage(processedMsg, quotedInfo);
        console.log(formattedMsg);

        // Store the message for future reference
        const messageId = messageStore.add(processedMsg);
        console.log(chalk.gray(`📝 Message stored with ID: ${messageId}`));

        // Show how to reply to this message
        console.log(chalk.gray(`[To reply to this message, use command: !reply ${messageId} Your reply text]`));

        // Show notification
        await handleNotification(processedMsg, userPrefs.notifications);

        // The automatic replies are now handled in the processMessage function in messageHandler.js
        // No need to send additional replies here
      } catch (error) {
        console.error('Error processing message:', error);
      }
    }
  });

  return sock;
}

// Connect to WhatsApp
connectToWhatsApp();
