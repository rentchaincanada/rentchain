export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "VALIDATION_ERROR"
  | "MISSING_CREDENTIALS"
  | "INVALID_CREDENTIALS"
  | "LIMIT_REACHED";

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  details?: any;
  expose: boolean;

  constructor(status: number, code: ApiErrorCode, message: string, details?: any, expose = true) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = expose;
  }
}

export const badRequest = (code: ApiErrorCode, message: string, details?: any) =>
  new ApiError(400, code, message, details, true);

export const unauthorized = (code: ApiErrorCode = "UNAUTHORIZED", message = "Unauthorized") =>
  new ApiError(401, code, message, undefined, true);

export const forbidden = (code: ApiErrorCode = "FORBIDDEN", message = "Forbidden") =>
  new ApiError(403, code, message, undefined, true);

export const notFound = (message = "Not Found") =>
  new ApiError(404, "NOT_FOUND", message, undefined, true);

export const conflict = (message = "Conflict", details?: any) =>
  new ApiError(409, "CONFLICT", message, details, true);

export const internal = (message = "Internal Server Error", details?: any) =>
  new ApiError(500, "INTERNAL", message, details, false);
