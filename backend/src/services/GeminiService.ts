import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error(
    "Erro: A variável de ambiente GEMINI_API_KEY não está definida."
  );
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export class GeminiService {
  /**
   * Analisa uma imagem usando a API do Gemini.
   * Faz upload da imagem, envia para o modelo com um prompt e retorna a resposta textual.
   *
   * @param imagePath Caminho local para o arquivo de imagem.
   * @param prompt O prompt a ser usado na análise da imagem.
   * @param modelName O nome do modelo Gemini a ser usado (ex: 'gemini-1.5-flash').
   * @returns A resposta textual do modelo Gemini.
   */
  async analyzeImage(
    imagePath: string,
    prompt: string,
    modelName: string = "gemini-2.0-flash-exp-image-generation"
  ): Promise<string> {
    console.log(`[GeminiService] Iniciando análise da imagem: ${imagePath}`);

    // 1. Upload do arquivo
    let uploadedFile;
    try {
      console.log(`[GeminiService] Fazendo upload do arquivo...`);
      const response = await ai.files.upload({ file: imagePath });
      uploadedFile = response;

      if (!uploadedFile?.uri || !uploadedFile?.mimeType) {
        console.error(
          "[GeminiService] Erro: Falha ao obter URI ou mimeType do arquivo após upload.",
          response
        );
        throw new Error("Falha no upload do arquivo ou URI/mimeType ausente.");
      }
      console.log(`[GeminiService] Upload concluído. URI: ${uploadedFile.uri}`);
    } catch (error: any) {
      console.error("[GeminiService] Erro durante o upload do arquivo:", error);
      throw new Error(
        `Falha ao fazer upload do arquivo para a IA: ${error.message}`
      );
    }

    // 2. Geração de Conteúdo
    try {
      console.log(
        `[GeminiService] Solicitando geração de conteúdo para o modelo ${modelName}...`
      );

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          createUserContent([
            prompt,
            createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
          ]),
        ],
      });

      if (!response || !response.text) {
        console.error(
          "[GeminiService] Erro: Resposta da IA inválida ou sem texto.",
          response
        );
        // Tente obter mais detalhes do erro, se disponíveis
        const candidate = response?.candidates?.[0];
        if (candidate?.finishReason && candidate.finishReason !== "STOP") {
          throw new Error(
            `Geração de conteúdo falhou ou foi bloqueada. Razão: ${candidate.finishReason}`
          );
        }
        throw new Error("Resposta da IA não contém texto.");
      }

      console.log(`[GeminiService] Geração de conteúdo concluída.`);
      return response.text;
    } catch (error: any) {
      console.error(
        "[GeminiService] Erro durante a geração de conteúdo:",
        error
      );
      throw new Error(`Falha ao gerar conteúdo com a IA: ${error.message}`);
    }
  }
}
