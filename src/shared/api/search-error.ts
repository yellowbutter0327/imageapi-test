export class SearchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'SearchError';
  }
}
