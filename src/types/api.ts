export type ApiSuccess<T> = { data: T; meta?: Record<string, unknown> };
export type ApiFailure = {
  error: { code: string; message: string; fieldErrors?: Record<string, string[]> };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
