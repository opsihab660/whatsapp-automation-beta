const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode-terminal'); // QR কোড টার্মিনালে প্রদর্শনের জন্য
const pino = require('pino'); // For better logging control
const chalk = require('chalk'); // For colored console output
const readline = require('readline'); // For command-line interface

// Import our custom modules
const { processMessage, MESSAGE_CATEGORIES, isGroupMessage, isDirectMessage } = require('./messageHandler');
const { formatMessage } = require('./messageUI');
const { handleNotification } = require('./notificationHandler');
const { loadPreferences, addCustomCategoryRule } = require('./userPreferences');
const { isReplyToMessage, getQuotedMessageInfo, formatQuotedMessage, sendReply, createReplyInterface, processReplyCommand } = require('./replyHandler');
const MessageStore = require('./messageStore');

// Create a custom logger with reduced noise
const logger = pino({
  level: 'warn', // Only show warnings and errors, not info messages
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

async function startBot() {
  console.log('Starting WhatsApp bot...');

  // Create auth state
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();

  // Create message store for tracking messages
  const messageStore = new MessageStore({ maxSize: 200 });

  // Create readline interface for command input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'WhatsApp> '
  });

  // Create socket with improved options
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // We'll handle QR code display ourselves
    logger: logger, // Use our custom logger to reduce noise
    browser: ['Chrome (Windows)', 'Chrome', '10.0'], // More common user agent
    connectTimeoutMs: 60000, // Increase timeout for better connection stability
    retryRequestDelayMs: 250 // Faster retry on connection issues
  });

  // Save credentials when updated
  sock.ev.on('creds.update', saveCreds);

  // Set up command line interface for replying to messages
  rl.on('line', async (input) => {
    try {
      // Handle exit command
      if (input.toLowerCase() === '!exit') {
        console.log('Exiting WhatsApp bot...');
        rl.close();
        return;
      }

      // Handle help command
      if (input.toLowerCase() === '!help') {
        console.log(chalk.green('=== WhatsApp Bot Commands ==='));
        console.log(chalk.yellow('!reply [messageId] [text] - Reply to a specific message'));
        console.log(chalk.yellow('!help - Show this help message'));
        console.log(chalk.yellow('!exit - Exit the bot'));
        rl.prompt();
        return;
      }

      // Process reply commands
      const success = await processReplyCommand(sock, input, messageStore);
      if (!success && input.startsWith('!')) {
        console.log('Unknown command or command failed');
      }
    } catch (error) {
      console.error('Error processing command:', error);
    }
    rl.prompt();
  });

  // Start the prompt
  rl.prompt();

  // Handle readline close
  rl.on('close', () => {
    console.log('WhatsApp bot shutting down...');
    process.exit(0);
  });

  // Handle connection updates
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Connection closed
    if (connection === 'close') {
      // Check if we should reconnect
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.output?.payload?.error;

      console.log(`Connection closed. Status code: ${statusCode}, Reason: ${reason || 'Unknown'}`);

      // Don't reconnect if logged out
      if (statusCode !== DisconnectReason.loggedOut) {
        console.log('Reconnecting...');
        setTimeout(startBot, 3000); // Wait 3 seconds before reconnecting
      } else {
        console.log('Logged out. Please restart the bot manually.');
      }
    }
    // Connection opened successfully
    else if (connection === 'open') {
      console.log('✅ Successfully connected to WhatsApp!');
    }

    // QR code received - display it
    if (qr) {
      console.log('\n📱 Scan this QR code with your WhatsApp app:\n');
      QRCode.generate(qr, { small: true }, (qrcode) => {
        console.log(qrcode);
      });
      console.log('\nWaiting for you to scan the QR code...');
    }
  });

  // Load user preferences
  const userPrefs = loadPreferences();

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

        // Store the message for future reference (for reply functionality)
        const storedMsgId = messageStore.add(processedMsg);
        console.log(chalk.gray(`📝 Message stored with ID: ${storedMsgId}`));

        // Check if this message is a reply to another message
        let quotedInfo = null;
        let replyContext = '';

        if (isReplyToMessage(processedMsg)) {
          quotedInfo = getQuotedMessageInfo(processedMsg);
          replyContext = formatQuotedMessage(processedMsg, quotedInfo);
          console.log(chalk.blue(`ℹ️ ${replyContext}`));
        }

        // Format and display the message
        const formattedMessage = formatMessage(processedMsg, userPrefs);
        console.log(formattedMessage);

        // Add reply interface to the message display
        console.log(createReplyInterface(processedMsg));

        // Handle notifications
        handleNotification(processedMsg, userPrefs);

        // Implement different reply behaviors for group vs individual messages
        const sender = msg.key.remoteJid;

        // Check if the message is from a group - using direct function for clarity
        if (isGroupMessage(msg)) {
          // Always send automatic reply to group messages
          console.log(chalk.green('✅ Sending automatic reply to group message'));

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
        } else if (isDirectMessage(msg)) {
          // For individual/direct messages, implement reply functionality
          console.log(chalk.yellow('📩 Direct message received, enabling reply functionality'));

          // Get sender information
          const senderNumber = msg.key.remoteJid.split('@')[0];
          console.log(chalk.gray(`📱 Direct message from: ${senderNumber}`));

          // Send automatic reply for direct messages too
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
          console.log(chalk.gray('ℹ️ Received a message that is neither group nor direct message'));
        }

        // Prompt the user for input after processing the message
        rl.prompt();
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });
}

startBot();
