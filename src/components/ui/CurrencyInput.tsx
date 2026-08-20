import React, { useState, useEffect, useRef } from 'react';

export interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | '' | undefined;
  onChange: (value: number) => void;
  showPrefix?: boolean;
  className?: string;
  placeholder?: string;
  allowNegative?: boolean;
}

export function formatNumberToBRL(value: number | '' | undefined, showPrefix = true): string {
  if (value === '' || value === undefined || isNaN(value)) {
    return '';
  }
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  const prefix = showPrefix ? 'R$ ' : '';
  const sign = value < 0 ? '-' : '';
  return `${sign}${prefix}${formatted}`;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  showPrefix = true,
  className = '',
  placeholder = 'R$ 0,00',
  allowNegative = false,
  disabled = false,
  required = false,
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (value === '' || value === undefined || value === 0) return '';
    return formatNumberToBRL(value, showPrefix);
  });

  const isFocusedRef = useRef(false);

  // Sincroniza o displayValue se o valor prop mudar externamente (quando não está focado ou mudou programaticamente)
  useEffect(() => {
    if (value === '' || value === undefined) {
      setDisplayValue('');
    } else {
      setDisplayValue(formatNumberToBRL(value, showPrefix));
    }
  }, [value, showPrefix]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;

    // Se o usuário limpou o campo
    if (!rawInput.trim()) {
      setDisplayValue('');
      onChange(0);
      return;
    }

    // Identificar se há sinal negativo
    const isNegative = allowNegative && rawInput.includes('-');

    // Extrair apenas os dígitos numéricos
    const digitsOnly = rawInput.replace(/\D/g, '');

    if (!digitsOnly) {
      setDisplayValue('');
      onChange(0);
      return;
    }

    // Trata como centavos progressivos
    const cents = parseInt(digitsOnly, 10);
    const numericValue = (cents / 100) * (isNegative ? -1 : 1);

    setDisplayValue(formatNumberToBRL(numericValue, showPrefix));
    onChange(numericValue);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').trim();
    if (!pastedText) return;

    // Tentar interpretar formatos brasileiros ou internacionais colados
    // Ex: "1.827,21", "1827,21", "1827.21", "R$ 1.827,21"
    let clean = pastedText.replace(/[R$\s]/g, '');
    let numeric = 0;

    if (clean.includes(',') && clean.includes('.')) {
      // Ex: 1.827,21
      clean = clean.replace(/\./g, '').replace(',', '.');
      numeric = parseFloat(clean);
    } else if (clean.includes(',')) {
      // Ex: 1827,21
      clean = clean.replace(',', '.');
      numeric = parseFloat(clean);
    } else if (clean.includes('.')) {
      // Ex: 1827.21
      numeric = parseFloat(clean);
    } else {
      // Somente números inteiros, ex: "1827" -> 1827
      const digits = clean.replace(/\D/g, '');
      if (digits) {
        numeric = parseInt(digits, 10);
      }
    }

    if (!isNaN(numeric)) {
      setDisplayValue(formatNumberToBRL(numeric, showPrefix));
      onChange(numeric);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    if (props.onFocus) props.onFocus(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false;
    if (value === '' || value === undefined || value === 0) {
      setDisplayValue('');
    } else {
      setDisplayValue(formatNumberToBRL(value, showPrefix));
    }
    if (props.onBlur) props.onBlur(e);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onPaste={handlePaste}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      required={required}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  );
};
