export class ConflictError extends Error {
  constructor() {
    super("Công việc đã được cập nhật bởi thao tác khác. Hãy tải lại và thử lại.");
  }
}

export class InputError extends Error {}
