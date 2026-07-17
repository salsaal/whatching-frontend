export interface ApiResponse<T = unknown> {
  status: string;
  message?: string;
  data?: T;
}
