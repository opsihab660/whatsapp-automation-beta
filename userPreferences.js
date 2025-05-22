/**
 * User Preferences Module
 * 
 * Manages user preferences for message display, categorization, and notifications
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_STYLES } = require('./messageUI');
const { DEFAULT_NOTIFICATION_SETTINGS } = require('./notificationHandler');
const { MESSAGE_CATEGORIES } = require('./messageHandler');

// Default user preferences
const DEFAULT_PREFERENCES = {
  // UI preferences
  styles: DEFAULT_STYLES,
  
  // Notification preferences
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
  
  // Chat preferences
  mutedChats: [],
  
  // Custom category rules
  customCategories: null,
  
  // General preferences
  showTimestamps: true,
  showSenderName: true,
  compactMode: false
};

// Path to save user preferences
const PREFS_FILE_PATH = path.join(process.cwd(), 'user_preferences.json');

/**
 * Loads user preferences from file
 * @returns {Object} - User preferences object
 */
function loadPreferences() {
  try {
    if (fs.existsSync(PREFS_FILE_PATH)) {
      const data = fs.readFileSync(PREFS_FILE_PATH, 'utf8');
      const prefs = JSON.parse(data);
      
      // Merge with default preferences to ensure all required fields exist
      return { ...DEFAULT_PREFERENCES, ...prefs };
    }
  } catch (error) {
    console.error('Error loading user preferences:', error);
  }
  
  // Return default preferences if loading fails
  return { ...DEFAULT_PREFERENCES };
}

/**
 * Saves user preferences to file
 * @param {Object} prefs - User preferences object
 * @returns {Boolean} - True if save was successful
 */
function savePreferences(prefs) {
  try {
    // Filter out any function properties before saving
    const prefsToSave = { ...prefs };
    
    // Remove any functions as they can't be serialized
    Object.keys(prefsToSave).forEach(key => {
      if (typeof prefsToSave[key] === 'function') {
        delete prefsToSave[key];
      }
    });
    
    fs.writeFileSync(PREFS_FILE_PATH, JSON.stringify(prefsToSave, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving user preferences:', error);
    return false;
  }
}

/**
 * Updates user preferences
 * @param {Object} newPrefs - New preferences to merge with existing ones
 * @returns {Object} - Updated preferences
 */
function updatePreferences(newPrefs) {
  const currentPrefs = loadPreferences();
  
  // Deep merge the preferences
  const updatedPrefs = deepMerge(currentPrefs, newPrefs);
  
  // Save the updated preferences
  savePreferences(updatedPrefs);
  
  return updatedPrefs;
}

/**
 * Deep merges two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object to merge into target
 * @returns {Object} - Merged object
 */
function deepMerge(target, source) {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

/**
 * Checks if a value is an object
 * @param {*} item - Value to check
 * @returns {Boolean} - True if the value is an object
 */
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Adds a custom category rule
 * @param {Function} ruleFn - Function that takes a message and returns a category or null
 * @returns {Object} - Updated preferences
 */
function addCustomCategoryRule(ruleFn) {
  const prefs = loadPreferences();
  
  // Store the function in memory (can't be saved to JSON)
  prefs.customCategories = ruleFn;
  
  // Save other preferences (function will be filtered out)
  savePreferences(prefs);
  
  return prefs;
}

module.exports = {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  updatePreferences,
  addCustomCategoryRule
};
