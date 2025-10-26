/**
 * MCP Response Wrapper
 * Converts plain object responses to MCP-compliant format
 */

export function wrapMCPResponse(data: any): any {
  // If already in MCP format, return as-is
  if (data && data.content && Array.isArray(data.content)) {
    return data;
  }

  // Convert plain object to MCP format
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' 
          ? data 
          : JSON.stringify(data, null, 2)
      }
    ]
  };
}

/**
 * Wrapper for tool handlers to ensure MCP-compliant responses
 */
export function createMCPHandler(handler: (args: any) => Promise<any>) {
  return async (args: any) => {
    try {
      const result = await handler(args);
      return wrapMCPResponse(result);
    } catch (error) {
      return wrapMCPResponse({
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Tool execution failed'
      });
    }
  };
}
