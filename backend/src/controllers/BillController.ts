import { Request, Response, NextFunction } from "express";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UploadBillDto } from "../dtos/UploadBill.dto.js"; // Verifique extensão .js
import { BillAnalysisService } from "../services/BillAnalysisService.js"; // Verifique extensão .js

import { GeminiService } from "../services/GeminiService.js";
const geminiService = new GeminiService();
const billAnalysisService = new BillAnalysisService(geminiService);

export class BillController {
  // Método para lidar com o upload e análise
  async uploadBillAnalysis(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    console.log("[BillController] Recebida requisição POST /upload");

    // 1. Converter o corpo da requisição para o DTO
    const uploadData = plainToInstance(UploadBillDto, req.body);

    // 2. Validar o DTO
    const errors = await validate(uploadData);
    if (errors.length > 0) {
      console.error("[BillController] Erros de validação:", errors);
      const formattedErrors = errors.map((err) => ({
        property: err.property,
        constraints: err.constraints,
      }));
      res.status(400).json({
        message: "Dados de entrada inválidos.",
        errors: formattedErrors,
      });
      return;
    }

    // 3. Chamar o Serviço
    try {
      console.log(
        "[BillController] Dados validados. Chamando BillAnalysisService..."
      );
      const result = await billAnalysisService.handleUploadAndAnalysis(
        uploadData
      );

      console.log("[BillController] Análise concluída com sucesso.");
      // 4. Enviar Resposta de Sucesso
      res.status(200).json(result);
    } catch (error) {
      console.error(
        "[BillController] Erro ao processar upload/análise:",
        error
      );
      // 5. Passar o erro para o Middleware de Erro Global
      next(error);
    }
  }
}
