import { RespostaDadosModelo } from "../interfaces/dados-modelo.js";

/**
 * Extrai uma string JSON de dentro de um bloco de código Markdown (```json\n ... \n```)
 * e a converte para um objeto TypeScript tipado.
 * FORMATO COM QUEBRAS DE LINHA APÓS ```json E ANTES DE ```.
 *
 * @param textoBlocoCodigo A string completa contendo o bloco de código Markdown com newlines.
 * @returns Um objeto do tipo DadosModelo com os dados extraídos,
 * ou null se o bloco não for encontrado, o JSON for inválido ou a estrutura incorreta.
 */
export function getJsonBlockWithNewlines(
  textoBlocoCodigo: string
): RespostaDadosModelo | null {
  const regex = /```json\n(.*?)\n```/s;
  let textoJsonExtraido: string | null = null;

  try {
    // 1. Tenta encontrar o padrão na string original.
    const match = textoBlocoCodigo.match(regex);

    // 2. Verifica se encontrou o padrão e o grupo de captura 1 (o JSON)
    if (match && match[1]) {
      textoJsonExtraido = match[1].trim();
    } else {
      console.error(
        "Não foi possível encontrar o padrão ```json\\n...\\n``` na string fornecida."
      );
      // console.error("String recebida:", textoBlocoCodigo);
      // console.error("Resultado do match:", match);
      return null;
    }

    // 3. Tenta fazer o parse da string JSON extraída
    const dados = JSON.parse(textoJsonExtraido);

    // 4. Validação da estrutura (opcional, mas bom ter)
    if (
      typeof dados?.valor_total !== "string" ||
      typeof dados?.mes_referencia !== "string"
    ) {
      console.error(
        "Estrutura do JSON inválida ou campos faltando/tipo incorreto após extração do bloco."
      );
      console.error("Objeto após parse:", dados);
      return null;
    }

    // 5. Retorna o objeto tipado
    return dados as RespostaDadosModelo;
  } catch (error) {
    if (error instanceof SyntaxError && textoJsonExtraido !== null) {
      console.error(
        `Erro de sintaxe ao decodificar JSON extraído do bloco. String processada: '${textoJsonExtraido}'. Erro:`,
        error.message
      );
    } else if (textoJsonExtraido === null && !(error instanceof SyntaxError)) {
      console.error(
        "Ocorreu um erro inesperado antes de tentar o parse do JSON (regex falhou?):",
        error
      );
    } else {
      console.error(
        "Ocorreu um erro inesperado durante o processamento:",
        error
      );
    }
    return null;
  }
}
