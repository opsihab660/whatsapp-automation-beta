/**
 * Message Store Module
 *
 * Stores messages for future reference and replies
 */

class MessageStore {
  constructor(options = {}) {
    this.messages = new Map();
    this.maxSize = options.maxSize || 100;
  }

  /**
   * Adds a message to the store
   * @param {Object} message - The message object to store
   * @returns {String} - The ID of the stored message
   */
  add(message) {
    // Use the message ID as the key
    const messageId = message.key.id;
    
    // Add the message to the store
    this.messages.set(messageId, message);
    
    // If we've exceeded the max size, remove the oldest message
    if (this.messages.size > this.maxSize) {
      const oldestKey = this.messages.keys().next().value;
      this.messages.delete(oldestKey);
    }
    
    return messageId;
  }

  /**
   * Gets a message from the store by ID
   * @param {String} messageId - The ID of the message to retrieve
   * @returns {Object|null} - The message object or null if not found
   */
  get(messageId) {
    return this.messages.get(messageId) || null;
  }

  /**
   * Removes a message from the store
   * @param {String} messageId - The ID of the message to remove
   * @returns {Boolean} - True if the message was removed, false if not found
   */
  remove(messageId) {
    return this.messages.delete(messageId);
  }

  /**
   * Gets the number of messages in the store
   * @returns {Number} - The number of messages
   */
  size() {
    return this.messages.size;
  }

  /**
   * Clears all messages from the store
   */
  clear() {
    this.messages.clear();
  }
}

module.exports = MessageStore;
