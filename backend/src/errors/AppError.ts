export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: string; // Código de erro específico da aplicação
  public readonly details?: any; // Detalhes adicionais (ex: erros de validação)

  constructor(
    message: string,
    statusCode: number = 400,
    errorCode?: string,
    details?: any
  ) {
    super(message); // Passa a mensagem para a classe Error pai
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;

    // Garante que o nome do erro seja o nome da classe (útil para instanceof)
    Object.setPrototypeOf(this, new.target.prototype);
    // Captura a stack trace (opcional, mas útil para debug)
    Error.captureStackTrace(this);
  }
}
