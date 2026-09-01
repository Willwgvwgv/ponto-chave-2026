import React, { useRef } from "react";
import { X, Printer, Calendar, Users, Building, ShieldCheck } from "lucide-react";
import { UserProfile, PontoRegistro, CompanySettings } from "../../types";
import { formatMinutesToHHMM, formatMinutesToHoursFriendly } from "./MeuEspelho";

interface FolhaPontoPrintProps {
  collaborator: UserProfile | null;
  companySettings: CompanySettings | null;
  year: number;
  month: number;
  registros: PontoRegistro[];
  onClose: () => void;
}

export const FolhaPontoPrint: React.FC<FolhaPontoPrintProps> = ({
  collaborator,
  companySettings,
  year,
  month,
  registros,
  onClose
}) => {
  const printContentRef = useRef<HTMLDivElement>(null);

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const totalDays = new Date(year, month, 0).getDate();
  const diasDoMes = Array.from({ length: totalDays }, (_, i) => i + 1);

  const getWeekDayName = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return weekDays[d.getDay()];
  };

  const registrosMap = new Map<string, PontoRegistro>();
  registros.forEach(r => {
    registrosMap.set(r.date, r);
  });

  // Calculate stats
  let totalTrabalhadas = 0;
  let totalExcedente = 0;
  let totalDeficit = 0;
  let totalSaldoNet = 0;
  let diasTrabalhados = 0;

  registros.forEach(r => {
    if (r.horasTrabalhadas !== undefined) {
      totalTrabalhadas += r.horasTrabalhadas;
      diasTrabalhados++;
    }
    if (r.horasExtras !== undefined) {
      totalSaldoNet += r.horasExtras;
      if (r.horasExtras > 0) {
        totalExcedente += r.horasExtras;
      } else {
        totalDeficit += Math.abs(r.horasExtras);
      }
    }
  });

  const collaboratorName =
    collaborator?.displayName ||
    (collaborator as any)?.name ||
    (collaborator as any)?.nome ||
    collaborator?.email ||
    "Colaborador";

  const getRoleLabel = (user?: UserProfile | null) => {
    if (!user) return "Colaborador";

    if (user.cargoComissao === "CORRETOR") return "Corretor de Imóveis";
    if (user.cargoComissao === "CAPTADOR") return "Captador / Angariador";
    if (user.cargoComissao === "GESTOR") return "Gestor / Gerente";
    if (user.cargoComissao === "SOCIO") return "Sócio / Diretor";

    const customCargo = (user as any).cargo || (user as any).funcao;
    if (customCargo) return customCargo;

    const rawRole = String(user.role || (user as any).originalRole || "").toLowerCase();
    switch (rawRole) {
      case "admin":
      case "administrador":
        return "Administrador";
      case "corretor":
        return "Corretor de Imóveis";
      case "captador":
        return "Captador / Angariador";
      case "colaborador":
      case "user":
      case "funcionario":
      case "funcionário":
        return "Colaborador";
      case "broker":
        return "Corretor de Imóveis";
      case "manager":
      case "gerente":
      case "gestor":
        return "Gestor / Gerente";
      case "socio":
        return "Sócio / Diretor";
      default:
        if (!rawRole || rawRole === "none") return "Colaborador";
        return rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
    }
  };

  const formattedMonthName = monthNames[month - 1];

  const handlePrint = () => {
    const printContent = printContentRef.current || document.getElementById("printable-folha-content");
    if (!printContent) {
      window.print();
      return;
    }

    // Use isolated iframe for 100% reliable print rendering without blank page issues
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Espelho de Ponto - ${collaboratorName} (${formattedMonthName}/${year})</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            * {
              box-sizing: border-box;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            body {
              margin: 0;
              padding: 0;
              color: #000;
              background: #fff;
              font-size: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              border: 1px solid #000;
              padding: 3px 5px;
              font-size: 9px;
            }
            th {
              background-color: #f1f5f9;
              font-weight: 800;
              text-transform: uppercase;
            }
            .header-box {
              border: 1px solid #000;
              padding: 10px;
              margin-bottom: 10px;
            }
            .grid-4 {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-top: 8px;
            }
            .grid-2 {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
            }
            .info-cell {
              border: 1px dotted #94a3b8;
              padding: 6px;
              border-radius: 4px;
            }
            .info-label {
              display: block;
              font-size: 8px;
              font-weight: bold;
              text-transform: uppercase;
              color: #64748b;
            }
            .info-value {
              font-size: 10px;
              font-weight: bold;
              color: #0f172a;
            }
            .totals-box {
              border: 1px solid #000;
              padding: 8px;
              background-color: #f8fafc;
              margin-top: 10px;
              margin-bottom: 12px;
            }
            .signatures {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 32px;
              text-align: center;
              margin-top: 24px;
            }
            .sig-line {
              border-bottom: 1px solid #000;
              height: 24px;
              margin-bottom: 6px;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-mono { font-family: monospace; }
            .font-bold { font-weight: bold; }
            .font-black { font-weight: 900; }
            .uppercase { text-transform: uppercase; }
            .no-print { display: none !important; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 250);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      
      {/* CSS overrides for print-only scope */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          #print-area-wrapper {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            overflow: visible !important;
            z-index: 99999 !important;
          }
        }
      `}</style>

      {/* Main Container */}
      <div id="print-area-wrapper" className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-250 flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="no-print p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">Visualização de Folha para Assinatura (CLT)</h3>
              <p className="text-xxs text-slate-400">Verifique os dados apurados antes de enviar para impressão e assinatura dos colaboradores.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Salvar PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scalable Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-8 font-sans text-slate-800">
          
          <div id="printable-folha-content" ref={printContentRef}>
            {/* Header Layout Document */}
            <div className="border border-black p-4 mb-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-3 border-b border-black gap-4 mb-3">
                <div>
                  <h1 className="text-sm font-black tracking-tight uppercase text-black">
                    {companySettings?.name || "IMOBILIÁRIA"}
                  </h1>
                  <p className="text-[10px] text-slate-550 max-w-md">
                    {companySettings?.address || "Endereço da Imobiliária"} {companySettings?.phone ? `| Tel: ${companySettings.phone}` : ""}
                  </p>
                  {companySettings?.cnpj && (
                    <p className="text-[10px] font-bold text-black mt-0.5">CNPJ: {companySettings.cnpj}</p>
                  )}
                </div>
                <div className="md:text-right">
                  <span className="inline-block px-3 py-1 border border-black text-[10px] font-bold tracking-wider uppercase text-black bg-slate-50">
                    Espelho de Ponto Individual
                  </span>
                  <p className="text-[10px] text-slate-600 mt-1 font-mono">
                    Referência: <strong>{formattedMonthName} / {year}</strong>
                  </p>
                </div>
              </div>

              {/* Employee Block Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="border border-dotted border-slate-400 p-2 rounded">
                  <span className="block text-[8px] font-bold uppercase text-slate-400">Nome do Colaborador</span>
                  <span className="font-extrabold text-slate-800 text-[11px]">{collaboratorName}</span>
                </div>
                <div className="border border-dotted border-slate-400 p-2 rounded">
                  <span className="block text-[8px] font-bold uppercase text-slate-400">CPF do Colaborador</span>
                  <span className="font-bold text-slate-800 text-[11px]">{collaborator?.cpf || "___.___.___-__"}</span>
                </div>
                <div className="border border-dotted border-slate-400 p-2 rounded">
                  <span className="block text-[8px] font-bold uppercase text-slate-400">Função / Cargo</span>
                  <span className="font-bold text-slate-800 text-[11px]">{getRoleLabel(collaborator)}</span>
                </div>
                <div className="border border-dotted border-slate-400 p-2 rounded">
                  <span className="block text-[8px] font-bold uppercase text-slate-400">Jornada Diária Registrada</span>
                  <span className="font-bold text-slate-800 text-[11px]">{formatMinutesToHoursFriendly(collaborator?.jornadaDiariaMinutos || 480)} / dia</span>
                </div>
              </div>
            </div>

            {/* Table Days Log */}
            <div className="border-l border-r border-t border-black mb-4 overflow-x-auto">
              <table className="w-full text-left text-black text-[10px] border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-100 border-b border-black font-black text-slate-800 text-xxs uppercase tracking-wider text-center">
                    <th className="py-2 px-2 text-left border-r border-black w-28">Dia / Semana</th>
                    <th className="py-2 px-1 border-r border-black w-16">Entrada</th>
                    <th className="py-2 px-1 border-r border-black w-18">S. Almoço</th>
                    <th className="py-2 px-1 border-r border-black w-18">R. Almoço</th>
                    <th className="py-2 px-1 border-r border-black w-16">Saída</th>
                    <th className="py-2 px-1 border-r border-black w-20">Trabalhado</th>
                    <th className="py-2 px-1 border-r border-black w-20">Saldo Diário</th>
                    <th className="py-2 px-2 text-left w-36">Visto / Rubrica</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/40">
                  {diasDoMes.map(dia => {
                    const diaStr = String(dia).padStart(2, '0');
                    const pDate = `${year}-${String(month).padStart(2, '0')}-${diaStr}`;
                    const reg = registrosMap.get(pDate);
                    const wName = getWeekDayName(pDate);
                    const isWeekend = wName === "Sáb" || wName === "Dom";

                    if (!reg) {
                      return (
                        <tr key={dia} className={`h-7 hover:bg-slate-50/55 ${isWeekend ? "bg-slate-50" : ""}`}>
                          <td className="py-1 px-2 font-mono font-bold border-r border-black">
                            {diaStr}/{String(month).padStart(2, '0')} <span className="text-[8px] font-normal text-slate-500">({wName})</span>
                          </td>
                          <td colSpan={4} className="py-1 px-1 border-r border-black text-center text-slate-400 italic text-[9px]">
                            {isWeekend ? "Fim de Semana" : "Sem Registro"}
                          </td>
                          <td className="py-1 px-1 border-r border-black text-center text-slate-400 font-mono">--:--</td>
                          <td className="py-1 px-1 border-r border-black text-center text-slate-400 font-mono">--:--</td>
                          <td className="py-1 px-2 border-black/40 text-center text-slate-300">
                            {isWeekend ? "" : "________________"}
                          </td>
                        </tr>
                      );
                    }

                    const trabalhadoStr = reg.horasTrabalhadas !== undefined 
                      ? formatMinutesToHHMM(reg.horasTrabalhadas) 
                      : "--:--";
                    const saldoStr = reg.horasExtras !== undefined 
                      ? (reg.horasExtras >= 0 ? "+" : "") + formatMinutesToHHMM(reg.horasExtras) 
                      : "--:--";

                    return (
                      <tr key={dia} className={`h-7 hover:bg-slate-50/55 ${isWeekend ? "bg-slate-50" : ""}`}>
                        <td className="py-1 px-2 font-mono font-bold border-r border-black">
                          {diaStr}/{String(month).padStart(2, '0')} <span className="text-[8px] font-bold text-slate-500">({wName})</span>
                        </td>
                        <td className="py-1 px-1 border-r border-black text-center font-semibold font-mono">{reg.entrada || "---"}</td>
                        <td className="py-1 px-1 border-r border-black text-center font-semibold font-mono">{reg.saidaAlmoco || "---"}</td>
                        <td className="py-1 px-1 border-r border-black text-center font-semibold font-mono">{reg.retornoAlmoco || "---"}</td>
                        <td className="py-1 px-1 border-r border-black text-center font-semibold font-mono">{reg.saida || "---"}</td>
                        <td className="py-1 px-1 border-r border-black text-center font-bold font-mono text-slate-900">{trabalhadoStr}</td>
                        <td className={`py-1 px-1 border-r border-black text-center font-bold font-mono ${reg.horasExtras && reg.horasExtras < 0 ? "text-amber-700" : "text-emerald-850"}`}>
                          {saldoStr}
                        </td>
                        <td className="py-1 px-2 border-black/40 text-center">
                          <span className="text-slate-300 text-[8px]">________________</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Resume and Legend Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-black p-3 mb-6 bg-slate-50 text-xs">
              <div>
                <h4 className="font-extrabold uppercase text-[10px] text-black border-b border-black pb-1 mb-2">Totais Consolidados do Período</h4>
                <div className="space-y-1.5 font-mono text-[11px] text-slate-800">
                  <div className="flex justify-between">
                    <span>Dias Corridos de Escala:</span>
                    <span className="font-bold">{totalDays} dias</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dias com Apuração Efetiva:</span>
                    <span className="font-bold">{diasTrabalhados} dias</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-slate-300 pt-1">
                    <span>SOMA HORAS TRABALHADAS:</span>
                    <span className="font-black text-black">{formatMinutesToHoursFriendly(totalTrabalhadas)} ({formatMinutesToHHMM(totalTrabalhadas)}h)</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-slate-300 pt-1">
                    <span>Banco Positivo Período (Extras):</span>
                    <span className="font-bold text-indigo-700">+{formatMinutesToHHMM(totalExcedente)}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Banco Negativo Período (Faltas/Atrasos):</span>
                    <span className="font-bold text-amber-600">-{formatMinutesToHHMM(totalDeficit)}h</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-400 pt-1.5 text-xs font-black">
                    <span>SALDO LÍQUIDO ACUMULADO:</span>
                    <span className={`font-black ${totalSaldoNet >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                      {totalSaldoNet >= 0 ? "+" : ""}{formatMinutesToHHMM(totalSaldoNet)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between">
                <div>
                  <h4 className="font-extrabold uppercase text-[10px] text-black border-b border-black pb-1 mb-2">Declaração Legitimidade de Jornada</h4>
                  <p className="text-[9px] text-justify text-slate-600 leading-relaxed">
                    Declaro que as informações constantes neste relatório de espelho de ponto eletrônico são a expressão da verdade operacional, correspondendo integralmente aos horários e intervalos por mim praticados e registrados no sistema de controle eletrônico durante o período de referência, para fins do disposto no Artigo 74 da CLT e normas vigentes do MTE.
                  </p>
                </div>
                <div className="text-[9px] text-slate-400 mt-4 text-right font-mono italic">
                  Ponto Eletrônico CLT | Emitido em: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}
                </div>
              </div>
            </div>

            {/* Signature Box Section */}
            <div className="mt-8 pt-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-center text-xs">
                <div className="flex flex-col items-center">
                  <div className="w-64 border-b border-black h-8 mb-2"></div>
                  <span className="font-bold uppercase text-black">{collaboratorName}</span>
                  <span className="text-[10px] text-slate-500">Assinatura do Colaborador</span>
                  {collaborator?.cpf && <span className="text-[9px] text-slate-400 font-mono mt-0.5">CPF: {collaborator.cpf}</span>}
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-64 border-b border-black h-8 mb-2"></div>
                  <span className="font-bold uppercase text-black">{companySettings?.name || "IMOBILIÁRIA / EMPREGADOR"}</span>
                  <span className="text-[10px] text-slate-500">Representante do Empregador</span>
                  {companySettings?.cnpj && <span className="text-[9px] text-slate-400 font-mono mt-0.5">CNPJ: {companySettings.cnpj}</span>}
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

