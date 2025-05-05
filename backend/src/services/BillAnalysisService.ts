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
    let tempFilePath: string | null = null;
    const measureUuid = uuidv4();

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

      console.log("[BillAnalysisService] Processamento concluído com sucesso.");
      return {
        imageUrl: imageUrl,
        measureValue: measureValue,
        measureUuid: measureUuid,
      };
    } catch (error: any) {
      console.error(
        "[BillAnalysisService] Erro em handleUploadAndAnalysis:",
        error
      );
      throw error;
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
    measureDate: string
  ): Promise<void> {
    try {
      const date = new Date(measureDate);
      const year = date.getFullYear();
      // getMonth() é 0-indexado, então adicionamos 1 e padStart para formatar MM
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const recordKey = `${customerCode}_${measureType}_${year}-${month}`;

      console.log(
        `[BillAnalysisService] Checando duplicata para chave: ${recordKey}`
      );

      // Lógica REAL: await database.findRecord(recordKey);
      if (existingRecords.has(recordKey)) {
        console.warn(
          `[BillAnalysisService] Duplicata encontrada: ${recordKey}`
        );
        throw new ConflictError(); // Lança o erro 409 específico
      }

      // Lógica REAL: Marcar como existente ou apenas não lançar erro
      existingRecords.add(recordKey); // Adiciona ao nosso set de simulação
      console.log(
        `[BillAnalysisService] Chave ${recordKey} adicionada ao registro (simulação).`
      );
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error; // Relança o erro de conflito
      }
      // Logar outros erros potenciais na validação da data, etc.
      console.error(
        "[BillAnalysisService] Erro ao checar duplicata ou processar data:",
        error
      );
      // Lançar um erro genérico ou um AppError mais específico, se apropriado
      throw new AppError(
        "Erro interno ao verificar duplicidade de leitura.",
        500
      );
    }
  }

  private parseMeasureValue(valorTotal: string | number | null): number | null {
    if (valorTotal === null || valorTotal === undefined) {
      return null;
    }
    if (typeof valorTotal === "number") {
      return Math.round(valorTotal); // Arredonda se já for número
    }
    if (typeof valorTotal === "string") {
      try {
        // Tenta remover caracteres não numéricos (exceto ponto/vírgula) e converter
        const numericString = valorTotal
          .replace(",", ".")
          .replace(/[^\d.-]/g, "");
        const parsed = parseFloat(numericString);
        return isNaN(parsed) ? null : Math.round(parsed); // Arredonda após parse
      } catch {
        return null; // Retorna null se falhar a conversão
      }
    }
    return null;
  }
}
