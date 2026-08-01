// Result type for Server Actions
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
