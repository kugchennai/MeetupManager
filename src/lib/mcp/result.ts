export function mcpJson(data: unknown, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
    isError,
  };
}

export function mcpError(message: string, status?: number) {
  return mcpJson(status ? { error: message, status } : { error: message }, true);
}
