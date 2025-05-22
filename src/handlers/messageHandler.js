/**
 * Message Handler Module
 *
 * Handles processing, categorization, and management of different message types
 */

// Import required services
const { getChatCompletion, formatConversationForAI } = require('../services/mistralService');
const userDataService = require('../services/userDataService');
const mentionService = require('../services/mentionService');
const { getPreferences } = require('../config/userPreferences');

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
 * @param {Object} sock - The WhatsApp socket connection (not used in this synchronous version)
 * @returns {String} - The name of the group or null if not available
 */
function getGroupName(message, sock) {
  try {
    if (!isGroupMessage(message)) return null;

    // First priority: If message has group metadata, use it
    if (message.groupMetadata && message.groupMetadata.subject) {
      return message.groupMetadata.subject;
    }

    // Get the group JID
    const jid = message.key.remoteJid;

    // If it's not a group, return null
    if (!jid.endsWith('@g.us')) {
      return null;
    }

    // IMPORTANT: Don't use pushName for group name as it's the sender's name, not the group name
    // Instead, use the JID as a fallback
    return jid.split('@')[0];
  } catch (error) {
    console.error('Error getting group name:', error);
    return 'Unknown Group';
  }
}







/**
 * Gets the user's display name from the message
 * @param {Object} message - The message object from Baileys
 * @returns {String} - The user's display name or a generic greeting if not available
 */
function getUserName(message) {
  try {
    // First try to get the pushName directly from the message
    if (message.pushName) {
      return message.pushName;
    }

    // Try to get the name from the message key
    if (message.key && message.key.pushName) {
      return message.key.pushName;
    }

    // For group messages, try to get the participant's name
    if (isGroupMessage(message) && message.key && message.key.participant) {
      // Extract just the phone number part for a cleaner display
      const participantNumber = message.key.participant.split('@')[0];
      // Try to make it more user-friendly by formatting
      if (participantNumber.length > 4) {
        return participantNumber.substring(0, 4) + '...';
      }
      return participantNumber;
    }

    // If we have a remoteJid, use that as a last resort
    if (message.key && message.key.remoteJid) {
      const jidParts = message.key.remoteJid.split('@')[0];
      if (jidParts.length > 4) {
        return jidParts.substring(0, 4) + '...';
      }
      return jidParts;
    }

    // Fall back to just "there" as a generic greeting
    return "there";
  } catch (error) {
    console.error('Error getting user name:', error);
    return "there"; // Default fallback
  }
}

/**
 * Sends an automatic reply to any incoming message, using AI if enabled
 * @param {Object} sock - The WhatsApp socket connection
 * @param {Object} message - The message object from Baileys
 * @returns {Promise<Object|null>} - The sent message or null if failed
 */
async function sendAutoReply(sock, message) {
  if (!sock || !message || !message.key || !message.key.remoteJid) {
    console.error('Invalid parameters for auto reply');
    return null;
  }

  try {
    const jid = message.key.remoteJid;
    const isGroup = isGroupMessage(message);

    // Get a friendly name for the user
    let userName = "there"; // Default fallback

    try {
      // Try to get the user's name from the message
      userName = getUserName(message);
    } catch (nameError) {
      console.error('Error getting user name:', nameError);
      // Continue with the default name
    }

    // Extract message text
    const messageText = message.message?.conversation ||
                       (message.message?.extendedTextMessage && message.message.extendedTextMessage.text) ||
                       '';

    // Get user preferences
    const prefs = getPreferences();

    // Determine if we should use AI reply based on user preferences
    const useAI = prefs.ai?.enabled !== false;

    let replyText = '';

    if (useAI && messageText) {
      try {
        console.log('=== GENERATING AI REPLY ===');

        // Load user conversation history
        const userData = userDataService.loadUserData(jid, isGroup);

        // Add the incoming message to the conversation history
        userDataService.addMessageToConversation(jid, isGroup, message, false);

        // Update user profile with name if available
        if (message.pushName && !userData.profile.name) {
          userData.profile.name = message.pushName;
          userDataService.updateUserProfile(jid, isGroup, { name: message.pushName });
        }

        // Detect language and update user preferences
        const detectedLanguage = userDataService.detectAndUpdateLanguage(jid, isGroup, messageText);
        console.log(`Detected language for message: ${detectedLanguage}`);

        // Reload user data to get updated preferences
        const updatedUserData = userDataService.loadUserData(jid, isGroup);

        // Format the conversation for the AI, including user profile and preferences
        const aiMessages = formatConversationForAI(
          updatedUserData.conversation,
          messageText,
          updatedUserData
        );

        // Get AI response
        const aiResponse = await getChatCompletion(aiMessages);

        // Use the AI response as the reply text
        replyText = aiResponse;

        // Get sender ID for the reply
        const senderId = message.key.participant || message.key.remoteJid;

        // Store the AI response in the conversation history with replyTo information
        userDataService.addMessageToConversation(jid, isGroup, {
          key: { id: Date.now().toString() },
          message: { conversation: replyText },
          replyTo: senderId // Add the sender ID to track who we're replying to
        }, true);

        console.log(`AI reply generated: ${replyText.substring(0, 50)}${replyText.length > 50 ? '...' : ''}`);
      } catch (aiError) {
        console.error('Error generating AI reply:', aiError);
        // Fall back to default reply if AI fails
        replyText = `Wait for me, ${userName}`;
      }
    } else {
      // Use default reply if AI is disabled or no message text
      replyText = `Wait for me, ${userName}`;
    }

    // Print the exact reply message to the terminal
    console.log('=== SENDING REPLY ===');
    console.log(replyText);
    console.log('=====================');

    // Send the message
    const result = await sock.sendMessage(jid, { text: replyText }, { quoted: message });
    console.log(`Reply sent successfully to ${jid}`);
    return result;
  } catch (error) {
    console.error('Error sending reply:', error);
    return null;
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
  const jid = message.key.remoteJid;

  // Get group metadata if it's a group message
  let groupName = null;
  let groupMetadata = null;

  if (isGroup) {
    try {
      // First, load existing user data to avoid overwriting good data with incomplete data
      const existingData = userDataService.loadUserData(jid, isGroup);

      // Try to get group metadata from the socket
      try {
        groupMetadata = await sock.groupMetadata(jid);
        console.log(`Retrieved group metadata for ${jid}`);
      } catch (metadataError) {
        console.error('Error getting group metadata:', metadataError);
        // If we failed to get fresh metadata but have existing data, use that
        if (existingData && existingData.profile && existingData.profile.name) {
          console.log(`Using existing group name: ${existingData.profile.name}`);
          groupName = existingData.profile.name;
        }
      }

      // Get group name from metadata or fallback to message
      if (groupMetadata && groupMetadata.subject) {
        groupName = groupMetadata.subject;
        console.log(`Using group name from metadata: ${groupName}`);
      } else if (!groupName) { // Only use getGroupName if we don't already have a name
        // getGroupName doesn't actually use await, so we can call it directly
        groupName = getGroupName(message, sock);
        console.log(`Using fallback group name: ${groupName}`);
      }

      // Update group profile in user data
      if (groupName && groupName !== 'Unknown Group') {
        const groupProfileUpdate = {
          name: groupName
        };

        // Add additional metadata if available
        if (groupMetadata) {
          if (groupMetadata.desc) {
            groupProfileUpdate.description = groupMetadata.desc;
          }

          if (groupMetadata.participants) {
            groupProfileUpdate.memberCount = groupMetadata.participants.length;

            // Create participants data
            const participantsData = {};

            // First, preserve existing participant data that we already have
            if (existingData && existingData.participants) {
              Object.assign(participantsData, existingData.participants);
            }

            // Then update with new participant data
            for (const participant of groupMetadata.participants) {
              if (participant.id) {
                // Preserve existing name if available
                const existingName = participantsData[participant.id]?.name || null;
                const participantName = participant.name || existingName || null;

                // Try to get name from pushName if this is the current sender
                if (!participantName && message.key && message.key.participant === participant.id && message.pushName) {
                  console.log(`Found name for participant ${participant.id} from pushName: ${message.pushName}`);
                }

                participantsData[participant.id] = {
                  // Keep existing name if available, otherwise use new name or null
                  name: message.key && message.key.participant === participant.id && message.pushName ?
                        message.pushName :
                        (existingName || participant.name || null),
                  isAdmin: participant.isAdmin || false,
                  isSuperAdmin: participant.isSuperAdmin || false,
                  lastSeen: new Date().toISOString(),
                  lastUpdated: new Date().toISOString()
                };

                // Log participant data
                console.log(`Updated participant data: ${participant.id}, name: ${participantsData[participant.id].name}`);
              }
            }

            // Update user data with group metadata and participants
            userDataService.updateUserProfile(jid, isGroup, groupProfileUpdate, {
              participants: participantsData
            });
          } else {
            // Update just the profile if participants not available
            userDataService.updateUserProfile(jid, isGroup, groupProfileUpdate);
          }
        } else {
          // Update just the name if no metadata available
          userDataService.updateUserProfile(jid, isGroup, { name: groupName });
        }
      }
    } catch (error) {
      console.error('Error processing group information:', error);
      groupName = 'Unknown Group';
    }
  }

  // Extract message text
  const messageText = message.message?.conversation ||
                     message.message?.extendedTextMessage?.text ||
                     '';

  // Extract mentioned numbers and names if this is a group message
  let mentionedNumbers = [];
  let mentionedNames = [];
  if (isGroup && messageText) {
    mentionedNumbers = mentionService.extractMentionedNumbers(messageText);
    mentionedNames = mentionService.extractMentionedNames(messageText);
  }

  // Update user profile with name if available, but ONLY for direct messages, not groups
  if (message.pushName && !isGroup) {
    // Only update name for direct messages, not for groups
    userDataService.updateUserProfile(jid, isGroup, { name: message.pushName });
  }

  // Get sender's name if available
  let senderName = message.pushName || null;

  // Enrich the message with additional metadata
  const enrichedMessage = {
    ...message,
    metadata: {
      category,
      isGroup,
      timestamp: new Date(message.messageTimestamp * 1000),
      groupName,
      messageText,
      mentionedNumbers,
      mentionedNames,
      senderName, // Add sender's name to metadata
      // Add any other metadata that might be useful
    }
  };

  // Check if message is already processed to avoid duplicate replies
  const messageId = message.key?.id;
  const isProcessed = global.processedMessages && global.processedMessages.has(messageId);

  // Initialize global set to track processed messages if not exists
  if (!global.processedMessages) {
    global.processedMessages = new Set();
  }

  // Only process the message if it hasn't been processed before
  if (!isProcessed && messageId) {
    // Add to processed messages
    global.processedMessages.add(messageId);

    // Limit the size of the set to prevent memory leaks
    if (global.processedMessages.size > 1000) {
      // Convert to array, remove oldest entries, convert back to set
      const messagesArray = Array.from(global.processedMessages);
      global.processedMessages = new Set(messagesArray.slice(-500));
    }

    // Check if there are mentioned numbers or names
    if (mentionedNumbers.length > 0 || mentionedNames.length > 0) {
      console.log(`Processing message with ${mentionedNumbers.length} mentioned numbers and ${mentionedNames.length} mentioned names`);
      // If there are mentions, handle them and don't send the "Wait for me" message
      await mentionService.handleMentions(sock, enrichedMessage);
    } else {
      // If no mentions, send the AI reply
      await sendAutoReply(sock, message);
    }
  } else {
    console.log(`Message ${messageId} already processed, skipping reply`);
  }

  return enrichedMessage;
}



module.exports = {
  MESSAGE_CATEGORIES,
  isGroupMessage,
  isDirectMessage,
  categorizeMessage,
  getGroupName,
  processMessage,
  sendAutoReply,
  getUserName
};
