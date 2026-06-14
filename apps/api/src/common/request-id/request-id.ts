import { randomUUID } from "node:crypto";

export const requestIdHeaderName = "X-Request-Id";

export type RequestWithRequestId = {
  headers?: Record<string, string | string[] | undefined>;
  requestId?: string;
};

type ResponseWithHeaders = {
  setHeader: (name: string, value: string) => void;
};

type NextFunction = () => void;

const maxRequestIdLength = 64;
const safeRequestIdPattern = /^[A-Za-z0-9._-]+$/;

export function requestIdMiddleware(
  request: RequestWithRequestId,
  response: ResponseWithHeaders,
  next: NextFunction
): void {
  const requestId = getSafeRequestIdFromHeaders(request.headers) ?? generateRequestId();

  request.requestId = requestId;
  response.setHeader(requestIdHeaderName, requestId);
  next();
}

export function getSafeRequestIdFromHeaders(
  headers: RequestWithRequestId["headers"]
): string | undefined {
  const header = headers?.["x-request-id"] ?? headers?.[requestIdHeaderName];
  const candidate = Array.isArray(header) ? header[0] : header;

  return isSafeRequestId(candidate) ? candidate : undefined;
}

export function isSafeRequestId(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxRequestIdLength &&
    safeRequestIdPattern.test(value);
}

export function generateRequestId(): string {
  return `req_${randomUUID()}`;
}
