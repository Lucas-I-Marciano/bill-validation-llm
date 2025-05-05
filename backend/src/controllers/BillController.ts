import { Request, Response, NextFunction } from "express";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UploadBillDto } from "../dtos/UploadBill.dto.js"; // Verifique extensão .js
import { BillAnalysisService } from "../services/BillAnalysisService.js"; // Verifique extensão .js

import { GeminiService } from "../services/GeminiService.js";
import { AppError } from "../errors/AppError.js";
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
      const errorDescription = errors
        .map(
          (err) =>
            `${err.property}: ${Object.values(err.constraints || {}).join(
              ", "
            )}`
        )
        .join("; ");

      res.status(400).json({
        error_code: "INVALID_DATA",
        // Incluir detalhes no error_description
        error_description: `Dados de entrada inválidos. Detalhes: ${errorDescription}`,
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
      res.status(200).json({
        // Descrição: "Operação realizada com sucesso." (implícita pelo status 200 ou adicionar message)
        image_url: result.imageUrl, // Veio do serviço
        measure_value: result.measureValue, // Veio do serviço
        measure_uuid: result.measureUuid, // Veio do serviço
      });
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
