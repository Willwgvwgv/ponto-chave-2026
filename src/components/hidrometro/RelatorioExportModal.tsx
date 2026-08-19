import React, { useState, useRef } from "react";
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
  Share2
} from "lucide-react";
import { FaturaHidrometro, CompanySettings } from "../../types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface RelatorioExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fatura: FaturaHidrometro | null;
  onOpenFotoViewer: (url: string, titulo: string, subtitulo: string) => void;
  companySettings?: CompanySettings | null;
}

export const RelatorioExportModal: React.FC<RelatorioExportModalProps> = ({
  isOpen,
  onClose,
  fatura,
  onOpenFotoViewer,
  companySettings
}) => {
  const [showFotos, setShowFotos] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !fatura) return null;

  // Total apartments with photos
  const fotosCount = fatura.leituras.filter((l) => !!l.fotoHidrometroUrl).length;

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      "Apartamento",
      "Bloco",
      "Morador",
      "Telefone",
      "Hidrometro Nº",
      "Leitura Anterior (m³)",
      "Leitura Atual (m³)",
      "Consumo (m³)",
      "Valor Consumo (R$)",
      "Rateio Área Comum (R$)",
      "Valor Total (R$)",
      "Possui Foto"
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
      l.fotoHidrometroUrl ? "Sim" : "Não"
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Rateio_Agua_${fatura.edificioNome.replace(/\s+/g, "_")}_${fatura.mesReferencia}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Planilha CSV exportada com sucesso!");
  };

  // Copy text summary to clipboard
  const handleCopySummary = () => {
    let text = `*RELATÓRIO DE RATEIO DE ÁGUA - FIDELITÉ IMOBILIÁRIA*\n`;
    text += `🏢 Edifício: ${fatura.edificioNome}\n`;
    text += `📅 Mês: ${fatura.mesAnoTexto || fatura.mesReferencia}\n`;
    text += `💧 Consumo Total: ${fatura.consumoTotalApartamentosM3.toFixed(2)} m³ | Tarifa: R$ ${fatura.tarifaM3Calculada.toFixed(2)}/m³\n`;
    text += `💵 Valor Total Fatura: R$ ${fatura.valorTotalConta.toFixed(2)}\n\n`;
    text += `*DEMONSTRATIVO POR APARTAMENTO:*\n`;

    fatura.leituras.forEach((l) => {
      text += `• Apto ${l.numeroUnidade} ${l.moradorNome ? `(${l.moradorNome})` : ""}: Ant: ${l.leituraAnterior}m³ | Atual: ${l.leituraAtual}m³ | Consumo: ${l.consumoM3}m³ => *R$ ${l.valorTotalAPagar.toFixed(2)}*\n`;
    });

    navigator.clipboard.writeText(text);
    toast.success("Resumo copiado para a área de transferência!");
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
          className="relative bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] z-10 print:shadow-none print:rounded-none print:max-h-none print:max-w-none print:w-full"
        >
          {/* Top Actions Bar (Hidden on print) */}
          <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/80 shrink-0 print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Relatório de Rateio & Medição de Água
                </h3>
                <p className="text-xs text-slate-500">
                  {fatura.edificioNome} • {fatura.mesAnoTexto || fatura.mesReferencia}
                </p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer shadow-sm">
                <input
                  type="checkbox"
                  checked={showFotos}
                  onChange={(e) => setShowFotos(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Incluir Fotos dos Hidrômetros ({fotosCount})</span>
              </label>

              <button
                onClick={handleCopySummary}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Copiar texto para WhatsApp"
              >
                <Copy className="w-3.5 h-3.5 text-blue-600" />
                <span>Copiar Resumo</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel / CSV</span>
              </button>

              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir / PDF</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Document Body */}
          <div ref={printRef} className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 custom-scrollbar print:overflow-visible print:p-4">
            {/* Document Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b-2 border-slate-900 pb-6 gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xs">
                    F
                  </div>
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                      FIDELITÉ IMOBILIÁRIA
                    </h1>
                    <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-600 mt-0.5">
                      Gestão de Condomínios & Rateio de Água
                    </p>
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-3 space-y-0.5">
                  <p><strong>Edifício / Condomínio:</strong> {fatura.edificioNome}</p>
                  <p><strong>Mês de Referência:</strong> {fatura.mesAnoTexto || fatura.mesReferencia}</p>
                </div>
              </div>

              <div className="text-left sm:text-right text-xs text-slate-600 space-y-1 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-slate-100 w-full sm:w-auto">
                <p><strong>Data da Leitura:</strong> {new Date(fatura.dataLeitura + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                <p><strong>Total de Unidades:</strong> {fatura.leituras?.length || 0} apartamentos</p>
                <p><strong>Status:</strong> <span className="uppercase font-bold text-blue-600">{fatura.status}</span></p>
              </div>
            </div>

            {/* Financial & Consumption Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Valor Total da Fatura
                </span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">
                  R$ {fatura.valorTotalConta.toFixed(2)}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Consumo Total Aptos
                </span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">
                  {fatura.consumoTotalApartamentosM3.toFixed(2)} m³
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Tarifa / m³
                </span>
                <span className="text-lg font-black text-blue-600 mt-0.5 block">
                  R$ {fatura.tarifaM3Calculada.toFixed(2)}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Área Comum / Diferença
                </span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">
                  {fatura.consumoDiferencaAreaComumM3 > 0 ? `${fatura.consumoDiferencaAreaComumM3.toFixed(2)} m³` : "0,00 m³"}
                </span>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Droplet className="w-4 h-4 text-blue-600" />
                Demonstrativo Detalhado por Unidade
              </h3>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-3">Apto</th>
                      <th className="py-2.5 px-3">Morador / Responsável</th>
                      <th className="py-2.5 px-3 text-right">Leitura Ant.</th>
                      <th className="py-2.5 px-3 text-right">Leitura Atual</th>
                      <th className="py-2.5 px-3 text-center">Consumo (m³)</th>
                      <th className="py-2.5 px-3 text-right">Valor Água (R$)</th>
                      {fatura.valorDiferencaAreaComum > 0 && (
                        <th className="py-2.5 px-3 text-right">Área Comum</th>
                      )}
                      <th className="py-2.5 px-3 text-right font-black">Total a Pagar (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fatura.leituras.map((l, idx) => (
                      <tr key={l.unidadeId || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 font-black text-slate-900">
                          {l.numeroUnidade} {l.bloco ? `(${l.bloco})` : ""}
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-medium truncate max-w-[180px]">
                          {l.moradorNome || "-"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500">
                          {l.leituraAnterior.toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                          {l.leituraAtual.toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-center font-black text-blue-700">
                          {l.consumoM3.toFixed(2)} m³
                        </td>
                        <td className="py-2 px-3 text-right text-slate-700">
                          R$ {l.valorConsumoM3.toFixed(2)}
                        </td>
                        {fatura.valorDiferencaAreaComum > 0 && (
                          <td className="py-2 px-3 text-right text-slate-500">
                            R$ {l.valorAreaComumRateio.toFixed(2)}
                          </td>
                        )}
                        <td className="py-2 px-3 text-right font-black text-emerald-800">
                          R$ {l.valorTotalAPagar.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                      <td colSpan={2} className="py-3 px-3 uppercase text-[11px]">
                        Totais Gerais
                      </td>
                      <td colSpan={2} className="py-3 px-3"></td>
                      <td className="py-3 px-3 text-center text-blue-700 text-xs">
                        {fatura.consumoTotalApartamentosM3.toFixed(2)} m³
                      </td>
                      <td className="py-3 px-3 text-right">
                        R$ {fatura.leituras.reduce((acc, l) => acc + l.valorConsumoM3, 0).toFixed(2)}
                      </td>
                      {fatura.valorDiferencaAreaComum > 0 && (
                        <td className="py-3 px-3 text-right text-slate-600">
                          R$ {fatura.valorDiferencaAreaComum.toFixed(2)}
                        </td>
                      )}
                      <td className="py-3 px-3 text-right text-emerald-800 text-sm">
                        R$ {fatura.valorTotalConta.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Notes if present */}
            {fatura.observacoes && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block">
                  Observações:
                </span>
                <p>{fatura.observacoes}</p>
              </div>
            )}

            {/* Photos of Hydrometers Gallery */}
            {showFotos && fotosCount > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-200 break-before-page">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    Comprovantes Fotográficos dos Hidrômetros ({fotosCount} fotos)
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    Registros fotográficos para transparência e conferência
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {fatura.leituras
                    .filter((l) => !!l.fotoHidrometroUrl)
                    .map((l, idx) => (
                      <div
                        key={l.unidadeId || idx}
                        className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col"
                      >
                        <div
                          onClick={() =>
                            onOpenFotoViewer(
                              l.fotoHidrometroUrl!,
                              `Hidrômetro Apto ${l.numeroUnidade}`,
                              `${fatura.edificioNome} • Leitura: ${l.leituraAtual} m³`
                            )
                          }
                          className="h-44 bg-slate-200 relative group cursor-pointer overflow-hidden flex items-center justify-center"
                        >
                          <img
                            src={l.fotoHidrometroUrl}
                            alt={`Hidrômetro Apto ${l.numeroUnidade}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1">
                            <Eye className="w-4 h-4" />
                            <span>Ampliar</span>
                          </div>
                        </div>

                        <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between">
                          <div>
                            <span className="font-black text-slate-900 text-xs block">
                              Apto {l.numeroUnidade}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[120px]">
                              {l.moradorNome || "Sem nome"}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="font-black text-blue-700 text-xs block font-mono">
                              {l.leituraAtual} m³
                            </span>
                            <span className="text-[10px] font-bold text-emerald-700 block">
                              R$ {l.valorTotalAPagar.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Document Signature Footer */}
            <div className="pt-10 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
              <div>
                <p>Demonstrativo gerado pela Fidelité Imobiliária.</p>
                <p className="text-[10px]">Ponto Chave Gestão • {new Date().toLocaleDateString("pt-BR")}</p>
              </div>

              <div className="w-48 text-center border-t border-slate-300 pt-2">
                <span className="text-[10px] font-bold text-slate-600 block">Fidelité Imobiliária</span>
                <span className="text-[9px] text-slate-400">Responsável pela Medição</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
