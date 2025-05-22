/**
 * Message UI Module
 *
 * Handles the display and formatting of different message types
 */

const chalk = require('chalk');
const { MESSAGE_CATEGORIES } = require('./messageHandler');
const { isReplyToMessage, getQuotedMessageInfo, formatQuotedMessage } = require('./replyHandler');

// Default UI styles for different message categories
const DEFAULT_STYLES = {
  [MESSAGE_CATEGORIES.GROUP]: {
    headerColor: chalk.green.bold,
    bodyColor: chalk.white,
    borderChar: '═',
    borderColor: chalk.green
  },
  [MESSAGE_CATEGORIES.INBOX]: {
    headerColor: chalk.blue.bold,
    bodyColor: chalk.white,
    borderChar: '─',
    borderColor: chalk.blue
  },
  [MESSAGE_CATEGORIES.IMPORTANT]: {
    headerColor: chalk.red.bold,
    bodyColor: chalk.white,
    borderChar: '█',
    borderColor: chalk.red
  },
  [MESSAGE_CATEGORIES.WORK]: {
    headerColor: chalk.yellow.bold,
    bodyColor: chalk.white,
    borderChar: '─',
    borderColor: chalk.yellow
  },
  [MESSAGE_CATEGORIES.PERSONAL]: {
    headerColor: chalk.magenta.bold,
    bodyColor: chalk.white,
    borderChar: '─',
    borderColor: chalk.magenta
  },
  [MESSAGE_CATEGORIES.OTHER]: {
    headerColor: chalk.gray.bold,
    bodyColor: chalk.white,
    borderChar: '─',
    borderColor: chalk.gray
  }
};

/**
 * Creates a border line for message display
 * @param {Number} length - Length of the border
 * @param {Object} style - Style object containing borderChar and borderColor
 * @returns {String} - Formatted border line
 */
function createBorder(length, style) {
  // Create the border string first
  const borderString = style.borderChar.repeat(length);

  // Apply the color using the chalk function
  // The borderColor property is a chalk color function
  if (typeof style.borderColor === 'function') {
    return style.borderColor(borderString);
  }

  // Fallback if borderColor is not a function
  return borderString;
}

/**
 * Formats a group message for display
 * @param {Object} message - The processed message object
 * @param {Object} userPrefs - User preferences for UI customization
 * @returns {String} - Formatted message ready for display
 */
function formatGroupMessage(message, userPrefs = {}) {
  const styles = userPrefs.styles?.[MESSAGE_CATEGORIES.GROUP] || DEFAULT_STYLES[MESSAGE_CATEGORIES.GROUP];
  const groupName = message.metadata.groupName || 'Unknown Group';
  const sender = message.key.participant ? message.key.participant.split('@')[0] : 'Unknown';
  const messageContent = message.message?.conversation ||
                         message.message?.extendedTextMessage?.text ||
                         '[Media or unsupported message]';

  // Check if this is a reply to another message
  let replyInfo = '';
  if (isReplyToMessage(message)) {
    const quotedInfo = getQuotedMessageInfo(message);
    replyInfo = formatQuotedMessage(message, quotedInfo);
  }

  const timestamp = new Date(message.messageTimestamp * 1000).toLocaleTimeString();
  const headerText = `GROUP: ${groupName} | From: ${sender} | ${timestamp}`;

  // Calculate border length considering reply info
  const contentWithReply = replyInfo ? `${replyInfo}\n${messageContent}` : messageContent;
  const borderLength = Math.max(headerText.length, contentWithReply.length);

  // Apply colors safely with type checking
  const formattedHeader = typeof styles.headerColor === 'function' ?
                          styles.headerColor(headerText) :
                          headerText;

  // Format the reply info with a different color if it exists
  const formattedReply = replyInfo ? chalk.cyan(replyInfo) : '';

  const formattedBody = typeof styles.bodyColor === 'function' ?
                        styles.bodyColor(messageContent) :
                        messageContent;

  // Construct the final message with or without reply context
  const bodyContent = replyInfo ?
    `${formattedReply}\n${formattedBody}` :
    formattedBody;

  return `
${createBorder(borderLength, styles)}
${formattedHeader}
${createBorder(borderLength, styles)}
${bodyContent}
${createBorder(borderLength, styles)}
  `;
}

/**
 * Formats an inbox message for display
 * @param {Object} message - The processed message object
 * @param {Object} userPrefs - User preferences for UI customization
 * @returns {String} - Formatted message ready for display
 */
function formatInboxMessage(message, userPrefs = {}) {
  const category = message.metadata.category;
  const styles = userPrefs.styles?.[category] || DEFAULT_STYLES[category] || DEFAULT_STYLES[MESSAGE_CATEGORIES.INBOX];

  const sender = message.key.remoteJid.split('@')[0];
  const messageContent = message.message?.conversation ||
                         message.message?.extendedTextMessage?.text ||
                         '[Media or unsupported message]';

  // Check if this is a reply to another message
  let replyInfo = '';
  if (isReplyToMessage(message)) {
    const quotedInfo = getQuotedMessageInfo(message);
    replyInfo = formatQuotedMessage(message, quotedInfo);
  }

  const timestamp = new Date(message.messageTimestamp * 1000).toLocaleTimeString();
  const headerText = `${category.toUpperCase()}: From ${sender} | ${timestamp}`;

  // Calculate border length considering reply info
  const contentWithReply = replyInfo ? `${replyInfo}\n${messageContent}` : messageContent;
  const borderLength = Math.max(headerText.length, contentWithReply.length);

  // Apply colors safely with type checking
  const formattedHeader = typeof styles.headerColor === 'function' ?
                          styles.headerColor(headerText) :
                          headerText;

  // Format the reply info with a different color if it exists
  const formattedReply = replyInfo ? chalk.cyan(replyInfo) : '';

  const formattedBody = typeof styles.bodyColor === 'function' ?
                        styles.bodyColor(messageContent) :
                        messageContent;

  // Construct the final message with or without reply context
  const bodyContent = replyInfo ?
    `${formattedReply}\n${formattedBody}` :
    formattedBody;

  return `
${createBorder(borderLength, styles)}
${formattedHeader}
${createBorder(borderLength, styles)}
${bodyContent}
${createBorder(borderLength, styles)}
  `;
}

/**
 * Formats a message for display based on its category
 * @param {Object} message - The processed message object
 * @param {Object} userPrefs - User preferences for UI customization
 * @returns {String} - Formatted message ready for display
 */
function formatMessage(message, userPrefs = {}) {
  if (message.metadata.isGroup) {
    return formatGroupMessage(message, userPrefs);
  } else {
    return formatInboxMessage(message, userPrefs);
  }
}

module.exports = {
  DEFAULT_STYLES,
  formatMessage,
  formatGroupMessage,
  formatInboxMessage
};
