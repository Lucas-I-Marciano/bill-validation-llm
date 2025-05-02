import express, { Request, Response, NextFunction } from "express";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  Part,
} from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";
import { z, ZodError } from "zod";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config(); // Carrega variáveis do .env

// --- Configuração ---
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

if (!GEMINI_API_KEY) {
  console.error(
    "Erro: Chave da API do Gemini (GEMINI_API_KEY) não configurada no .env"
  );
  process.exit(1);
}

// Garante que o diretório de uploads exista
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// --- Inicialização do Express ---
const app = express();
app.use(express.json({ limit: "10mb" })); // Aceita JSON no body (aumente o limite se necessário para base64)
// Serve os arquivos estáticos da pasta 'uploads'
app.use("/uploads", express.static(UPLOAD_DIR));

// --- Inicialização do Cliente Gemini ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({
  model: "gemini-1.5-pro-latest", // Ou "gemini-pro-vision" se preferir/necessário
  // Configurações de segurança (ajuste conforme necessário)
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
});

// --- Simulação de Banco de Dados (para verificação de duplicidade) ---
interface ReadingRecord {
  customerCode: string;
  measureType: "WATER" | "GAS";
  yearMonth: string; // Formato YYYY-MM
  uuid: string;
}
// Usar um Map para simular o BD em memória
const simulatedDB = new Map<string, ReadingRecord>();

async function checkDuplicateReading(
  customerCode: string,
  measureType: "WATER" | "GAS",
  measureDate: Date
): Promise<boolean> {
  const year = measureDate.getFullYear();
  // getMonth() é 0-indexado, então adicionamos 1 e formatamos com zero à esquerda
  const month = (measureDate.getMonth() + 1).toString().padStart(2, "0");
  const yearMonthKey = `${year}-${month}`;

  // Chave de busca simples (poderia ser mais complexa em um BD real)
  const searchKeyPrefix = `${customerCode}-${measureType}-${yearMonthKey}`;

  // Verifica se alguma chave no Map começa com nosso prefixo
  for (const key of simulatedDB.keys()) {
    if (key.startsWith(searchKeyPrefix)) {
      return true; // Encontrou uma leitura para este cliente/tipo neste mês/ano
    }
  }
  return false; // Nenhuma leitura encontrada
}

function addReadingToDB(record: ReadingRecord) {
  // Gera uma chave única para o Map usando o UUID
  const dbKey = `${record.customerCode}-${record.measureType}-${record.yearMonth}-${record.uuid}`;
  simulatedDB.set(dbKey, record);
  console.log("Leitura adicionada ao DB simulado:", record);
}

// --- Validação Zod ---
const MeasureTypeEnum = z.enum(["WATER", "GAS"]);

const UploadRequestBodySchema = z.object({
  image: z.string().refine(
    (val) => {
      // Validação básica de base64 (pode ser aprimorada)
      // Verifica se tem o prefixo data:image ou se é apenas base64 puro
      const base64Regex =
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
      const parts = val.split(",");
      const data = parts.length > 1 ? parts[1] : parts[0]; // Pega a parte de dados
      return base64Regex.test(data);
    },
    { message: "Formato base64 inválido" }
  ),
  customer_code: z.string().min(1, "Código do cliente não pode ser vazio"),
  measure_datetime: z
    .string()
    .datetime({ message: "Data/hora da medição inválida" }), // Valida formato ISO 8601
  measure_type: MeasureTypeEnum,
});

// Helper para formatar erros Zod
function formatZodError(error: ZodError): {
  error_code: string;
  error_description: string;
} {
  const descriptions = error.errors
    .map((err) => `${err.path.join(".")}: ${err.message}`)
    .join("; ");
  return {
    error_code: "INVALID_DATA",
    error_description: descriptions,
  };
}

// Helper para extrair dados e mime type do base64
function extractBase64Data(base64String: string): {
  mimeType: string;
  data: string;
} {
  const match = base64String.match(/^data:(image\/\w+);base64,(.*)$/);
  if (match && match[1] && match[2]) {
    return { mimeType: match[1], data: match[2] };
  }
  // Se não houver prefixo, assuma um tipo padrão (ex: jpeg) ou retorne erro
  // Aqui assumimos jpeg se não especificado, mas idealmente o front-end deveria enviar com prefixo
  console.warn(
    "Prefixo MIME Type não encontrado no base64, assumindo image/jpeg"
  );
  return { mimeType: "image/jpeg", data: base64String };
}

// --- Endpoint POST /upload ---

app.post(
  "/upload",
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      // 1. Validar Body da Requisição
      const validationResult = UploadRequestBodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json(formatZodError(validationResult.error));
      }
      const {
        image: base64Input,
        customer_code,
        measure_datetime,
        measure_type,
      } = validationResult.data;
      const measureDate = new Date(measure_datetime); // 2. Verificar Duplicidade

      const isDuplicate = await checkDuplicateReading(
        customer_code,
        measure_type,
        measureDate
      );
      if (isDuplicate) {
        return res.status(409).json({
          error_code: "DOUBLE_REPORT",
          error_description: "Leitura do mês já realizada",
        });
      } // 3. Preparar e Chamar API do Gemini

      const { mimeType, data: base64Data } = extractBase64Data(base64Input);

      const imagePart: Part = {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      };

      const prompt = `Analise a imagem do medidor (${
        measure_type === "WATER" ? "água" : "gás"
      }) e extraia APENAS o valor numérico inteiro da leitura principal exibida. Retorne somente o número.`;

      console.log("Enviando requisição para o Gemini...");
      const result = await geminiModel.generateContent([prompt, imagePart]);
      const responseText = result.response.text().trim();
      console.log("Resposta bruta do Gemini:", responseText); // 4. Processar Resposta do Gemini

      const measureValue = parseInt(responseText.replace(/\D/g, ""), 10); // Remove não-dígitos e converte

      if (isNaN(measureValue)) {
        console.error("Gemini não retornou um número válido:", responseText);
        return res.status(500).json({
          // Ou talvez 400 se considerar falha na imagem/prompt?
          error_code: "LLM_EXTRACTION_FAILED",
          error_description:
            "Não foi possível extrair um valor numérico da imagem.",
        });
      } // 5. Gerar UUID

      const measure_uuid = uuidv4(); // 6. Salvar Imagem Temporariamente e Gerar URL

      const imageBuffer = Buffer.from(base64Data, "base64");
      const imageFileName = `${measure_uuid}.${
        mimeType.split("/")[1] || "jpg"
      }`; // Usa UUID como nome + extensão
      const imagePath = path.join(UPLOAD_DIR, imageFileName);

      await fs.promises.writeFile(imagePath, imageBuffer);
      console.log(`Imagem salva temporariamente em: ${imagePath}`); // Gera a URL pública (assumindo que o servidor está rodando na raiz '/') // Em produção, seria uma URL de um CDN ou Storage Bucket

      const image_url = `${req.protocol}://${req.get(
        "host"
      )}/uploads/${imageFileName}`; // 7. (Simulado) Salvar no Banco de Dados

      const year = measureDate.getFullYear();
      const month = (measureDate.getMonth() + 1).toString().padStart(2, "0");
      addReadingToDB({
        customerCode: customer_code,
        measureType: measure_type,
        yearMonth: `${year}-${month}`,
        uuid: measure_uuid,
      }); // 8. Retornar Sucesso

      return res.status(200).json({
        image_url: image_url,
        measure_value: measureValue,
        measure_uuid: measure_uuid,
      });
    } catch (error) {
      console.error("Erro inesperado no endpoint /upload:", error); // Passa para o middleware de erro genérico
      next(error);
    }
  }
);

// --- Middleware de Erro Genérico ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Middleware de erro capturou:", err);
  // Verifica se é um erro da API do Google
  // (A estrutura exata do erro pode variar, inspecione o objeto 'err' para detalhes)
  // if (err?.response?.promptFeedback?.blockReason) { // Exemplo de verificação
  //     return res.status(400).json({
  //         error_code: "CONTENT_BLOCKED",
  //         error_description": `Conteúdo bloqueado pela API: ${err.response.promptFeedback.blockReason}`
  //     });
  // }

  // Erro genérico do servidor
  res.status(500).json({
    error_code: "INTERNAL_SERVER_ERROR",
    error_description: "Ocorreu um erro inesperado no servidor.",
  });
});

// --- Iniciar Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Diretório de uploads: ${UPLOAD_DIR}`);
  console.log(`Aguardando requisições no endpoint POST /upload`);
});
