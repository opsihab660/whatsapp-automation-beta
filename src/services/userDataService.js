/**
 * User Data Service
 *
 * Handles storage and retrieval of user conversation data
 */

const fs = require('fs');
const path = require('path');

// Import user preferences
const { getPreferences } = require('../config/userPreferences');

// Base directory for storing user data
const DATA_DIR = path.join(__dirname, '../../data');
const GROUP_DATA_DIR = path.join(DATA_DIR, 'groups');
const INBOX_DATA_DIR = path.join(DATA_DIR, 'inbox');

// Ensure data directories exist
function initializeDataDirectories() {
  const directories = [DATA_DIR, GROUP_DATA_DIR, INBOX_DATA_DIR];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Gets the file path for a user's data
 * @param {String} userId - The user's ID (phone number or group ID)
 * @param {Boolean} isGroup - Whether this is a group conversation
 * @returns {String} - The file path
 */
function getUserDataPath(userId, isGroup) {
  // Clean the userId to make it safe for filenames
  const cleanId = userId.replace(/[^a-zA-Z0-9]/g, '_');
  const baseDir = isGroup ? GROUP_DATA_DIR : INBOX_DATA_DIR;
  return path.join(baseDir, `${cleanId}.json`);
}

/**
 * Loads a user's conversation data
 * @param {String} userId - The user's ID (phone number or group ID)
 * @param {Boolean} isGroup - Whether this is a group conversation
 * @returns {Object} - The user's data
 */
function loadUserData(userId, isGroup) {
  const filePath = getUserDataPath(userId, isGroup);

  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error loading user data for ${userId}:`, error);
  }

  // Return default structure if file doesn't exist or there's an error
  return {
    userId,
    isGroup,
    profile: {
      name: null,
      lastSeen: null,
      updatedAt: new Date().toISOString(),
      description: null,
      createdAt: new Date().toISOString(),
      avatar: null,
      memberCount: isGroup ? 0 : null
    },
    conversation: [],
    participants: {}, // Track multiple users in a group
    preferences: {
      language: 'auto', // Auto-detect language or set specific language
      aiEnabled: true,  // Whether AI replies are enabled
      notifyOnMention: true // Whether to notify on mentions
    },
    stats: {
      messageCount: 0,
      lastActivity: new Date().toISOString(),
      topParticipants: [] // Track most active participants
    }
  };
}

/**
 * Saves a user's conversation data
 * @param {String} userId - The user's ID (phone number or group ID)
 * @param {Boolean} isGroup - Whether this is a group conversation
 * @param {Object} userData - The user data to save
 */
function saveUserData(userId, isGroup, userData) {
  const filePath = getUserDataPath(userId, isGroup);

  try {
    // Ensure the userData has the updated timestamp
    if (!userData.profile) {
      userData.profile = {};
    }
    userData.profile.updatedAt = new Date().toISOString();

    const data = JSON.stringify(userData, null, 2);
    fs.writeFileSync(filePath, data, 'utf8');
    console.log(`Saved user data for ${userId}`);
  } catch (error) {
    console.error(`Error saving user data for ${userId}:`, error);
  }
}

/**
 * Adds a message to a user's conversation history
 * @param {String} userId - The user's ID (phone number or group ID)
 * @param {Boolean} isGroup - Whether this is a group conversation
 * @param {Object} message - The message object
 * @param {Boolean} fromMe - Whether the message is from the bot
 */
function addMessageToConversation(userId, isGroup, message, fromMe) {
  // Load existing data
  const userData = loadUserData(userId, isGroup);

  // Extract the text content from the message
  let messageText = '';
  if (typeof message === 'string') {
    messageText = message;
  } else if (message.message) {
    // Extract from Baileys message format
    messageText = message.message.conversation ||
                 (message.message.extendedTextMessage && message.message.extendedTextMessage.text) ||
                 'Unknown message format';
  }

  // Create message object with sender information
  const messageObj = {
    id: message.key?.id || Date.now().toString(),
    timestamp: new Date().toISOString(),
    text: messageText,
    fromMe
  };

  // Add sender information for non-bot messages
  if (!fromMe && message.key) {
    // Get sender ID (participant for group messages, remoteJid for direct messages)
    const senderId = isGroup && message.key.participant ?
                    message.key.participant :
                    (message.key.remoteJid || userId);

    // Add sender info to the message
    messageObj.sender = {
      id: senderId,
      name: message.pushName || 'Unknown User'
    };

    // Initialize participants object if it doesn't exist
    if (!userData.participants) {
      userData.participants = {};
    }

    // Update or add participant info
    // Get existing participant data if available
    const existingParticipant = userData.participants[senderId] || {};

    userData.participants[senderId] = {
      ...existingParticipant,
      // Keep existing name if available, otherwise use new name
      name: message.pushName || existingParticipant.name || 'Unknown User',
      lastSeen: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    // Log participant update
    if (message.pushName) {
      console.log(`Updated participant name from message: ${senderId}, name: ${message.pushName}`);
    }
  } else if (fromMe && message.replyTo) {
    // If this is a bot message replying to a specific user
    messageObj.replyTo = message.replyTo;
  }

  // Add the message to conversation
  userData.conversation.push(messageObj);

  // Get user preferences
  const prefs = getPreferences();
  const maxConversationLength = prefs.userData?.maxConversationLength || 100;

  // Limit conversation history based on user preferences to prevent files from growing too large
  if (userData.conversation.length > maxConversationLength) {
    userData.conversation = userData.conversation.slice(-maxConversationLength);
  }

  // Ensure stats object exists
  if (!userData.stats) {
    userData.stats = {
      messageCount: 0,
      lastActivity: new Date().toISOString(),
      topParticipants: []
    };
  }

  // Update statistics
  userData.stats.messageCount = (userData.stats.messageCount || 0) + 1;
  userData.stats.lastActivity = new Date().toISOString();

  // Update profile info if available
  if (!fromMe) {
    // For direct messages, update profile name if available
    if (!isGroup && message.pushName) {
      userData.profile.name = message.pushName;
    }

    // If the message is from a group, try to get the group name and metadata
    if (isGroup && message.key && message.key.remoteJid) {
      // Extract group name if available in the message
      if (message.groupMetadata) {
        if (message.groupMetadata.subject) {
          // Only update group name if it's from group metadata
          userData.profile.name = message.groupMetadata.subject;
          console.log(`Updated group name to: ${userData.profile.name}`);
        }

        if (message.groupMetadata.desc) {
          userData.profile.description = message.groupMetadata.desc;
        }

        if (message.groupMetadata.participants) {
          userData.profile.memberCount = message.groupMetadata.participants.length;
        }
      }

      // IMPORTANT: Don't update group name with pushName as that's the sender's name, not the group name
    }

    // Update top participants for groups
    if (isGroup && messageObj.sender && messageObj.sender.id) {
      const senderId = messageObj.sender.id;

      // Update participant info in the participants object
      if (!userData.participants) {
        userData.participants = {};
      }

      // Get existing participant data or create new
      const existingParticipant = userData.participants[senderId] || {};

      // Update participant data
      userData.participants[senderId] = {
        ...existingParticipant,
        name: messageObj.sender.name || existingParticipant.name || 'Unknown User',
        lastSeen: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      // Ensure topParticipants array exists
      if (!userData.stats.topParticipants) {
        userData.stats.topParticipants = [];
      }

      // Find if sender is already in top participants
      const existingParticipantIndex = userData.stats.topParticipants.findIndex(p => p.id === senderId);

      if (existingParticipantIndex >= 0) {
        // Increment message count for existing participant
        userData.stats.topParticipants[existingParticipantIndex].messageCount += 1;
        userData.stats.topParticipants[existingParticipantIndex].lastActive = new Date().toISOString();
        // Ensure name is updated if available
        if (messageObj.sender.name) {
          userData.stats.topParticipants[existingParticipantIndex].name = messageObj.sender.name;
        }
      } else {
        // Add new participant to top participants
        userData.stats.topParticipants.push({
          id: senderId,
          name: messageObj.sender.name || 'Unknown User',
          messageCount: 1,
          lastActive: new Date().toISOString()
        });
      }

      // Sort top participants by message count and limit to top 10
      userData.stats.topParticipants.sort((a, b) => b.messageCount - a.messageCount);
      if (userData.stats.topParticipants.length > 10) {
        userData.stats.topParticipants = userData.stats.topParticipants.slice(0, 10);
      }
    }
  }

  // Save the updated data
  saveUserData(userId, isGroup, userData);

  return userData;
}

/**
 * Updates a user's profile information
 * @param {String} userId - The user's ID
 * @param {Boolean} isGroup - Whether this is a group
 * @param {Object} profileInfo - The profile information to update
 * @param {Object} [additionalData] - Additional data to update (preferences, etc.)
 */
function updateUserProfile(userId, isGroup, profileInfo, additionalData = {}) {
  const userData = loadUserData(userId, isGroup);

  // Update profile information
  userData.profile = {
    ...userData.profile,
    ...profileInfo,
    updatedAt: new Date().toISOString()
  };

  // Update preferences if provided
  if (additionalData.preferences) {
    userData.preferences = {
      ...userData.preferences,
      ...additionalData.preferences
    };
  }

  // Update participants if provided
  if (additionalData.participants) {
    // Initialize participants object if it doesn't exist
    if (!userData.participants) {
      userData.participants = {};
    }

    // Merge with existing participants
    for (const [id, info] of Object.entries(additionalData.participants)) {
      // Get existing participant data
      const existingParticipant = userData.participants[id] || {};

      // Preserve existing name if new name is null
      const name = info.name || existingParticipant.name || null;

      // Update participant data
      userData.participants[id] = {
        ...existingParticipant,
        ...info,
        // Keep existing name if new name is null
        name: name,
        lastUpdated: new Date().toISOString()
      };

      // Log participant update
      console.log(`Updated participant: ${id}, name: ${userData.participants[id].name}`);
    }
  }

  // Update stats if provided
  if (additionalData.stats) {
    userData.stats = {
      ...userData.stats,
      ...additionalData.stats
    };
  }

  saveUserData(userId, isGroup, userData);
  return userData;
}

/**
 * Detects the language of a message and updates user preferences
 * @param {String} userId - The user's ID
 * @param {Boolean} isGroup - Whether this is a group
 * @param {String} messageText - The message text to analyze
 * @returns {String} - The detected language code
 */
function detectAndUpdateLanguage(userId, isGroup, messageText) {
  if (!messageText || typeof messageText !== 'string' || messageText.trim().length === 0) {
    return 'auto';
  }

  // Simple language detection based on character sets
  // This is a basic implementation - for production, consider using a proper language detection library
  const bengaliPattern = /[\u0980-\u09FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  const hindiPattern = /[\u0900-\u097F]/;
  const englishPattern = /[a-zA-Z]/;

  let detectedLanguage = 'auto';

  if (bengaliPattern.test(messageText)) {
    detectedLanguage = 'bn'; // Bengali
  } else if (arabicPattern.test(messageText)) {
    detectedLanguage = 'ar'; // Arabic
  } else if (hindiPattern.test(messageText)) {
    detectedLanguage = 'hi'; // Hindi
  } else if (englishPattern.test(messageText)) {
    detectedLanguage = 'en'; // English
  }

  // Update user preferences with detected language
  if (detectedLanguage !== 'auto') {
    const userData = loadUserData(userId, isGroup);

    // Ensure preferences object exists
    if (!userData.preferences) {
      userData.preferences = {
        language: 'auto',
        aiEnabled: true,
        notifyOnMention: true
      };
    }

    // Only update if the preference is set to auto
    if (!userData.preferences.language || userData.preferences.language === 'auto') {
      updateUserProfile(userId, isGroup, {}, {
        preferences: {
          language: detectedLanguage
        }
      });
    }
  }

  return detectedLanguage;
}

/**
 * Gets all users who have interacted with the bot
 * @returns {Array} - Array of user data objects
 */
function getAllUsers() {
  const users = [];

  try {
    // Get all files from inbox directory
    if (fs.existsSync(INBOX_DATA_DIR)) {
      const inboxFiles = fs.readdirSync(INBOX_DATA_DIR);

      for (const file of inboxFiles) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(INBOX_DATA_DIR, file);
            const data = fs.readFileSync(filePath, 'utf8');
            const userData = JSON.parse(data);
            users.push({
              ...userData,
              type: 'inbox'
            });
          } catch (error) {
            console.error(`Error reading user data file ${file}:`, error);
          }
        }
      }
    }

    // Get all files from groups directory
    if (fs.existsSync(GROUP_DATA_DIR)) {
      const groupFiles = fs.readdirSync(GROUP_DATA_DIR);

      for (const file of groupFiles) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(GROUP_DATA_DIR, file);
            const data = fs.readFileSync(filePath, 'utf8');
            const userData = JSON.parse(data);
            users.push({
              ...userData,
              type: 'group'
            });
          } catch (error) {
            console.error(`Error reading group data file ${file}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error getting all users:', error);
  }

  return users;
}

/**
 * Finds a user's phone number by their name
 * @param {String} name - The name to search for
 * @returns {String|null} - The phone number or null if not found
 */
function findPhoneNumberByName(name) {
  if (!name || typeof name !== 'string') {
    console.error('Invalid name provided to findPhoneNumberByName:', name);
    return null;
  }

  console.log(`Looking for phone number for name: ${name}`);

  // Normalize the name for case-insensitive comparison
  const normalizedSearchName = name.toLowerCase().trim();

  try {
    // Get all users
    const allUsers = getAllUsers();

    // First, search direct message users (more likely to have accurate names)
    for (const user of allUsers) {
      if (user.type === 'inbox' && user.profile && user.profile.name) {
        const userName = user.profile.name.toLowerCase().trim();

        // Check for exact or partial match
        if (userName === normalizedSearchName ||
            userName.includes(normalizedSearchName) ||
            normalizedSearchName.includes(userName)) {

          // Extract the phone number from the userId
          const phoneNumber = user.userId.split('@')[0];
          console.log(`Found phone number ${phoneNumber} for name ${name}`);
          return phoneNumber;
        }
      }
    }

    // If not found in direct messages, search in group participants
    for (const user of allUsers) {
      if (user.type === 'group' && user.participants) {
        for (const [participantId, participantData] of Object.entries(user.participants)) {
          if (participantData.name) {
            const participantName = participantData.name.toLowerCase().trim();

            // Check for exact or partial match
            if (participantName === normalizedSearchName ||
                participantName.includes(normalizedSearchName) ||
                normalizedSearchName.includes(participantName)) {

              // Extract the phone number from the participant ID
              const phoneNumber = participantId.split('@')[0];
              console.log(`Found phone number ${phoneNumber} for name ${name} in group ${user.profile?.name || 'unknown'}`);
              return phoneNumber;
            }
          }
        }
      }
    }

    console.log(`No phone number found for name: ${name}`);
    return null;
  } catch (error) {
    console.error('Error finding phone number by name:', error);
    return null;
  }
}

// Initialize directories when the module is loaded
initializeDataDirectories();

module.exports = {
  loadUserData,
  saveUserData,
  addMessageToConversation,
  updateUserProfile,
  detectAndUpdateLanguage,
  getAllUsers,
  findPhoneNumberByName
};
