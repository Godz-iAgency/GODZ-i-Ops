type ApiErrorBody = {
  error?: string;
  message?: string;
};

export async function readApiJson<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(`${fallback} (server returned HTTP ${response.status})`);
      }
      throw new Error("The server returned an unreadable response. Please refresh and try again.");
    }
  }

  if (!response.ok) {
    const body = (payload || {}) as ApiErrorBody;
    throw new Error(body.error || body.message || `${fallback} (HTTP ${response.status})`);
  }

  if (payload == null) {
    throw new Error("The server returned an empty response. Please refresh and try again.");
  }

  return payload as T;
}
