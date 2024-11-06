export class UnreachableError extends Error {
  constructor(value: unknown = "Unreachable code reached.") {
    super(String(value));
  }
}
