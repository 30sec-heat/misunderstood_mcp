#!/usr/bin/env tsx

/**
 * Telegram Authentication Script (Auto-configured)
 * 
 * This script automatically uses your API credentials to generate a Telegram session string.
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

class TelegramAuth {
  private client: TelegramClient | null = null;
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private async prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  private async promptSecret(question: string): Promise<string> {
    return new Promise((resolve) => {
      process.stdout.write(question);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      let input = '';
      process.stdin.on('data', (key) => {
        if (key === '\r' || key === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(input);
        } else if (key === '\u0003') { // Ctrl+C
          process.exit(0);
        } else if (key === '\u007f') { // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          input += key;
          process.stdout.write('*');
        }
      });
    });
  }

  async authenticate(): Promise<string> {
    try {
      console.log('🔐 Telegram Authentication Setup (Auto-configured)');
      console.log('==================================================\n');

      // API credentials from environment variables
      const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
      const apiHash = process.env.TELEGRAM_API_HASH || '';
      
      if (!apiId || !apiHash) {
        console.error('❌ Missing Telegram API credentials');
        console.log('Please set TELEGRAM_API_ID and TELEGRAM_API_HASH environment variables');
        console.log('Get your credentials from: https://my.telegram.org/apps');
        process.exit(1);
      }

      console.log('✅ Using pre-configured API credentials:');
      console.log(`   API ID: ${apiId}`);
      console.log(`   API Hash: ${apiHash.substring(0, 8)}...`);
      console.log('');

      const phoneNumber = await this.prompt('Enter your phone number (with country code, e.g., +1234567890): ');

      console.log('\n🔄 Connecting to Telegram...');

      // Create a new session
      const stringSession = new StringSession('');
      this.client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
        timeout: 10000,
      });

      await this.client.start({
        phoneNumber: async () => phoneNumber,
        password: async () => {
          const password = await this.promptSecret('Enter your 2FA password (if enabled): ');
          return password;
        },
        phoneCode: async () => {
          const code = await this.prompt('Enter the verification code sent to your phone: ');
          return code;
        },
        onError: (err) => {
          console.error('❌ Authentication error:', err);
        },
      });

      console.log('✅ Successfully authenticated!');

      // Get the session string
      const sessionString = this.client.session.save() as unknown as string;
      
      // Save session to file
      const sessionPath = path.join(process.cwd(), '.session');
      fs.writeFileSync(sessionPath, sessionString, 'utf8');
      
      console.log('\n💾 Session saved to .session file');
      console.log('================================');
      console.log(`📁 File: ${sessionPath}`);
      console.log('================================\n');

      console.log('✅ Authentication complete!');
      console.log('The Telegram module will now automatically use this session.');
      console.log('\n⚠️  Keep the .session file secure and private!');

      return sessionString;
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  async testConnection(sessionString?: string): Promise<boolean> {
    try {
      console.log('\n🧪 Testing connection...');

      // Try to load session from file if not provided
      let sessionToTest = sessionString;
      if (!sessionToTest) {
        const sessionPath = path.join(process.cwd(), '.session');
        if (fs.existsSync(sessionPath)) {
          sessionToTest = fs.readFileSync(sessionPath, 'utf8');
          console.log('📁 Loaded session from .session file');
        } else {
          console.log('❌ No session file found at .session');
          return false;
        }
      }

      const stringSession = new StringSession(sessionToTest);
      const testClient = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 3,
        timeout: 5000,
      });

      await testClient.start({
        phoneNumber: async () => {
          throw new Error('Phone number not needed for existing session');
        },
        password: async () => {
          throw new Error('Password not needed for existing session');
        },
        phoneCode: async () => {
          throw new Error('Phone code not needed for existing session');
        },
        onError: (err) => {
          console.error('❌ Connection test error:', err);
        },
      });

      // Get user info to verify connection
      const me = await testClient.getMe();
      console.log(`✅ Connection successful! Logged in as: ${me.firstName} ${me.lastName || ''} (@${me.username || 'no username'})`);

      await testClient.disconnect();
      return true;
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
    }
    this.rl.close();
  }
}

async function main() {
  const auth = new TelegramAuth();

  try {
    // Check if we should test existing session
    const testMode = process.argv.includes('--test');
    
    if (testMode) {
      console.log('🧪 Testing existing session...');
      const isValid = await auth.testConnection();
      
      if (isValid) {
        console.log('✅ Session is valid and working!');
        console.log('The Telegram module can now use this session.');
      } else {
        console.log('❌ Session is invalid or expired');
        console.log('Run "npm run auth" to create a new session.');
        process.exit(1);
      }
    } else {
      // Interactive authentication with pre-configured credentials
      const sessionString = await auth.authenticate();
      
      // Test the generated session string
      const isValid = await auth.testConnection(sessionString);
      
      if (!isValid) {
        console.log('❌ Generated session failed connection test');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('❌ Authentication process failed:', error);
    process.exit(1);
  } finally {
    await auth.cleanup();
  }
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { TelegramAuth };
