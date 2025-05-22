/**
 * Mistral AI Service
 *
 * Handles integration with Mistral AI API for generating AI responses
 */

// Use axios for making HTTP requests to the Mistral API
const axios = require('axios');

// Import user preferences
const { getPreferences } = require('../config/userPreferences');

// Mistral API configuration
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

// Get API key and model from user preferences
function getMistralConfig() {
  const prefs = getPreferences();
  return {
    apiKey: prefs.ai?.apiKey || 'stP8jFsp9UjHetAUW3KBCM6ssvr7IU9g',
    model: prefs.ai?.model || 'mistral-large-latest',
    maxHistoryMessages: prefs.ai?.maxHistoryMessages || 10,
    useNameInReplies: prefs.ai?.useNameInReplies || 'occasional'
  };
}

/**
 * Sends a message to Mistral AI API and gets a response
 * @param {Array} messages - Array of message objects with role and content
 * @returns {Promise<String>} - The AI response text
 */
async function getChatCompletion(messages) {
  try {
    console.log('Sending request to Mistral AI...');

    // Get configuration from user preferences
    const config = getMistralConfig();

    const response = await axios.post(
      MISTRAL_API_URL,
      {
        model: config.model,
        messages: messages
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        }
      }
    );

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      const aiResponse = response.data.choices[0].message.content;
      console.log('Received AI response:', aiResponse.substring(0, 100) + (aiResponse.length > 100 ? '...' : ''));
      return aiResponse;
    } else {
      console.error('Invalid response format from Mistral AI:', response.data);
      return 'I apologize, but I encountered an issue processing your request.';
    }
  } catch (error) {
    console.error('Error getting AI response:', error.message);
    if (error.response) {
      console.error('API error details:', error.response.data);
    }
    return 'I apologize, but I encountered an error while processing your request.';
  }
}

/**
 * Formats a conversation history for the AI
 * @param {Array} conversationHistory - Array of previous messages
 * @param {String} newMessage - The new message from the user
 * @param {Object} userProfile - User profile information
 * @returns {Array} - Formatted messages array for the AI
 */
function formatConversationForAI(conversationHistory, newMessage, userProfile = {}) {
  // Determine the preferred language based on user preferences or auto-detection
  const preferredLanguage = userProfile.preferences?.language || 'auto';

  // Create language-specific instructions
  let languageInstructions = '';
  if (preferredLanguage === 'bn') {
    languageInstructions = 'Respond primarily in Bengali (Bangla) unless the user asks in another language.';
  } else if (preferredLanguage === 'en') {
    languageInstructions = 'Respond primarily in English unless the user asks in another language.';
  } else if (preferredLanguage === 'ar') {
    languageInstructions = 'Respond primarily in Arabic unless the user asks in another language.';
  } else if (preferredLanguage === 'hi') {
    languageInstructions = 'Respond primarily in Hindi unless the user asks in another language.';
  } else {
    languageInstructions = 'Detect the language of the user\'s message and respond in the same language. You can understand and respond in multiple languages including English, Bengali (Bangla), Arabic, and Hindi.';
  }

  // Create a detailed system message with user profile information
  let systemContent = `You are a helpful WhatsApp assistant. Be concise, friendly, and helpful. Respond in a conversational manner. ${languageInstructions}

When users ask about their name:
- If you know their name (provided in their profile), tell them their name
- If someone asks "what is my name" or similar questions, respond with their name if you know it
- Be conversational and natural when responding to such questions

Be smart about context:
- Pay attention to the conversation history to maintain context
- If multiple people are chatting in a group, keep track of who is saying what
- Adapt your tone to match the user's style of communication

User activity information:
- The user has sent ${userProfile.stats?.messageCount || 0} messages in total
- Their last activity was at ${userProfile.stats?.lastActivity || 'unknown time'}`;

  // Add user profile information to the system message if available
  if (userProfile) {
    systemContent += '\n\nUser Information:';

    // For direct messages, use userProfile.profile.name
    // For groups, use userProfile.profile.name as the group name
    if (userProfile.profile && userProfile.profile.name) {
      if (userProfile.isGroup) {
        systemContent += `\n- Group Name: ${userProfile.profile.name}`;
      } else {
        systemContent += `\n- Name: ${userProfile.profile.name}`;
      }
    }

    if (userProfile.isGroup) {
      systemContent += '\n- This is a group chat.';

      // Add group description if available
      if (userProfile.profile && userProfile.profile.description) {
        systemContent += `\n- Group Description: ${userProfile.profile.description}`;
      }

      // Add information about group participants if available
      if (userProfile.participants && Object.keys(userProfile.participants).length > 0) {
        const participantEntries = Object.entries(userProfile.participants);
        const totalParticipants = participantEntries.length;

        // Add total member count
        systemContent += `\n- Total group members: ${totalParticipants}`;

        // Add member count to profile if not already there
        if (userProfile.profile) {
          userProfile.profile.memberCount = totalParticipants;
        }

        systemContent += '\n- Group participants:';

        // Get all participants with names
        const namedParticipants = participantEntries
          .filter(([_, p]) => p.name)
          .map(([_, p]) => p.name);

        // Get count of participants without names
        const unknownParticipants = totalParticipants - namedParticipants.length;

        // Add all named participants
        for (const name of namedParticipants) {
          systemContent += `\n  * ${name}`;
        }

        // Add count of unknown participants if any
        if (unknownParticipants > 0) {
          systemContent += `\n  * And ${unknownParticipants} participants with unknown names`;
        }
      }
    } else {
      systemContent += '\n- This is a direct message.';
    }

    // Add any other profile information that might be useful
    if (userProfile.lastSeen) {
      systemContent += `\n- Last seen: ${userProfile.lastSeen}`;
    }

    // Important instruction to use the user's name based on user preferences
    if (userProfile.profile && userProfile.profile.name && !userProfile.isGroup) {
      // For direct messages, use the user's name
      // Get configuration from user preferences
      const config = getMistralConfig();
      const userName = userProfile.profile.name;

      if (config.useNameInReplies === 'always') {
        systemContent += `\n\nIMPORTANT: Always address the user by their name "${userName}" in your responses to create a personalized experience.`;
      } else if (config.useNameInReplies === 'never') {
        systemContent += `\n\nIMPORTANT: You know the user's name is "${userName}", but don't use it in your responses unless they specifically ask about their name.`;
      } else {
        // Default to 'occasional'
        systemContent += `\n\nIMPORTANT: You know the user's name is "${userName}", but don't overuse it. Only use their name occasionally when it feels natural, such as:
- At the beginning of the conversation
- When they ask about their name
- When emphasizing a point or giving important information
- When the conversation has been going on for a while and you want to re-personalize
- No more than once every 3-4 messages

Don't use their name in every message as it can feel unnatural and robotic.`;
      }
    }

    // For group chats, add instruction about addressing specific users and group name
    if (userProfile.isGroup) {
      // Add instruction about the group name and members
      if (userProfile.profile && userProfile.profile.name) {
        const groupName = userProfile.profile.name;
        const memberCount = userProfile.profile.memberCount || Object.keys(userProfile.participants || {}).length || 0;

        systemContent += `\n\nIMPORTANT: This is a group chat named "${groupName}". When users ask about the group name, tell them it's "${groupName}".`;

        // Add instructions for member count questions
        systemContent += `\n\nWhen users ask about how many members are in the group, tell them there are ${memberCount} members in the group.`;

        // Add instructions for member list questions
        if (userProfile.participants && Object.keys(userProfile.participants).length > 0) {
          const participantEntries = Object.entries(userProfile.participants);
          const namedParticipants = participantEntries
            .filter(([_, p]) => p.name)
            .map(([_, p]) => p.name);

          const unknownCount = memberCount - namedParticipants.length;

          systemContent += `\n\nWhen users ask about who is in the group or for a list of members, tell them the group members are: ${namedParticipants.join(', ')}`;

          if (unknownCount > 0) {
            systemContent += ` and ${unknownCount} other members whose names are not known.`;
          }
        }
      }

      // Add instruction about addressing specific users
      if (userProfile.participants) {
        systemContent += `\n\nIn this group chat, when replying to a specific user, address them by their name only when necessary for clarity, not in every message.`;
      }
    }
  }

  // Start with the system message
  const messages = [
    {
      role: 'system',
      content: systemContent
    }
  ];

  // Get configuration from user preferences
  const config = getMistralConfig();

  // Add conversation history (limited by user preferences to avoid token limits)
  const recentHistory = conversationHistory.slice(-config.maxHistoryMessages);

  // Track the current sender to detect changes
  let currentSenderId = null;
  let senderChanged = false;

  for (const msg of recentHistory) {
    // Create the message content, potentially including sender information
    let content = msg.text;

    // Determine if the sender has changed
    if (userProfile.isGroup && !msg.fromMe && msg.sender) {
      if (currentSenderId !== msg.sender.id) {
        currentSenderId = msg.sender.id;
        senderChanged = true;
      } else {
        senderChanged = false;
      }

      // Add sender name to message if it's a group chat and either:
      // 1. The sender has changed from the previous message, or
      // 2. It's the first message in the conversation
      if (senderChanged && msg.sender.name) {
        content = `[${msg.sender.name}]: ${content}`;
      }
    }

    messages.push({
      role: msg.fromMe ? 'assistant' : 'user',
      content: content
    });
  }

  // Add the new message
  messages.push({
    role: 'user',
    content: newMessage
  });

  return messages;
}

module.exports = {
  getChatCompletion,
  formatConversationForAI
};
