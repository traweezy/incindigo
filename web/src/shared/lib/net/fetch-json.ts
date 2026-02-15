export class HttpError extends Error {
  public readonly status: number;
  public readonly payload: unknown;

  public constructor(status: number, payload: unknown, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.payload = payload;
  }
}

export const fetchJson = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 8_000
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");

    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers
    });

    const isJSON = response.headers.get("content-type")?.includes("application/json") ?? false;
    const payload = isJSON ? ((await response.json()) as unknown) : null;

    if (!response.ok) {
      throw new HttpError(
        response.status,
        payload,
        `Request failed with status ${String(response.status)}`
      );
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
};
