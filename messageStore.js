/**
 * Message Store Module
 *
 * Provides storage and retrieval functionality for messages
 * to support features like replying to specific messages
 */

class MessageStore {
  constructor(options = {}) {
    // Maximum number of messages to store (default: 100)
    this.maxSize = options.maxSize || 100;
    
    // Storage for messages, using Map for O(1) lookups by ID
    this.messages = new Map();
    
    // Queue to track message order for FIFO removal when maxSize is reached
    this.messageQueue = [];
  }

  /**
   * Add a message to the store
   * @param {Object} message - The message object to store
   * @returns {String} - The ID of the stored message
   */
  add(message) {
    if (!message || !message.key || !message.key.id) {
      throw new Error('Invalid message: missing key.id');
    }

    const messageId = message.key.id;

    // If we're at capacity, remove the oldest message
    if (this.messageQueue.length >= this.maxSize) {
      const oldestId = this.messageQueue.shift();
      this.messages.delete(oldestId);
    }

    // Store the message and its ID
    this.messages.set(messageId, message);
    this.messageQueue.push(messageId);

    return messageId;
  }

  /**
   * Get a message by its ID
   * @param {String} messageId - The ID of the message to retrieve
   * @returns {Object|undefined} - The message object or undefined if not found
   */
  get(messageId) {
    return this.messages.get(messageId);
  }

  /**
   * Check if a message exists in the store
   * @param {String} messageId - The ID of the message to check
   * @returns {Boolean} - True if the message exists
   */
  has(messageId) {
    return this.messages.has(messageId);
  }

  /**
   * Remove a message from the store
   * @param {String} messageId - The ID of the message to remove
   * @returns {Boolean} - True if the message was removed
   */
  remove(messageId) {
    if (!this.messages.has(messageId)) {
      return false;
    }

    // Remove from the map
    this.messages.delete(messageId);
    
    // Remove from the queue
    const index = this.messageQueue.indexOf(messageId);
    if (index !== -1) {
      this.messageQueue.splice(index, 1);
    }

    return true;
  }

  /**
   * Get all messages in the store
   * @returns {Array} - Array of all stored messages
   */
  getAll() {
    return Array.from(this.messages.values());
  }

  /**
   * Get the number of messages in the store
   * @returns {Number} - The number of stored messages
   */
  size() {
    return this.messages.size;
  }

  /**
   * Clear all messages from the store
   */
  clear() {
    this.messages.clear();
    this.messageQueue = [];
  }
}

module.exports = MessageStore;
