// src/errors/ConflictError.ts (Novo)
import { AppError } from "./AppError.js"; // Verifique extensão

export class ConflictError extends AppError {
  constructor(
    message: string = "Leitura do mês já realizada",
    errorCode: string = "DOUBLE_REPORT"
  ) {
    // Chama o construtor do AppError com status 409 e o código de erro específico
    super(message, 409, errorCode);
    this.name = "ConflictError"; // Define o nome do erro
  }
}
