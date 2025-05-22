# WhatsApp Messaging System

A WhatsApp automation system with advanced messaging features including message categorization, custom UI, notification handling, and reply functionality. Now with cloud deployment support for Render.com!

## Features

### Message Categorization
- **Group Messages**: Messages from group chats are automatically categorized as "group" messages
- **Inbox Messages**: Direct messages are categorized as "inbox" by default
- **Custom Categories**: Messages can be categorized as "important", "work", "personal", or any custom category
- **Flexible Categorization Rules**: Custom rules can be defined to categorize messages based on content or sender

### Fast Reply System
- **Quick Replies**: Predefined messages for common responses
- **Shortcut Commands**: Use shortcuts like !hi, !busy, !thanks to send messages instantly
- **Reply Queue**: Messages are queued and sent in order to prevent rate limiting
- **Targeted Replies**: Send quick replies to specific messages using message IDs
- **Error Handling**: Robust error handling for reliable message delivery
- **Customizable Templates**: Add your own quick reply templates for frequent messages

### @number Mention System
- **Mention Detection**: The bot detects when someone mentions a phone number with @ in group chats
- **Direct Messaging**: Automatically sends direct messages to mentioned numbers
- **Customizable Messages**: The notification message sent to mentioned users can be customized
- **Format Support**: Supports various formats like @1234567890 and @+1234567890

### Automatic Reply Behavior
- **Group Messages**: Automatic replies are sent to all group messages
- **Direct Messages**: Automatic replies can now be sent to direct/private messages
- **Reply System**: Support for replying to specific messages in both groups and direct chats
- **Clear Distinction**: The system clearly distinguishes between group and direct messages

### Message Display
- **Group Message Headers**: Group messages are displayed with a header showing the group name and sender
- **Category-Based Formatting**: Different message categories have distinct visual styles
- **Customizable UI**: All UI elements can be customized through user preferences

### Notification System
- **Category-Based Notifications**: Different notification settings for each message category
- **Customizable Notification Settings**: Control notification sounds, priority, and preview settings
- **Muted Chats**: Option to mute notifications from specific chats

### User Preferences
- **Persistent Settings**: User preferences are saved to a JSON file
- **Customizable UI**: Change colors, borders, and other display elements
- **Custom Category Rules**: Define rules for automatic message categorization

## Getting Started

### Local Installation

1. Install dependencies:
```bash
npm install
```

2. Start the application in development mode:
```bash
npm run dev
```

3. Scan the QR code with your WhatsApp app to authenticate.

4. Use the command line interface to interact with the bot:
```
!reply [messageId] [Your reply text]  # Reply to a specific message
!qr                                  # Show available quick replies
!qr [messageId] [shortcut]           # Send a quick reply to a specific message
!help                                # Show available commands
!exit                                # Exit the bot
```

5. Use quick reply shortcuts for fast responses:
```
!hi       # Send a greeting message to the last received message
!busy     # Let people know you're busy
!thanks   # Send a thank you message
!noted    # Acknowledge a message in a group
!ack      # Acknowledge receipt of a message
!gm       # Send a good morning greeting
!ga       # Send a good afternoon greeting
!ge       # Send a good evening greeting
```

6. Use @number mentions in group messages:
```
Hey @1234567890 check this out!  # Bot will send a direct message to the number 1234567890
@+1234567890 please review this  # You can also use country codes with + prefix
```

When someone mentions a number with @ in a group chat, the bot will:
- Detect the mention and extract the phone number
- Format the number correctly for WhatsApp
- Send a direct message to that number with information about who mentioned them
- Include the original message content in the notification

### Cloud Deployment on Render

This project is configured for easy deployment on Render.com:

1. **Push your code to a Git repository**

2. **Create a new Web Service on Render**
   - Connect your Git repository
   - Select Node.js environment

3. **Configure the service**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Add environment variables from `.env`
   - Add a persistent disk mounted at `/opt/render/project/src/auth`

4. **Deploy and access the web interface**
   - Open your Render URL to access the dashboard
   - Scan the QR code to authenticate
   - Monitor connection status

For detailed deployment instructions, see the `render.yaml` file.

### Configuration

User preferences can be customized by editing the `user_preferences.json` file or through environment variables.

#### Example Custom Category Rule

```javascript
// Categorize messages containing "urgent" as important
addCustomCategoryRule((message) => {
  const messageText = message.message?.conversation ||
                     message.message?.extendedTextMessage?.text || '';
  if (messageText.toLowerCase().includes('urgent')) {
    return MESSAGE_CATEGORIES.IMPORTANT;
  }
  return null; // Use default categorization
});
```

## Project Structure

```
whatsapp-automation-beta/
├── auth/                  # Authentication credentials
├── public/                # Static files
└── src/                   # Source code
    ├── config/            # Configuration files
    │   └── userPreferences.js
    ├── core/              # Core functionality
    │   └── messageStore.js
    ├── handlers/          # Message and notification handlers
    │   ├── messageHandler.js
    │   ├── notificationHandler.js
    │   └── replyHandler.js
    ├── services/          # Services
    ├── utils/             # Utility functions
    │   └── messageUI.js
    ├── index.js           # Entry point
    └── server.js          # Web server for cloud deployment
```

## Customization

### UI Customization

You can customize the UI by updating the styles in user preferences:

```javascript
// Example: Change the color of important messages
updatePreferences({
  styles: {
    important: {
      headerColor: chalk.red.bold,
      bodyColor: chalk.yellow,
      borderChar: '!',
      borderColor: chalk.red
    }
  }
});
```

### Notification Customization

```javascript
// Example: Disable notifications for group messages
updatePreferences({
  notifications: {
    group: {
      enabled: false
    }
  }
});
```

### Fast Reply Customization

You can add your own quick replies by modifying the `quickReplies.js` file:

```javascript
// Example: Add custom quick replies
addQuickReply('!urgent', 'This is urgent and requires your immediate attention!');
addQuickReply('!meeting', 'Let\'s schedule a meeting to discuss this further.');
addQuickReply('!followup', 'I\'ll follow up with you on this matter soon.');
```

You can also add quick replies directly from the command line:

```javascript
// In your code, you can add this to allow adding quick replies from the command line
if (command.startsWith('!addqr ')) {
  const parts = command.substring(7).split(' ');
  const shortcut = parts[0];
  const message = parts.slice(1).join(' ');
  addQuickReply(shortcut, message);
  console.log(`✅ Added quick reply: ${shortcut}`);
  return true;
}
```

### @number Mention Customization

You can customize the message sent to mentioned numbers by modifying the `mentionMessage` in the server.js file:

```javascript
// Example: Customize the message sent to mentioned numbers
const mentionMessage = `Hello ${number}! You were mentioned by ${senderName} in the group "${groupName}".
Message: "${originalText}"

This is an automated notification from WhatsApp Bot.`;
```

## License

ISC
