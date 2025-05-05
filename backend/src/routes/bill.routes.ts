import { Router } from "express";
import { BillController } from "../controllers/BillController.js"; // Verifique extensão .js

const billRouter = Router();
const billController = new BillController(); // Instanciar (ou obter via DI)

// Definir a rota POST /upload
// O bind é importante se o método 'uploadBillAnalysis' usar 'this' internamente
// Se não usar 'this' ou for arrow function, pode chamar direto. Por segurança, usar bind ou wrapper.
// billRouter.post('/upload', billController.uploadBillAnalysis.bind(billController));

// Alternativa com wrapper (mais explícita e não depende de bind)
billRouter.post("/upload", (req, res, next) => {
  billController.uploadBillAnalysis(req, res, next);
});

export default billRouter;
