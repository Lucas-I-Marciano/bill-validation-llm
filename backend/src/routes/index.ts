import { Router } from "express";
import billRouter from "./bill.routes.js"; // Verifique extensão .js
// Importe outros roteadores aqui se houver (ex: userRouter)

const router = Router();

// Usar o roteador de contas sem prefixo específico NESTE arquivo
router.use(billRouter);
// Exemplo: router.use('/users', userRouter); // Outro roteador com prefixo

export default router;
