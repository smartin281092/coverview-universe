export class DocumentError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "DocumentError";
  }
}
