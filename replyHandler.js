/**
 * Reply Handler Module
 *
 * Handles functionality related to replying to messages in WhatsApp
 */

/**
 * Checks if a message is a reply to another message
 * @param {Object} message - The message object from Baileys
 * @returns {Boolean} - True if the message is a reply
 */
function isReplyToMessage(message) {
  if (!message || !message.message) {
    return false;
  }

  // Check if the message has a quoted message
  return !!message.message.extendedTextMessage?.contextInfo?.quotedMessage;
}

/**
 * Gets the quoted message information from a reply
 * @param {Object} message - The message object from Baileys
 * @returns {Object|null} - The quoted message info or null if not a reply
 */
function getQuotedMessageInfo(message) {
  if (!isReplyToMessage(message)) {
    return null;
  }

  const contextInfo = message.message.extendedTextMessage?.contextInfo;
  
  if (!contextInfo) {
    return null;
  }

  return {
    quotedMessage: contextInfo.quotedMessage,
    quotedMessageId: contextInfo.stanzaId,
    participant: contextInfo.participant,
    // Add any other relevant information from the context
  };
}

/**
 * Formats a reply message for display
 * @param {Object} message - The processed message object
 * @param {Object} quotedInfo - Information about the quoted message
 * @returns {String} - Formatted quoted message content
 */
function formatQuotedMessage(message, quotedInfo) {
  if (!quotedInfo || !quotedInfo.quotedMessage) {
    return '';
  }

  // Extract the text from the quoted message
  const quotedText = quotedInfo.quotedMessage.conversation || 
                     quotedInfo.quotedMessage.extendedTextMessage?.text ||
                     '[Media or unsupported message]';

  // Truncate if too long
  const maxLength = 50;
  const truncatedText = quotedText.length > maxLength 
    ? quotedText.substring(0, maxLength) + '...' 
    : quotedText;

  // Format the quoted message
  return `↪️ Replying to: "${truncatedText}"`;
}

/**
 * Sends a reply to a specific message
 * @param {Object} sock - The WhatsApp socket connection
 * @param {String} jid - The JID to send the reply to
 * @param {String} text - The text content of the reply
 * @param {Object} quotedMessage - The message to quote/reply to
 * @returns {Promise<Object>} - The sent message
 */
async function sendReply(sock, jid, text, quotedMessage) {
  try {
    return await sock.sendMessage(jid, { text }, { quoted: quotedMessage });
  } catch (error) {
    console.error('Error sending reply:', error);
    throw error;
  }
}

/**
 * Creates a reply button interface for the console
 * @param {Object} message - The processed message object
 * @returns {String} - Formatted reply button interface
 */
function createReplyInterface(message) {
  const messageId = message.key.id;
  return `\n[To reply to this message, use command: !reply ${messageId} Your reply text]`;
}

/**
 * Processes a command to reply to a message
 * @param {Object} sock - The WhatsApp socket connection
 * @param {String} command - The command text (e.g., "!reply messageId Your reply text")
 * @param {Object} messageStore - Storage for messages to retrieve the original message
 * @returns {Promise<Boolean>} - True if the command was processed successfully
 */
async function processReplyCommand(sock, command, messageStore) {
  // Check if this is a reply command
  if (!command.startsWith('!reply ')) {
    return false;
  }

  // Parse the command
  const parts = command.split(' ');
  if (parts.length < 3) {
    console.log('Invalid reply command format. Use: !reply messageId Your reply text');
    return false;
  }

  const messageId = parts[1];
  const replyText = parts.slice(2).join(' ');

  // Find the original message in the store
  const originalMessage = messageStore.get(messageId);
  if (!originalMessage) {
    console.log(`Message with ID ${messageId} not found.`);
    return false;
  }

  // Send the reply
  try {
    await sendReply(
      sock, 
      originalMessage.key.remoteJid, 
      replyText, 
      originalMessage
    );
    console.log(`Reply sent successfully to message ${messageId}`);
    return true;
  } catch (error) {
    console.error('Error processing reply command:', error);
    return false;
  }
}

module.exports = {
  isReplyToMessage,
  getQuotedMessageInfo,
  formatQuotedMessage,
  sendReply,
  createReplyInterface,
  processReplyCommand
};
