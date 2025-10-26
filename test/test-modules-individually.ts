#!/usr/bin/env tsx

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface TestResult {
  module: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  testsRun?: number;
  testsPassed?: number;
  testsFailed?: number;
  logFile?: string;
  output?: string;
}

class ModuleTester {
  private results: TestResult[] = [];
  private readonly testsDir = 'tests';
  private readonly timeout = 0; // No timeout

  constructor() {
    console.log('[TEST] Module-by-Module Test Runner');
    console.log('================================\n');
  }

  private getModules(): string[] {
    const modules: string[] = [];
    
    if (fs.existsSync(this.testsDir)) {
      const entries = fs.readdirSync(this.testsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          modules.push(entry.name);
        } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
          // Handle standalone test files
          const moduleName = entry.name.replace('.test.ts', '');
          modules.push(moduleName);
        }
      }
    }
    
    return modules.sort();
  }

  private async testModule(moduleName: string): Promise<TestResult> {
    const startTime = Date.now();
    const modulePath = path.join(this.testsDir, moduleName);
    const standaloneTestFile = path.join(this.testsDir, `${moduleName}.test.ts`);
    
    console.log(`\n[SEARCH] Testing module: ${moduleName}`);
    console.log(` Path: ${modulePath}`);
    
    let testFiles: string[] = [];
    
    // Check if it's a standalone test file
    if (fs.existsSync(standaloneTestFile)) {
      testFiles = [`${moduleName}.test.ts`];
      console.log(` Found standalone test file: ${moduleName}.test.ts`);
    }
    // Check if module directory exists
    else if (fs.existsSync(modulePath)) {
      testFiles = this.findTestFiles(modulePath);
      console.log(` Found ${testFiles.length} test file(s) in directory:`);
      testFiles.forEach(file => console.log(`   - ${file}`));
    }
    else {
      return {
        module: moduleName,
        status: 'SKIP',
        duration: 0,
        error: 'Module directory or standalone test file not found'
      };
    }
    
    if (testFiles.length === 0) {
      return {
        module: moduleName,
        status: 'SKIP',
        duration: 0,
        error: 'No test files found'
      };
    }

    // Create logs directory in the module's test folder
    const moduleTestDir = path.join(this.testsDir, moduleName);
    const logsDir = path.join(moduleTestDir, 'test-results');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Generate log filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(logsDir, `test-results-${timestamp}.log`);
    
    try {
      // Run tests for this module
      const testPattern = testFiles.map(file => {
        if (file === `${moduleName}.test.ts`) {
          return `tests/${file}`;
        } else {
          return `tests/${moduleName}/${file}`;
        }
      }).join(' ');
      const command = `npx tsx node_modules/mocha/bin/_mocha ${testPattern} --require tests/mocha-setup.ts`;
      
      console.log(`[LAUNCH] Running: ${command}`);
      console.log(`[WRITE] Logging to: ${logFile}`);
      
      const output = execSync(command, { 
        encoding: 'utf8',
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      
      const duration = Date.now() - startTime;
      
      // Save full output to log file
      const logContent = `Test Run for Module: ${moduleName}
Timestamp: ${new Date().toISOString()}
Duration: ${duration}ms
Command: ${command}

=== OUTPUT ===
${output}

=== END OF OUTPUT ===
`;
      
      fs.writeFileSync(logFile, logContent);
      
      // Parse output to count tests
      const testsRun = this.parseTestCount(output);
      
      console.log(`[SUCCESS] ${moduleName} completed successfully`);
      console.log(`⏱  Duration: ${duration}ms`);
      console.log(`[WRITE] Log saved: ${logFile}`);
      
      return {
        module: moduleName,
        status: 'PASS',
        duration,
        testsRun: testsRun.total,
        testsPassed: testsRun.passed,
        testsFailed: testsRun.failed,
        logFile,
        output
      };
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.stdout || error.message || 'Unknown error';
      const fullOutput = error.stdout || '';
      
      // Save error output to log file
      const logContent = `Test Run for Module: ${moduleName}
Timestamp: ${new Date().toISOString()}
Duration: ${duration}ms
Status: FAILED
Command: npx tsx node_modules/mocha/bin/_mocha ${testFiles.map(file => `tests/${moduleName}/${file}`).join(' ')} --require tests/mocha-setup.ts

=== ERROR OUTPUT ===
${fullOutput}

=== ERROR MESSAGE ===
${error.message}

=== END OF OUTPUT ===
`;
      
      fs.writeFileSync(logFile, logContent);
      
      console.log(`[ERROR] ${moduleName} failed`);
      console.log(`⏱  Duration: ${duration}ms`);
      console.log(`[WRITE] Error log saved: ${logFile}`);
      console.log(`💥 Error: ${errorMessage.substring(0, 200)}...`);
      
      return {
        module: moduleName,
        status: 'FAIL',
        duration,
        error: errorMessage,
        testsRun: 0,
        testsPassed: 0,
        testsFailed: 1,
        logFile,
        output: fullOutput
      };
    }
  }

  private findTestFiles(modulePath: string): string[] {
    const testFiles: string[] = [];
    
    const scanDirectory = (dir: string, relativePath: string = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativeFilePath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          scanDirectory(fullPath, relativeFilePath);
        } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
          testFiles.push(relativeFilePath);
        }
      }
    };
    
    scanDirectory(modulePath);
    return testFiles;
  }

  private parseTestCount(output: string): { total: number; passed: number; failed: number } {
    const lines = output.split('\n');
    let total = 0;
    let passed = 0;
    let failed = 0;
    
    for (const line of lines) {
      if (line.includes('passing') || line.includes('failing')) {
        const match = line.match(/(\d+)\s+passing.*?(\d+)\s+failing/);
        if (match) {
          passed = parseInt(match[1]);
          failed = parseInt(match[2]);
          total = passed + failed;
        }
      }
    }
    
    return { total, passed, failed };
  }

  private printSummary() {
    console.log('\n[DATA] Test Summary');
    console.log('================');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;
    
    console.log(`Total modules: ${total}`);
    console.log(`[SUCCESS] Passed: ${passed}`);
    console.log(`[ERROR] Failed: ${failed}`);
    console.log(`⏭  Skipped: ${skipped}`);
    
    console.log('\n[LIST] Detailed Results:');
    console.log('====================');
    
    this.results.forEach(result => {
      const statusIcon = result.status === 'PASS' ? 'SUCCESS:' : 
                        result.status === 'FAIL' ? 'ERROR:' : '⏭';
      
      console.log(`${statusIcon} ${result.module.padEnd(20)} | ${result.duration.toString().padStart(6)}ms | ${result.status}`);
      
      if (result.testsRun !== undefined) {
        console.log(`   └─ Tests: ${result.testsPassed}/${result.testsRun} passed`);
      }
      
      if (result.logFile) {
        console.log(`   └─ Log: ${result.logFile}`);
      }
      
      if (result.error) {
        console.log(`   └─ Error: ${result.error.substring(0, 100)}...`);
      }
    });
    
    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-results-${timestamp}.json`;
    
    fs.writeFileSync(filename, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: { total, passed, failed, skipped },
      results: this.results
    }, null, 2));
    
    console.log(`\n💾 Results saved to: ${filename}`);
  }

  async runAll(): Promise<void> {
    const modules = this.getModules();
    
    console.log(`Found ${modules.length} modules to test:`);
    modules.forEach(module => console.log(`  - ${module}`));
    
    for (const module of modules) {
      const result = await this.testModule(module);
      this.results.push(result);
      
      // Small delay between modules
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    this.printSummary();
  }

  async runSpecific(moduleName: string): Promise<void> {
    console.log(`Testing specific module: ${moduleName}`);
    
    const result = await this.testModule(moduleName);
    this.results.push(result);
    
    this.printSummary();
  }
}

// Main execution
async function main() {
  const tester = new ModuleTester();
  
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // Test specific module
    await tester.runSpecific(args[0]);
  } else {
    // Test all modules
    await tester.runAll();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ModuleTester };
