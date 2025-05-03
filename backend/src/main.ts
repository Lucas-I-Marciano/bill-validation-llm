import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const COMMON_PROMPT: string = `Você é um assistente especializado em analisar textos de contas de serviços públicos (água ou gás). Sua tarefa é extrair duas informações específicas do texto da imagem.

Informações a extrair:
1.  **Valor Total a Pagar:** O montante final que o cliente deve pagar nesta fatura. Procure por termos como "Total a Pagar", "Valor a Pagar", etc.
2.  **Mês de Referência:** O mês e ano (ou período) ao qual o consumo ou serviço faturado se refere. Procure por termos como "Mês de Referência", "Competência", "Período de", etc.

Instruções:
* Leia atentamente o texto da conta fornecido.
* Identifique os valores exatos correspondentes às informações solicitadas.
* Retorne a resposta EXCLUSIVAMENTE como um objeto JSON válido, contendo as chaves \`valor_total\` (para o valor numérico ou string formatada como número, ex: 123.45 ou "123,45") e \`mes_referencia\` (para o mês/período como string, ex: "Maio/2025" ou "05/2025").
* Se uma das informações não puder ser encontrada de forma confiável, utilize \`null\` como valor para a chave correspondente.
* Não inclua nenhuma outra explicação ou texto adicional na sua resposta, apenas o JSON.`;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error(
    "Erro: A variável de ambiente GEMINI_API_KEY não está definida."
  );
  process.exit(1);
}

const image_path = path.join(UPLOAD_DIR, "teste.png");
if (!fs.existsSync(image_path)) {
  console.error(`Erro: Arquivo de imagem não encontrado em: ${image_path}`);
  process.exit(1); // Sair se a imagem não existir
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function main() {
  const image = await ai.files.upload({
    file: image_path,
  });
  if (!image.uri || !image.mimeType) {
    console.error(
      "Erro: Falha ao obter URI ou mimeType do arquivo após upload.",
      image
    );
    throw new Error("Falha no upload do arquivo ou URI/mimeType ausente.");
  }
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-exp-image-generation",
    contents: [
      createUserContent([
        COMMON_PROMPT,
        createPartFromUri(image.uri, image.mimeType),
      ]),
    ],
  });
  console.log(response.text);
}

await main();
