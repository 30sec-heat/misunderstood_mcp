#!/usr/bin/env tsx

/**
 * Telegram Authentication Script
 * 
 * This script helps you generate a Telegram session string for the Telegram module.
 * You can use this session string to authenticate with your Telegram account.
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import * as readline from 'readline';
import * as path from 'path';

interface AuthConfig {
  apiId: number;
  apiHash: string;
  phoneNumber: string;
  password?: string;
}

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

  async getAuthConfig(): Promise<AuthConfig> {
    console.log('🔐 Telegram Authentication Setup');
    console.log('================================\n');

    console.log('To get your API credentials:');
    console.log('1. Go to https://my.telegram.org/apps');
    console.log('2. Log in with your Telegram account');
    console.log('3. Create a new application');
    console.log('4. Copy the API ID and API Hash\n');

    const apiId = await this.prompt('Enter your API ID: ');
    const apiHash = await this.promptSecret('Enter your API Hash: ');
    const phoneNumber = await this.prompt('Enter your phone number (with country code, e.g., +1234567890): ');

    return {
      apiId: parseInt(apiId),
      apiHash,
      phoneNumber,
    };
  }

  async authenticate(config: AuthConfig): Promise<string> {
    try {
      console.log('\n🔄 Connecting to Telegram...');

      // Create a new session
      const stringSession = new StringSession('');
      this.client = new TelegramClient(stringSession, config.apiId, config.apiHash, {
        connectionRetries: 5,
        timeout: 10000,
      });

      await this.client.start({
        phoneNumber: async () => config.phoneNumber,
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
      
      // Save session to .session file in project root
      const sessionPath = path.join(process.cwd(), '.session');
      const fs = await import('fs');
      
      try {
        fs.writeFileSync(sessionPath, sessionString, { mode: 0o600 }); // Secure permissions
        console.log('\n✅ Session saved to .session file');
        console.log('📁 Location:', sessionPath);
      } catch (error) {
        console.error('❌ Failed to save session file:', error);
        console.log('\n📋 Your session string (save manually):');
        console.log('========================');
        console.log(sessionString);
        console.log('========================\n');
      }

      console.log('\n💡 Session file usage:');
      console.log('• The .session file is automatically loaded by the Telegram module');
      console.log('• Keep this file secure and never commit it to version control');
      console.log('• If you move the project, copy the .session file to the new location');
      console.log('\n⚠️  Keep your session secure and private!');

      return sessionString;
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      throw error;
    }
  }

  async testConnection(sessionString: string): Promise<boolean> {
    try {
      console.log('\n🧪 Testing connection...');

      const stringSession = new StringSession(sessionString);
      const testClient = new TelegramClient(stringSession, 0, '', {
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
    // Check if session string is provided as argument
    const sessionString = process.argv[2];
    
    if (sessionString) {
      console.log('🧪 Testing provided session string...');
      const isValid = await auth.testConnection(sessionString);
      
      if (isValid) {
        console.log('✅ Session string is valid and working!');
        
        // Save to .session file
        const sessionPath = path.join(process.cwd(), '.session');
        const fs = await import('fs');
        
        try {
          fs.writeFileSync(sessionPath, sessionString, { mode: 0o600 });
          console.log('✅ Session saved to .session file');
          console.log('📁 Location:', sessionPath);
        } catch (error) {
          console.error('❌ Failed to save session file:', error);
        }
      } else {
        console.log('❌ Session string is invalid or expired');
        process.exit(1);
      }
    } else {
      // Interactive authentication
      const config = await auth.getAuthConfig();
      const sessionString = await auth.authenticate(config);
      
      // Test the generated session string
      const isValid = await auth.testConnection(sessionString);
      
      if (!isValid) {
        console.log('❌ Generated session string failed connection test');
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