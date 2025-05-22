/**
 * Mention Service
 *
 * Handles detection and processing of mentions in messages
 */

// Import required services
const userDataService = require('./userDataService');
const { getChatCompletion } = require('./mistralService');

/**
 * Extracts @number mentions from a message text
 * @param {String} messageText - The text content of the message
 * @returns {Array} - Array of phone numbers mentioned in the message
 */
function extractMentionedNumbers(messageText) {
  if (!messageText) return [];

  console.log('Checking for @number mentions in message:', messageText);

  // Regular expression to match @number format with improved pattern
  // This will match various formats like @1234567890, @+1234567890, @‪+1234567890‬, etc.
  const mentionRegex = /@\s*[‪]?(\+?\d+)[‬]?/g;
  const matches = [];
  let match;

  // Find all matches in the message text
  while ((match = mentionRegex.exec(messageText)) !== null) {
    // match[1] contains the number without the @ symbol
    const number = match[1].trim();
    console.log('Found @number mention:', number);
    matches.push(number);
  }

  // If no matches found with regex, try a simpler approach
  if (matches.length === 0) {
    console.log('No matches found with regex, trying alternative approach');

    // Split the message by spaces and look for words starting with @
    const words = messageText.split(/\s+/);
    for (const word of words) {
      if (word.startsWith('@')) {
        // Extract the number part (remove @ and any non-digit characters except +)
        const numberPart = word.substring(1).replace(/[^\d+]/g, '');
        if (numberPart && /^\+?\d+$/.test(numberPart)) {
          console.log('Found @number mention with alternative approach:', numberPart);
          matches.push(numberPart);
        }
      }
    }
  }

  console.log('Total @number mentions found:', matches.length);
  return matches;
}

/**
 * Extracts @name mentions from a message text
 * @param {String} messageText - The text content of the message
 * @returns {Array} - Array of names mentioned in the message
 */
function extractMentionedNames(messageText) {
  if (!messageText) return [];

  console.log('Checking for @name mentions in message:', messageText);

  // Array to store mentioned names
  const mentionedNames = [];

  // First, try to find multi-word names with a pattern like "@Name Last"
  // We'll use a regex to find @ followed by text, then extract the full name from the context
  const atSymbolPositions = [];
  let atIndex = messageText.indexOf('@');
  while (atIndex !== -1) {
    atSymbolPositions.push(atIndex);
    atIndex = messageText.indexOf('@', atIndex + 1);
  }

  // Process each @ position to extract potential multi-word names
  for (const position of atSymbolPositions) {
    // Skip if this @ is part of an email or other pattern
    if (position > 0 && messageText[position-1].match(/[a-zA-Z0-9]/)) {
      continue;
    }

    // Extract the text after the @ symbol
    const textAfterAt = messageText.substring(position + 1);

    // Find the end of the potential name (space, punctuation, end of string)
    let endOfFirstWord = textAfterAt.search(/[\s.,!?;:'"]/);
    if (endOfFirstWord === -1) {
      endOfFirstWord = textAfterAt.length;
    }

    // Get the first word of the name
    const firstWord = textAfterAt.substring(0, endOfFirstWord);

    // Skip if it's a number or too short
    if (/\d/.test(firstWord) || firstWord.length < 2) {
      continue;
    }

    // Check if there are more words that might be part of the name
    const remainingText = textAfterAt.substring(endOfFirstWord);
    const match = remainingText.match(/^\s+([A-Z][a-z]+)(\s+[A-Z][a-z]+)?/);

    if (match) {
      // This is likely a multi-word name with proper capitalization
      const fullName = firstWord + ' ' + match[1] + (match[2] || '');
      console.log('Found @name mention (multi-word):', fullName);
      mentionedNames.push(fullName);
    } else {
      // Just a single word name
      console.log('Found @name mention (single-word):', firstWord);
      mentionedNames.push(firstWord);
    }
  }

  // Handle special case for names with underscores like @SIHAB_BHAI
  const underscoreNameRegex = /@([a-zA-Z]+_[a-zA-Z]+)/g;
  let underscoreMatch;

  while ((underscoreMatch = underscoreNameRegex.exec(messageText)) !== null) {
    const nameWithUnderscore = underscoreMatch[1];
    if (!mentionedNames.includes(nameWithUnderscore)) {
      console.log('Found @name mention with underscore:', nameWithUnderscore);
      mentionedNames.push(nameWithUnderscore);
    }
  }

  console.log('Total @name mentions found:', mentionedNames.length);
  return mentionedNames;
}

/**
 * Extracts the actual message content by removing @mentions
 * @param {String} messageText - The original message text
 * @param {Array} mentionedNames - Array of mentioned names
 * @param {Array} mentionedNumbers - Array of mentioned numbers
 * @returns {String} - The message without @mentions
 */
function extractActualMessage(messageText, mentionedNames = [], mentionedNumbers = []) {
  if (!messageText) return '';

  console.log('Extracting actual message content from:', messageText);

  let cleanedMessage = messageText;

  // Remove all @name mentions
  for (const name of mentionedNames) {
    // Handle multi-word names and names with underscores
    const escapedName = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const nameRegex = new RegExp(`@${escapedName}\\b`, 'g');
    cleanedMessage = cleanedMessage.replace(nameRegex, '');
  }

  // Remove all @number mentions
  for (const number of mentionedNumbers) {
    const escapedNumber = number.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const numberRegex = new RegExp(`@${escapedNumber}\\b`, 'g');
    cleanedMessage = cleanedMessage.replace(numberRegex, '');
  }

  // Remove any remaining @mentions that might have been missed
  cleanedMessage = cleanedMessage.replace(/@\S+\s?/g, '');

  // Clean up extra spaces and trim
  cleanedMessage = cleanedMessage.replace(/\s+/g, ' ').trim();

  console.log('Extracted actual message:', cleanedMessage);
  return cleanedMessage;
}

/**
 * Detects the language of a message
 * @param {String} text - The text to detect language from
 * @returns {String} - The detected language code ('bn' for Bengali, 'en' for English, 'auto' for unknown)
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return 'auto';
  }

  // Simple language detection based on character sets
  const bengaliPattern = /[\u0980-\u09FF]/;
  const englishPattern = /[a-zA-Z]/;

  // Count Bengali and English characters
  const bengaliChars = (text.match(bengaliPattern) || []).length;
  const englishChars = (text.match(englishPattern) || []).length;

  console.log(`Language detection - Bengali chars: ${bengaliChars}, English chars: ${englishChars}`);

  // Common Bengali words that might be written in English
  const bengaliWordsInEnglish = [
    'ki', 'koro', 'korchi', 'korbe', 'kore', 'bolo', 'bolchi', 'bolbe', 'bole',
    'ache', 'hobe', 'hoyeche', 'hoye', 'jabe', 'jao', 'asho', 'eshechi', 'thik',
    'bhalo', 'kharap', 'sundor', 'bhai', 'bon', 'amake', 'tomake', 'apnake', 'ke',
    'keno', 'kothay', 'kivabe', 'ekhon', 'pore', 'age', 'sathe', 'jonno', 'tumi',
    'ami', 'apni', 'tui', 'ora', 'tara', 'amra', 'tomra', 'apnara', 'hoy', 'noy'
  ];

  // Check if the text contains Bengali words written in English
  const words = text.toLowerCase().split(/\s+/);
  const bengaliWordsCount = words.filter(word => bengaliWordsInEnglish.includes(word)).length;

  console.log(`Bengali words in English count: ${bengaliWordsCount}`);

  // Determine dominant language with improved logic
  if (bengaliChars > 0) {
    // If there are ANY Bengali characters, consider it Bengali
    return 'bn'; // Bengali
  } else if (bengaliWordsCount > 0 && bengaliWordsCount >= words.length / 3) {
    // If at least 1/3 of words are Bengali words written in English
    return 'bn'; // Bengali
  } else if (englishChars > 0) {
    return 'en'; // English
  }

  // Default to auto for our use case
  return 'auto';
}

/**
 * Enhances a message using AI to make it more professional and polished
 * @param {String} messageText - The original message text
 * @param {String} recipientName - The name of the recipient (optional)
 * @param {String} groupName - The name of the group (optional)
 * @param {String} senderName - The name of the sender (optional)
 * @param {Boolean} isTellSomeoneMessage - Whether this is a "tell someone" message (optional)
 * @returns {Promise<String>} - The enhanced message
 */
async function enhanceMessageWithAI(messageText, recipientName = '', groupName = '', senderName = '', isTellSomeoneMessage = false) {
  if (!messageText || messageText.trim() === '') {
    console.log('No message text provided for AI enhancement');
    return messageText;
  }

  try {
    console.log(`Enhancing message with AI for recipient: ${recipientName || 'unknown'}`);

    // Detect the language of the message
    const detectedLanguage = detectLanguage(messageText);
    console.log(`Detected language: ${detectedLanguage}`);

    // Create language-specific instructions based on detected language
    let languageInstructions = '';
    if (detectedLanguage === 'bn') {
      languageInstructions = 'Respond in Bengali (Bangla). Make sure your response is in Bangla script.';
    } else if (detectedLanguage === 'en') {
      languageInstructions = 'Respond in English only. Do NOT translate to Bengali.';
    } else {
      // For 'auto' or unknown, check if the message looks like Bengali written in English
      if (messageText.toLowerCase().includes('ki') ||
          messageText.toLowerCase().includes('koro') ||
          messageText.toLowerCase().includes('bolo') ||
          messageText.toLowerCase().includes('amake') ||
          messageText.toLowerCase().includes('tomake') ||
          messageText.toLowerCase().includes('apnake')) {
        languageInstructions = 'Respond in Bengali (Bangla). Make sure your response is in Bangla script.';
      } else {
        languageInstructions = 'Respond in English only. Do NOT translate to Bengali.';
      }
    }

    // Filter out any inappropriate language
    const filterInstructions = 'Filter out any inappropriate or offensive language while maintaining the message intent.';

    // Context information
    const contextInfo = [];
    if (recipientName) contextInfo.push(`This message will be sent to ${recipientName}.`);
    if (groupName) contextInfo.push(`This message is from a group chat named "${groupName}".`);
    if (senderName) contextInfo.push(`The message was sent by ${senderName}.`);

    // Add special instructions for "tell someone" messages
    let tellSomeoneInstructions = '';
    if (isTellSomeoneMessage) {
      tellSomeoneInstructions = `
IMPORTANT: This appears to be a message where someone is asking to relay information to someone else.
- Your MAIN TASK is to extract ONLY the part that should be relayed, removing all instructions
- Identify and REMOVE phrases like "tell X", "say to X", "X ke bolo", "ke bolo", "bolte bolo", etc.
- Return ONLY the actual message content that needs to be relayed
- For example:
  * If the message is "Tell John I'll be late", return ONLY "I'll be late"
  * If the message is "X ke bolo ami aschi", return ONLY "ami aschi" (I'm coming)
  * If the message is "Sihab ke bolo toh amake message dite", return ONLY "amake message dite"
  * If the message is "ke bolo toh amake message dite", return ONLY "amake message dite"
- Be aggressive about removing the instruction part and keeping only the content to be relayed
- If the entire message is an instruction with no content to relay, return a simple greeting like "Hello" or "হ্যালো"
- Focus on preserving ONLY the exact message that needs to be relayed, not the instruction to relay it`;
    }

    // Create a prompt for the AI to enhance the message
    const messages = [
      {
        role: 'system',
        content: `You are a message relay assistant. ${languageInstructions} Your task is to relay the EXACT message with ZERO changes to meaning:
1. Fix only obvious spelling errors
2. Keep the EXACT same meaning, intent, and tone
3. Do NOT change the core message in any way
4. Do NOT add any new information
5. ${filterInstructions}
6. Keep the message IDENTICAL to the original in meaning

${contextInfo.join(' ')}
${tellSomeoneInstructions}

CRITICAL INSTRUCTIONS:
- Your primary job is to relay the EXACT same message with the EXACT same meaning
- If someone is asking to tell something to someone else, relay that EXACT message
- If someone is asking a question, relay that EXACT question
- If someone is giving instructions, relay those EXACT instructions
- If the message contains "ke bolo" (tell someone), keep it as "কে বলো" (tell someone)
- If the message contains "ki koro" (what are you doing), keep it as "কি করো" (what are you doing)
- Do NOT try to make the message more polite or professional if it changes the meaning
- Do NOT add any explanations or notes
- Just return the message text directly
- Do NOT include quotation marks in your response

EXAMPLES:
Original: "ke bolo ki koro"
Correct: "কে বলো কি করো" (exact same meaning and structure)
Incorrect: "তাকে বলো কি করছে" (changes the meaning)
Incorrect: "অনুগ্রহ করে তাকে জিজ্ঞাসা করুন তিনি কি করছেন" (too formal, changes tone)

Original: "SIHAB ke bolo amake call dite"
Correct: "শিহাবকে বলো আমাকে কল দিতে" (exact same instruction)
Incorrect: "শিহাবকে অনুরোধ করুন আমাকে ফোন করতে" (changes the tone)

Original: "please check the report"
Correct: "Please check the report" (minimal change)
Incorrect: "I would appreciate if you could review the report" (changes the message)

REMEMBER: Your job is to relay the message EXACTLY as given, not improve or change it. Keep it as close to the original as possible.`
      },
      {
        role: 'user',
        content: `Relay this message with NO changes to meaning: "${messageText}"`
      }
    ];

    // Get the enhanced message from the AI
    const enhancedMessage = await getChatCompletion(messages);

    // Remove any quotation marks that might have been added by the AI
    let cleanedMessage = enhancedMessage.replace(/^["']|["']$/g, '').trim();

    console.log('Original message:', messageText);
    console.log('AI enhanced message:', cleanedMessage);

    return cleanedMessage;
  } catch (error) {
    console.error('Error enhancing message with AI:', error);
    // Return the original message if there's an error
    return messageText;
  }
}

/**
 * Formats a phone number for WhatsApp
 * @param {String} number - The phone number to format
 * @returns {String|null} - The formatted number or null if invalid
 */
function formatNumberForWhatsApp(number) {
  if (!number) {
    console.error('No number provided to format');
    return null;
  }

  // Convert to string if it's not already
  let numStr = String(number);

  // Remove any invisible characters, spaces, and other non-digit characters except the + sign
  let cleanNumber = numStr.replace(/[\u200B-\u200D\uFEFF\u2060\u2800\s]/g, '');
  cleanNumber = cleanNumber.replace(/[^\d+]/g, '');

  console.log('Cleaned number:', cleanNumber);

  // If the number doesn't start with +, assume it's a local number and add default country code
  if (!cleanNumber.startsWith('+')) {
    // You can change this default country code as needed
    cleanNumber = '+' + cleanNumber;
    console.log('Added + prefix:', cleanNumber);
  }

  // Remove the + sign for WhatsApp format
  cleanNumber = cleanNumber.replace('+', '');

  // Ensure the number is not empty after cleaning
  if (!cleanNumber || !/^\d+$/.test(cleanNumber)) {
    console.error('Invalid number after cleaning:', cleanNumber);
    return null;
  }

  // Return the number with WhatsApp suffix
  const formattedNumber = `${cleanNumber}@s.whatsapp.net`;
  console.log('Formatted number for WhatsApp:', formattedNumber);
  return formattedNumber;
}

/**
 * Handles mentioned numbers and names in a message by sending them direct messages
 * @param {Object} sock - The WhatsApp socket connection
 * @param {Object} message - The processed message with metadata
 * @returns {Promise<Array>} - Array of results from sending messages
 */
async function handleMentions(sock, message) {
  if (!sock || !message || !message.metadata) {
    return [];
  }

  const { mentionedNumbers, mentionedNames, messageText, groupName } = message.metadata;
  const results = [];
  const processedNumbers = new Set(); // To avoid duplicate messages

  // Check if there are any mentions to process
  if ((!mentionedNumbers || mentionedNumbers.length === 0) &&
      (!mentionedNames || mentionedNames.length === 0)) {
    return results;
  }

  console.log(`Processing ${mentionedNumbers?.length || 0} mentioned numbers and ${mentionedNames?.length || 0} mentioned names`);

  // Get sender's name/number for personalized response
  let senderName = '';
  const senderId = message.key.participant || message.key.remoteJid;

  // Try to get the sender's name from message metadata or group data
  try {
    // First check if we have a name in the message metadata
    if (message.pushName) {
      senderName = message.pushName;
      console.log(`Using sender's name from message metadata: ${senderName}`);
    }
    // Then check if we have a name in the group data
    else if (message.metadata && message.metadata.senderName) {
      senderName = message.metadata.senderName;
      console.log(`Using sender's name from message metadata: ${senderName}`);
    }
    // If no name found, use the ID
    else {
      senderName = senderId.split('@')[0];
      console.log(`No name found for sender: ${senderId}, using ID: ${senderName}`);
    }
  } catch (error) {
    console.error('Error getting sender name:', error);
    // Fallback to ID if error
    senderName = senderId.split('@')[0];
  }

  // Extract the actual message content (removing @mentions)
  const actualMessage = extractActualMessage(messageText, mentionedNames, mentionedNumbers);

  // Check if the message is a "tell someone" type message
  const isTellSomeoneMessage = checkIfTellSomeoneMessage(messageText, actualMessage);
  console.log(`Is this a "tell someone" message? ${isTellSomeoneMessage}`);

  // Process mentioned numbers first
  if (mentionedNumbers && mentionedNumbers.length > 0) {
    for (const number of mentionedNumbers) {
      try {
        // Skip if we've already processed this number
        if (processedNumbers.has(number)) {
          console.log(`Skipping duplicate mention of number: ${number}`);
          continue;
        }

        // For numbers, we'll also enhance the message but without a specific name
        console.log(`Enhancing message with AI for number: ${number}`);
        const enhancedMessage = await enhanceMessageWithAI(actualMessage, '', groupName, senderName, isTellSomeoneMessage);

        // Translate group name to Bengali if it's in English
        let bengaliGroupName = groupName || 'একটি গ্রুপ';
        if (bengaliGroupName.match(/^[a-zA-Z0-9\s]+$/)) {
          // If group name is in English, use a generic Bengali name
          bengaliGroupName = 'গ্রুপ';
        }

        // Translate sender name to Bengali if needed
        let bengaliSenderName = senderName;
        if (senderName) {
          // Common English names and their Bengali translations
          const nameTranslations = {
            'SIHAB': 'শিহাব',
            'SIHAB BHAI': 'শিহাব ভাই',
            'RAHIM': 'রহিম',
            'RAHIM KHAN': 'রহিম খান',
            'KARIM': 'করিম',
            'JOHN': 'জন',
            'SARAH': 'সারা',
            'ADMIN': 'অ্যাডমিন',
            'BHAI': 'ভাই',
            'AUNTIE': 'আন্টি',
            'UNCLE': 'আংকেল',
            'SIR': 'স্যার',
            'MADAM': 'ম্যাডাম'
          };

          // Check if we have a translation for this name
          const upperName = senderName.toUpperCase();
          if (nameTranslations[upperName]) {
            bengaliSenderName = nameTranslations[upperName];
            console.log(`Translated sender name to Bengali: ${bengaliSenderName}`);
          }
        }

        // Create personalized message with the AI-enhanced content in the new format
        let personalizedMessage;
        if (isTellSomeoneMessage) {
          // For "tell someone" messages, use a format that indicates it's a relay
          personalizedMessage = `${bengaliGroupName} থেকে ${bengaliSenderName} আপনাকে এই বার্তা পাঠাতে বলেছে:\n\n"${enhancedMessage}"`;
        } else {
          // For regular mentions, use the standard format
          personalizedMessage = `${bengaliGroupName} থেকে ${bengaliSenderName} আপনাকে বলেছে:\n\n"${enhancedMessage}"`;
        }

        console.log(`Sending AI-enhanced message to number: ${number}`);
        const result = await sendDirectMessage(sock, number, personalizedMessage);
        processedNumbers.add(number);

        if (result) {
          // Send confirmation message back to the original chat
          const confirmationMessage = `✅ মেসেজ পাঠানো হয়েছে: ${number} নম্বরে আপনার বার্তা পৌঁছে গেছে`;

          // Print the confirmation message to the terminal
          console.log('=== SENDING CONFIRMATION ===');
          console.log(confirmationMessage);
          console.log('===========================');

          await sock.sendMessage(message.key.remoteJid, { text: confirmationMessage });
          console.log(`Confirmation sent for ${number}`);
          results.push(result);
        }

        results.push({ number, success: !!result });
      } catch (error) {
        console.error(`Failed to send message to mentioned number ${number}:`, error);
        results.push({ number, success: false, error: error.message });
      }
    }
  }

  // Process mentioned names
  if (mentionedNames && mentionedNames.length > 0) {
    for (const name of mentionedNames) {
      try {
        console.log(`Looking up phone number for mentioned name: ${name}`);

        // Use the userDataService to find the phone number for this name
        const phoneNumber = userDataService.findPhoneNumberByName(name);

        if (!phoneNumber) {
          console.log(`No phone number found for name: ${name}`);
          // Send a message back to the chat that we couldn't find the number
          await sock.sendMessage(message.key.remoteJid, {
            text: `I couldn't find a phone number for ${name}. Make sure they have chatted with me before.`
          });
          continue;
        }

        // Skip if we've already processed this number
        if (processedNumbers.has(phoneNumber)) {
          console.log(`Skipping duplicate mention of number: ${phoneNumber} (from name ${name})`);
          continue;
        }

        // Enhance the message with AI for this specific recipient
        console.log(`Enhancing message with AI for ${name}`);
        const enhancedMessage = await enhanceMessageWithAI(actualMessage, name, groupName, senderName, isTellSomeoneMessage);

        // Translate group name to Bengali if it's in English
        let bengaliGroupName = groupName || 'একটি গ্রুপ';
        if (bengaliGroupName.match(/^[a-zA-Z0-9\s]+$/)) {
          // If group name is in English, use a generic Bengali name
          bengaliGroupName = 'গ্রুপ';
        }

        // Translate sender name to Bengali if needed
        let bengaliSenderName = senderName;
        if (senderName) {
          // Common English names and their Bengali translations
          const nameTranslations = {
            'SIHAB': 'শিহাব',
            'SIHAB BHAI': 'শিহাব ভাই',
            'RAHIM': 'রহিম',
            'RAHIM KHAN': 'রহিম খান',
            'KARIM': 'করিম',
            'JOHN': 'জন',
            'SARAH': 'সারা',
            'ADMIN': 'অ্যাডমিন',
            'BHAI': 'ভাই',
            'AUNTIE': 'আন্টি',
            'UNCLE': 'আংকেল',
            'SIR': 'স্যার',
            'MADAM': 'ম্যাডাম'
          };

          // Check if we have a translation for this name
          const upperName = senderName.toUpperCase();
          if (nameTranslations[upperName]) {
            bengaliSenderName = nameTranslations[upperName];
            console.log(`Translated sender name to Bengali: ${bengaliSenderName}`);
          }
        }

        // Create personalized message with the AI-enhanced content in the new format
        let personalizedMessage;
        if (isTellSomeoneMessage) {
          // For "tell someone" messages, use a format that indicates it's a relay
          personalizedMessage = `${bengaliGroupName} থেকে ${bengaliSenderName} আপনাকে এই বার্তা পাঠাতে বলেছে:\n\n"${enhancedMessage}"`;
        } else {
          // For regular mentions, use the standard format
          personalizedMessage = `${bengaliGroupName} থেকে ${bengaliSenderName} আপনাকে বলেছে:\n\n"${enhancedMessage}"`;
        }

        console.log(`Sending AI-enhanced message to ${name} (${phoneNumber})`);
        const result = await sendDirectMessage(sock, phoneNumber, personalizedMessage);
        processedNumbers.add(phoneNumber);

        if (result) {
          // Send confirmation message back to the original chat
          const confirmationMessage = `✅ বার্তা পাঠানো হয়েছে: ${name} কে আপনার বার্তা পৌঁছে গেছে`;

          // Print the confirmation message to the terminal
          console.log('=== SENDING CONFIRMATION ===');
          console.log(confirmationMessage);
          console.log('===========================');

          await sock.sendMessage(message.key.remoteJid, { text: confirmationMessage });
          console.log(`Confirmation sent for ${name}`);
          results.push(result);
        }

        results.push({ name, phoneNumber, success: !!result });
      } catch (error) {
        console.error(`Failed to send message to mentioned name ${name}:`, error);
        results.push({ name, success: false, error: error.message });
      }
    }
  }

  return results;
}

/**
 * Sends a direct message to a phone number
 * @param {Object} sock - The WhatsApp socket connection
 * @param {String} number - The phone number to send the message to
 * @param {String} text - The message text
 * @returns {Promise<Object|null>} - The result of sending the message or null if failed
 */
async function sendDirectMessage(sock, number, text) {
  console.log(`Attempting to send direct message to ${number}`);

  try {
    // Validate inputs
    if (!sock) {
      console.error('Invalid WhatsApp socket connection');
      return null;
    }

    if (!number) {
      console.error('Invalid phone number provided');
      return null;
    }

    if (!text) {
      console.error('No message text provided');
      return null;
    }

    // Format the number for WhatsApp
    const formattedNumber = formatNumberForWhatsApp(number);

    if (!formattedNumber) {
      console.error(`Failed to format number: ${number}`);
      return null;
    }

    console.log(`Sending message to ${formattedNumber}`);
    console.log(`Message content: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);

    // Send the message
    const result = await sock.sendMessage(formattedNumber, { text });
    console.log(`Message sent successfully to ${number}`);
    return result;
  } catch (error) {
    console.error(`Error sending direct message to ${number}:`, error);

    // Try an alternative method if the first one fails
    try {
      console.log(`Trying alternative method to send message to ${number}`);
      const formattedNumber = formatNumberForWhatsApp(number);

      if (!formattedNumber) {
        return null;
      }

      // Try with a simpler message format
      const result = await sock.sendMessage(formattedNumber, { text: text });
      console.log(`Message sent successfully using alternative method to ${number}`);
      return result;
    } catch (altError) {
      console.error(`Alternative method also failed for ${number}:`, altError);
      return null;
    }
  }
}

/**
 * Checks if a message is a "tell someone" type message
 * @param {String} originalMessage - The original message text
 * @param {String} cleanedMessage - The message with mentions removed
 * @returns {Boolean} - True if this is a "tell someone" message
 */
function checkIfTellSomeoneMessage(originalMessage, cleanedMessage) {
  if (!originalMessage || !cleanedMessage) {
    return false;
  }

  // Convert to lowercase for case-insensitive matching
  const lowerOriginal = originalMessage.toLowerCase();

  // Check for English patterns
  const englishPatterns = [
    'tell', 'say to', 'inform', 'let know', 'message', 'ask', 'tell him', 'tell her',
    'please tell', 'can you tell', 'would you tell', 'could you tell'
  ];

  // Check for Bengali patterns (in both Bengali script and transliterated)
  const bengaliPatterns = [
    'বলো', 'বল', 'জানাও', 'বলতে', 'বলবে', 'জানাবে', 'জিজ্ঞাসা', 'জিজ্ঞেস',
    'bolo', 'bol', 'janao', 'bolte', 'bolbe', 'janabe', 'jiggasa', 'jigges'
  ];

  // Check if any of the patterns are present in the original message
  const hasEnglishPattern = englishPatterns.some(pattern => lowerOriginal.includes(pattern));
  const hasBengaliPattern = bengaliPatterns.some(pattern => lowerOriginal.includes(pattern));

  // Check if the message has a "tell someone" pattern
  const isTellSomeoneMessage = hasEnglishPattern || hasBengaliPattern;

  console.log(`Message check - Has English pattern: ${hasEnglishPattern}, Has Bengali pattern: ${hasBengaliPattern}`);
  console.log(`Is "tell someone" message: ${isTellSomeoneMessage}`);

  return isTellSomeoneMessage;
}

module.exports = {
  extractMentionedNumbers,
  extractMentionedNames,
  extractActualMessage,
  detectLanguage,
  enhanceMessageWithAI,
  formatNumberForWhatsApp,
  handleMentions,
  sendDirectMessage,
  checkIfTellSomeoneMessage
};
