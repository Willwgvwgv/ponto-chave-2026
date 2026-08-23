export interface ParsedOFXTransaction {
  internalId: string;
  fitId: string;
  type: 'DEBIT' | 'CREDIT';
  date: string; // YYYY-MM-DD
  amount: number;
  description: string;
}

export function parseOFX(text: string): ParsedOFXTransaction[] {
  const transactions: ParsedOFXTransaction[] = [];
  const stmttrns = text.split(/<\/STMTTRN>|<STMTTRN>/gi);

  let index = 0;
  for (const block of stmttrns) {
    if (!block.trim() || !block.includes('<TRNAMT>')) continue;

    const trntypeMatch = block.match(/<TRNTYPE>([^<\n\r]+)/i);
    const dtpostedMatch = block.match(/<DTPOSTED>([^<\n\r]+)/i);
    const trnamtMatch = block.match(/<TRNAMT>([^<\n\r]+)/i);
    const fitidMatch = block.match(/<FITID>([^<\n\r]+)/i);
    const memoMatch = block.match(/<MEMO>([^<\n\r]+)/i);
    const nameMatch = block.match(/<NAME>([^<\n\r]+)/i);

    if (trnamtMatch) {
      const amount = parseFloat(trnamtMatch[1].trim());
      const rawDate = dtpostedMatch ? dtpostedMatch[1].trim() : '';
      let dateStr = new Date().toISOString().split('T')[0];
      if (rawDate && rawDate.length >= 8) {
        dateStr = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      }

      const typeVal = trntypeMatch ? trntypeMatch[1].trim().toUpperCase() : '';
      const fitId = fitidMatch ? fitidMatch[1].trim() : `ofx_${Math.random().toString(36).substring(2, 9)}`;
      const description = (memoMatch ? memoMatch[1].trim() : (nameMatch ? nameMatch[1].trim() : 'Transação Importada'))
        .replace(/&amp;/g, '&');

      const internalId = `ofx_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 8)}`;
      index++;

      transactions.push({
        internalId,
        fitId,
        type: typeVal === 'DEBIT' || amount < 0 ? 'DEBIT' : 'CREDIT',
        amount: Math.abs(amount),
        date: dateStr,
        description
      });
    }
  }

  return transactions;
}

export function parseCSV(text: string): ParsedOFXTransaction[] {
  const transactions: ParsedOFXTransaction[] = [];
  const cleanText = text.replace(/^\uFEFF/i, '');
  const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  // 1. Detect delimiter
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount >= commaCount ? ';' : ',';

  // Helper to parse a single CSV line acknowledging quotes and escape sequences
  const parseCSVLine = (lineStr: string, delim: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < lineStr.length; i++) {
      const char = lineStr[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delim && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // 2. Clear empty lines and map arrays using smart parser
  const rows = lines
    .map(line => parseCSVLine(line, delimiter))
    .filter(row => row.length > 1 && row.some(cell => cell !== ''));

  if (rows.length === 0) return [];

  // Helper to robustly parse float values in various regional locales (e.g. 1572.75 or 1.572,75)
  const robustParseFloat = (valStr: string): number => {
    let s = valStr.replace(/[R$\s]/g, '').trim();
    if (!s) return NaN;

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    if (hasComma && hasDot) {
      const commaIdx = s.lastIndexOf(',');
      const dotIdx = s.lastIndexOf('.');
      if (commaIdx > dotIdx) {
        // Comma is decimal separator, dot is thousands
        s = s.replace(/\./g, '').replace(/,/g, '.');
      } else {
        // Dot is decimal separator, comma is thousands
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      // Only comma: it is the decimal separator
      s = s.replace(/,/g, '.');
    } else if (hasDot) {
      // Only dot: check if multiple dots
      const dotCount = (s.match(/\./g) || []).length;
      if (dotCount > 1) {
        s = s.replace(/\./g, '');
      }
    }

    return parseFloat(s);
  };

  // 3. Find column indices
  let dateIdx = -1;
  let descIdx = -1;
  let amountIdx = -1;
  let typeIdx = -1;

  // Let's inspect the first row to check for headers
  const headerRow = rows[0];
  const hasHeader = headerRow.some(cell => {
    const c = cell.toLowerCase();
    return c.includes('data') || c.includes('hist') || c.includes('desc') || c.includes('valor') || c.includes('amount');
  });

  const dataStartIdx = hasHeader ? 1 : 0;

  if (hasHeader) {
    let bestDateScore = -1;
    let bestDescScore = -1;
    let bestAmountScore = -1;
    let bestTypeScore = -1;

    headerRow.forEach((cell, idx) => {
      const c = cell.toLowerCase().trim();

      // Date Prioritization (Avoid picking cancel/delete/expire dates)
      if (c.includes('data') || c.includes('date') || c.includes('moviment') || c.includes('lanç')) {
        let score = 10;
        if (c.includes('cancel') || c.includes('delet') || c.includes('excl') || c.includes('fim') || c.includes('alt')) {
          score = 1;
        } else if (c === 'data' || c === 'date') {
          score = 100;
        } else if (c.includes('movimento') || c.includes('moviment') || c.includes('lançamento') || c.includes('lancamento')) {
          score = 90;
        } else if (c.includes('vencimento') || c.includes('venc')) {
          score = 80;
        } else if (c.includes('emissao') || c.includes('emissão')) {
          score = 70;
        }
        if (score > bestDateScore) {
          bestDateScore = score;
          dateIdx = idx;
        }
      }

      // Description Prioritization
      if (c.includes('desc') || c.includes('hist') || c.includes('memo') || c.includes('detalhe') || c.includes('transa') || c.includes('title') || c.includes('título') || c.includes('titulo') || c.includes('cliente')) {
        let score = 10;
        if (c === 'descricao' || c === 'descrição' || c === 'description') {
          score = 100;
        } else if (c.includes('hist')) {
          score = 80;
        } else if (c.includes('cliente')) {
          score = 5;
        }
        if (score > bestDescScore) {
          bestDescScore = score;
          descIdx = idx;
        }
      }

      // Amount/Valor Prioritization
      if (c.includes('valor') || c.includes('amount') || c.includes('quantia')) {
        let score = 10;
        if (c === 'valor' || c === 'amount') {
          score = 100;
        }
        if (score > bestAmountScore) {
          bestAmountScore = score;
          amountIdx = idx;
        }
      }

      // Type/Tipo Prioritization
      if (c.includes('tipo') || c.includes('nature') || c.includes('c/d')) {
        let score = 10;
        if (c === 'tipo' || c === 'type') {
          score = 100;
        }
        if (score > bestTypeScore) {
          bestTypeScore = score;
          typeIdx = idx;
        }
      }
    });
  }

  // If column indices are not found, guess them
  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    const sampleRow = rows[dataStartIdx] || rows[0];
    sampleRow.forEach((cell, idx) => {
      if (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/.test(cell)) {
        if (dateIdx === -1) dateIdx = idx;
      } else if (/^-?\s?\d+([.,]\d+)?$/.test(cell.replace(/\s/g, '').replace(/[R$]/g, '')) && !/^\d+$/.test(cell)) {
        if (amountIdx === -1) amountIdx = idx;
      } else if (cell.length > 3) {
        if (descIdx === -1) descIdx = idx;
      }
    });
    
    if (dateIdx === -1) dateIdx = 0;
    if (descIdx === -1) descIdx = Math.min(1, sampleRow.length - 1);
    if (amountIdx === -1) amountIdx = Math.min(2, sampleRow.length - 1);
  }

  // 4. Parse rows
  for (let i = dataStartIdx; i < rows.length; i++) {
    const row = rows[i];
    if (row.length <= Math.max(dateIdx, descIdx, amountIdx)) continue;

    const rawDate = row[dateIdx];
    const rawDesc = row[descIdx];
    const rawAmt = row[amountIdx];
    
    if (!rawDate || !rawDesc || !rawAmt) continue;

    // Parse date (dd/mm/yyyy or yyyy-mm-dd)
    let parsedDate = '';
    const dateParts = rawDate.match(/(\d+)/g);
    if (dateParts && dateParts.length >= 3) {
      if (dateParts[0].length === 4) {
        parsedDate = `${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
      } else {
        const year = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2];
        parsedDate = `${year}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
      }
    } else {
      parsedDate = new Date().toISOString().split('T')[0];
    }

    // Parse amount robustly
    let amount = robustParseFloat(rawAmt);
    if (isNaN(amount)) continue;

    const isNegative = amount < 0;
    amount = Math.abs(amount);

    let typeVal: 'DEBIT' | 'CREDIT' = 'DEBIT';
    if (typeIdx !== -1 && row[typeIdx]) {
      const t = row[typeIdx].toLowerCase();
      // Match incoming/credits while avoiding debits with 'c' letter (like "compra")
      const isCredit = t === 'c' || t === 'cr' || t.includes('cred') || t.includes('ent') || t.includes('receit') || t.includes('receb') || t.includes('+') || t.includes('deposito') || t.includes('depósito') || t.includes('faturamento');
      if (isCredit) {
        typeVal = 'CREDIT';
      }
    } else {
      if (isNegative || rawAmt.includes('-')) {
        typeVal = 'DEBIT';
      } else {
        typeVal = 'CREDIT';
      }
    }

    const cleanDesc = rawDesc.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 45);
    const fitId = `csv_${parsedDate}_${amount}_${cleanDesc}`;
    const internalId = `csv_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 8)}`;

    transactions.push({
      internalId,
      fitId,
      type: typeVal,
      amount,
      date: parsedDate,
      description: rawDesc
    });
  }

  return transactions;
}

export function parseBankStatement(text: string): ParsedOFXTransaction[] {
  const isOFXML = text.includes('<OFX>') || text.includes('<STMTTRN>') || text.includes('<TRNAMT>') || text.includes('OFXHEADER');
  if (isOFXML) {
    return parseOFX(text);
  } else {
    return parseCSV(text);
  }
}

export interface LedgerBalance {
  amount: number;
  date: string; // YYYY-MM-DD
}

export function parseLedgerBalance(text: string): LedgerBalance | null {
  const match = text.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)[\s\S]*?<DTASOF>([^<\r\n]+)/i);
  if (!match) return null;

  const amount = parseFloat(match[1].trim());
  const rawDate = match[2].trim();
  if (isNaN(amount) || rawDate.length < 8) return null;

  const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
  return { amount, date };
}

