# Utils

This directory contains utility scripts for the MCP Crypto Server.

## Telegram Authentication Script

The `telegram-auth.ts` script helps you generate a Telegram session string for authenticating with the Telegram module.

### Usage

#### Interactive Authentication (Recommended)
```bash
tsx utils/telegram-auth.ts
```

This will guide you through:
1. Entering your Telegram API credentials
2. Phone number verification
3. 2FA password (if enabled)
4. Generating a session string

#### Test Existing Session String
```bash
tsx utils/telegram-auth.ts "your_session_string_here"
```

This will test if an existing session string is valid.

### Getting API Credentials

1. Go to [https://my.telegram.org/apps](https://my.telegram.org/apps)
2. Log in with your Telegram account
3. Create a new application
4. Copy the API ID and API Hash

### Environment Variables

After generating a session string, set it as an environment variable:

```bash
export TELEGRAM_SESSION_STRING="your_session_string_here"
```

Or add it to your `.env` file:

```
TELEGRAM_SESSION_STRING=your_session_string_here
```