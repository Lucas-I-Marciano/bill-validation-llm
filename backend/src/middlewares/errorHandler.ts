import { Request, Response, NextFunction, ErrorRequestHandler } from "express"; // <<< Importar ErrorRequestHandler
import { AppError } from "../errors/AppError.js";
import { ConflictError } from "../errors/ConflictError.js";

// Use o tipo ErrorRequestHandler explicitamente aqui VVVV
const errorHandler: ErrorRequestHandler = (
  err: any, // É comum usar 'any' ou 'Error' para o primeiro parâmetro 'err'
  request: Request,
  response: Response,
  next: NextFunction // next PODE ser usado se você quiser passar para outro error handler (raro)
): void => {
  // <<< Mudar o tipo de retorno para void (mais comum para middleware)
  console.error("------------------------------------");
  console.error("[ErrorHandler] Erro Capturado:", err?.message || err); // Log mais seguro
  if (err?.stack) {
    console.error("[ErrorHandler] Stack Trace:", err.stack);
  }
  console.error("------------------------------------");

  // Erro de Conflito (409 - DOUBLE_REPORT)
  if (err instanceof ConflictError) {
    // Envia a resposta e **não** chama next()
    response.status(err.statusCode).json({
      error_code: err.errorCode || "DOUBLE_REPORT",
      error_description: err.message,
    });
    return; // Importante sair da função após enviar resposta
  }

  // Outros erros conhecidos da aplicação (AppError)
  if (err instanceof AppError) {
    response.status(err.statusCode).json({
      error_code:
        err.errorCode ||
        (err.statusCode === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR"),
      error_description: err.message,
      details: err.details,
    });
    return; // Importante sair da função
  }

  // Erro Genérico (500 Internal Server Error)
  const isDevelopment = process.env.NODE_ENV === "development";
  response.status(500).json({
    error_code: "INTERNAL_SERVER_ERROR",
    error_description:
      isDevelopment && err instanceof Error
        ? err.message
        : "Ocorreu um erro interno no servidor.",
    ...(isDevelopment && err instanceof Error && { stack: err.stack }),
  });
  // Não chama next() aqui também, pois a resposta foi enviada.
};

export default errorHandler;
