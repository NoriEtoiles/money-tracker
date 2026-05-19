const fallbackBaseUrl = "http://localhost:3001/api/v1";

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? fallbackBaseUrl;
}

export function createApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${getApiBaseUrl()}${normalizedPath}`;
}
