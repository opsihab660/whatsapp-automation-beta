/**
 * Message UI Module
 *
 * Manages message display and formatting
 */

const chalk = require('chalk');
const { formatQuotedMessage } = require('../handlers/replyHandler');

/**
 * Formats a message for display in the console
 * @param {Object} message - The processed message object
 * @param {Object} quotedInfo - Information about the quoted message (if any)
 * @param {Object} styles - Styling options for different message categories
 * @returns {String} - The formatted message
 */
function formatMessage(message, quotedInfo = null, styles = {}) {
  // Default styles
  const defaultStyles = {
    group: {
      headerColor: chalk.cyan.bold,
      bodyColor: chalk.white,
      borderChar: '═',
      borderColor: chalk.cyan
    },
    inbox: {
      headerColor: chalk.green.bold,
      bodyColor: chalk.white,
      borderChar: '─',
      borderColor: chalk.green
    },
    important: {
      headerColor: chalk.red.bold,
      bodyColor: chalk.yellow,
      borderChar: '!',
      borderColor: chalk.red
    },
    work: {
      headerColor: chalk.blue.bold,
      bodyColor: chalk.white,
      borderChar: '─',
      borderColor: chalk.blue
    },
    personal: {
      headerColor: chalk.magenta.bold,
      bodyColor: chalk.white,
      borderChar: '─',
      borderColor: chalk.magenta
    },
    other: {
      headerColor: chalk.gray.bold,
      bodyColor: chalk.white,
      borderChar: '─',
      borderColor: chalk.gray
    }
  };
  
  // Merge default styles with provided styles
  const mergedStyles = {
    ...defaultStyles,
    ...styles
  };
  
  // Get the category of the message
  const category = message.metadata.category;
  
  // Get the style for this category
  const style = mergedStyles[category] || mergedStyles.other;
  
  // Extract message content
  const messageContent = message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || 
                        '[Media Message]';
  
  // Create header
  let header = '';
  if (message.metadata.isGroup) {
    const sender = message.key.participant ? 
                  message.key.participant.split('@')[0] : 
                  'Unknown';
    
    header = `${message.metadata.groupName || 'Unknown Group'} | From: ${sender}`;
  } else {
    const sender = message.key.remoteJid.split('@')[0];
    header = `From: ${sender}`;
  }
  
  // Add timestamp
  const timestamp = message.metadata.timestamp.toLocaleTimeString();
  header += ` | ${timestamp}`;
  
  // Create border
  const borderLength = Math.max(header.length, messageContent.length);
  const border = style.borderColor(style.borderChar.repeat(borderLength));
  
  // Format the message
  let formattedMessage = `\n${border}\n${style.headerColor(header)}\n${border}\n${style.bodyColor(messageContent)}\n`;
  
  // Add quoted message if available
  if (quotedInfo) {
    const quotedMessage = formatQuotedMessage(quotedInfo);
    formattedMessage += `${style.bodyColor(quotedMessage)}\n`;
  }
  
  formattedMessage += `${border}\n`;
  
  return formattedMessage;
}

module.exports = {
  formatMessage
};
