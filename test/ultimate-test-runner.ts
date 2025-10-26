#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

interface TestResult {
  file: string;
  status: 'passed' | 'failed' | 'timeout' | 'error' | 'skipped';
  duration: number;
  error?: string;
  details?: string;
  testCount?: number;
  passedCount?: number;
  failedCount?: number;
}

class UltimateTestRunner {
  private results: TestResult[] = [];
  private totalTests = 0;
  private passedTests = 0;
  private failedTests = 0;
  private timeoutTests = 0;
  private errorTests = 0;
  private skippedTests = 0;
  private startTime = Date.now();

  async runAllTests(): Promise<void> {
    console.log('[LAUNCH] ULTIMATE TEST RUNNER - Safe Sequential Execution');
    console.log('=' .repeat(60));
    console.log(`⏰ Started: ${new Date().toLocaleString()}`);
    console.log('[SECURE]  Features: Memory limits, timeouts, detailed errors');
    console.log('=' .repeat(60));
    
    const testFiles = this.findAllTestFiles('tests');
    this.totalTests = testFiles.length;
    
    console.log(`\n[DATA] Found ${this.totalTests} test files\n`);
    
    for (let i = 0; i < testFiles.length; i++) {
      const testFile = testFiles[i];
      const progress = `[${i + 1}/${this.totalTests}]`;
      
      console.log(`${progress} [TEST] ${testFile}`);
      
      const result = await this.runSingleTestUltimate(testFile);
      this.results.push(result);
      
      this.updateCounters(result);
      this.printResult(result, progress);
      
      // System recovery delay
      await this.delay(800);
    }
    
    this.printUltimateSummary();
    this.saveResults();
  }

  private findAllTestFiles(dir: string, files: string[] = []): string[] {
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        try {
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            this.findAllTestFiles(fullPath, files);
          } else if (item.endsWith('.test.ts') && !item.includes('sample') && !item.includes('simple') && !item.includes('basic')) {
            files.push(fullPath);
          }
        } catch (error) {
          console.log(`[WARNING]  Skipping ${fullPath}: ${error}`);
        }
      }
    } catch (error) {
      console.log(`[WARNING]  Cannot read directory ${dir}: ${error}`);
    }
    
    return files.sort();
  }

  private async runSingleTestUltimate(testFile: string): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Check if file exists and is readable
      try {
        statSync(testFile);
      } catch (error) {
        return {
          file: testFile,
          status: 'skipped',
          duration: Date.now() - startTime,
          error: 'File not accessible',
          details: 'File may not exist or is not readable'
        };
      }

      // Run Jest with ultra-safe settings
      const command = `timeout 40s npx jest "${testFile}" --runInBand --forceExit --detectOpenHandles --silent --no-cache --maxWorkers=1 --verbose --json`;
      
      const result = execSync(command, {
        stdio: 'pipe',
        timeout: 45000, // 45 second timeout
        env: {
          ...process.env,
          NODE_OPTIONS: '--max-old-space-size=512', // Very low memory
          JEST_WORKER_ID: '1',
          CI: 'true' // Disable interactive features
        },
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 // 1MB buffer limit
      });
      
      const duration = Date.now() - startTime;
      
      // Parse Jest JSON output
      try {
        const jestResult = JSON.parse(result);
        
        if (jestResult.success === false) {
          const testResults = jestResult.testResults?.[0];
          const failureMessages = testResults?.failureMessages || [];
          const assertionResults = testResults?.assertionResults || [];
          
          const failedTests = assertionResults.filter((t: any) => t.status === 'failed');
          const passedTests = assertionResults.filter((t: any) => t.status === 'passed');
          
          let errorMessage = 'Test failures';
          let details = `${failedTests.length} failed, ${passedTests.length} passed`;
          
          if (failureMessages.length > 0) {
            const firstFailure = failureMessages[0];
            // Extract meaningful error from Jest output
            const lines = firstFailure.split('\n');
            const errorLine = lines.find(line => 
              line.includes('Error:') || 
              line.includes('expect(') ||
              line.includes('TypeError') ||
              line.includes('ReferenceError')
            );
            
            if (errorLine) {
              errorMessage = errorLine.trim().substring(0, 100);
            }
            
            details = firstFailure.substring(0, 200);
          }
          
          return {
            file: testFile,
            status: 'failed',
            duration,
            error: errorMessage,
            details,
            testCount: assertionResults.length,
            passedCount: passedTests.length,
            failedCount: failedTests.length
          };
        }
        
        const testResults = jestResult.testResults?.[0];
        const assertionResults = testResults?.assertionResults || [];
        const passedTests = assertionResults.filter((t: any) => t.status === 'passed');
        
        return {
          file: testFile,
          status: 'passed',
          duration,
          details: `All ${passedTests.length} tests passed`,
          testCount: assertionResults.length,
          passedCount: passedTests.length,
          failedCount: 0
        };
        
      } catch (parseError) {
        // If JSON parsing fails but command succeeded, assume pass
        return {
          file: testFile,
          status: 'passed',
          duration,
          details: 'Tests passed (JSON parse failed)',
          error: 'Could not parse Jest output'
        };
      }
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Handle timeout
      if (duration >= 40000 || error.signal === 'SIGTERM') {
        return {
          file: testFile,
          status: 'timeout',
          duration,
          error: 'Test exceeded 40 second timeout',
          details: 'Consider optimizing test performance'
        };
      }
      
      // Parse error details
      const stderr = error.stderr?.toString() || '';
      const stdout = error.stdout?.toString() || '';
      
      let errorType = 'Unknown Error';
      let details = 'No additional details available';
      
      if (stderr) {
        const errorLines = stderr.split('\n').filter(line => line.trim());
        
        // Categorize errors
        if (stderr.includes('SyntaxError')) {
          errorType = 'Syntax Error';
          const syntaxLine = errorLines.find(line => line.includes('SyntaxError'));
          details = syntaxLine?.substring(0, 150) || 'Syntax error in test file';
        } else if (stderr.includes('Cannot find module')) {
          errorType = 'Module Not Found';
          const moduleLine = errorLines.find(line => line.includes('Cannot find module'));
          details = moduleLine?.substring(0, 150) || 'Missing module dependency';
        } else if (stderr.includes('TypeError')) {
          errorType = 'Type Error';
          const typeLine = errorLines.find(line => line.includes('TypeError'));
          details = typeLine?.substring(0, 150) || 'Type-related error';
        } else if (stderr.includes('ReferenceError')) {
          errorType = 'Reference Error';
          const refLine = errorLines.find(line => line.includes('ReferenceError'));
          details = refLine?.substring(0, 150) || 'Undefined reference';
        } else if (stderr.includes('ENOENT')) {
          errorType = 'File Not Found';
          details = 'Test file or dependency not found';
        } else {
          // Generic error handling
          const relevantLine = errorLines.find(line => 
            line.includes('Error') || 
            line.includes('FAIL') ||
            line.includes('✖')
          );
          
          if (relevantLine) {
            details = relevantLine.substring(0, 150);
          }
        }
      }
      
      return {
        file: testFile,
        status: 'error',
        duration,
        error: errorType,
        details
      };
    }
  }

  private updateCounters(result: TestResult): void {
    switch (result.status) {
      case 'passed': this.passedTests++; break;
      case 'failed': this.failedTests++; break;
      case 'timeout': this.timeoutTests++; break;
      case 'error': this.errorTests++; break;
      case 'skipped': this.skippedTests++; break;
    }
  }

  private printResult(result: TestResult, progress: string): void {
    const duration = `${result.duration}ms`;
    
    switch (result.status) {
      case 'passed':
        console.log(`   [SUCCESS] PASSED (${duration}) - ${result.details}`);
        break;
      case 'failed':
        console.log(`   [ERROR] FAILED (${duration}) - ${result.error}`);
        console.log(`      [WRITE] ${result.details}`);
        if (result.testCount) {
          console.log(`      [DATA] ${result.passedCount}/${result.testCount} tests passed`);
        }
        break;
      case 'timeout':
        console.log(`   ⏰ TIMEOUT (${duration}) - ${result.error}`);
        console.log(`      [INFO] ${result.details}`);
        break;
      case 'error':
        console.log(`   💥 ERROR (${duration}) - ${result.error}`);
        console.log(`      [WRITE] ${result.details}`);
        break;
      case 'skipped':
        console.log(`   ⏭  SKIPPED - ${result.error}`);
        break;
    }
    console.log('');
  }

  private printUltimateSummary(): void {
    const totalDuration = Date.now() - this.startTime;
    const minutes = Math.floor(totalDuration / 60000);
    const seconds = Math.floor((totalDuration % 60000) / 1000);
    
    console.log('\n' + '='.repeat(80));
    console.log(' ULTIMATE TEST EXECUTION SUMMARY');
    console.log('='.repeat(80));
    
    console.log(`⏰ Total Time: ${minutes}m ${seconds}s`);
    console.log(`[DATA] Total Files: ${this.totalTests}`);
    console.log(`[SUCCESS] Passed: ${this.passedTests} (${this.percentage(this.passedTests)}%)`);
    console.log(`[ERROR] Failed: ${this.failedTests} (${this.percentage(this.failedTests)}%)`);
    console.log(`⏰ Timeouts: ${this.timeoutTests} (${this.percentage(this.timeoutTests)}%)`);
    console.log(`💥 Errors: ${this.errorTests} (${this.percentage(this.errorTests)}%)`);
    console.log(`⏭  Skipped: ${this.skippedTests} (${this.percentage(this.skippedTests)}%)`);
    
    // Success rate
    const successRate = this.percentage(this.passedTests);
    if (successRate >= 80) {
      console.log(`\n[COMPLETE] Great job! ${successRate}% success rate`);
    } else if (successRate >= 50) {
      console.log(`\n👍 Good progress! ${successRate}% success rate`);
    } else {
      console.log(`\n[SETUP] Needs work. ${successRate}% success rate`);
    }
    
    // Error breakdown
    this.printErrorBreakdown();
    
    // Top failures
    this.printTopFailures();
    
    console.log('\n[INFO] NEXT STEPS:');
    if (this.errorTests > 0) {
      console.log('   • Fix syntax and import errors first');
    }
    if (this.failedTests > 0) {
      console.log('   • Review failing test logic and assertions');
    }
    if (this.timeoutTests > 0) {
      console.log('   • Optimize slow tests or mock external calls');
    }
    
    console.log('\n Detailed results: test-results.json');
    console.log('[SETUP] Run single test: npx jest "path/to/test.ts" --runInBand');
    console.log('='.repeat(80));
  }

  private percentage(count: number): string {
    return this.totalTests > 0 ? ((count / this.totalTests) * 100).toFixed(1) : '0.0';
  }

  private printErrorBreakdown(): void {
    const errorTypes: Record<string, number> = {};
    
    this.results.forEach(result => {
      if (result.status === 'error' || result.status === 'failed') {
        const errorType = result.error || 'Unknown';
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      }
    });
    
    if (Object.keys(errorTypes).length > 0) {
      console.log('\n[LIST] ERROR BREAKDOWN:');
      Object.entries(errorTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([error, count]) => {
          console.log(`   ${error}: ${count} files`);
        });
    }
  }

  private printTopFailures(): void {
    const failures = this.results.filter(r => r.status === 'failed' || r.status === 'error');
    
    if (failures.length > 0) {
      console.log('\n[SEARCH] TOP FAILURES:');
      failures.slice(0, 5).forEach((failure, index) => {
        console.log(`\n${index + 1}. ${failure.file}`);
        console.log(`   ${failure.error}`);
        if (failure.details) {
          console.log(`   ${failure.details.substring(0, 100)}...`);
        }
      });
    }
  }

  private saveResults(): void {
    const summary = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      summary: {
        total: this.totalTests,
        passed: this.passedTests,
        failed: this.failedTests,
        timeouts: this.timeoutTests,
        errors: this.errorTests,
        skipped: this.skippedTests
      },
      results: this.results
    };
    
    writeFileSync('test-results.json', JSON.stringify(summary, null, 2));
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runSpecificTests(patterns: string[]): Promise<void> {
    console.log('[TARGET] Running specific test patterns...\n');
    
    const allTestFiles = this.findAllTestFiles('tests');
    const matchingFiles = allTestFiles.filter(file => 
      patterns.some(pattern => file.toLowerCase().includes(pattern.toLowerCase()))
    );
    
    if (matchingFiles.length === 0) {
      console.log('[ERROR] No test files found matching patterns:', patterns);
      return;
    }
    
    this.totalTests = matchingFiles.length;
    console.log(`[DATA] Found ${this.totalTests} matching files\n`);
    
    for (let i = 0; i < matchingFiles.length; i++) {
      const testFile = matchingFiles[i];
      const progress = `[${i + 1}/${this.totalTests}]`;
      
      console.log(`${progress} [TEST] ${testFile}`);
      
      const result = await this.runSingleTestUltimate(testFile);
      this.results.push(result);
      
      this.updateCounters(result);
      this.printResult(result, progress);
      
      await this.delay(800);
    }
    
    this.printUltimateSummary();
    this.saveResults();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const runner = new UltimateTestRunner();
  
  if (args.length === 0) {
    await runner.runAllTests();
  } else {
    await runner.runSpecificTests(args);
  }
}

process.on('SIGINT', () => {
  console.log('\n\n[WARNING]  Test execution interrupted by user');
  process.exit(130);
});

main().catch(error => {
  console.error('[ERROR] Ultimate test runner failed:', error);
  process.exit(1);
});
