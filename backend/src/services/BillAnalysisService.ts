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

    try {
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

      const tempFilename = `${uuidv4()}${extension}`;
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
      const finalResult = {
        customer_code: data.customer_code,
        measure_datetime: data.measure_datetime, // Manter como string ISO ou converter para Date
        measure_type: data.measure_type,
        analysis: analysisResult, // Inclui valor_total e mes_referencia
      };

      return finalResult;
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
}
