import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import {
  generateRequestId,
  getSafeRequestIdFromHeaders,
  RequestWithRequestId,
  requestIdHeaderName
} from "../request-id/request-id";

type ErrorDetail = {
  field?: string;
  message: string;
};

type HttpErrorResponse = {
  message?: string | string[];
  error?: string;
};

type ErrorResponseWriter = {
  setHeader: (name: string, value: string) => void;
  status: (status: number) => {
    json: (body: unknown) => void;
  };
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<ErrorResponseWriter>();
    const request = context.getRequest<RequestWithRequestId>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = exception instanceof HttpException ? exception.getResponse() : undefined;
    const normalized = this.normalizeResponse(responseBody, status);
    const requestId = request.requestId ?? getSafeRequestIdFromHeaders(request.headers) ?? generateRequestId();

    response.setHeader(requestIdHeaderName, requestId);

    response.status(status).json({
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details,
        requestId
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
