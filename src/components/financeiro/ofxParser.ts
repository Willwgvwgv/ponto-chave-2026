export interface ParsedOFXTransaction {
  fitId: string;
  type: 'DEBIT' | 'CREDIT';
  date: string; // YYYY-MM-DD
  amount: number;
  description: string;
}

export function parseOFX(text: string): ParsedOFXTransaction[] {
  const transactions: ParsedOFXTransaction[] = [];
  const stmttrns = text.split(/<\/STMTTRN>|<STMTTRN>/gi);

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

      transactions.push({
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
  const lines = text.split(/\r?\n/);
  if (lines.length <= 1) return [];

  // 1. Detect delimiter
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount >= commaCount ? ';' : ',';

  // 2. Clear empty lines and map arrays
  const rows = lines
    .map(line => line.split(delimiter).map(cell => cell.replace(/^["']|["']$/g, '').trim()))
    .filter(row => row.length > 1 && row.some(cell => cell !== ''));

  if (rows.length === 0) return [];

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
    headerRow.forEach((cell, idx) => {
      const c = cell.toLowerCase();
      if (c.includes('data') || c.includes('date') || c.includes('moviment') || c.includes('lanç')) {
        dateIdx = idx;
      } else if (c.includes('desc') || c.includes('hist') || c.includes('memo') || c.includes('detalhe') || c.includes('transa') || c.includes('title') || c.includes('título') || c.includes('titulo')) {
        descIdx = idx;
      } else if (c.includes('valor') || c.includes('amount') || c.includes('quantia')) {
        amountIdx = idx;
      } else if (c.includes('tipo') || c.includes('nature') || c.includes('c/d')) {
        typeIdx = idx;
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

    // Parse amount
    let cleanAmt = rawAmt
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(/,/g, '.');
    
    let amount = parseFloat(cleanAmt);
    if (isNaN(amount)) continue;

    const isNegative = amount < 0;
    amount = Math.abs(amount);

    let typeVal: 'DEBIT' | 'CREDIT' = 'DEBIT';
    if (typeIdx !== -1 && row[typeIdx]) {
      const t = row[typeIdx].toLowerCase();
      if (t.includes('c') || t.includes('cred') || t.includes('ent') || t.includes('receit') || t.includes('+')) {
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

    transactions.push({
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
