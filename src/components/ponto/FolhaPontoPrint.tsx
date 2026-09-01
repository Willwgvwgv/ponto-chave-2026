import React, { useRef } from "react";
import { X, Printer, ShieldCheck } from "lucide-react";
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
  const emissionDateStr = new Date().toLocaleDateString("pt-BR");
  const emissionTimeStr = new Date().toLocaleTimeString("pt-BR");

  const handlePrint = () => {
    const printContent = printContentRef.current || document.getElementById("printable-folha-content");
    if (!printContent) {
      window.print();
      return;
    }

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
              margin: 5mm 6mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff !important;
              color: #0f172a;
              font-size: 8.5px;
              line-height: 1.2;
              width: 100%;
              height: 100%;
              overflow: hidden;
            }
            .page-container {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
              padding: 0;
              page-break-inside: avoid;
              page-break-after: avoid;
            }
            
            /* Header */
            .header-card {
              border: 1.5px solid #0f172a;
              border-radius: 6px;
              padding: 6px 8px;
              margin-bottom: 5px;
              background: #ffffff;
            }
            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid #0f172a;
              padding-bottom: 4px;
              margin-bottom: 5px;
            }
            .company-name {
              font-size: 11px;
              font-weight: 900;
              text-transform: uppercase;
              color: #0f172a;
              margin: 0 0 1px 0;
              letter-spacing: -0.2px;
            }
            .company-sub {
              font-size: 7.5px;
              color: #475569;
              margin: 0;
              max-width: 480px;
            }
            .company-cnpj {
              font-size: 8px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 1px;
            }
            .badge-box {
              text-align: right;
            }
            .badge-title {
              display: inline-block;
              border: 1.5px solid #0f172a;
              background: #f8fafc;
              padding: 2px 8px;
              font-size: 8.5px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              border-radius: 4px;
            }
            .badge-ref {
              font-size: 8px;
              color: #334155;
              margin-top: 2px;
              font-family: monospace;
            }
            
            /* 4 Info Cards */
            .info-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 5px;
            }
            .info-item {
              border: 1px dashed #94a3b8;
              background: #f8fafc;
              border-radius: 4px;
              padding: 3px 6px;
            }
            .info-item-label {
              display: block;
              font-size: 6.5px;
              font-weight: 800;
              text-transform: uppercase;
              color: #64748b;
              margin-bottom: 1px;
            }
            .info-item-val {
              display: block;
              font-size: 9px;
              font-weight: 800;
              color: #0f172a;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            /* Table */
            .table-container {
              border: 1px solid #0f172a;
              margin-bottom: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            th, td {
              border: 1px solid #0f172a;
              padding: 1.5px 3px;
              text-align: center;
              font-size: 7.8px;
              height: 14.5px;
              line-height: 14.5px;
            }
            th {
              background-color: #f1f5f9 !important;
              color: #0f172a;
              font-weight: 900;
              font-size: 7.5px;
              text-transform: uppercase;
              letter-spacing: 0.2px;
              border-bottom: 1.5px solid #0f172a;
            }
            .th-day { width: 14%; text-align: left; padding-left: 4px; }
            .th-time { width: 9.5%; }
            .th-work { width: 12%; }
            .th-saldo { width: 12%; }
            .th-visto { width: 14%; text-align: left; }
            
            .td-day { text-align: left; font-weight: 700; font-family: monospace; font-size: 7.5px; padding-left: 4px; }
            .td-day-weekend { color: #64748b; font-weight: normal; font-size: 7px; }
            .td-weekend { background-color: #f8fafc !important; color: #64748b; font-style: italic; font-size: 7.2px; }
            .td-semreg { color: #94a3b8; font-style: italic; font-size: 7.2px; }
            .td-mono { font-family: monospace; font-weight: 700; font-size: 7.8px; }
            .td-work { font-family: monospace; font-weight: 900; color: #0f172a; font-size: 7.8px; }
            .td-saldo-pos { font-family: monospace; font-weight: 900; color: #047857; font-size: 7.8px; }
            .td-saldo-neg { font-family: monospace; font-weight: 900; color: #c2410c; font-size: 7.8px; }
            .td-empty { color: #94a3b8; font-family: monospace; font-size: 7.5px; }
            .td-rubrica { color: #94a3b8; font-size: 7px; text-align: center; }

            /* Summary Card */
            .summary-card {
              border: 1.5px solid #0f172a;
              border-radius: 6px;
              background: #f8fafc;
              padding: 5px 8px;
              margin-bottom: 6px;
              display: flex;
              justify-content: space-between;
              gap: 10px;
            }
            .summary-left {
              width: 50%;
            }
            .summary-right {
              width: 48%;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .summary-title {
              font-size: 8px;
              font-weight: 900;
              text-transform: uppercase;
              color: #0f172a;
              border-bottom: 1px solid #cbd5e1;
              padding-bottom: 2px;
              margin-bottom: 3px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              font-family: monospace;
              font-size: 7.5px;
              color: #1e293b;
              margin-bottom: 1.5px;
            }
            .summary-row-bold {
              font-weight: 800;
            }
            .summary-row-total {
              border-top: 1px solid #94a3b8;
              padding-top: 2px;
              margin-top: 2px;
              font-size: 8.5px;
              font-weight: 900;
            }
            .text-indigo { color: #4338ca; }
            .text-amber { color: #b45309; }
            .text-emerald { color: #047857; }
            .text-rose { color: #be123c; }

            .legal-text {
              font-size: 6.8px;
              text-align: justify;
              color: #475569;
              line-height: 1.25;
              margin: 0;
            }
            .legal-footer {
              font-size: 6.8px;
              color: #64748b;
              font-style: italic;
              text-align: right;
              font-family: monospace;
              margin-top: 2px;
            }

            /* Signatures */
            .signatures-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              text-align: center;
              margin-top: 6px;
            }
            .sig-box {
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .sig-line {
              width: 80%;
              max-width: 220px;
              border-bottom: 1px solid #0f172a;
              height: 18px;
              margin-bottom: 2px;
            }
            .sig-name {
              font-size: 8.5px;
              font-weight: 900;
              text-transform: uppercase;
              color: #0f172a;
            }
            .sig-role {
              font-size: 7px;
              color: #64748b;
            }
            .sig-doc {
              font-size: 6.8px;
              color: #64748b;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          <div class="page-container">
            ${printContent.innerHTML}
          </div>
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      
      {/* Main Container */}
      <div id="print-area-wrapper" className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 flex flex-col max-h-[95vh]">
        
        {/* Modal Header (Buttons & Controls) */}
        <div className="no-print p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">Visualização de Folha para Assinatura (CLT)</h3>
              <p className="text-xs text-slate-400">Layout ajustado em folha única A4 com cores e formatação completa para impressão/PDF.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-200 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Salvar PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scalable Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/50">
          
          <div 
            id="printable-folha-content" 
            ref={printContentRef}
            className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm max-w-3xl mx-auto text-slate-900"
          >
            {/* Header Layout Document */}
            <div className="header-card border border-slate-900 rounded-lg p-3 mb-2.5 bg-white">
              <div className="header-top flex justify-between items-center pb-2.5 mb-2.5 border-b border-slate-900 gap-2">
                <div>
                  <h1 className="company-name text-xs sm:text-sm font-black tracking-tight uppercase text-slate-900 m-0">
                    {companySettings?.name || "FIDELITÉ NEGÓCIOS IMOBILIÁRIOS"}
                  </h1>
                  <p className="company-sub text-[10px] text-slate-600 m-0 leading-tight">
                    {companySettings?.address || "Rua Principal, Centro"} {companySettings?.phone ? `| Tel: ${companySettings.phone}` : ""}
                  </p>
                  {companySettings?.cnpj && (
                    <p className="company-cnpj text-[10px] font-bold text-slate-900 mt-0.5 mb-0">CNPJ: {companySettings.cnpj}</p>
                  )}
                </div>
                <div className="badge-box text-right flex-shrink-0">
                  <div className="badge-title inline-block px-2.5 py-1 border border-slate-900 text-[10px] font-black tracking-wider uppercase text-slate-900 bg-slate-50 rounded">
                    Espelho de Ponto Individual
                  </div>
                  <div className="badge-ref text-[9px] text-slate-600 mt-0.5 font-mono">
                    Referência: <strong className="text-slate-900">{formattedMonthName} / {year}</strong>
                  </div>
                </div>
              </div>

              {/* Employee Block Fields */}
              <div className="info-grid grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="info-item border border-dashed border-slate-300 bg-slate-50/80 p-1.5 rounded">
                  <span className="info-item-label block text-[8px] font-bold uppercase text-slate-500">Nome do Colaborador</span>
                  <span className="info-item-val block font-black text-slate-900 text-[11px] truncate">{collaboratorName}</span>
                </div>
                <div className="info-item border border-dashed border-slate-300 bg-slate-50/80 p-1.5 rounded">
                  <span className="info-item-label block text-[8px] font-bold uppercase text-slate-500">CPF do Colaborador</span>
                  <span className="info-item-val block font-bold text-slate-800 text-[11px] font-mono">{collaborator?.cpf || "___.___.___-__"}</span>
                </div>
                <div className="info-item border border-dashed border-slate-300 bg-slate-50/80 p-1.5 rounded">
                  <span className="info-item-label block text-[8px] font-bold uppercase text-slate-500">Função / Cargo</span>
                  <span className="info-item-val block font-bold text-slate-800 text-[11px]">{getRoleLabel(collaborator)}</span>
                </div>
                <div className="info-item border border-dashed border-slate-300 bg-slate-50/80 p-1.5 rounded">
                  <span className="info-item-label block text-[8px] font-bold uppercase text-slate-500">Jornada Diária Registrada</span>
                  <span className="info-item-val block font-bold text-slate-800 text-[11px]">{formatMinutesToHoursFriendly(collaborator?.jornadaDiariaMinutos || 480)} / dia</span>
                </div>
              </div>
            </div>

            {/* Table Days Log */}
            <div className="table-container border border-slate-900 mb-2.5 overflow-hidden rounded-sm">
              <table className="w-full text-left text-slate-900 text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-900 font-black text-slate-900 text-[9px] uppercase tracking-wider text-center">
                    <th className="th-day py-1 px-1.5 text-left border-r border-slate-900 w-[14%]">Dia / Semana</th>
                    <th className="th-time py-1 px-1 border-r border-slate-900 w-[9.5%]">Entrada</th>
                    <th className="th-time py-1 px-1 border-r border-slate-900 w-[9.5%]">S. Almoço</th>
                    <th className="th-time py-1 px-1 border-r border-slate-900 w-[9.5%]">R. Almoço</th>
                    <th className="th-time py-1 px-1 border-r border-slate-900 w-[9.5%]">Saída</th>
                    <th className="th-work py-1 px-1 border-r border-slate-900 w-[12%]">Trabalhado</th>
                    <th className="th-saldo py-1 px-1 border-r border-slate-900 w-[12%]">Saldo Diário</th>
                    <th className="th-visto py-1 px-1.5 text-left w-[14%]">Visto / Rubrica</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {diasDoMes.map(dia => {
                    const diaStr = String(dia).padStart(2, '0');
                    const pDate = `${year}-${String(month).padStart(2, '0')}-${diaStr}`;
                    const reg = registrosMap.get(pDate);
                    const wName = getWeekDayName(pDate);
                    const isWeekend = wName === "Sáb" || wName === "Dom";

                    if (!reg) {
                      return (
                        <tr key={dia} className={`h-4.5 ${isWeekend ? "bg-slate-50/80" : "bg-white"}`}>
                          <td className="td-day py-0.5 px-1.5 font-mono font-bold border-r border-slate-900 text-[9px]">
                            {diaStr}/{String(month).padStart(2, '0')} <span className="td-day-weekend text-[8px] font-normal text-slate-500">({wName})</span>
                          </td>
                          <td colSpan={4} className={`td-weekend py-0.5 px-1 border-r border-slate-900 text-center italic text-[8.5px] ${isWeekend ? "text-slate-400" : "td-semreg text-slate-400"}`}>
                            {isWeekend ? "Fim de Semana" : "Sem Registro"}
                          </td>
                          <td className="td-empty py-0.5 px-1 border-r border-slate-900 text-center text-slate-400 font-mono text-[8.5px]">--:--</td>
                          <td className="td-empty py-0.5 px-1 border-r border-slate-900 text-center text-slate-400 font-mono text-[8.5px]">--:--</td>
                          <td className="td-rubrica py-0.5 px-1.5 text-center text-slate-300">
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

                    const isNegative = reg.horasExtras !== undefined && reg.horasExtras < 0;
                    const isPositive = reg.horasExtras !== undefined && reg.horasExtras > 0;

                    return (
                      <tr key={dia} className={`h-4.5 ${isWeekend ? "bg-slate-50/80" : "bg-white"}`}>
                        <td className="td-day py-0.5 px-1.5 font-mono font-bold border-r border-slate-900 text-[9px]">
                          {diaStr}/{String(month).padStart(2, '0')} <span className="td-day-weekend text-[8px] font-bold text-slate-600">({wName})</span>
                        </td>
                        <td className="td-mono py-0.5 px-1 border-r border-slate-900 text-center font-bold font-mono text-[9px] text-slate-800">{reg.entrada || "---"}</td>
                        <td className="td-mono py-0.5 px-1 border-r border-slate-900 text-center font-bold font-mono text-[9px] text-slate-800">{reg.saidaAlmoco || "---"}</td>
                        <td className="td-mono py-0.5 px-1 border-r border-slate-900 text-center font-bold font-mono text-[9px] text-slate-800">{reg.retornoAlmoco || "---"}</td>
                        <td className="td-mono py-0.5 px-1 border-r border-slate-900 text-center font-bold font-mono text-[9px] text-slate-800">{reg.saida || "---"}</td>
                        <td className="td-work py-0.5 px-1 border-r border-slate-900 text-center font-black font-mono text-[9px] text-slate-950">{trabalhadoStr}</td>
                        <td className={`py-0.5 px-1 border-r border-slate-900 text-center font-black font-mono text-[9px] ${isNegative ? "td-saldo-neg text-amber-700" : isPositive ? "td-saldo-pos text-emerald-700" : "text-slate-600"}`}>
                          {saldoStr}
                        </td>
                        <td className="td-rubrica py-0.5 px-1.5 text-center text-slate-300">
                          <span>________________</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Resume and Legend Blocks */}
            <div className="summary-card border border-slate-900 rounded-lg p-2.5 mb-2.5 bg-slate-50/90 text-[10px] flex flex-col sm:flex-row justify-between gap-3">
              <div className="summary-left sm:w-1/2">
                <h4 className="summary-title font-black uppercase text-[9px] text-slate-900 border-b border-slate-300 pb-1 mb-1.5">Totais Consolidados do Período</h4>
                <div className="space-y-0.5 font-mono text-[9px] text-slate-800">
                  <div className="summary-row flex justify-between">
                    <span>Dias Corridos de Escala:</span>
                    <span className="summary-row-bold font-bold text-slate-900">{totalDays} dias</span>
                  </div>
                  <div className="summary-row flex justify-between">
                    <span>Dias com Apuração Efetiva:</span>
                    <span className="summary-row-bold font-bold text-slate-900">{diasTrabalhados} dias</span>
                  </div>
                  <div className="summary-row flex justify-between border-t border-dashed border-slate-300 pt-0.5">
                    <span>SOMA HORAS TRABALHADAS:</span>
                    <span className="summary-row-bold font-black text-slate-950">{formatMinutesToHoursFriendly(totalTrabalhadas)} ({formatMinutesToHHMM(totalTrabalhadas)}h)</span>
                  </div>
                  <div className="summary-row flex justify-between border-t border-dashed border-slate-300 pt-0.5">
                    <span>Banco Positivo Período (Extras):</span>
                    <span className="summary-row-bold font-bold text-indigo-700 text-indigo">+{formatMinutesToHHMM(totalExcedente)}h</span>
                  </div>
                  <div className="summary-row flex justify-between">
                    <span>Banco Negativo Período (Faltas/Atrasos):</span>
                    <span className="summary-row-bold font-bold text-amber-600 text-amber">-{formatMinutesToHHMM(totalDeficit)}h</span>
                  </div>
                  <div className="summary-row summary-row-total flex justify-between border-t border-slate-400 pt-1 text-[10px] font-black">
                    <span>SALDO LÍQUIDO ACUMULADO:</span>
                    <span className={`font-black ${totalSaldoNet >= 0 ? "text-emerald-700 text-emerald" : "text-rose-600 text-rose"}`}>
                      {totalSaldoNet >= 0 ? "+" : ""}{formatMinutesToHHMM(totalSaldoNet)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="summary-right sm:w-1/2 flex flex-col justify-between">
                <div>
                  <h4 className="summary-title font-black uppercase text-[9px] text-slate-900 border-b border-slate-300 pb-1 mb-1.5">Declaração Legitimidade de Jornada</h4>
                  <p className="legal-text text-[8px] text-justify text-slate-600 leading-tight m-0">
                    Declaro que as informações constantes neste relatório de espelho de ponto eletrônico são a expressão da verdade operacional, correspondendo integralmente aos horários e intervalos por mim praticados e registrados no sistema de controle eletrônico durante o período de referência, para fins do disposto no Artigo 74 da CLT e normas vigentes do MTE.
                  </p>
                </div>
                <div className="legal-footer text-[8px] text-slate-400 mt-1 text-right font-mono italic">
                  Ponto Eletrônico CLT | Emitido em: {emissionDateStr} às {emissionTimeStr}
                </div>
              </div>
            </div>

            {/* Signature Box Section */}
            <div className="signatures-grid grid grid-cols-2 gap-4 text-center mt-3 pt-1">
              <div className="sig-box flex flex-col items-center">
                <div className="sig-line w-48 sm:w-56 border-b border-slate-900 h-5 mb-1"></div>
                <span className="sig-name font-black uppercase text-slate-900 text-[10px]">{collaboratorName}</span>
                <span className="sig-role text-[8px] text-slate-500">Assinatura do Colaborador</span>
                {collaborator?.cpf && <span className="sig-doc text-[8px] text-slate-400 font-mono mt-0.5">CPF: {collaborator.cpf}</span>}
              </div>

              <div className="sig-box flex flex-col items-center">
                <div className="sig-line w-48 sm:w-56 border-b border-slate-900 h-5 mb-1"></div>
                <span className="sig-name font-black uppercase text-slate-900 text-[10px]">{companySettings?.name || "FIDELITÉ NEGÓCIOS IMOBILIÁRIOS"}</span>
                <span className="sig-role text-[8px] text-slate-500">Representante do Empregador</span>
                {companySettings?.cnpj && <span className="sig-doc text-[8px] text-slate-400 font-mono mt-0.5">CNPJ: {companySettings.cnpj}</span>}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
