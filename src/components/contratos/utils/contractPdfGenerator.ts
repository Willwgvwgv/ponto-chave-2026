import { ContratoLocacao } from "../types/contractTypes";
import { CompanySettings } from "../../../types";
import { buildVariableMap, resolveContractText } from "./contractVariableResolver";
import { assinaturasDoBloco } from "./contractSignatures";

const escaparHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Triggers native high-fidelity vector printing for the contract.
 * Uses a dedicated hidden print container or iframe with optimized @media print styles
 * to guarantee that fonts remain crisp, margins are exactly A4, and headers/footers appear reliably.
 */
export function printContractDocument(
  contract: ContratoLocacao,
  companySettings?: CompanySettings | null
): void {
  const variableMap = buildVariableMap(contract, companySettings);
  const styles = contract.styleSettings;

  // Build the complete HTML for printing
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.print();
    return;
  }

  const logoUrl = styles.headerLogoUrl || companySettings?.logoUrl || "";
  const companyName = companySettings?.name || "Fidelité Imobiliária";
  const companyCreci = companySettings?.creci || "CRECI-GO";
  const companyAddress = companySettings?.address || "";
  const companyPhone = companySettings?.phone || "";

  const marginMm = styles.marginType === "estreita" ? 15 : styles.marginType === "ampla" ? 30 : 25;
  const primaryColor = styles.primaryColor || "#1e3a8a";

  let bodyHtml = "";

  let runningClauseCount = 1;

  contract.blocks.forEach((block) => {
    const resolvedContent = resolveContractText(block.content, variableMap);
    // Ajustes manuais do bloco: nova página, espaço acima e tamanho do texto
    if (block.pageBreakBefore) {
      bodyHtml += `<div style="page-break-before: always; break-before: page; height: 0;"></div>`;
    }
    const inicioBloco = bodyHtml.length;

    if (block.type === "title") {
      bodyHtml += `
        <div class="contract-title-wrapper" style="text-align: center; margin-bottom: 8px;">
          <h1 style="font-size: 16pt; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">
            ${resolvedContent}
          </h1>
        </div>
      `;
    } else if (block.type === "subtitle") {
      bodyHtml += `
        <div class="contract-subtitle-wrapper" style="text-align: center; margin-bottom: 24px;">
          <h2 style="font-size: 11pt; font-weight: 700; color: #475569; letter-spacing: 1px; margin: 0;">
            ${resolvedContent}
          </h2>
        </div>
      `;
    } else if (block.type === "clause") {
      const num = block.clauseNumber || runningClauseCount;
      runningClauseCount = num + 1;
      const clauseNum = `CLÁUSULA ${num}ª - `;
      const clauseTitle = block.clauseTitle ? block.clauseTitle.toUpperCase() : "";
      bodyHtml += `
        <div class="contract-clause-block" style="margin-bottom: ${styles.paragraphSpacingPx}px;">
          <h3 style="font-size: 11pt; font-weight: 700; color: ${primaryColor}; margin-bottom: 6px; text-transform: uppercase; page-break-after: avoid; break-after: avoid;">
            ${clauseNum}${clauseTitle}
          </h3>
          <div class="clause-text" style="text-align: justify; line-height: ${styles.lineSpacing};">
            ${resolvedContent}
          </div>
        </div>
      `;
    } else if (block.type === "parties") {
      bodyHtml += `
        <div class="contract-parties-block" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; margin-bottom: ${styles.paragraphSpacingPx}px;">
          <h4 style="font-size: 10pt; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">
            ${block.clauseTitle || "IDENTIFICAÇÃO DAS PARTES"}
          </h4>
          <div style="font-size: 10pt; line-height: 1.4; text-align: justify;">
            ${resolvedContent}
          </div>
        </div>
      `;
    } else if (block.type === "signatures") {
      bodyHtml += `
        <div class="contract-signatures-wrapper" style="margin-top: 36px; page-break-inside: avoid;">
          <div style="margin-bottom: 24px;">
            ${resolvedContent}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px 24px; margin-top: 36px;">
            ${(() => {
              const assin = assinaturasDoBloco(block, contract, variableMap);
              const impar = assin.linhas.length % 2 === 1;
              const linhas = assin.linhas.map((l, idx) => `
                <div style="text-align: center;${impar && idx === assin.linhas.length - 1 ? " grid-column: span 2; max-width: 60%; margin: 0 auto; width: 100%;" : ""}">
                  <div style="border-top: 1.5px solid #0f172a; width: 85%; margin: 0 auto 6px auto;"></div>
                  <p style="font-weight: 700; font-size: 10pt; margin: 0;">${escaparHtml(l.nome || "")}</p>
                  ${l.papel ? `<p style="font-size: 8.5pt; color: #64748b; margin: 2px 0 0 0;">${escaparHtml(l.papel)}</p>` : ""}
                  ${l.doc ? `<p style="font-size: 8pt; color: #94a3b8; margin: 0;">${escaparHtml(l.doc)}</p>` : ""}
                </div>`).join("");
              const testemunhas = Array.from({ length: assin.testemunhas }).map((_, idx) => `
                <div style="text-align: center; margin-top: 20px;">
                  <div style="border-top: 1px dashed #94a3b8; width: 85%; margin: 0 auto 6px auto;"></div>
                  <p style="font-size: 9pt; font-weight: 600; margin: 0;">${idx + 1}ª TESTEMUNHA</p>
                  <p style="font-size: 8pt; color: #64748b; margin: 0;">Nome: ___________________________</p>
                  <p style="font-size: 8pt; color: #64748b; margin: 0;">CPF: ____________________________</p>
                </div>`).join("");
              return linhas + testemunhas;
            })()}
          </div>
        </div>
      `;
    } else if (block.type === "page_break") {
      bodyHtml += `
        <div class="page-break" style="page-break-before: always; height: 0; margin: 0; padding: 0; border: none;"></div>
      `;
    } else {
      bodyHtml += `
        <div class="contract-paragraph-block" style="margin-bottom: ${styles.paragraphSpacingPx}px; text-align: justify; line-height: ${styles.lineSpacing};">
          ${resolvedContent}
        </div>
      `;
    }
    if (block.espacoAcimaPx || (block.escalaFonte && block.escalaFonte !== 1)) {
      const estilo = [
        block.espacoAcimaPx ? `margin-top: ${block.espacoAcimaPx}px;` : "",
        block.escalaFonte && block.escalaFonte !== 1 ? `font-size: ${styles.fontSizePt * block.escalaFonte}pt;` : ""
      ].join(" ");
      bodyHtml = bodyHtml.slice(0, inicioBloco) + `<div style="${estilo}">` + bodyHtml.slice(inicioBloco) + `</div>`;
    }
  });

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${contract.titulo || "Contrato de Locação"}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: ${marginMm}mm;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page-break {
            page-break-before: always;
          }
          .no-print {
            display: none !important;
          }
        }
        body {
          font-family: ${styles.fontFamily}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: ${styles.fontSizePt}pt;
          line-height: ${styles.lineSpacing};
          color: #0f172a;
          margin: 0;
          padding: 0;
          background: #ffffff;
        }
        .header-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid ${primaryColor};
          padding-bottom: 12px;
          margin-bottom: 24px;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .company-logo {
          height: 48px;
          max-width: 160px;
          object-fit: contain;
        }
        .company-info h3 {
          margin: 0;
          font-size: 13pt;
          font-weight: 800;
          color: ${primaryColor};
        }
        .company-info p {
          margin: 2px 0 0 0;
          font-size: 8pt;
          color: #64748b;
          font-weight: 600;
        }
        .header-right {
          text-align: right;
          font-size: 8pt;
          color: #475569;
        }
        .footer-container {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid #cbd5e1;
          padding-top: 6px;
          font-size: 8pt;
          color: #64748b;
        }
        .watermark {
          position: fixed;
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
          font-size: 80pt;
          font-weight: 900;
          color: rgba(203, 213, 225, 0.35);
          pointer-events: none;
          z-index: 9999;
          letter-spacing: 12px;
        }
        p {
          margin-top: 0;
          margin-bottom: 8px;
        }
        strong {
          color: #0f172a;
        }
      </style>
    </head>
    <body>
      ${styles.showWatermark ? `<div class="watermark">${styles.watermarkText || "MINUTA"}</div>` : ""}

      ${styles.showHeader ? `
        <div class="header-container">
          <div class="header-left">
            ${logoUrl ? `<img src="${logoUrl}" class="company-logo" alt="Logo" />` : ""}
            <div class="company-info">
              <h3>${companyName}</h3>
              <p>${companyCreci} • ${companyPhone || companyAddress}</p>
            </div>
          </div>
          <div class="header-right">
            <div><strong>Contrato Nº:</strong> ${contract.numeroContrato || "---"}</div>
            <div><strong>Data:</strong> ${variableMap.data_inicio || "---"}</div>
          </div>
        </div>
      ` : ""}

      <div class="contract-content">
        ${bodyHtml}
      </div>

      ${styles.showFooter ? `
        <div class="footer-container">
          <span>${companyName} • ${companyAddress}</span>
          <span>${contract.numeroContrato || "LOC"}</span>
        </div>
      ` : ""}

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 400);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
}
