import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// VALIDAÇÃO DE DOCUMENTOS FISCAIS
// ============================================

/**
 * Remove todos os caracteres não numéricos
 */
export const stripDoc = (doc: string): string =>
  doc.replace(/\D/g, "");

/**
 * Valida CPF pelo tamanho e formato correto
 */
export const isValidCPF = (cpf: string): boolean => {
  const digits = stripDoc(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  return true;
};

/**
 * Valida CNPJ pelo tamanho e formato correto
 */
export const isValidCNPJ = (cnpj: string): boolean => {
  const digits = stripDoc(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  return true;
};

/**
 * Valida CPF ou CNPJ automaticamente pelo tamanho
 */
export const isValidDoc = (doc: string): boolean => {
  const digits = stripDoc(doc);
  if (digits.length === 11) return true;
  if (digits.length === 14) return true;
  return false;
};

/**
 * Aplica máscara de CPF: 000.000.000-00
 */
export const maskCPF = (value: string): string => {
  const digits = stripDoc(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

/**
 * Aplica máscara de CNPJ: 00.000.000/0000-00
 */
export const maskCNPJ = (value: string): string => {
  const digits = stripDoc(value).slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

/**
 * Aplica máscara automaticamente pelo tamanho digitado
 */
export const maskDoc = (value: string): string => {
  const digits = stripDoc(value);
  if (digits.length <= 11) return maskCPF(value);
  return maskCNPJ(value);
};

/**
 * Mascara CPF para exibição pública: 123.456.***-**
 */
export const maskCPFPublic = (cpf: string): string => {
  const digits = stripDoc(cpf);
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.***.**`;
};

/**
 * Retorna o tipo do documento pelo tamanho
 */
export const getDocType = (doc: string): "CPF" | "CNPJ" | null => {
  const digits = stripDoc(doc);
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  return null;
};

/**
 * Remove campos undefined de um objeto antes de enviar ao Firestore
 * Substitui undefined por null em campos opcionais
 */
export const sanitizeForFirestore = <T extends Record<string, any>>(data: T): Partial<T> => {
  if (data === null || data === undefined) return {} as Partial<T>;
  
  const recurse = (val: any): any => {
    if (val === undefined) return null;
    if (val === null) return null;
    if (Array.isArray(val)) {
      return val.map(recurse);
    }
    if (typeof val === 'object') {
      // Evita recursão em objetos especiais do Firebase (ex: refs, timestamps, FieldValue)
      if (
        val.constructor && 
        (val.constructor.name === 'DocumentReference' || 
         val.constructor.name === 'Timestamp' || 
         val.constructor.name === 'FieldPath' ||
         val.constructor.name === 'FieldValue' ||
         val._type === 'doc' ||
         val._type === 'query')
      ) {
        return val;
      }
      const entries = Object.entries(val)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, recurse(v)]);
      return Object.fromEntries(entries);
    }
    return val;
  };

  return recurse(data) as Partial<T>;
};


