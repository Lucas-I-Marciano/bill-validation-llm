/**
 * Limpa uma string que pode conter um bloco JSON envolvido por marcadores de código Markdown.
 * Remove ```json ... ``` ou ``` ... ``` e espaços em branco extras.
 * @param rawText A string bruta retornada pela IA.
 * @returns A string JSON limpa, pronta para JSON.parse().
 */
export function cleanAiJsonString(rawText: string): string {
  if (!rawText) {
    return ""; // Retorna string vazia se a entrada for nula/vazia
  }
  // Remove ```json, ``` e espaços em branco no início/fim
  return rawText.replace(/^```(json)?\s*|```$/g, "").trim();
}
