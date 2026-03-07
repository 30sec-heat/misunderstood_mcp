#!/usr/bin/env node

/**
 * MCP Configuration Validator
 * 
 * This script validates the MCP configuration for Cursor IDE and tests
 * that the server can start correctly.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 MCP Configuration Validator\n');

// Check if .cursor/mcp.json exists
const mcpConfigPath = path.join(__dirname, '.cursor', 'mcp.json');
if (!fs.existsSync(mcpConfigPath)) {
  console.error('❌ .cursor/mcp.json not found');
  console.log('💡 Run this script from the project root directory');
  process.exit(1);
}

console.log('✅ Found .cursor/mcp.json');

// Validate JSON syntax
let config;
try {
  const configContent = fs.readFileSync(mcpConfigPath, 'utf8');
  config = JSON.parse(configContent);
  console.log('✅ JSON syntax is valid');
} catch (error) {
  console.error('❌ Invalid JSON syntax:', error.message);
  process.exit(1);
}

// Check required fields
if (!config.mcpServers) {
  console.error('❌ Missing mcpServers field');
  process.exit(1);
}

const servers = Object.keys(config.mcpServers);
if (servers.length === 0) {
  console.error('❌ No MCP servers configured');
  process.exit(1);
}

console.log(`✅ Found ${servers.length} MCP server(s): ${servers.join(', ')}`);

// Validate each server configuration
for (const serverName of servers) {
  const server = config.mcpServers[serverName];
  console.log(`\n🔍 Validating server: ${serverName}`);
  
  if (!server.command) {
    console.error(`❌ Missing command for server ${serverName}`);
    continue;
  }
  
  if (!server.args || !Array.isArray(server.args)) {
    console.error(`❌ Missing or invalid args for server ${serverName}`);
    continue;
  }
  
  if (!server.cwd) {
    console.error(`❌ Missing cwd (working directory) for server ${serverName}`);
    continue;
  }
  
  // Check if working directory exists
  if (!fs.existsSync(server.cwd)) {
    console.error(`❌ Working directory does not exist: ${server.cwd}`);
    continue;
  }
  
  console.log(`✅ Server ${serverName} configuration is valid`);
  
  // Check if package.json exists in working directory
  const packageJsonPath = path.join(server.cwd, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.warn(`⚠️  No package.json found in ${server.cwd}`);
    continue;
  }
  
  // Check if the npm script exists
  if (server.command === 'npm' && server.args[0] === 'run') {
    const scriptName = server.args[1];
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (!packageJson.scripts || !packageJson.scripts[scriptName]) {
        console.error(`❌ npm script "${scriptName}" not found in package.json`);
        continue;
      }
      console.log(`✅ npm script "${scriptName}" exists`);
    } catch (error) {
      console.error(`❌ Error reading package.json: ${error.message}`);
      continue;
    }
  }
  
  // Test server startup (only for enabled servers)
  if (!server.disabled) {
    console.log(`🧪 Testing server startup for ${serverName}...`);
    
    const testProcess = spawn(server.command, server.args, {
      cwd: server.cwd,
      env: { ...process.env, ...server.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    testProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Give the server 5 seconds to start
    setTimeout(() => {
      testProcess.kill('SIGTERM');
    }, 5000);
    
    await new Promise((resolve) => {
      testProcess.on('close', (code) => {
        if (output.includes('MCP Crypto Server started successfully')) {
          console.log(`✅ Server ${serverName} starts successfully`);
        } else if (code === null || code === 0) {
          console.log(`✅ Server ${serverName} started (killed after 5s test)`);
        } else {
          console.error(`❌ Server ${serverName} failed to start (exit code: ${code})`);
          if (errorOutput) {
            console.error('Error output:', errorOutput.slice(0, 500));
          }
        }
        resolve();
      });
    });
  } else {
    console.log(`⏸️  Server ${serverName} is disabled, skipping startup test`);
  }
}

console.log('\n🎉 MCP Configuration validation complete!');
console.log('\n📋 Next steps:');
console.log('1. Restart Cursor IDE');
console.log('2. Start a new AI chat');
console.log('3. Ask about available crypto tools');
console.log('4. Check CURSOR_MCP_SETUP.md for detailed usage instructions');