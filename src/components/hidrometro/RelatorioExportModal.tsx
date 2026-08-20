import React, { useState, useRef, useMemo } from "react";
import { 
  X, 
  Printer, 
  Download, 
  FileSpreadsheet, 
  Eye, 
  Image as ImageIcon, 
  CheckCircle2, 
  Droplet, 
  Building2, 
  Calendar,
  Layers,
  Copy,
  Share2,
  TrendingUp,
  History,
  Info,
  DollarSign,
  Gauge,
  Loader2
} from "lucide-react";
import { FaturaHidrometro, CompanySettings } from "../../types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

interface RelatorioExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fatura: FaturaHidrometro | null;
  onOpenFotoViewer: (url: string, titulo: string, subtitulo: string) => void;
  faturasExistentes?: FaturaHidrometro[];
  companySettings?: CompanySettings | null;
}

const formatUnitLabel = (numStr: string) => {
  if (!numStr) return "Unidade";
  const trimmed = numStr.trim();
  if (/^(apto|apartamento|unidade|bloco|sala|loja)\b/i.test(trimmed)) {
    return trimmed;
  }
  return `Apto ${trimmed}`;
};

const formatBRL = (val: number) => 
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

const formatM3 = (val: number, decimals = 2) => 
  `${(val || 0).toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} m³`;

export const RelatorioExportModal: React.FC<RelatorioExportModalProps> = ({
  isOpen,
  onClose,
  fatura,
  onOpenFotoViewer,
  faturasExistentes = [],
  companySettings
}) => {
  const [showFotos, setShowFotos] = useState(true);
  const [showHistorico, setShowHistorico] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Total apartments with photos
  const fotosCount = fatura?.leituras?.filter((l) => !!l.fotoHidrometroUrl).length || 0;

  // Build client consumption history across past months for the same building
  const historicoMeses = useMemo(() => {
    if (!fatura) return { meses: [], dataByUnit: {} };

    // Get all previous invoices for this building sorted chronologically
    const buildingInvoices = faturasExistentes
      .filter((f) => f.edificioId === fatura.edificioId && f.mesReferencia <= fatura.mesReferencia)
      .sort((a, b) => a.mesReferencia.localeCompare(b.mesReferencia));

    // Keep last 4 cycles including current
    const recentInvoices = buildingInvoices.slice(-4);
    const meses = recentInvoices.map((f) => ({
      mesReferencia: f.mesReferencia,
      mesAnoTexto: f.mesAnoTexto || f.mesReferencia
    }));

    const dataByUnit: Record<string, Record<string, { consumoM3: number; valorTotal: number; leitura: number }>> = {};

    recentInvoices.forEach((inv) => {
      inv.leituras.forEach((l) => {
        const key = l.numeroUnidade;
        if (!dataByUnit[key]) {
          dataByUnit[key] = {};
        }
        dataByUnit[key][inv.mesReferencia] = {
          consumoM3: l.consumoM3 || 0,
          valorTotal: l.valorTotalAPagar || 0,
          leitura: l.leituraAtual || 0
        };
      });
    });

    return { meses, dataByUnit };
  }, [fatura, faturasExistentes]);

  if (!isOpen || !fatura) return null;

  // Direct PDF generation (100% reliable, multi-page, high definition)
  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsGeneratingPDF(true);
    toast.info("Processando documento para PDF em alta resolução...");

    try {
      const element = printRef.current;
      const originalScrollTop = element.scrollTop;
      const originalOverflow = element.style.overflow;
      const originalHeight = element.style.height;
      const originalMaxHeight = element.style.maxHeight;

      // Expand container so html2canvas captures entire content, not just viewport
      element.scrollTop = 0;
      element.style.overflow = "visible";
      element.style.height = "auto";
      element.style.maxHeight = "none";

      // Render high quality canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      // Restore container styles
      element.style.overflow = originalOverflow;
      element.style.height = originalHeight;
      element.style.maxHeight = originalMaxHeight;
      element.scrollTop = originalScrollTop;

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      const totalPages = Math.ceil(imgHeight / pdfHeight);

      for (let i = 0; i < totalPages; i++) {
        if (i > 0) {
          pdf.addPage();
        }
        const position = -(i * pdfHeight);
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      }

      const cleanBuildingName = fatura.edificioNome.replace(/[^a-zA-Z0-9_-]/g, "_");
      pdf.save(`Demonstrativo_Agua_${cleanBuildingName}_${fatura.mesReferencia}.pdf`);
      toast.success("PDF baixado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao exportar PDF: " + (error?.message || "Tente imprimir pelo botão Imprimir"));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Dedicated Browser Print function (Opens isolated printable document to guarantee zero blank pages)
  const handlePrint = () => {
    if (!printRef.current) {
      window.print();
      return;
    }

    const printContent = printRef.current.innerHTML;
    const printWindow = window.open("", "_blank", "width=1100,height=900");

    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Demonstrativo de Água - ${fatura.edificioNome} (${fatura.mesAnoTexto || fatura.mesReferencia})</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm 8mm 12mm 8mm;
          }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #ffffff;
            color: #0f172a;
            margin: 0;
            padding: 8px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          table {
            page-break-inside: auto;
            border-collapse: collapse;
            width: 100%;
          }
          tr, td, th {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .break-inside-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          img {
            max-width: 100%;
            height: auto;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @media print {
            .no-print, .print\\:hidden { display: none !important; }
          }
        </style>
      </head>
      <body class="bg-white text-slate-900">
        <div class="max-w-5xl mx-auto space-y-6">
          ${printContent}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 400);
          };
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      "Apartamento",
      "Bloco",
      "Morador / Responsável",
      "Telefone",
      "Hidrômetro Nº",
      "Leitura Anterior (m³)",
      "Leitura Atual (m³)",
      "Consumo Medido (m³)",
      "Valor Consumo (R$)",
      "Rateio Área Comum (R$)",
      "Valor Total a Pagar (R$)",
      "Comprovante Fotográfico"
    ];

    const rows = fatura.leituras.map((l) => [
      `"${l.numeroUnidade}"`,
      `"${l.bloco || ""}"`,
      `"${l.moradorNome || ""}"`,
      `"${l.moradorTelefone || ""}"`,
      `"${l.hidrometroNumero || ""}"`,
      l.leituraAnterior.toFixed(2),
      l.leituraAtual.toFixed(2),
      l.consumoM3.toFixed(2),
      l.valorConsumoM3.toFixed(2),
      l.valorAreaComumRateio.toFixed(2),
      l.valorTotalAPagar.toFixed(2),
      l.fotoHidrometroUrl ? "Anexado" : "Não informado"
    ]);

    // Add total row
    rows.push([
      `"TOTAIS"`,
      `""`,
      `""`,
      `""`,
      `""`,
      `""`,
      `""`,
      fatura.consumoTotalApartamentosM3.toFixed(2),
      fatura.leituras.reduce((acc, l) => acc + l.valorConsumoM3, 0).toFixed(2),
      fatura.valorDiferencaAreaComum.toFixed(2),
      fatura.valorTotalConta.toFixed(2),
      `""`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Demonstrativo_Fidelite_${fatura.edificioNome.replace(/\s+/g, "_")}_${fatura.mesReferencia}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Planilha CSV exportada com sucesso!");
  };

  // Copy text summary to clipboard
  const handleCopySummary = () => {
    let text = `*FIDELITÉ IMOBILIÁRIA - DEMONSTRATIVO DE ÁGUA*\n`;
    text += `🏢 *Edifício:* ${fatura.edificioNome}\n`;
    text += `📅 *Mês de Referência:* ${fatura.mesAnoTexto || fatura.mesReferencia}\n`;
    text += `💵 *Valor Total da Fatura:* R$ ${fatura.valorTotalConta.toFixed(2)}\n`;
    text += `💧 *Consumo Total Medido:* ${fatura.consumoTotalApartamentosM3.toFixed(2)} m³ (Tarifa: R$ ${fatura.tarifaM3Calculada.toFixed(2)}/m³)\n`;
    if (fatura.valorDiferencaAreaComum > 0) {
      text += `🏢 *Diferença Área Comum:* R$ ${fatura.valorDiferencaAreaComum.toFixed(2)} (${fatura.consumoDiferencaAreaComumM3.toFixed(2)} m³)\n`;
    }
    text += `\n*VALORES POR APARTAMENTO:*\n`;

    fatura.leituras.forEach((l) => {
      text += `• *Apto ${l.numeroUnidade}* ${l.moradorNome ? `(${l.moradorNome})` : ""}: `;
      text += `Ant: ${l.leituraAnterior}m³ ➔ Atual: ${l.leituraAtual}m³ | Consumo: ${l.consumoM3}m³ => *R$ ${l.valorTotalAPagar.toFixed(2)}*\n`;
    });

    text += `\n_Demonstrativo emitido por Fidelité Imobiliária. Comprovantes fotográficos arquivados para conferência._`;

    navigator.clipboard.writeText(text);
    toast.success("Demonstrativo copiado para a área de transferência!");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:m-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm print:hidden"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-5xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] z-10 print:shadow-none print:rounded-none print:max-h-none print:max-w-none print:w-full print:border-none"
        >
          {/* Top Actions Bar (Hidden on print) */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/90 shrink-0 print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                  Demonstrativo & Relatório de Água
                </h3>
                <p className="text-xs text-slate-500">
                  {fatura.edificioNome} • {fatura.mesAnoTexto || fatura.mesReferencia}
                </p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer shadow-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={showFotos}
                  onChange={(e) => setShowFotos(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Fotos dos Hidrômetros ({fotosCount})</span>
              </label>

              <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer shadow-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={showHistorico}
                  onChange={(e) => setShowHistorico(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Histórico dos Clientes</span>
              </label>

              <button
                onClick={handleCopySummary}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Copiar texto para WhatsApp"
              >
                <Copy className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Excel</span>
              </button>

              <button
                onClick={handleExportPDF}
                disabled={isGeneratingPDF}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Gerar e baixar arquivo PDF completo diretamente"
              >
                {isGeneratingPDF ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Gerando...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar PDF</span>
                  </>
                )}
              </button>

              <button
                onClick={handlePrint}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Imprimir ou Salvar em PDF pelo navegador"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Imprimir</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Document Body */}
          <div 
            id="print-area"
            ref={printRef} 
            className="print-area flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 custom-scrollbar print:overflow-visible print:p-6 print:m-0 print:space-y-6 text-slate-900 bg-white"
          >
            {/* 1. Official Header with Fidelité Logo */}
            <div className="border-b-2 border-slate-900/80 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center">
                <img 
                  src="/logo-fidelite.svg" 
                  alt="Fidelité Negócios Imobiliários" 
                  className="h-16 sm:h-20 w-auto object-contain"
                />
              </div>

              <div className="text-left sm:text-right text-xs text-slate-700 space-y-1 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-slate-200 w-full sm:w-auto">
                <p><span className="text-slate-500 font-medium">Condomínio / Edifício:</span> <strong className="text-slate-900 text-sm">{fatura.edificioNome}</strong></p>
                <p><span className="text-slate-500 font-medium">Mês de Referência:</span> <strong className="text-blue-700">{fatura.mesAnoTexto || fatura.mesReferencia}</strong></p>
                <p><span className="text-slate-500 font-medium">Data da Medição:</span> <strong>{new Date(fatura.dataLeitura + "T12:00:00").toLocaleDateString("pt-BR")}</strong></p>
                <p><span className="text-slate-500 font-medium">Total de Unidades:</span> <strong>{fatura.leituras?.length || 0} apartamentos</strong></p>
              </div>
            </div>

            {/* 2. Financial & Volume Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Valor Total da Fatura
                </span>
                <span className="text-lg sm:text-xl font-black text-slate-900 mt-1 block">
                  {formatBRL(fatura.valorTotalConta)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Conta da Concessionária</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border-2 border-blue-200 shadow-sm bg-blue-50/20">
                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block">
                  Consumo Total Medido
                </span>
                <span className="text-lg sm:text-xl font-black text-blue-700 mt-1 block font-mono">
                  {formatM3(fatura.consumoTotalApartamentosM3)}
                </span>
                <span className="text-[10px] text-blue-600 font-medium">Soma dos Hidrômetros</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Tarifa Rateada / m³
                </span>
                <span className="text-lg sm:text-xl font-black text-slate-900 mt-1 block font-mono">
                  {formatBRL(fatura.tarifaM3Calculada)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Valor por m³ apurado</span>
              </div>

              <div className="p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Área Comum / Diferença
                </span>
                <span className="text-lg sm:text-xl font-black text-slate-900 mt-1 block font-mono">
                  {fatura.valorDiferencaAreaComum > 0 ? formatBRL(fatura.valorDiferencaAreaComum) : "R$ 0,00"}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {fatura.consumoDiferencaAreaComumM3 > 0 ? `${formatM3(fatura.consumoDiferencaAreaComumM3)} rateado` : "Sem diferença"}
                </span>
              </div>
            </div>

            {/* 3. Detailed Consumption & Apportionment Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-blue-600" />
                  Demonstrativo Detalhado por Apartamento
                </h3>
                <span className="text-[10px] font-bold text-slate-500">
                  Cálculo fidedigno ao valor da fatura geral
                </span>
              </div>

              <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-300">
                      <th className="py-2.5 px-3">Apto</th>
                      <th className="py-2.5 px-3">Morador / Responsável</th>
                      <th className="py-2.5 px-3 text-center">Hidrômetro</th>
                      <th className="py-2.5 px-3 text-right">Leitura Ant.</th>
                      <th className="py-2.5 px-3 text-right">Leitura Atual</th>
                      <th className="py-2.5 px-3 text-center">Consumo (m³)</th>
                      <th className="py-2.5 px-3 text-right">Valor Consumo</th>
                      {fatura.valorDiferencaAreaComum > 0 && (
                        <th className="py-2.5 px-3 text-right">Área Comum</th>
                      )}
                      <th className="py-2.5 px-3 text-right font-black text-slate-900">Total a Pagar (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {fatura.leituras.map((l, idx) => (
                      <tr key={l.unidadeId || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-black text-slate-900">
                          {l.numeroUnidade} {l.bloco ? `(${l.bloco})` : ""}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-medium truncate max-w-[200px]">
                          {l.moradorNome || "Unidade Ocupada"}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">
                          {l.hidrometroNumero || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                          {l.leituraAnterior.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {l.leituraAtual.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-blue-700 font-mono">
                          {formatM3(l.consumoM3)}
                          {l.viradaHidrometro && (
                            <span className="block text-[9px] font-bold text-emerald-700 uppercase tracking-tighter mt-0.5">
                              (Virada 9999→0)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 font-mono">
                          {formatBRL(l.valorConsumoM3)}
                        </td>
                        {fatura.valorDiferencaAreaComum > 0 && (
                          <td className="py-2.5 px-3 text-right text-slate-500 font-mono">
                            {formatBRL(l.valorAreaComumRateio)}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 font-mono text-sm bg-slate-50/50">
                          {formatBRL(l.valorTotalAPagar)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                      <td colSpan={3} className="py-3 px-3 uppercase text-[11px]">
                        Totais Gerais Faturados
                      </td>
                      <td colSpan={2} className="py-3 px-3"></td>
                      <td className="py-3 px-3 text-center text-blue-700 text-xs font-mono">
                        {formatM3(fatura.consumoTotalApartamentosM3)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {formatBRL(fatura.leituras.reduce((acc, l) => acc + l.valorConsumoM3, 0))}
                      </td>
                      {fatura.valorDiferencaAreaComum > 0 && (
                        <td className="py-3 px-3 text-right text-slate-700 font-mono">
                          {formatBRL(fatura.valorDiferencaAreaComum)}
                        </td>
                      )}
                      <td className="py-3 px-3 text-right text-slate-900 text-sm font-mono bg-slate-200/50">
                        {formatBRL(fatura.valorTotalConta)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 4. Client History Table across past months */}
            {showHistorico && historicoMeses.meses.length > 1 && (
              <div className="space-y-3 pt-2 break-inside-avoid">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-600" />
                    Histórico Comparativo de Consumo por Cliente / Unidade
                  </h3>
                  <span className="text-[10px] text-slate-500">
                    Acompanhamento da evolução mensal de consumo (m³ e R$)
                  </span>
                </div>

                <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-300">
                        <th className="py-2.5 px-3">Apto</th>
                        <th className="py-2.5 px-3">Morador</th>
                        {historicoMeses.meses.map((m) => (
                          <th key={m.mesReferencia} className="py-2.5 px-3 text-center">
                            {m.mesAnoTexto}
                          </th>
                        ))}
                        <th className="py-2.5 px-3 text-right font-black">Média (m³)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {fatura.leituras.map((l, idx) => {
                        const unitHist = historicoMeses.dataByUnit[l.numeroUnidade] || {};
                        const historyValues = historicoMeses.meses
                          .map((m) => unitHist[m.mesReferencia]?.consumoM3)
                          .filter((v) => typeof v === "number");
                        const avgConsumo = historyValues.length > 0
                          ? historyValues.reduce((a, b) => a + b, 0) / historyValues.length
                          : l.consumoM3;

                        return (
                          <tr key={l.unidadeId || idx} className="hover:bg-slate-50/80">
                            <td className="py-2 px-3 font-black text-slate-900">
                              {l.numeroUnidade}
                            </td>
                            <td className="py-2 px-3 text-slate-600 truncate max-w-[150px]">
                              {l.moradorNome || "-"}
                            </td>
                            {historicoMeses.meses.map((m) => {
                              const record = unitHist[m.mesReferencia];
                              const isCurrent = m.mesReferencia === fatura.mesReferencia;
                              return (
                                <td 
                                  key={m.mesReferencia} 
                                  className={`py-2 px-3 text-center font-mono ${isCurrent ? 'bg-blue-50/40 font-bold text-blue-800' : 'text-slate-600'}`}
                                >
                                  {record ? (
                                    <div>
                                      <span className="block">{formatM3(record.consumoM3, 1)}</span>
                                      <span className="text-[10px] text-slate-400 block font-normal">{formatBRL(record.valorTotal)}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                              {formatM3(avgConsumo)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes if present */}
            {fatura.observacoes && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1 break-inside-avoid">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block">
                  Observações Gerais do Demonstrativo:
                </span>
                <p>{fatura.observacoes}</p>
              </div>
            )}

            {/* 5. Comprovantes Fotográficos dos Hidrômetros (Galeria de Fotos com Dados) */}
            {showFotos && fotosCount > 0 && (
              <div className="space-y-4 pt-4 border-t-2 border-slate-300 print:break-before-page break-inside-avoid">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    Comprovantes Fotográficos dos Hidrômetros ({fotosCount} registros)
                  </h3>
                  <span className="text-[10px] text-slate-500 font-bold">
                    Fidelité Imobiliária • Auditoria & Transparência
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {fatura.leituras
                    .filter((l) => !!l.fotoHidrometroUrl)
                    .map((l, idx) => (
                      <div
                        key={l.unidadeId || idx}
                        className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-sm flex flex-col break-inside-avoid"
                      >
                        {/* Header of unit card */}
                        <div className="p-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-black text-slate-900 text-xs block">
                              {formatUnitLabel(l.numeroUnidade)} {l.bloco ? `(${l.bloco})` : ""}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate max-w-[140px]">
                              {l.moradorNome || "Morador"}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                              Hidrômetro
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-700">
                              {l.hidrometroNumero || "N/D"}
                            </span>
                          </div>
                        </div>

                        {/* Photo Container */}
                        <div
                          onClick={() =>
                            onOpenFotoViewer(
                              l.fotoHidrometroUrl!,
                              `Comprovante Hidrômetro - Apto ${l.numeroUnidade}`,
                              `${fatura.edificioNome} • Leitura Registrada: ${l.leituraAtual.toLocaleString('pt-BR')} m³`
                            )
                          }
                          className="h-48 bg-slate-100 relative group cursor-pointer overflow-hidden flex items-center justify-center"
                        >
                          <img
                            src={l.fotoHidrometroUrl}
                            alt={`Hidrômetro Apto ${l.numeroUnidade}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1 print:hidden">
                            <Eye className="w-4 h-4" />
                            <span>Ampliar</span>
                          </div>
                        </div>

                        {/* Footer stats of unit */}
                        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">
                              Leitura Atual
                            </span>
                            <span className="font-black text-blue-700 font-mono text-sm block">
                              {l.leituraAtual.toLocaleString('pt-BR')} m³
                            </span>
                            <span className="text-[9px] text-slate-500">Consumo: {formatM3(l.consumoM3)}</span>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] text-slate-400 uppercase font-bold block">
                              Valor a Pagar
                            </span>
                            <span className="font-black text-emerald-800 font-mono text-sm block">
                              {formatBRL(l.valorTotalAPagar)}
                            </span>
                            <span className="text-[9px] text-slate-500">Mês: {fatura.mesReferencia}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 6. Document Signature Footer */}
            <div className="pt-10 border-t-2 border-slate-300 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4 break-inside-avoid">
              <div>
                <p className="font-bold text-slate-700">FIDELITÉ IMOBILIÁRIA - GESTÃO CONDOMINIAL</p>
                <p className="text-[10px] text-slate-400">Documento oficial de prestação de contas de consumo de água • Emitido em {new Date().toLocaleDateString("pt-BR")}</p>
              </div>

              <div className="w-56 text-center border-t border-slate-400 pt-2">
                <span className="text-[11px] font-black text-slate-800 block">Fidelité Imobiliária</span>
                <span className="text-[9px] text-slate-500">Responsável pela Medição e Rateio</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
