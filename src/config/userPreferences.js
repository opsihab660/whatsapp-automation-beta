/**
 * User Preferences Module
 *
 * Manages user preferences and settings
 */

// Default user preferences
const defaultPreferences = {
  autoReply: {
    enabled: true,
    group: {
      enabled: true
    },
    direct: {
      enabled: false
    }
  },
  notifications: {
    enabled: true,
    group: {
      enabled: true
    },
    direct: {
      enabled: true
    }
  },
  ai: {
    enabled: true,
    model: "mistral-large-latest",
    apiKey: "stP8jFsp9UjHetAUW3KBCM6ssvr7IU9g",
    defaultLanguage: "auto", // auto, en, bn, ar, hi
    useNameInReplies: "occasional", // always, occasional, never
    maxHistoryMessages: 10
  },
  userData: {
    storageEnabled: true,
    maxConversationLength: 100,
    trackParticipants: true
  },
  styles: {
    // Styles are defined in messageUI.js
  },
  customCategories: null
};

// Current user preferences
let userPreferences = { ...defaultPreferences };

/**
 * Loads user preferences
 * @param {Object} preferences - User preferences to load
 * @returns {Object} - The loaded preferences
 */
function loadPreferences(preferences = {}) {
  // Merge default preferences with provided preferences
  userPreferences = {
    ...defaultPreferences,
    ...preferences
  };

  return userPreferences;
}

/**
 * Gets the current user preferences
 * @returns {Object} - The current user preferences
 */
function getPreferences() {
  return userPreferences;
}

/**
 * Updates user preferences
 * @param {Object} preferences - User preferences to update
 * @returns {Object} - The updated preferences
 */
function updatePreferences(preferences = {}) {
  // Merge current preferences with provided preferences
  userPreferences = {
    ...userPreferences,
    ...preferences
  };

  return userPreferences;
}

/**
 * Adds a custom category rule
 * @param {Function} rule - The rule function that takes a message and returns a category
 * @returns {Object} - The updated preferences
 */
function addCustomCategoryRule(rule) {
  if (typeof rule !== 'function') {
    throw new Error('Custom category rule must be a function');
  }

  userPreferences.customCategories = rule;

  return userPreferences;
}

/**
 * Resets user preferences to defaults
 * @returns {Object} - The default preferences
 */
function resetPreferences() {
  userPreferences = { ...defaultPreferences };

  return userPreferences;
}

module.exports = {
  loadPreferences,
  getPreferences,
  updatePreferences,
  addCustomCategoryRule,
  resetPreferences
};
