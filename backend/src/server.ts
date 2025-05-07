//   const response = `\`\`\`json
// {
//     "valor_total": "115,06",
//     "mes_referencia": "Abril/2025"
// }
// \`\`\``;

import "reflect-metadata";
import express, {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";
import cors from "cors";
import "dotenv/config"; // Garante que dotenv carregue antes de tudo
import mainRouter from "./routes/index.js"; // Importa o roteador principal - Verifique extensão .js
import errorHandler from "./middlewares/errorHandler.js";
import logger from "./middlewares/logger.js"; // Importa o middleware de logging

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares Essenciais
app.use(cors()); // Habilita CORS para todas as origens (ajuste em produção!)
app.use(express.json({ limit: "10mb" })); // Habilita parsing de JSON no body (aumente o limite se base64 for grande)
app.use(express.urlencoded({ extended: true })); // Para parsing de application/x-www-form-urlencoded

// Middleware de Logging
app.use(logger); // Adiciona o middleware de logging

// Rotas Principais (sem prefixo global aqui, o prefixo está dentro de routes/index.ts se necessário)
app.use(mainRouter); // <<< USA O ROTEADOR PRINCIPAL AQUI

// Rota "Not Found" (Opcional, mas bom ter)
app.use((req, res, next) => {
  res.status(404).json({ message: "Endpoint não encontrado." });
});

// Middleware Global de Tratamento de Erros (IMPORTANTE: Deve ser o ÚLTIMO middleware)
app.use(errorHandler);

// Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

export default app; // Exportar app pode ser útil para testes
