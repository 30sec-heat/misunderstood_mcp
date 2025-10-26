// Base class for all technical indicators
export class BaseIndicator {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  // Abstract method - must be implemented by subclasses
  async calculate(data: any[], params: any, symbol: string, interval: string, startDate?: string | null): Promise<any> {
    throw new Error(`calculate method must be implemented by ${this.constructor.name}`);
  }

  // Abstract method - must be implemented by subclasses
  validateParams(params: any): void {
    throw new Error(`validateParams method must be implemented by ${this.constructor.name}`);
  }

  // Helper method to validate data
  validateData(data: any[]): void {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Data must be a non-empty array');
    }
    
    // Check if data has required OHLCV properties
    const requiredProps = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
    const firstCandle = data[0];
    
    for (const prop of requiredProps) {
      if (!(prop in firstCandle)) {
        throw new Error(`Data missing required property: ${prop}`);
      }
    }
  }

  // Helper method to validate period parameter
  validatePeriod(period: number, minPeriod: number = 1, maxPeriod: number = 200): void {
    if (!Number.isInteger(period) || period < minPeriod || period > maxPeriod) {
      throw new Error(`Period must be an integer between ${minPeriod} and ${maxPeriod}`);
    }
  }

  // Helper method to validate array of periods
  validatePeriods(periods: number[], minPeriod: number = 1, maxPeriod: number = 200): void {
    if (!Array.isArray(periods) || periods.length === 0) {
      throw new Error('Periods must be a non-empty array');
    }
    
    for (const period of periods) {
      this.validatePeriod(period, minPeriod, maxPeriod);
    }
  }
}
