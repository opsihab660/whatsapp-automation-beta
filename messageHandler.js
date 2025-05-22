/**
 * Message Handler Module
 *
 * Handles processing, categorization, and management of different message types
 */

// Message categories
const MESSAGE_CATEGORIES = {
  GROUP: 'group',
  INBOX: 'inbox',
  IMPORTANT: 'important',
  WORK: 'work',
  PERSONAL: 'personal',
  OTHER: 'other'
};

/**
 * Determines if a message is from a group
 * @param {Object} message - The message object from Baileys
 * @returns {Boolean} - True if the message is from a group
 */
function isGroupMessage(message) {
  if (!message || !message.key || !message.key.remoteJid) {
    return false;
  }

  // In WhatsApp, group JIDs end with @g.us
  // Direct messages end with @s.whatsapp.net
  return message.key.remoteJid.endsWith('@g.us');
}

/**
 * Determines if a message is a direct/private message from an individual
 * @param {Object} message - The message object from Baileys
 * @returns {Boolean} - True if the message is a direct message
 */
function isDirectMessage(message) {
  if (!message || !message.key || !message.key.remoteJid) {
    return false;
  }

  // In WhatsApp, direct messages end with @s.whatsapp.net
  return message.key.remoteJid.endsWith('@s.whatsapp.net');
}

/**
 * Categorizes a message based on its content and metadata
 * @param {Object} message - The message object from Baileys
 * @param {Object} userPrefs - User preferences for message categorization
 * @returns {String} - The category of the message
 */
function categorizeMessage(message, userPrefs = {}) {
  // Default categorization logic
  if (isGroupMessage(message)) {
    return MESSAGE_CATEGORIES.GROUP;
  }

  // Check for custom categorization rules from user preferences
  if (userPrefs.customCategories && typeof userPrefs.customCategories === 'function') {
    const customCategory = userPrefs.customCategories(message);
    if (customCategory) {
      return customCategory;
    }
  }

  // Default to inbox for direct messages
  return MESSAGE_CATEGORIES.INBOX;
}

/**
 * Extracts the group name from a message
 * @param {Object} message - The message object from Baileys
 * @param {Object} sock - The WhatsApp socket connection
 * @returns {String} - The name of the group or null if not available
 */
async function getGroupName(message, sock) {
  try {
    if (!isGroupMessage(message)) return null;

    const groupMetadata = await sock.groupMetadata(message.key.remoteJid);
    return groupMetadata.subject;
  } catch (error) {
    console.error('Error getting group name:', error);
    return 'Unknown Group';
  }
}

/**
 * Processes a message and enriches it with additional metadata
 * @param {Object} message - The message object from Baileys
 * @param {Object} sock - The WhatsApp socket connection
 * @param {Object} userPrefs - User preferences
 * @returns {Object} - The processed message with additional metadata
 */
async function processMessage(message, sock, userPrefs = {}) {
  const category = categorizeMessage(message, userPrefs);
  const isGroup = isGroupMessage(message);

  // Get group name if it's a group message
  let groupName = null;
  if (isGroup) {
    groupName = await getGroupName(message, sock);
  }

  // Enrich the message with additional metadata
  const enrichedMessage = {
    ...message,
    metadata: {
      category,
      isGroup,
      timestamp: new Date(message.messageTimestamp * 1000),
      groupName,
      // Add any other metadata that might be useful
    }
  };

  return enrichedMessage;
}

module.exports = {
  MESSAGE_CATEGORIES,
  isGroupMessage,
  isDirectMessage,
  categorizeMessage,
  getGroupName,
  processMessage
};
