import { useEffect, useRef } from "react";

interface UseAutoSaveProps<T> {
  key: string;
  data: T;
  debounceMs?: number;
  disabled?: boolean;
}

export function useAutoSave<T>({ key, data, debounceMs = 2000, disabled = false }: UseAutoSaveProps<T>) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dataRef = useRef<T>(data);

  dataRef.current = data;

  useEffect(() => {
    if (disabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      try {
        const keyName = `comissone_${key}`;
        const encoded = encodeDraft(dataRef.current);
        localStorage.setItem(keyName, encoded);
      } catch (err) {
        console.error("Erro no auto-save da comissão:", err);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, key, debounceMs]);
}

export const encodeDraft = (data: any): string => {
  try {
    if (!data || typeof data !== "object") {
      return JSON.stringify({ ...data, savedAt: Date.now() });
    }

    // 1. Remova os campos 'clientName' e 'propertyAddress' (PII)
    // 2. Mantenha apenas: saleDate, saleValue, commissionPercentage e tempSplits
    // (apenas brokerId, role e percentage — sem broker_name ou outros campos de identificação)
    const cleaned: any = {};
    
    if ("saleDate" in data) cleaned.saleDate = data.saleDate;
    if ("saleValue" in data) cleaned.saleValue = data.saleValue;
    if ("commissionPercentage" in data) cleaned.commissionPercentage = data.commissionPercentage;
    
    if ("tempSplits" in data && Array.isArray(data.tempSplits)) {
      cleaned.tempSplits = data.tempSplits.map((split: any) => ({
        brokerId: split.brokerId ?? "",
        role: split.role ?? "",
        percentage: split.percentage ?? 0,
      }));
    }

    // 4. Ao salvar, adicione o campo: savedAt: Date.now()
    cleaned.savedAt = Date.now();

    return JSON.stringify(cleaned);
  } catch {
    return "";
  }
};

export const decodeDraft = <T>(encoded: string): T | null => {
  try {
    let parsed: any;
    const trimmed = encoded.trim();
    // Tenta o parse direto do formato de string JSON
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      parsed = JSON.parse(trimmed);
    } else {
      // Fallback para ler rascunhos salvos no formato antigo (base64/URI encoded)
      try {
        parsed = JSON.parse(decodeURIComponent(atob(encoded)));
      } catch {
        parsed = JSON.parse(encoded);
      }
    }

    // 3. Adicione um TTL de 24 horas (86.400.000 ms)
    if (parsed && typeof parsed === "object" && "savedAt" in parsed) {
      const savedAt = Number(parsed.savedAt);
      if (!isNaN(savedAt) && Date.now() - savedAt > 86400000) {
        localStorage.removeItem("comissone_sale_draft");
        return null;
      }
    }

    return parsed as T;
  } catch {
    return null;
  }
};
