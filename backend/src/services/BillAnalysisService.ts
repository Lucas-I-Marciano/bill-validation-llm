import { UploadBillDto } from "../dtos/UploadBill.dto.js";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { GeminiService } from "../services/GeminiService.js";
import { PROMPT_ANALYSE_BILL, UPLOAD_DIR } from "../config/index.js";
import { cleanAiJsonString } from "../utils/aiUtils.js";
import {
  BillAnalysisResult,
  SuccessAnalysisResponse,
} from "../interfaces/dados-modelo.js";
import { AppError } from "../errors/AppError.js";
import { ConflictError } from "../errors/ConflictError.js";

import prisma from "../config/prismaClient.js"; // Ajuste o path se você colocou em outro lugar
import { MeasureType as PrismaMeasureType } from "@prisma/client";

const existingRecords = new Set<string>();

export class BillAnalysisService {
  private geminiService: GeminiService;
  constructor(geminiServiceDep: GeminiService) {
    this.geminiService = geminiServiceDep;
    console.log(
      "[BillAnalysisService] Instância criada e GeminiService injetado."
    );
  }

  async handleUploadAndAnalysis(data: UploadBillDto): Promise<any> {
    console.log(
      "[BillAnalysisService] Iniciando handleUploadAndAnalysis para cliente:",
      data.customer_code
    );
    const measureUuid = uuidv4(); // UUID para esta operação/leitura
    let tempFilePath: string | null = null;
    let tempFilenameWithExt: string | null = null;

    try {
      // 0. Checar Duplicatas
      await this.checkForDuplicate(
        data.customer_code,
        data.measure_type,
        data.measure_datetime
      );

      // 1. Decodificar Base64 e Salvar Arquivo Temporário
      const base64Data = data.image.replace(/^data:image\/\w+;base64,/, ""); // Remove header se presente
      const imageBuffer = Buffer.from(base64Data, "base64");

      let extension = ".png";
      if (
        data.image.startsWith("data:image/jpeg") ||
        data.image.startsWith("data:image/jpg")
      ) {
        extension = ".jpg";
      } else if (data.image.startsWith("data:image/webp")) {
        extension = ".webp";
      }

      const tempFilename = `${measureUuid}${extension}`;
      tempFilePath = path.join(UPLOAD_DIR, tempFilename);

      console.log(
        `[BillAnalysisService] Salvando imagem temporária em: ${tempFilePath}`
      );
      // Criar diretório uploads se não existir
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      await fs.writeFile(tempFilePath, imageBuffer);

      // 2. Chamar o GeminiService para analisar a imagem salva
      console.log(
        `[BillAnalysisService] Chamando GeminiService.analyzeImage para ${tempFilePath}`
      );
      const rawAnalysisText = await this.geminiService.analyzeImage(
        tempFilePath,
        PROMPT_ANALYSE_BILL
      );
      console.log(
        "[BillAnalysisService] Texto JSON recebido do Gemini:",
        rawAnalysisText
      );

      // 3. Parsear o resultado do Gemini
      const cleanedJsonText = cleanAiJsonString(rawAnalysisText);

      // 4. Parsear e Validar o JSON
      let analysisResult: BillAnalysisResult;
      if (!cleanedJsonText) {
        throw new Error("A resposta da IA estava vazia após a limpeza.");
      }
      try {
        analysisResult = JSON.parse(cleanedJsonText);
      } catch (e) {
        console.error("Texto que falhou no parse:", cleanedJsonText);
        throw new Error("Falha ao parsear o JSON da resposta da IA.");
      }

      if (
        typeof analysisResult !== "object" ||
        analysisResult === null ||
        !("valor_total" in analysisResult) ||
        !("mes_referencia" in analysisResult)
      ) {
        throw new Error("Formato JSON recebido da IA é inválido após parse.");
      }

      console.log(
        "[BillAnalysisService] JSON parseado com sucesso:",
        analysisResult
      );

      // 5. Combinar informações e retornar (Exemplo)
      const measureValue = this.parseMeasureValue(analysisResult.valor_total);
      const imageUrl = `/uploads/${tempFilename}`;
      const measureValueFormattedString = this.parseMeasureValue(
        analysisResult.valor_total
      );

      // 5. Salvar no Banco de Dados com Prisma
      console.log(
        "[BillAnalysisService] Salvando leitura no banco de dados..."
      );
      await prisma.billReading.create({
        data: {
          measure_uuid: measureUuid,
          customer_code: data.customer_code,
          measure_datetime: new Date(data.measure_datetime), // Converter string ISO para Date
          measure_type: data.measure_type as PrismaMeasureType, // Cast para o enum do Prisma
          measure_value: measureValueFormattedString, // Passa a string "XX.YY" ou null. Prisma/DB lida com Decimal.
          original_ai_response: rawAnalysisText,
          image_temp_filename: tempFilenameWithExt,
        },
      });
      console.log(
        `[BillAnalysisService] Leitura com UUID ${measureUuid} salva no banco.`
      );

      // 6. Preparar resposta de sucesso para o Controller
      // ATENÇÃO: imageUrl é um caminho local/temporário, não uma URL pública real.
      // Para uma URL real, você precisaria fazer upload para um cloud storage.
      const imageUrlForResponse = `/uploads/${tempFilenameWithExt}`;

      console.log("[BillAnalysisService] Processamento concluído com sucesso.");
      return {
        imageUrl: imageUrlForResponse,
        measureValue: measureValueFormattedString, // A string formatada "XX.YY" ou null
        measureUuid: measureUuid,
      };
    } catch (error: any) {
      console.error(
        "[BillAnalysisService] Erro em handleUploadAndAnalysis:",
        error
      );
      // Relançar erros conhecidos (AppError, ConflictError) para serem tratados pelo errorHandler global
      if (error instanceof AppError || error instanceof ConflictError) {
        throw error;
      }
      // Encapsular erros inesperados em um AppError genérico
      throw new AppError(
        `Erro interno no serviço de análise: ${error.message}`,
        500
      );
    } finally {
      // 5. **IMPORTANTE:** Limpar o arquivo temporário
      if (tempFilePath) {
        try {
          console.log(
            `[BillAnalysisService] Removendo arquivo temporário: ${tempFilePath}`
          );
          await fs.unlink(tempFilePath);
        } catch (cleanupError) {
          console.error(
            `[BillAnalysisService] Falha ao remover arquivo temporário ${tempFilePath}:`,
            cleanupError
          );
        }
      }
    }
  }

  private async checkForDuplicate(
    customerCode: string,
    measureType: string,
    measureDateISO: string
  ): Promise<void> {
    try {
      const dateObj = new Date(measureDateISO);
      const year = dateObj.getFullYear();
      const month = (dateObj.getMonth() + 1).toString().padStart(2, "0"); // Mês é 0-indexado
      const recordKey = `${customerCode}_${measureType}_${year}-${month}`;

      console.log(
        `[BillAnalysisService] Checando duplicata para chave (simulação): ${recordKey}`
      );

      const existing = await prisma.billReading.findFirst({
        where: {
          customer_code: customerCode,
          measure_type: measureType as PrismaMeasureType, // Cast para o tipo do Prisma
          measure_datetime: {
            // Lógica para checar mês/ano
            gte: new Date(year, dateObj.getMonth(), 1),
            lt: new Date(year, dateObj.getMonth() + 1, 1),
          },
        },
      });
      if (existing) {
        console.warn(
          `[BillAnalysisService] Duplicata REAL encontrada no DB para: ${recordKey}`
        );
        throw new ConflictError("Leitura do mês já realizada e registrada.");
      }
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error; // Relança o erro de conflito
      }
      console.error(
        "[BillAnalysisService] Erro ao checar duplicata (simulação) ou processar data:",
        error
      );
      throw new AppError(
        "Erro interno ao verificar duplicidade de leitura.",
        500
      );
    }
  }

  private parseMeasureValue(valorTotal: string | number | null): string | null {
    if (valorTotal === null || valorTotal === undefined) {
      return null;
    }
    let parsed: number;
    if (typeof valorTotal === "number") {
      parsed = valorTotal;
    } else if (typeof valorTotal === "string") {
      try {
        const numericString = valorTotal
          .replace(",", ".")
          .replace(/[^\d.-]/g, "");
        parsed = parseFloat(numericString);
        if (isNaN(parsed)) return null;
      } catch {
        return null;
      }
    } else {
      return null;
    }
    return parsed.toFixed(2); // Retorna string formatada "XX.YY"
  }
}
