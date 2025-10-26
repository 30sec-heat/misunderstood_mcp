import { BaseCryptoModule } from '../src/modules/base/module.js';

export class TestModule extends BaseCryptoModule {
  name = 'test';

  protected setupTools() {
    this.addTool({
      name: 'test_ping',
      description: 'Simple test tool that returns a ping response',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Optional message to include in response',
            default: 'pong'
          }
        }
      },
      handler: this.ping.bind(this)
    });

    this.addTool({
      name: 'test_echo',
      description: 'Echo back the input parameters',
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text to echo back'
          }
        },
        required: ['text']
      },
      handler: this.echo.bind(this)
    });
  }

  async initialize(): Promise<void> {
    await super.initialize();
  }

  private async ping(args: any) {
    const message = args.message || 'pong';
    return {
      status: 'success',
      message: message,
      timestamp: new Date().toISOString(),
      module: this.name
    };
  }

  private async echo(args: any) {
    return {
      status: 'success',
      echoed: args.text,
      timestamp: new Date().toISOString(),
      module: this.name
    };
  }
}
