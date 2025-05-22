/**
 * Notification Handler Module
 *
 * Handles notification creation and display
 */

const notifier = require('node-notifier');
const path = require('path');

/**
 * Handles creating and displaying a notification
 * @param {Object} message - The processed message object
 * @param {Object} options - Notification options
 * @returns {Promise<void>} - Promise that resolves when notification is shown
 */
async function handleNotification(message, options = {}) {
  // Default options
  const defaultOptions = {
    enabled: true,
    group: {
      enabled: true
    },
    direct: {
      enabled: true
    }
  };
  
  // Merge default options with provided options
  const notificationOptions = {
    ...defaultOptions,
    ...options
  };
  
  // Check if notifications are enabled
  if (!notificationOptions.enabled) {
    return;
  }
  
  // Check if this is a group message and if group notifications are enabled
  if (message.metadata.isGroup && !notificationOptions.group.enabled) {
    return;
  }
  
  // Check if this is a direct message and if direct notifications are enabled
  if (!message.metadata.isGroup && !notificationOptions.direct.enabled) {
    return;
  }
  
  // Extract message content
  const messageContent = message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || 
                        '[Media Message]';
  
  // Create notification title
  let title = 'New WhatsApp Message';
  if (message.metadata.isGroup) {
    title = `New message from ${message.metadata.groupName || 'a group'}`;
  } else {
    const sender = message.key.remoteJid.split('@')[0];
    title = `New message from ${sender}`;
  }
  
  // Create notification
  return new Promise((resolve, reject) => {
    notifier.notify({
      title: title,
      message: messageContent.substring(0, 100) + (messageContent.length > 100 ? '...' : ''),
      icon: path.join(__dirname, '../../public/whatsapp-icon.png'),
      sound: true,
      wait: true
    }, (err, response) => {
      if (err) {
        console.error('Error showing notification:', err);
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}

module.exports = {
  handleNotification
};
