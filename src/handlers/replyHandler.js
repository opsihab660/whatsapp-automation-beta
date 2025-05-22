/**
 * Reply Handler Module
 *
 * Manages reply functionality for messages
 */

const readline = require('readline');
const chalk = require('chalk');
const { getQuickReply, getAllQuickReplies, addQuickReply } = require('../config/quickReplies');

// Queue for managing multiple replies
const replyQueue = [];

/**
 * Determines if a message is a reply to another message
 * @param {Object} message - The message object from Baileys
 * @returns {Boolean} - True if the message is a reply
 */
function isReplyToMessage(message) {
  if (!message || !message.message) return false;

  // Check if the message has a quoted message
  return !!message.message.extendedTextMessage?.contextInfo?.quotedMessage;
}

/**
 * Gets information about the quoted message
 * @param {Object} message - The message object from Baileys
 * @returns {Object|null} - Information about the quoted message or null if not a reply
 */
function getQuotedMessageInfo(message) {
  if (!isReplyToMessage(message)) return null;

  const contextInfo = message.message.extendedTextMessage.contextInfo;

  return {
    quotedMessage: contextInfo.quotedMessage,
    stanzaId: contextInfo.stanzaId,
    participant: contextInfo.participant,
    quotedText: contextInfo.quotedMessage.conversation ||
                contextInfo.quotedMessage.extendedTextMessage?.text ||
                '[Media Message]'
  };
}

/**
 * Formats a quoted message for display
 * @param {Object} quotedInfo - Information about the quoted message
 * @returns {String} - Formatted quoted message
 */
function formatQuotedMessage(quotedInfo) {
  if (!quotedInfo) return '';

  const sender = quotedInfo.participant ?
                quotedInfo.participant.split('@')[0] :
                'Unknown';

  return `> ${sender}: ${quotedInfo.quotedText}`;
}

/**
 * Adds a reply to the queue
 * @param {Object} sock - The WhatsApp socket connection
 * @param {String} jid - The JID to send the reply to
 * @param {String} text - The text content of the reply
 * @param {Object} quotedMsg - The message to quote in the reply
 * @returns {Promise<void>} - Promise that resolves when the reply is added to the queue
 */
async function queueReply(sock, jid, text, quotedMsg = null) {
  replyQueue.push({
    sock,
    jid,
    text,
    quotedMsg,
    timestamp: Date.now()
  });

  console.log(chalk.yellow(`📋 Reply queued: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`));

  // Process the queue if it's not already being processed
  if (replyQueue.length === 1) {
    processReplyQueue();
  }
}

/**
 * Processes the reply queue
 * @returns {Promise<void>} - Promise that resolves when the queue is processed
 */
async function processReplyQueue() {
  if (replyQueue.length === 0) return;

  const reply = replyQueue[0];

  try {
    // Validate the reply data before sending
    if (!reply.sock || !reply.jid || !reply.text) {
      console.error(chalk.red('❌ Invalid reply data:'), JSON.stringify(reply, null, 2));
      replyQueue.shift(); // Remove invalid reply

      // Process the next reply in the queue if there is one
      if (replyQueue.length > 0) {
        setTimeout(processReplyQueue, 500);
      }
      return;
    }

    // Check if the JID is valid
    if (!reply.jid.includes('@')) {
      console.error(chalk.red(`❌ Invalid JID: ${reply.jid}`));
      replyQueue.shift(); // Remove invalid reply

      // Process the next reply in the queue if there is one
      if (replyQueue.length > 0) {
        setTimeout(processReplyQueue, 500);
      }
      return;
    }

    // Send the reply with proper error handling
    await sendReply(reply.sock, reply.jid, reply.text, reply.quotedMsg);
    console.log(chalk.green(`✅ Queued reply sent successfully (${Date.now() - reply.timestamp}ms)`));
  } catch (error) {
    console.error(chalk.red('❌ Error sending queued reply:'), error);
  } finally {
    // Remove the processed reply from the queue
    replyQueue.shift();

    // Process the next reply in the queue if there is one
    if (replyQueue.length > 0) {
      // Add a small delay to prevent rate limiting
      setTimeout(processReplyQueue, 500);
    }
  }
}

/**
 * Sends a reply to a message
 * @param {Object} sock - The WhatsApp socket connection
 * @param {String} jid - The JID to send the reply to
 * @param {String} text - The text content of the reply
 * @param {Object} quotedMsg - The message to quote in the reply
 * @param {Boolean} queue - Whether to queue the reply (default: false)
 * @returns {Promise<Object>} - The sent message
 */
async function sendReply(sock, jid, text, quotedMsg = null, queue = false) {
  // Validate inputs
  if (!sock) {
    console.error(chalk.red('❌ Invalid socket connection'));
    throw new Error('Invalid socket connection');
  }

  if (!jid) {
    console.error(chalk.red('❌ Invalid JID'));
    throw new Error('Invalid JID');
  }

  if (!text) {
    console.error(chalk.red('❌ Invalid message text'));
    throw new Error('Invalid message text');
  }

  // If queue is true, add the reply to the queue
  if (queue) {
    return queueReply(sock, jid, text, quotedMsg);
  }

  try {
    const options = {};

    // If we have a message to quote and it's valid, add it to the options
    if (quotedMsg && quotedMsg.key && quotedMsg.key.remoteJid) {
      options.quoted = quotedMsg;
    }

    // Ensure the JID is valid
    if (!jid.includes('@')) {
      console.error(chalk.red(`❌ Invalid JID format: ${jid}`));
      throw new Error(`Invalid JID format: ${jid}`);
    }

    // Send the message with a simple text object
    return await sock.sendMessage(jid, { text: text.toString() }, options);
  } catch (error) {
    console.error(chalk.red('Error sending reply:'), error);
    throw error;
  }
}

/**
 * Creates a reply interface for the command line
 * @param {Object} sock - The WhatsApp socket connection
 * @param {Object} messageStore - The message store
 * @returns {Object} - The reply interface
 */
function createReplyInterface(sock, messageStore) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.blue('WhatsApp Bot > ')
  });

  rl.prompt();

  return rl;
}

/**
 * Sends a quick reply
 * @param {Object} sock - The WhatsApp socket connection
 * @param {String} jid - The JID to send the reply to
 * @param {String} shortcut - The quick reply shortcut
 * @param {Object} quotedMsg - The message to quote in the reply
 * @returns {Promise<Boolean>} - True if the quick reply was sent successfully
 */
async function sendQuickReply(sock, jid, shortcut, quotedMsg = null) {
  // Validate inputs
  if (!sock) {
    console.error(chalk.red('❌ Invalid socket connection for quick reply'));
    return false;
  }

  if (!jid) {
    console.error(chalk.red('❌ Invalid JID for quick reply'));
    return false;
  }

  if (!shortcut) {
    console.error(chalk.red('❌ Invalid shortcut for quick reply'));
    return false;
  }

  // Get the reply text from the shortcut
  const replyText = getQuickReply(shortcut);

  if (!replyText) {
    console.log(chalk.red(`❌ Quick reply shortcut "${shortcut}" not found`));
    console.log(chalk.yellow('Type !qr to see available quick replies'));
    return false;
  }

  try {
    // Validate the JID format
    if (!jid.includes('@')) {
      console.error(chalk.red(`❌ Invalid JID format for quick reply: ${jid}`));
      return false;
    }

    // Send the reply
    await sendReply(sock, jid, replyText, quotedMsg, true); // Queue the reply
    console.log(chalk.green(`✅ Quick reply "${shortcut}" queued`));
    return true;
  } catch (error) {
    console.error(chalk.red(`❌ Error sending quick reply "${shortcut}"`), error);
    return false;
  }
}

/**
 * Shows available quick replies
 */
function showQuickReplies() {
  const quickReplies = getAllQuickReplies();

  console.log(chalk.yellow('\nAvailable quick replies:'));

  Object.entries(quickReplies).forEach(([shortcut, message]) => {
    console.log(chalk.cyan(shortcut) + ' - ' + chalk.gray(`"${message.substring(0, 40)}${message.length > 40 ? '...' : ''}"`));
  });

  console.log(chalk.gray('\nUse these shortcuts to send predefined messages quickly.'));
}

/**
 * Processes a reply command
 * @param {String} command - The command to process
 * @param {Object} sock - The WhatsApp socket connection
 * @param {Object} messageStore - The message store
 * @returns {Promise<Boolean>} - True if the command was processed successfully
 */
async function processReplyCommand(command, sock, messageStore) {
  // Check if this is a quick reply command
  const quickReplies = getAllQuickReplies();
  if (quickReplies[command]) {
    console.log(chalk.yellow(`⚡ Using quick reply: ${command}`));

    try {
      // Get the last message from the store to reply to
      const messages = Array.from(messageStore.messages.values());
      if (messages.length === 0) {
        console.log(chalk.red('❌ No messages to reply to'));
        console.log(chalk.yellow('Send or receive a message first before using quick replies'));
        return false;
      }

      // Get the last valid message
      let lastMessage = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg && msg.key && msg.key.remoteJid && msg.key.remoteJid.includes('@')) {
          lastMessage = msg;
          break;
        }
      }

      if (!lastMessage) {
        console.log(chalk.red('❌ No valid message found to reply to'));
        return false;
      }

      console.log(chalk.blue(`📱 Replying to: ${lastMessage.key.remoteJid.split('@')[0]}`));

      // Send the quick reply
      return await sendQuickReply(sock, lastMessage.key.remoteJid, command, lastMessage);
    } catch (error) {
      console.error(chalk.red('❌ Error processing quick reply:'), error.message);
      return false;
    }
  }

  // Check if this is a reply command
  if (command.startsWith('!reply ')) {
    try {
      // Extract the message ID and reply text
      const parts = command.substring(7).split(' ');

      if (parts.length < 2) {
        console.log(chalk.red('❌ Invalid reply command format'));
        console.log(chalk.yellow('Usage: !reply [messageId] [Your reply text]'));
        return false;
      }

      const messageId = parts[0];
      const replyText = parts.slice(1).join(' ');

      if (!messageId) {
        console.log(chalk.red('❌ Message ID is required'));
        return false;
      }

      if (!replyText || replyText.trim() === '') {
        console.log(chalk.red('❌ Reply text is required'));
        return false;
      }

      // Get the message from the store
      const message = messageStore.get(messageId);

      if (!message) {
        console.log(chalk.red(`❌ Message with ID ${messageId} not found`));
        console.log(chalk.yellow('Make sure you are using the correct message ID'));
        return false;
      }

      // Validate the message has a valid remoteJid
      if (!message.key || !message.key.remoteJid || !message.key.remoteJid.includes('@')) {
        console.log(chalk.red(`❌ Message with ID ${messageId} has an invalid JID`));
        return false;
      }

      // Send the reply
      await sendReply(sock, message.key.remoteJid, replyText, message, true); // Queue the reply
      console.log(chalk.green('✅ Reply queued successfully'));
      console.log(chalk.blue(`📱 Replying to: ${message.key.remoteJid.split('@')[0]}`));
      return true;
    } catch (error) {
      console.error(chalk.red('❌ Error processing reply command:'), error.message);
      return false;
    }
  } else if (command.startsWith('!qr ')) {
    // Format: !qr [messageId] [shortcut]
    try {
      const parts = command.substring(4).split(' ');

      if (parts.length < 2) {
        console.log(chalk.red('❌ Invalid quick reply command format'));
        console.log(chalk.yellow('Usage: !qr [messageId] [shortcut]'));
        return false;
      }

      const messageId = parts[0];
      const shortcut = '!' + parts[1]; // Add ! prefix if not present

      // Get the message from the store
      const message = messageStore.get(messageId);

      if (!message) {
        console.log(chalk.red(`❌ Message with ID ${messageId} not found`));
        return false;
      }

      // Validate the message has a valid remoteJid
      if (!message.key || !message.key.remoteJid || !message.key.remoteJid.includes('@')) {
        console.log(chalk.red(`❌ Message with ID ${messageId} has an invalid JID`));
        return false;
      }

      // Send the quick reply to the specific message
      return await sendQuickReply(sock, message.key.remoteJid, shortcut, message);
    } catch (error) {
      console.error(chalk.red('❌ Error processing quick reply to specific message:'), error.message);
      return false;
    }
  } else if (command === '!help') {
    // Show help
    console.log(chalk.yellow('\nAvailable commands:'));
    console.log(chalk.cyan('!reply [messageId] [text]') + ' - Reply to a specific message');
    console.log(chalk.cyan('!qr') + ' - Show available quick replies');
    console.log(chalk.cyan('!qr [messageId] [shortcut]') + ' - Send a quick reply to a specific message');
    console.log(chalk.cyan('!addqr [shortcut] [message]') + ' - Add a new quick reply');
    console.log(chalk.cyan('!help') + ' - Show this help message');
    console.log(chalk.cyan('!exit') + ' - Exit the bot');
    return true;
  } else if (command === '!qr') {
    // Show quick replies
    showQuickReplies();
    return true;
  } else if (command.startsWith('!addqr ')) {
    // Format: !addqr [shortcut] [message]
    try {
      const parts = command.substring(7).split(' ');

      if (parts.length < 2) {
        console.log(chalk.red('❌ Invalid add quick reply command format'));
        console.log(chalk.yellow('Usage: !addqr [shortcut] [message]'));
        return false;
      }

      let shortcut = parts[0];
      const message = parts.slice(1).join(' ');

      if (!shortcut) {
        console.log(chalk.red('❌ Shortcut is required'));
        return false;
      }

      if (!message || message.trim() === '') {
        console.log(chalk.red('❌ Message is required'));
        return false;
      }

      // Add the ! prefix if not present
      if (!shortcut.startsWith('!')) {
        shortcut = '!' + shortcut;
      }

      // Add the quick reply
      addQuickReply(shortcut, message);

      console.log(chalk.green(`✅ Added quick reply: ${shortcut}`));
      console.log(chalk.blue(`📝 Message: "${message}"`));

      // Show all quick replies
      showQuickReplies();

      return true;
    } catch (error) {
      console.error(chalk.red('❌ Error adding quick reply:'), error.message);
      return false;
    }
  } else if (command === '!exit') {
    // Exit the bot
    console.log(chalk.yellow('Exiting bot...'));
    process.exit(0);
  }

  return false;
}

module.exports = {
  isReplyToMessage,
  getQuotedMessageInfo,
  formatQuotedMessage,
  sendReply,
  queueReply,
  processReplyQueue,
  sendQuickReply,
  showQuickReplies,
  createReplyInterface,
  processReplyCommand
};
