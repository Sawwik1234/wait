import { HttpException, HttpStatus } from '@nestjs/common';

/** Domain error with a stable machine-readable code surfaced to the API envelope. */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status);
  }
}
