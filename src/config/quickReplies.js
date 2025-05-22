/**
 * Quick Replies Configuration
 * 
 * Predefined messages for fast responses
 */

// Quick reply templates
const quickReplyTemplates = {
  // General responses
  greetings: {
    hello: "Hello! Thanks for your message. How can I help you today?",
    goodMorning: "Good morning! Hope you're having a great day.",
    goodAfternoon: "Good afternoon! How can I assist you?",
    goodEvening: "Good evening! How can I help you tonight?",
    thanks: "Thank you for your message. I appreciate it!",
    busy: "I'm currently busy, but I'll get back to you as soon as possible.",
    away: "I'm away right now. I'll respond when I return."
  },
  
  // Business responses
  business: {
    meeting: "I'm in a meeting right now. I'll contact you afterward.",
    callMe: "Please give me a call when you're free.",
    email: "Could you please send me an email with the details?",
    documents: "I've received your documents. I'll review them soon.",
    schedule: "Let's schedule a meeting to discuss this further."
  },
  
  // Group responses
  group: {
    acknowledge: "I've seen your message in the group. I'll respond shortly.",
    noted: "Noted. I'll take care of this.",
    thanks: "Thanks for mentioning me in the group. I'll look into it."
  }
};

// Quick reply shortcuts
const quickReplyShortcuts = {
  // General shortcuts
  "!hi": quickReplyTemplates.greetings.hello,
  "!gm": quickReplyTemplates.greetings.goodMorning,
  "!ga": quickReplyTemplates.greetings.goodAfternoon,
  "!ge": quickReplyTemplates.greetings.goodEvening,
  "!thx": quickReplyTemplates.greetings.thanks,
  "!busy": quickReplyTemplates.greetings.busy,
  "!away": quickReplyTemplates.greetings.away,
  
  // Business shortcuts
  "!meet": quickReplyTemplates.business.meeting,
  "!call": quickReplyTemplates.business.callMe,
  "!email": quickReplyTemplates.business.email,
  "!docs": quickReplyTemplates.business.documents,
  "!schedule": quickReplyTemplates.business.schedule,
  
  // Group shortcuts
  "!ack": quickReplyTemplates.group.acknowledge,
  "!noted": quickReplyTemplates.group.noted,
  "!gthanks": quickReplyTemplates.group.thanks
};

/**
 * Gets a quick reply message by shortcut
 * @param {String} shortcut - The shortcut command
 * @returns {String|null} - The quick reply message or null if not found
 */
function getQuickReply(shortcut) {
  return quickReplyShortcuts[shortcut] || null;
}

/**
 * Gets all available quick reply shortcuts
 * @returns {Object} - Object with all shortcuts and their messages
 */
function getAllQuickReplies() {
  return quickReplyShortcuts;
}

/**
 * Adds a custom quick reply
 * @param {String} shortcut - The shortcut command
 * @param {String} message - The quick reply message
 * @returns {Object} - Updated shortcuts object
 */
function addQuickReply(shortcut, message) {
  if (!shortcut.startsWith('!')) {
    shortcut = '!' + shortcut;
  }
  
  quickReplyShortcuts[shortcut] = message;
  return quickReplyShortcuts;
}

module.exports = {
  quickReplyTemplates,
  quickReplyShortcuts,
  getQuickReply,
  getAllQuickReplies,
  addQuickReply
};
