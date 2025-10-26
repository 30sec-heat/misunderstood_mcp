#!/usr/bin/env tsx
// Script to analyze test logs and generate insights

import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  testName: string;
  suiteName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  timestamp: string;
  filePath: string;
  memoryUsage?: NodeJS.MemoryUsage;
  stackTrace?: string;
  retryCount?: number;
  tags?: string[];
}

interface TestRunData {
  testRun: {
    startTime: string;
    endTime?: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    cwd: string;
    env: string;
    metrics?: any;
  };
  results: TestResult[];
}

class TestLogAnalyzer {
  private logsDir: string;

  constructor() {
    this.logsDir = path.join(process.cwd(), 'logs');
  }

  async analyzeLatestRun(): Promise<void> {
    if (!fs.existsSync(this.logsDir)) {
      console.log('No logs directory found. Run tests first to generate logs.');
      return;
    }

    const jsonFiles = fs.readdirSync(this.logsDir)
      .filter(file => file.endsWith('.json'))
      .sort()
      .reverse();

    if (jsonFiles.length === 0) {
      console.log('No JSON log files found.');
      return;
    }

    const latestFile = jsonFiles[0];
    const filePath = path.join(this.logsDir, latestFile);
    
    console.log(`\n[DATA] Analyzing test run: ${latestFile}\n`);

    try {
      const data: TestRunData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      this.generateAnalysis(data);
    } catch (error) {
      console.error('Failed to parse log file:', error);
    }
  }

  private generateAnalysis(data: TestRunData): void {
    const results = data.results;
    
    console.log('[SEARCH] Test Run Overview');
    console.log('===================');
    console.log(`Start Time: ${data.testRun.startTime}`);
    console.log(`End Time: ${data.testRun.endTime || 'In Progress'}`);
    console.log(`Environment: ${data.testRun.env}`);
    console.log(`Platform: ${data.testRun.platform} (${data.testRun.arch})`);
    console.log(`Node Version: ${data.testRun.nodeVersion}`);
    
    if (data.testRun.metrics) {
      const metrics = data.testRun.metrics;
      console.log(`\nUP: Performance Metrics`);
      console.log('======================');
      console.log(`Total Tests: ${metrics.totalTests}`);
      console.log(`Success Rate: ${((metrics.passed / metrics.totalTests) * 100).toFixed(1)}%`);
      console.log(`Total Duration: ${metrics.totalDuration}ms`);
      console.log(`Average Duration: ${metrics.averageDuration.toFixed(1)}ms`);
      console.log(`Memory Peak: ${Math.round(metrics.memoryPeak / 1024 / 1024)}MB`);
    }

    // Analyze by tags
    this.analyzeByTags(results);
    
    // Analyze by modules
    this.analyzeByModules(results);
    
    // Analyze performance
    this.analyzePerformance(results);
    
    // Analyze failures
    this.analyzeFailures(results);
  }

  private analyzeByTags(results: TestResult[]): void {
    const tagStats = new Map<string, { total: number; passed: number; failed: number; skipped: number }>();
    
    results.forEach(result => {
      if (result.tags) {
        result.tags.forEach(tag => {
          if (!tagStats.has(tag)) {
            tagStats.set(tag, { total: 0, passed: 0, failed: 0, skipped: 0 });
          }
          const stats = tagStats.get(tag)!;
          stats.total++;
          if (result.status === 'PASS') stats.passed++;
          else if (result.status === 'FAIL') stats.failed++;
          else if (result.status === 'SKIP') stats.skipped++;
        });
      }
    });

    if (tagStats.size > 0) {
      console.log(`\n  Analysis by Tags`);
      console.log('===================');
      
      Array.from(tagStats.entries())
        .sort(([,a], [,b]) => b.total - a.total)
        .forEach(([tag, stats]) => {
          const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
          console.log(`${tag}: ${stats.total} tests (${successRate}% success)`);
        });
    }
  }

  private analyzeByModules(results: TestResult[]): void {
    const moduleStats = new Map<string, { total: number; passed: number; failed: number; avgDuration: number }>();
    
    results.forEach(result => {
      const moduleName = this.extractModuleName(result.filePath);
      if (!moduleStats.has(moduleName)) {
        moduleStats.set(moduleName, { total: 0, passed: 0, failed: 0, avgDuration: 0 });
      }
      const stats = moduleStats.get(moduleName)!;
      stats.total++;
      if (result.status === 'PASS') stats.passed++;
      else if (result.status === 'FAIL') stats.failed++;
      stats.avgDuration = (stats.avgDuration * (stats.total - 1) + result.duration) / stats.total;
    });

    console.log(`\n🧩 Analysis by Modules`);
    console.log('======================');
    
    Array.from(moduleStats.entries())
      .sort(([,a], [,b]) => b.total - a.total)
      .forEach(([module, stats]) => {
        const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
        console.log(`${module}: ${stats.total} tests (${successRate}% success, ${stats.avgDuration.toFixed(0)}ms avg)`);
      });
  }

  private analyzePerformance(results: TestResult[]): void {
    const sortedByDuration = [...results].sort((a, b) => b.duration - a.duration);
    const slowTests = sortedByDuration.slice(0, 5);
    
    console.log(`\nLIGHTNING: Performance Analysis`);
    console.log('======================');
    console.log('Slowest Tests:');
    
    slowTests.forEach((test, index) => {
      console.log(`${index + 1}. ${test.suiteName} > ${test.testName} (${test.duration}ms)`);
    });

    // Memory analysis
    const testsWithMemory = results.filter(r => r.memoryUsage);
    if (testsWithMemory.length > 0) {
      const avgMemory = testsWithMemory.reduce((sum, r) => sum + r.memoryUsage!.heapUsed, 0) / testsWithMemory.length;
      const maxMemory = Math.max(...testsWithMemory.map(r => r.memoryUsage!.heapUsed));
      
      console.log(`\nMemory Usage:`);
      console.log(`Average: ${Math.round(avgMemory / 1024 / 1024)}MB`);
      console.log(`Peak: ${Math.round(maxMemory / 1024 / 1024)}MB`);
    }
  }

  private analyzeFailures(results: TestResult[]): void {
    const failures = results.filter(r => r.status === 'FAIL');
    
    if (failures.length > 0) {
      console.log(`\n[ERROR] Failure Analysis`);
      console.log('===================');
      
      // Group by error type
      const errorTypes = new Map<string, number>();
      failures.forEach(failure => {
        if (failure.error) {
          const errorType = failure.error.split(':')[0] || 'Unknown';
          errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
        }
      });

      console.log('Common Error Types:');
      Array.from(errorTypes.entries())
        .sort(([,a], [,b]) => b - a)
        .forEach(([errorType, count]) => {
          console.log(`${errorType}: ${count} occurrences`);
        });

      console.log('\nFailed Tests:');
      failures.forEach(failure => {
        console.log(`• ${failure.suiteName} > ${failure.testName}`);
        if (failure.error) {
          console.log(`  Error: ${failure.error.substring(0, 100)}${failure.error.length > 100 ? '...' : ''}`);
        }
      });
    }
  }

  private extractModuleName(filePath: string): string {
    if (filePath.includes('/modules/')) {
      const parts = filePath.split('/modules/');
      if (parts.length > 1) {
        return parts[1].split('/')[0];
      }
    }
    
    const fileName = path.basename(filePath, '.test.ts');
    return fileName.replace(/\.(test|spec)$/, '');
  }

  async compareRuns(run1?: string, run2?: string): Promise<void> {
    // Implementation for comparing two test runs
    console.log('Test run comparison feature - coming soon!');
  }

  async generateReport(): Promise<void> {
    // Implementation for generating detailed HTML/PDF reports
    console.log('Detailed report generation feature - coming soon!');
  }
}

// CLI interface
async function main() {
  const analyzer = new TestLogAnalyzer();
  const command = process.argv[2];

  switch (command) {
    case 'analyze':
    case undefined:
      await analyzer.analyzeLatestRun();
      break;
    case 'compare':
      await analyzer.compareRuns(process.argv[3], process.argv[4]);
      break;
    case 'report':
      await analyzer.generateReport();
      break;
    default:
      console.log('Usage: tsx scripts/analyze-test-logs.ts [analyze|compare|report]');
      console.log('  analyze (default): Analyze the latest test run');
      console.log('  compare <run1> <run2>: Compare two test runs');
      console.log('  report: Generate detailed report');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { TestLogAnalyzer };
