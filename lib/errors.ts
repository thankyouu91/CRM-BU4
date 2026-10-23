export class ConflictError extends Error {
  constructor() {
    super("Công việc đã được cập nhật bởi thao tác khác. Hãy tải lại và thử lại.");
  }
}

export class InputError extends Error {}

/** A refusal with its HTTP status (403 not allowed, 404 not found), message shown as is. */
export class StatusError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404,
  ) {
    super(message);
  }
}
