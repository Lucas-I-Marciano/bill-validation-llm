import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import { PROMPT_ANALYSE_BILL } from "./config/index.js";
import { GeminiService } from "./services/GeminiService.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const image_path = path.join(UPLOAD_DIR, "teste.png");
if (!fs.existsSync(image_path)) {
  console.error(`Erro: Arquivo de imagem não encontrado em: ${image_path}`);
  process.exit(1); // Sair se a imagem não existir
}

const geminiService = new GeminiService();

async function main() {
  const response = await geminiService.analyzeImage(
    image_path,
    PROMPT_ANALYSE_BILL
  );
  console.log(response);

  return response;
}

await main();
