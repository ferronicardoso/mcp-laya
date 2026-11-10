export function toText(result) {
    const text = result === undefined ? 'OK (empty response)' : JSON.stringify(result, null, 2);
    return { content: [{ type: 'text', text }] };
}
export function toError(message) {
    return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}
//# sourceMappingURL=toolResult.js.map