/**
 * API Routes
 * 
 * Handles all API endpoints for the dashboard
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const config = require('../config/config');

// Global variables to store connection state and QR code
let connectionState = 'close';
let qrCodeData = null;
let lastError = null;
let messagesCount = 0;

/**
 * Updates the connection state
 * @param {string} state - The new connection state
 */
function updateConnectionState(state) {
  connectionState = state;
}

/**
 * Updates the QR code data
 * @param {string} qrData - The QR code data
 */
function updateQRCode(qrData) {
  qrCodeData = qrData;
  
  // Generate and save QR code image
  if (qrData) {
    const qrImagePath = path.join(__dirname, '../../public/qrcode.png');
    qrcode.toFile(qrImagePath, qrData, {
      errorCorrectionLevel: 'H',
      margin: 1,
      scale: 8
    }, (err) => {
      if (err) {
        console.error('Error generating QR code image:', err);
      }
    });
  }
}

/**
 * Updates the error message
 * @param {string} error - The error message
 */
function updateError(error) {
  lastError = error;
}

/**
 * Updates the messages count
 * @param {number} count - The new messages count
 */
function updateMessagesCount(count) {
  messagesCount = count;
}

// API authentication middleware
function apiAuth(req, res, next) {
  // Skip auth in development mode
  if (config.server.env === 'development') {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === config.server.apiKey) {
    return next();
  }
  
  return res.status(401).json({ error: 'Unauthorized' });
}

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Status endpoint
router.get('/status', apiAuth, (req, res) => {
  res.json({
    status: connectionState,
    messagesStored: messagesCount,
    error: lastError,
    uptime: process.uptime()
  });
});

// QR code endpoint
router.get('/qrcode', apiAuth, (req, res) => {
  if (qrCodeData && connectionState !== 'open') {
    res.json({
      qrcode: `/qrcode.png?t=${Date.now()}` // Add timestamp to prevent caching
    });
  } else {
    res.status(404).json({
      error: 'QR code not available',
      reason: connectionState === 'open' ? 'Already connected' : 'Not generated yet'
    });
  }
});

// Stats endpoint
router.get('/stats', apiAuth, (req, res) => {
  // Get stats from data directory
  try {
    const groupsDir = path.join(__dirname, '../../data/groups');
    const inboxDir = path.join(__dirname, '../../data/inbox');
    
    // Count group conversations
    let groupCount = 0;
    if (fs.existsSync(groupsDir)) {
      groupCount = fs.readdirSync(groupsDir).filter(file => file.endsWith('.json')).length;
    }
    
    // Count direct conversations
    let directCount = 0;
    if (fs.existsSync(inboxDir)) {
      directCount = fs.readdirSync(inboxDir).filter(file => file.endsWith('.json')).length;
    }
    
    res.json({
      groups: groupCount,
      directChats: directCount,
      messagesStored: messagesCount,
      status: connectionState
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = {
  router,
  updateConnectionState,
  updateQRCode,
  updateError,
  updateMessagesCount
};
