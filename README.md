# WhatsApp Messaging System

A WhatsApp automation system with advanced messaging features including message categorization, custom UI, notification handling, and reply functionality. Now with cloud deployment support for Render.com!

## Features

### Message Categorization
- **Group Messages**: Messages from group chats are automatically categorized as "group" messages
- **Inbox Messages**: Direct messages are categorized as "inbox" by default
- **Custom Categories**: Messages can be categorized as "important", "work", "personal", or any custom category
- **Flexible Categorization Rules**: Custom rules can be defined to categorize messages based on content or sender

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
!help                                # Show available commands
!exit                                # Exit the bot
```

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

## Module Structure

- **messageHandler.js**: Handles message processing and categorization
- **messageUI.js**: Manages message display and formatting
- **notificationHandler.js**: Handles notification creation and display
- **userPreferences.js**: Manages user preferences and settings
- **replyHandler.js**: Manages reply functionality for messages
- **messageStore.js**: Stores messages for future reference and replies
- **server.js**: Web server for cloud deployment

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

## License

ISC
