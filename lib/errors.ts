export type IntakeCode =
  | "invalid_url"
  | "blocked"
  | "login_wall"
  | "empty"
  | "network"

export class IntakeError extends Error {
  code: IntakeCode

  constructor(message: string, code: IntakeCode) {
    super(message)
    this.name = "IntakeError"
    this.code = code
  }
}
