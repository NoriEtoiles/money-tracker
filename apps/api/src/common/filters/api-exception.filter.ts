import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";

type ErrorDetail = {
  field?: string;
  message: string;
};

type HttpErrorResponse = {
  message?: string | string[];
  error?: string;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = exception instanceof HttpException ? exception.getResponse() : undefined;
    const normalized = this.normalizeResponse(responseBody, status);
    const requestIdHeader = request.headers?.["x-request-id"];
    const requestId = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;

    response.status(status).json({
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details,
        requestId: requestId ?? null
      }
    });
  }

  private normalizeResponse(
    responseBody: string | object | undefined,
    status: number
  ): { code: string; message: string; details: ErrorDetail[] } {
    if (typeof responseBody === "string") {
      return {
        code: this.codeFromStatus(status),
        details: [],
        message: responseBody
      };
    }

    const body = responseBody as HttpErrorResponse | undefined;
    const message = body?.message;
    const details = Array.isArray(message)
      ? message.map((item) => ({ message: item }))
      : [];

    return {
      code: this.codeFromStatus(status),
      details,
      message: typeof message === "string"
        ? message
        : body?.error ?? "Unexpected server error"
    };
  }

  private codeFromStatus(status: number): string {
    if (status === HttpStatus.BAD_REQUEST) {
      return "VALIDATION_ERROR";
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      return "UNAUTHORIZED";
    }

    if (status === HttpStatus.FORBIDDEN) {
      return "FORBIDDEN";
    }

    if (status === HttpStatus.NOT_FOUND) {
      return "NOT_FOUND";
    }

    return status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR";
  }
}
