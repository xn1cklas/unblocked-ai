export class UnblockedError extends Error {
  constructor(message: string, cause?: string) {
    super(message);
    this.name = 'UnblockedError';
    this.message = message;
    this.cause = cause;
    this.stack = '';
  }
}
export class MissingDependencyError extends UnblockedError {
  constructor(pkgName: string) {
    super(
      `The package "${pkgName}" is required. Make sure it is installed.`,
      pkgName
    );
  }
}
