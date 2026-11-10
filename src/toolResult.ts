export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export function toText(result: unknown): ToolResult {
  const text = result === undefined ? 'OK (empty response)' : JSON.stringify(result, null, 2);
  return { content: [{ type: 'text', text }] };
}

export function toError(message: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}
