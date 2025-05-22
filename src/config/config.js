/**
 * Configuration Service
 * 
 * Centralizes all configuration settings from environment variables
 * with sensible defaults
 */

// Load environment variables
require('dotenv').config();

// Server configuration
const server = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  apiKey: process.env.API_KEY || 'default_api_key_change_me'
};

// Bot configuration
const bot = {
  name: process.env.BOT_NAME || 'WhatsAppBot',
  autoReply: {
    enabled: process.env.ENABLE_AUTO_REPLY !== 'false',
    group: {
      enabled: process.env.ENABLE_GROUP_AUTO_REPLY !== 'false'
    },
    direct: {
      enabled: process.env.ENABLE_DIRECT_AUTO_REPLY === 'true'
    }
  },
  notifications: {
    enabled: process.env.ENABLE_NOTIFICATIONS !== 'false'
  }
};

// AI configuration
const ai = {
  provider: 'mistral',
  apiKey: process.env.MISTRAL_API_KEY || 'stP8jFsp9UjHetAUW3KBCM6ssvr7IU9g', // Default key for development
  model: process.env.MISTRAL_MODEL || 'mistral-large-latest',
  maxHistoryMessages: parseInt(process.env.MISTRAL_MAX_HISTORY || '10', 10),
  useNameInReplies: process.env.USE_NAME_IN_REPLIES || 'occasional' // 'always', 'never', or 'occasional'
};

// Logging configuration
const logging = {
  level: process.env.LOG_LEVEL || 'info',
  prettyPrint: process.env.NODE_ENV !== 'production'
};

// Storage paths
const storage = {
  auth: process.env.AUTH_PATH || 'auth',
  data: process.env.DATA_PATH || 'data',
  public: process.env.PUBLIC_PATH || 'public'
};

// Export the configuration
module.exports = {
  server,
  bot,
  ai,
  logging,
  storage
};
