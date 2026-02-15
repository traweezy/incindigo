const apiBaseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "";

export const toAPIURL = (path: string): string => {
  if (apiBaseURL.length === 0) {
    return path;
  }

  return new URL(path, apiBaseURL).toString();
};
