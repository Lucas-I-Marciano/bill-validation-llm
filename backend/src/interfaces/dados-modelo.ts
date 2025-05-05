export interface BillAnalysisResult {
  valor_total: number | string | null;
  mes_referencia: string | null;
}

export interface SuccessAnalysisResponse {
  imageUrl: string;
  measureValue: number | null; // Permitir null se não for possível parsear
  measureUuid: string;
}
