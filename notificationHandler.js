/**
 * Notification Handler Module
 * 
 * Manages notifications for different message types
 */

const { MESSAGE_CATEGORIES } = require('./messageHandler');

// Default notification settings for different message categories
const DEFAULT_NOTIFICATION_SETTINGS = {
  [MESSAGE_CATEGORIES.GROUP]: {
    enabled: true,
    sound: 'group_notification.mp3',
    priority: 'medium',
    showPreview: true
  },
  [MESSAGE_CATEGORIES.INBOX]: {
    enabled: true,
    sound: 'inbox_notification.mp3',
    priority: 'high',
    showPreview: true
  },
  [MESSAGE_CATEGORIES.IMPORTANT]: {
    enabled: true,
    sound: 'important_notification.mp3',
    priority: 'high',
    showPreview: true
  },
  [MESSAGE_CATEGORIES.WORK]: {
    enabled: true,
    sound: 'work_notification.mp3',
    priority: 'medium',
    showPreview: true
  },
  [MESSAGE_CATEGORIES.PERSONAL]: {
    enabled: true,
    sound: 'personal_notification.mp3',
    priority: 'medium',
    showPreview: true
  },
  [MESSAGE_CATEGORIES.OTHER]: {
    enabled: true,
    sound: 'default_notification.mp3',
    priority: 'low',
    showPreview: true
  }
};

/**
 * Determines if a notification should be shown for a message
 * @param {Object} message - The processed message object
 * @param {Object} userPrefs - User preferences for notifications
 * @returns {Boolean} - True if notification should be shown
 */
function shouldNotify(message, userPrefs = {}) {
  const category = message.metadata.category;
  const notificationSettings = userPrefs.notifications || DEFAULT_NOTIFICATION_SETTINGS;
  
  // Check if notifications are enabled for this category
  if (notificationSettings[category] && notificationSettings[category].enabled === false) {
    return false;
  }
  
  // Check if the user has muted this specific chat
  if (userPrefs.mutedChats && userPrefs.mutedChats.includes(message.key.remoteJid)) {
    return false;
  }
  
  return true;
}

/**
 * Creates a notification for a message
 * @param {Object} message - The processed message object
 * @param {Object} userPrefs - User preferences for notifications
 * @returns {Object} - Notification object with relevant properties
 */
function createNotification(message, userPrefs = {}) {
  const category = message.metadata.category;
  const notificationSettings = userPrefs.notifications || DEFAULT_NOTIFICATION_SETTINGS;
  const settings = notificationSettings[category] || DEFAULT_NOTIFICATION_SETTINGS[MESSAGE_CATEGORIES.OTHER];
  
  // Extract message content for preview
  const messageContent = message.message?.conversation || 
                         message.message?.extendedTextMessage?.text || 
                         '[Media or unsupported message]';
  
  // Create sender name based on message type
  let sender;
  if (message.metadata.isGroup) {
    sender = `${message.metadata.groupName} (${message.key.participant ? message.key.participant.split('@')[0] : 'Unknown'})`;
  } else {
    sender = message.key.remoteJid.split('@')[0];
  }
  
  // Create notification object
  const notification = {
    title: `New ${category} message from ${sender}`,
    body: settings.showPreview ? messageContent : 'New message received',
    sound: settings.sound,
    priority: settings.priority,
    timestamp: new Date(message.messageTimestamp * 1000),
    category: category,
    chatId: message.key.remoteJid
  };
  
  return notification;
}

/**
 * Handles notification for a message
 * @param {Object} message - The processed message object
 * @param {Object} userPrefs - User preferences for notifications
 * @returns {Object|null} - Notification object or null if notification shouldn't be shown
 */
function handleNotification(message, userPrefs = {}) {
  if (!shouldNotify(message, userPrefs)) {
    return null;
  }
  
  const notification = createNotification(message, userPrefs);
  
  // In a real application, this would trigger the actual notification
  // For now, we'll just log it to the console
  console.log(`🔔 NOTIFICATION: ${notification.title}`);
  if (notification.body) {
    console.log(`📝 ${notification.body}`);
  }
  
  return notification;
}

module.exports = {
  DEFAULT_NOTIFICATION_SETTINGS,
  shouldNotify,
  createNotification,
  handleNotification
};
