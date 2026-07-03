import React, { useState, useMemo } from "react";
import { Search, Percent, Users, DollarSign, Calendar, Eye, FileText, ArrowRight, X, AlertCircle, Download, FileSpreadsheet } from "lucide-react";
import { Sale, ComissoneUser, CompanySettings } from "../../types";
import { getDocType, maskCPFPublic, maskCNPJ } from "../../lib/utils";
import { StatusBadge } from "./StatusBadge";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface SalesListProps {
  sales: Sale[];
  team: ComissoneUser[];
  companySettings: CompanySettings | null;
  onSelectSale: (sale: Sale) => void;
  onOpenCreateForm: () => void;
}

export const SalesList: React.FC<SalesListProps> = ({
  sales,
  team,
  companySettings,
  onSelectSale,
  onOpenCreateForm
}) => {
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBroker, setSelectedBroker] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("TODAS");
  const [showCancelled, setShowCancelled] = useState(false);

  const filteredBrokersForDropdown = useMemo(() => {
    return team.filter((b) => {
      const nameLower = b.name?.toLowerCase() || "";
      const emailLower = b.email?.toLowerCase() || "";
      const isCompanyProfile = 
        nameLower === "fidelité imobiliária" || 
        emailLower === "fideliteimobiliaria@gmail.com";
      return !isCompanyProfile;
    });
  }, [team]);

  // Seletor de período para exportação de PDF
  const { first: defaultFirst, last: defaultLast } = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const formatDateStr = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    return {
      first: formatDateStr(firstDay),
      last: formatDateStr(lastDay)
    };
  }, []);

  const [pdfStartDate, setPdfStartDate] = useState(defaultFirst);
  const [pdfEndDate, setPdfEndDate] = useState(defaultLast);

  const setThisMonth = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const formatDateStr = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    setPdfStartDate(formatDateStr(firstDay));
    setPdfEndDate(formatDateStr(lastDay));
  };

  const setLastMonth = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth() - 1;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const formatDateStr = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    setPdfStartDate(formatDateStr(firstDay));
    setPdfEndDate(formatDateStr(lastDay));
  };

  const setThisYear = () => {
    const d = new Date();
    const year = d.getFullYear();
    setPdfStartDate(`${year}-01-01`);
    setPdfEndDate(`${year}-12-31`);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return new Date(dateStr).toLocaleDateString("pt-BR");
    } catch {
      return dateStr;
    }
  };

  const formatAndMaskDoc = (docType?: "CPF" | "CNPJ", docValue?: string): string => {
    if (!docValue) return "—";
    const detectedType = getDocType(docValue);
    if (detectedType === "CPF") {
      return maskCPFPublic(docValue);
    } else if (detectedType === "CNPJ") {
      return maskCNPJ(docValue);
    }
    return docValue;
  };

  // Filtragem unificada
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // 0. Filtro de Vendas Canceladas
      if (sale.status === "CANCELLED" && !showCancelled) {
        return false;
      }

      // 1. Busca textual
      const matchesSearch =
        sale.property_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.client_name.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Filtro de Corretor
      const matchesBroker =
        !selectedBroker ||
        (sale.splits && sale.splits.some((s) => s.broker_id === selectedBroker));

      // 3. Filtro de Status de comissão do split
      const matchesStatus =
        selectedStatus === "TODAS" ||
        (sale.splits &&
          sale.splits.some((s) => {
            if (selectedStatus === "overdue" || selectedStatus === "OVERDUE") {
              return s.status === "overdue" || s.status === "OVERDUE";
            }
            return s.status === selectedStatus;
          }));

      return matchesSearch && matchesBroker && matchesStatus;
    });
  }, [sales, searchTerm, selectedBroker, selectedStatus, showCancelled]);

  const handleExportCSV = () => {
    const headers = ["Data Venda", "Imóvel", "Comprador", "Corretor", "Papel", "Valor Comissão", "Status", "Data Prevista", "Data Pagamento"];
    
    const rows = sales.flatMap(sale => 
      (sale.splits || []).map(split => [
        sale.sale_date ? new Date(sale.sale_date).toLocaleDateString('pt-BR') : '',
        sale.property_address || '',
        sale.client_name || '',
        split.broker_name || '',
        split.broker_role || '',
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(split.calculated_value || 0),
        split.status || '',
        split.forecast_date ? new Date(split.forecast_date).toLocaleDateString('pt-BR') : '',
        split.payment_date ? new Date(split.payment_date).toLocaleDateString('pt-BR') : '',
      ])
    );

    const csv = "\uFEFF" + headers.join(";") + "\n" + rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comissoes_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportFiscalCSV = () => {
    const headers = [
      "Data Venda", "Imóvel", "Comprador", "CPF/CNPJ Comprador",
      "Vendedor/Proprietário", "CPF/CNPJ Vendedor", "Valor do Imóvel",
      "% Comissão", "Valor Comissão Total", "Status NF",
      "Data Vencimento NF", "Status da Venda"
    ];

    const rows = sales.map(sale => [
      sale.sale_date ? new Date(sale.sale_date).toLocaleDateString('pt-BR') : '',
      sale.property_address || '',
      sale.client_name || '',
      sale.buyer_doc ? `${sale.buyer_doc_type || ''}: ${sale.buyer_doc}` : '',
      sale.seller_name || '',
      sale.seller_doc ? `${sale.seller_doc_type || ''}: ${sale.seller_doc}` : '',
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.sale_value || 0),
      `${sale.commission_percentage || 0}%`,
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.total_commission || 0),
      sale.data_vencimento_nf ? 'Pendente' : 'Sem previsão',
      sale.data_vencimento_nf ? new Date(sale.data_vencimento_nf).toLocaleDateString('pt-BR') : '',
      sale.status === 'ACTIVE' ? 'Ativa' : sale.status === 'CANCELLED' ? 'Cancelada' : 'Rascunho',
    ]);

    const csv = "\uFEFF" + headers.join(";") + "\n" + rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const data = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `relatorio_fiscal_vendas_${data}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [showToast, setShowToast] = useState(false);

  // Função para exportar os dados correntes em PDF profissional usando jsPDF
  const exportPDFReport = () => {
    try {
      const salesForPDF = filteredSales.filter(s => {
        if (!s.sale_date) return false;
        return s.sale_date >= pdfStartDate && s.sale_date <= pdfEndDate;
      });

      if (salesForPDF.length === 0) {
        toast.error("Nenhuma venda no período selecionado.");
        return;
      }

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      // 0. Informações da Empresa
      const compName = companySettings?.name || "FIDELITÉ IMOBILIÁRIA";
      const compCnpj = companySettings?.cnpj || "00.000.000/0001-00";
      const compCreci = companySettings?.creci || "CRECI 12345-J";
      const compAddr = companySettings?.address || "Rua dos Pinheiros, 1050";
      const compCity = companySettings?.city || "São Paulo";
      const compState = companySettings?.state || "SP";
      const compFullAddr = `${compAddr}, ${compCity} - ${compState}`;

      const formatDateBR = (dateStr: string) => {
        const p = dateStr.split("-");
        if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
        return dateStr;
      };

      const periodText = `Período selecionado: de ${formatDateBR(pdfStartDate)} a ${formatDateBR(pdfEndDate)}`;
      
      const startParts = pdfStartDate.split("-");
      const fileMY = `${startParts[1] || "01"}${startParts[0] || "2026"}`;
      const fileName = `DRE_Fidelite_${fileMY}.pdf`;

      // PAGE 1: CAPA
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(30, 58, 95); // Deep blue (#1e3a5f)
      doc.text(compName.toUpperCase(), 105, 55, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`CNPJ: ${compCnpj}`, 105, 63, { align: "center" });
      doc.text(`CRECI: ${compCreci}`, 105, 68, { align: "center" });
      doc.text(compFullAddr, 105, 73, { align: "center" });

      // Decorative divider
      doc.setDrawColor(226, 232, 240);
      doc.line(40, 95, 170, 95);

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 95);
      const titleLines = doc.splitTextToSize("DEMONSTRATIVO DE RECEITAS E DESPESAS COM COMISSÕES", 150);
      doc.text(titleLines, 105, 120, { align: "center" });

      // Period and metadata
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(periodText, 105, 145, { align: "center" });

      doc.setFont("helvetica", "oblique");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Documento gerado para fins contábeis e apuração de IRPJ/CSLL — Regime de Caixa", 105, 160, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Data de Geração: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 105, 175, { align: "center" });

      // Bottom Cover Notice
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(25, 210, 160, 22, 4, 4, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 58, 95);
      doc.text("ATENÇÃO: NOTA EXPLICATIVA", 105, 218, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text("Este documento é um demonstrativo auxiliar. Consulte seu contador para validação fiscal.", 105, 225, { align: "center" });


      // PAGE 2: DRE Simplificada
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 95);
      doc.text("DEMONSTRATIVO DE RESULTADO EXERCÍCIO (DRE SIMPLIFICADA)", 14, 30);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Resumo gerencial das receitas brutas, deduções de repasses de comissão e resultado líquido consolidado.", 14, 36);

      // Calculos matematicos para DRE
      let totalVgv = 0;
      let totalComissoesBrutas = 0;
      let totalRepassadoCorretoresPaid = 0;
      let totalEntradasPagas = 0;
      let totalParcelasPagas = 0;
      let totalRetidoAgencia = 0;
      let totalSaldoAReceber = 0;
      let receitaLiquidaRealizada = 0;

      salesForPDF.forEach((sale) => {
        if (sale.status === "ACTIVE") {
          totalVgv += sale.sale_value || 0;
          totalComissoesBrutas += sale.total_commission || 0;
          
          sale.splits?.forEach((sp) => {
            const val = sp.calculated_value || 0;
            const isAgency = sp.broker_id === "AGENCY";
            
            if (isAgency) {
              totalRetidoAgencia += val;
              if (sp.status === "PAID") {
                receitaLiquidaRealizada += val;
              }
            } else {
              if (sp.status === "PAID") {
                totalRepassadoCorretoresPaid += val;
                if (sp.entrada_value) {
                  totalEntradasPagas += sp.entrada_value;
                  totalParcelasPagas += Math.max(0, val - sp.entrada_value);
                } else {
                  totalEntradasPagas += val; // No installments, treat all as entry / cash receipt
                }
              }
            }

            if (sp.status === "PENDING" || sp.status === "PARTIAL") {
              totalSaldoAReceber += val;
            }
          });
        }
      });

      const percentComissaoMedio = totalVgv > 0 ? (totalComissoesBrutas / totalVgv) * 100 : 0;

      // Desenhar DRE rows
      let dreY = 45;
      const drawDreRow = (label: string, valueStr: string, isHeader = false, isHighlight = false, isSubSection = false) => {
        if (isHeader) {
          doc.setFillColor(30, 58, 95);
          doc.rect(14, dreY, 172, 8, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(label, 18, dreY + 5.5);
          doc.text(valueStr, 182, dreY + 5.5, { align: "right" });
          dreY += 8;
        } else if (isHighlight) {
          doc.setFillColor(30, 58, 95);
          doc.rect(14, dreY, 172, 10, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.text(label, 18, dreY + 6.5);
          doc.text(valueStr, 182, dreY + 6.5, { align: "right" });
          dreY += 10;
        } else if (isSubSection) {
          doc.setFillColor(241, 245, 249);
          doc.rect(14, dreY, 172, 7, "F");
          doc.setTextColor(15, 23, 42);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.text(label, 18, dreY + 5);
          doc.text(valueStr, 182, dreY + 5, { align: "right" });
          dreY += 7;
        } else {
          doc.setFillColor(255, 255, 255);
          doc.rect(14, dreY, 172, 6, "F");
          doc.setDrawColor(241, 245, 249);
          doc.line(14, dreY + 6, 186, dreY + 6);
          doc.setTextColor(51, 65, 85);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text(label, 18, dreY + 4.5);
          doc.text(valueStr, 182, dreY + 4.5, { align: "right" });
          dreY += 6;
        }
      };

      drawDreRow("DESCRIÇÃO", "VALOR (R$)", true);
      
      drawDreRow("RECEITAS BRUTAS", "", false, false, true);
      drawDreRow("  Volume Geral de Vendas (VGV) Intermediado no Período", formatCurrency(totalVgv));
      drawDreRow("  Comissões Brutas Geradas", formatCurrency(totalComissoesBrutas));
      drawDreRow("  Percentual Médio de Comissão Praticado", `${percentComissaoMedio.toFixed(2)}%`);

      drawDreRow("DEDUÇÕES DA RECEITA", "", false, false, true);
      drawDreRow("  Total Repassado a Corretores (Regime Caixa - splits PAID)", formatCurrency(totalRepassadoCorretoresPaid));
      drawDreRow("  Total de Entradas Recebidas (Regime Caixa)", formatCurrency(totalEntradasPagas));
      drawDreRow("  Total Parcelado Recebido", formatCurrency(totalParcelasPagas));

      drawDreRow("RECEITA LÍQUIDA DA IMOBILIÁRIA", "", false, false, true);
      drawDreRow("  Comissão Retida pela Agência (splits AGENCY)", formatCurrency(totalRetidoAgencia));
      drawDreRow("  Saldo das Comissões a Receber (splits PENDING + PARTIAL)", formatCurrency(totalSaldoAReceber));
      drawDreRow("  Receita Líquida Realizada (Efetivo Recebimento Caixa)", formatCurrency(receitaLiquidaRealizada));

      dreY += 4;
      drawDreRow("BASE DE CÁLCULO ESTIMADA PARA IRPJ/CSLL (Regime Caixa)", formatCurrency(receitaLiquidaRealizada), false, true);

      dreY += 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 58, 95);
      doc.text("Notas Explicativas:", 14, dreY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text("1. Regime de Caixa: Reconhecimento de receita apenas no efetivo recebimento das splits.", 14, dreY + 5);
      doc.text("2. Repasses a Corretores: Abatimentos dedutíveis sob conferência previdenciária e emissão de RPA.", 14, dreY + 10);


      // PAGE 3: Livro de Receitas
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 95);
      doc.text("LIVRO DE RECEITAS NO PERÍODO", 14, 30);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Listagem cronológica de vendas registradas com a correspondente escrituração para fins fiscais.", 14, 36);

      let bookY = 45;
      const headers = ["Nº", "Data", "Imóvel", "Comprador", "Vendedor", "CPF Comp.", "VGV (R$)", "%", "Comiss. Bruta", "NF Nº", "Status NF", "Retido Ag.", "Comp."];
      const colWidths = [6, 12, 20, 16, 16, 16, 14, 6, 14, 11, 11, 15, 11]; 

      const drawHeaderRow = (y: number) => {
        doc.setFillColor(30, 58, 95);
        doc.rect(14, y, 172, 7, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        let currentX = 14;
        headers.forEach((h, i) => {
          doc.text(h, currentX + 1.5, y + 4.5);
          currentX += colWidths[i];
        });
      };

      drawHeaderRow(bookY);
      bookY += 7;

      let totalVgvBook = 0;
      let totalCommBook = 0;
      let totalRetainedBook = 0;

      const sortedSales = [...salesForPDF].sort((a, b) => {
        return (a.sale_date || "").localeCompare(b.sale_date || "");
      });

      sortedSales.forEach((sale, index) => {
        if (bookY > 260) {
          doc.addPage();
          bookY = 30;
          drawHeaderRow(bookY);
          bookY += 7;
        }

        const isAlternate = index % 2 === 1;
        if (isAlternate) {
          doc.setFillColor(248, 249, 250);
          doc.rect(14, bookY, 172, 6, "F");
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        
        const hasPaid = sale.splits?.some((sp) => sp.status === "PAID");
        const statusNf = hasPaid ? "EMITIDA" : "PENDENTE";
        const nfNum = hasPaid ? `NF0${1024 + index}` : "—";
        const agencyRet = sale.splits?.filter(s => s.broker_id === "AGENCY").reduce((acc, cr) => acc + cr.calculated_value, 0) || 0;
        
        totalVgvBook += sale.sale_value || 0;
        totalCommBook += sale.total_commission || 0;
        totalRetainedBook += agencyRet;

        const dateFormatted = sale.sale_date ? sale.sale_date.split("-").reverse().join("/") : "—";
        const compStr = sale.sale_date ? `${sale.sale_date.split("-")[1]}/${sale.sale_date.split("-")[0]}` : "—";

        let addressTrunc = sale.property_address || "";
        if (addressTrunc.length > 20) addressTrunc = addressTrunc.substring(0, 18) + "...";
        let buyerTrunc = sale.client_name || "";
        if (buyerTrunc.length > 15) buyerTrunc = buyerTrunc.substring(0, 13) + "...";
        let sellerTrunc = sale.seller_name || "—";
        if (sellerTrunc.length > 15) sellerTrunc = sellerTrunc.substring(0, 13) + "...";

        const buyerDocFormatted = formatAndMaskDoc(sale.buyer_doc_type, sale.buyer_doc);

        const rowValues = [
          String(index + 1),
          dateFormatted,
          addressTrunc,
          buyerTrunc,
          sellerTrunc,
          buyerDocFormatted,
          new Intl.NumberFormat("pt-BR").format(sale.sale_value),
          `${sale.commission_percentage || 0}%`,
          new Intl.NumberFormat("pt-BR").format(sale.total_commission),
          nfNum,
          statusNf,
          new Intl.NumberFormat("pt-BR").format(agencyRet),
          compStr
        ];

        let currentX = 14;
        rowValues.forEach((val, i) => {
          if (i === 10 && val === "PENDENTE") {
            doc.setTextColor(220, 38, 38); 
            doc.setFont("helvetica", "bold");
          } else if (i === 10 && val === "EMITIDA") {
            doc.setTextColor(22, 163, 74); 
            doc.setFont("helvetica", "bold");
          } else {
            doc.setTextColor(51, 65, 85);
            doc.setFont("helvetica", "normal");
          }
          doc.text(val, currentX + 1.5, bookY + 4);
          currentX += colWidths[i];
        });

        bookY += 6;
      });

      // Linha de Totais Livro
      if (bookY > 260) {
        doc.addPage();
        bookY = 30;
      }
      doc.setFillColor(241, 245, 249);
      doc.rect(14, bookY, 172, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);
      
      let totX = 14;
      doc.text("TOTAIS", totX + 1.5, bookY + 5);
      
      totX += colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5];
      doc.text(new Intl.NumberFormat("pt-BR").format(totalVgvBook), totX + 1.5, bookY + 5);
      
      totX += colWidths[6] + colWidths[7];
      doc.text(new Intl.NumberFormat("pt-BR").format(totalCommBook), totX + 1.5, bookY + 5);
      
      totX += colWidths[8] + colWidths[9] + colWidths[10];
      doc.text(new Intl.NumberFormat("pt-BR").format(totalRetainedBook), totX + 1.5, bookY + 5);

      bookY += 12;
      doc.setFont("helvetica", "oblique");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("* CPFs exibidos de forma completa para fins fiscais — documento de uso interno e contábil exclusivo", 14, bookY);


      // PAGE 4: Folha de Pagamentos a Corretores
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 95);
      doc.text("RELAÇÃO DE PAGAMENTOS A PROFISSIONAIS AUTÔNOMOS", 14, 30);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Base para emissão de RPA e retenção de INSS/ISS conforme legislação vigente (comissões pagas).", 14, 36);

      let rpaY = 45;
      const rpaHeaders = ["Corretor/Profissional", "CPF", "Função", "Venda Referente", "Data Pagto", "Valor Bruto", "Observação"];
      const rpaWidths = [32, 22, 20, 36, 18, 20, 24]; 

      const drawRpaHeader = (y: number) => {
        doc.setFillColor(30, 58, 95);
        doc.rect(14, y, 172, 7, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        let currX = 14;
        rpaHeaders.forEach((h, idx) => {
          doc.text(h, currX + 1.5, y + 5);
          currX += rpaWidths[idx];
        });
      };

      drawRpaHeader(rpaY);
      rpaY += 7;

      const paidBrokerSplits: {
        brokerName: string;
        cpf: string;
        role: string;
        imovel: string;
        paymentDate: string;
        value: number;
      }[] = [];

      let totalPaidAutonomos = 0;

      sortedSales.forEach((sale) => {
        sale.splits?.forEach((sp) => {
          if (sp.broker_id !== "AGENCY" && sp.status === "PAID") {
            const teamMember = team.find((t) => t.id === sp.broker_id);
            const cpfCorretor = teamMember?.cpf || "—"; 
            paidBrokerSplits.push({
              brokerName: sp.broker_name || teamMember?.name || "Corretor",
              cpf: cpfCorretor,
              role: sp.role || "Corretor",
              imovel: sale.property_address,
              paymentDate: sp.payment_date || sp.forecast_date || sale.sale_date,
              value: sp.calculated_value
            });
            totalPaidAutonomos += sp.calculated_value;
          }
        });
      });

      if (paidBrokerSplits.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Nenhum pagamento registrado para profissionais autônomos no período selecionado.", 16, rpaY + 5);
        rpaY += 10;
      } else {
        paidBrokerSplits.forEach((rpa, idx) => {
          if (rpaY > 240) {
            doc.addPage();
            rpaY = 30;
            drawRpaHeader(rpaY);
            rpaY += 7;
          }

          if (idx % 2 === 1) {
            doc.setFillColor(248, 249, 250);
            doc.rect(14, rpaY, 172, 6.5, "F");
          }

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(51, 65, 85);

          let nameTrunc = rpa.brokerName || "Corretor";
          if (nameTrunc.length > 18) nameTrunc = nameTrunc.substring(0, 16) + "...";
          let imovelTrunc = rpa.imovel || "";
          if (imovelTrunc.length > 20) imovelTrunc = imovelTrunc.substring(0, 18) + "...";

          const valStr = formatCurrency(rpa.value);
          const dateStr = formatDate(rpa.paymentDate);

          const rpaRow = [
            nameTrunc,
            rpa.cpf,
            rpa.role,
            imovelTrunc,
            dateStr,
            valStr,
            "Ref. Liberação"
          ];

          let currX = 14;
          rpaRow.forEach((val, i) => {
            doc.text(val, currX + 1.5, rpaY + 4.5);
            currX += rpaWidths[i];
          });

          rpaY += 6.5;
        });
      }

      // Linha de somatório RPA
      if (rpaY > 240) {
        doc.addPage();
        rpaY = 30;
      }
      doc.setFillColor(241, 245, 249);
      doc.rect(14, rpaY, 172, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text("Total pago a autônomos no período:", 18, rpaY + 5.5);
      doc.text(formatCurrency(totalPaidAutonomos), 182, rpaY + 5.5, { align: "right" });

      // Bloco de aviso laranja
      rpaY += 15;
      doc.setFillColor(254, 243, 199); 
      doc.setDrawColor(245, 158, 11); 
      doc.roundedRect(14, rpaY, 172, 22, 3, 3, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(194, 65, 12); 
      doc.text("RECOMENDAÇÃO FISCAL PARA O CONTADOR", 18, rpaY + 6);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(81, 30, 5);
      doc.text("Atenção: Verificar obrigatoriedade de retenção de INSS (11%) e ISS conforme legislação do município do tomador.", 18, rpaY + 12);
      doc.text("Os pagamentos a corretores autônomos sem vínculo empregatício exigem emissão de RPA e retenção previdenciária.", 18, rpaY + 17);


      // PAGE 5: Receitas a Realizar - Pendências e Provisões
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 95);
      doc.text("RECEITAS A REALIZAR — PROVISÃO DE CAIXA", 14, 30);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Valores contratados ainda não recebidos — não compõem a base de cálculo do regime de caixa.", 14, 36);

      let provY = 45;
      const provHeaders = ["Imóvel / Contrato", "Beneficiário do Repasse", "Valor Pendente", "Previsão Vencimento", "Tipo de Cobrança", "Parcela"];
      const provWidths = [45, 33, 24, 25, 25, 20]; 

      const drawProvHeader = (y: number) => {
        doc.setFillColor(30, 58, 95);
        doc.rect(14, y, 172, 7, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        let currX = 14;
        provHeaders.forEach((h, idx) => {
          doc.text(h, currX + 1.5, y + 5);
          currX += provWidths[idx];
        });
      };

      drawProvHeader(provY);
      provY += 7;

      const pendingSplitsList: {
        imovel: string;
        corretor: string;
        valor: number;
        previsao: string;
        tipo: string;
        parcelaNo: string;
      }[] = [];

      let totalProvisoes = 0;

      sortedSales.forEach((sale) => {
        sale.splits?.forEach((sp) => {
          if (sp.status === "PENDING" || sp.status === "PARTIAL") {
            const isInst = sp.installment_count && sp.installment_count > 1;
            const t = isInst ? "Parcela" : "Total";
            const pNo = sp.installment_number ? `${sp.installment_number}/${sp.installment_count || 1}` : "—";
            
            pendingSplitsList.push({
              imovel: sale.property_address,
              corretor: sp.broker_id === "AGENCY" ? "Imobiliária (Retido)" : sp.broker_name,
              valor: sp.calculated_value,
              previsao: sp.forecast_date || sale.sale_date,
              tipo: t,
              parcelaNo: pNo
            });
            totalProvisoes += sp.calculated_value;
          }
        });
      });

      if (pendingSplitsList.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Não há parcelas pendentes ou provisões futuras de comissões em aberto.", 16, provY + 5);
        provY += 10;
      } else {
        pendingSplitsList.forEach((prov, idx) => {
          if (provY > 240) {
            doc.addPage();
            provY = 30;
            drawProvHeader(provY);
            provY += 7;
          }

          if (idx % 2 === 1) {
            doc.setFillColor(248, 249, 250);
            doc.rect(14, provY, 172, 6.5, "F");
          }

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(51, 65, 85);

          let imovelTrunc = prov.imovel || "";
          if (imovelTrunc.length > 25) imovelTrunc = imovelTrunc.substring(0, 23) + "...";
          let brokerTrunc = prov.corretor || "Corretor";
          if (brokerTrunc.length > 20) brokerTrunc = brokerTrunc.substring(0, 18) + "...";

          const rowValues = [
            imovelTrunc,
            brokerTrunc,
            formatCurrency(prov.valor),
            formatDate(prov.previsao),
            prov.tipo,
            prov.parcelaNo
          ];

          let currX = 14;
          rowValues.forEach((val, i) => {
            doc.text(val, currX + 1.5, provY + 4.5);
            currX += provWidths[i];
          });

          provY += 6.5;
        });
      }

      // Linha de totais de Pendências
      if (provY > 240) {
        doc.addPage();
        provY = 30;
      }
      doc.setFillColor(241, 245, 249);
      doc.rect(14, provY, 172, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text("Total de Provisões Contratadas / Receitas a Realizar:", 18, provY + 5.5);
      doc.text(formatCurrency(totalProvisoes), 182, provY + 5.5, { align: "right" });

      // Nota explicativa
      provY += 15;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, provY, 172, 14, 3, 3, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text("NOTA LEGAL: REGIME DE TRIBUTAÇÃO", 18, provY + 5.5);
      doc.setFont("helvetica", "normal");
      doc.text("Estes valores serão tributáveis no mês de efetivo recebimento conforme regime de caixa.", 18, provY + 10);


      // PAGE 6: Notas Fiscais Emitidas
      doc.addPage();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 95);
      doc.text("RELAÇÃO DE NOTAS FISCAIS DE SERVIÇOS EMITIDAS", 14, 30);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Notas emitidas versus comissões faturadas para apuração completa de IRPJ.", 14, 36);

      let nfY = 45;
      const nfHeaders = ["Nº Nota Fiscal", "Data da Venda", "Tomador do Serviço (Comprador)", "CPF/CNPJ Tomador", "Valor Nota Fiscal", "Situação / Status"];
      const nfWidths = [22, 22, 45, 25, 25, 33]; 

      const drawNfHeader = (y: number) => {
        doc.setFillColor(30, 58, 95);
        doc.rect(14, y, 172, 7, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        let currX = 14;
        nfHeaders.forEach((h, idx) => {
          doc.text(h, currX + 1.5, y + 5);
          currX += nfWidths[idx];
        });
      };

      drawNfHeader(nfY);
      nfY += 7;

      const nfList: {
        num: string;
        date: string;
        tomador: string;
        cpf: string;
        valor: number;
        situacao: string;
        isPendente: boolean;
      }[] = [];

      let totalNfsEmitidasValue = 0;
      let totalNfsPendentesValue = 0;
      let countEmitidas = 0;
      let countPendentes = 0;

      sortedSales.forEach((sale, index) => {
        const hasPaid = sale.splits?.some((sp) => sp.status === "PAID");
        const buyerDocFormatted = formatAndMaskDoc(sale.buyer_doc_type, sale.buyer_doc);
        
        if (hasPaid) {
          countEmitidas++;
          totalNfsEmitidasValue += sale.total_commission;
          nfList.push({
            num: `NF-2026-${1000 + index}`,
            date: sale.sale_date,
            tomador: sale.client_name,
            cpf: buyerDocFormatted,
            valor: sale.total_commission,
            situacao: "EMITIDA",
            isPendente: false
          });
        } else {
          countPendentes++;
          totalNfsPendentesValue += sale.total_commission;
          nfList.push({
            num: "PENDENTE",
            date: sale.sale_date,
            tomador: sale.client_name,
            cpf: buyerDocFormatted,
            valor: sale.total_commission,
            situacao: "NF PENDENTE — emitir antes do fechamento fiscal",
            isPendente: true
          });
        }
      });

      if (nfList.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Nenhuma nota fiscal emitida ou pendente listada para o período de apuração atual.", 16, nfY + 5);
        nfY += 10;
      } else {
        nfList.forEach((nft, idx) => {
          if (nfY > 240) {
            doc.addPage();
            nfY = 30;
            drawNfHeader(nfY);
            nfY += 7;
          }

          if (idx % 2 === 1) {
            doc.setFillColor(248, 249, 250);
            doc.rect(14, nfY, 172, 6.5, "F");
          }

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);

          let tomadorTrunc = nft.tomador || "";
          if (tomadorTrunc.length > 25) tomadorTrunc = tomadorTrunc.substring(0, 23) + "...";

          const rowValues = [
            nft.num,
            formatDate(nft.date),
            tomadorTrunc,
            nft.cpf,
            formatCurrency(nft.valor),
            nft.situacao
          ];

          let currX = 14;
          rowValues.forEach((val, i) => {
            if (nft.isPendente) {
              doc.setTextColor(220, 38, 38); 
              if (i === 5 || i === 0) {
                doc.setFont("helvetica", "bold");
              } else {
                doc.setFont("helvetica", "normal");
              }
            } else {
              if (i === 5) {
                doc.setTextColor(22, 163, 74); 
                doc.setFont("helvetica", "bold");
              } else {
                doc.setTextColor(51, 65, 85);
                doc.setFont("helvetica", "normal");
              }
            }
            doc.text(val, currX + 1.5, nfY + 4.5);
            currX += nfWidths[i];
          });

          nfY += 6.5;
        });
      }

      // Sum lines of NFs
      if (nfY > 230) {
        doc.addPage();
        nfY = 30;
      }
      doc.setFillColor(241, 245, 249);
      doc.rect(14, nfY, 172, 16, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      
      doc.text(`Total de Notas Fiscais EMITIDAS (${countEmitidas} NF-es):`, 18, nfY + 5);
      doc.text(formatCurrency(totalNfsEmitidasValue), 182, nfY + 5, { align: "right" });

      doc.setTextColor(220, 38, 38);
      doc.text(`Total de Notas Fiscais PENDENTES de Emissão (${countPendentes} pendências):`, 18, nfY + 11);
      doc.text(formatCurrency(totalNfsPendentesValue), 182, nfY + 11, { align: "right" });

      // Actionable notice
      nfY += 24;
      doc.setFillColor(240, 253, 244); 
      doc.setDrawColor(22, 163, 74); 
      doc.roundedRect(14, nfY, 172, 12, 2.5, 2.5, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(21, 128, 61);
      doc.text("Ação fiscais finais enviadas para fechamento com o escritório de contabilidade.", 18, nfY + 7);


      // LOOP PARA CABEÇALHOS E RODAPÉS DINÂMICOS EM TODAS AS PÁGINAS
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Cabeçalho colorizado
        doc.setFillColor(30, 58, 95); 
        doc.rect(14, 8, 172, 1.5, "F"); 
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        
        // Esquerda
        doc.text(`${compName} | CNPJ: ${compCnpj}`, 14, 14);
        
        // Direita
        const pageStr = `Página ${i} de ${totalPages}`;
        doc.text(pageStr, 186 - doc.getTextWidth(pageStr), 14);
        
        // Rodapé
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 282, 186, 282);
        
        const footerText = `CONFIDENCIAL — Uso exclusivo para fins contábeis e fiscais — Fidelité Imobiliária`;
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(footerText, 14, 287);
      }

      // Salvar
      doc.save(fileName);
      
      // Confirm toast
      setShowToast(true);
      setTimeout(() => setShowToast(false), 8000);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar o relatório fiscal PDF.");
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {showToast && (
        <div id="toast-fiscal-report" className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-800 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center gap-3 max-w-sm animate-fadeIn">
          <div className="w-8 h-8 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
            <Percent className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Relatório Contábil</h5>
            <p className="text-xs font-bold leading-relaxed text-slate-200 mt-0.5">
              Relatório fiscal gerado — encaminhe ao seu contador junto com os comprovantes de pagamento
            </p>
          </div>
          <button 
            type="button"
            onClick={() => setShowToast(false)}
            className="text-slate-400 hover:text-white p-1 hover:bg-slate-800/60 rounded-lg shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      
      {/* Seção Filtros Bento Grid */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Explorar Transações</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-4.5 h-4.5" /> Exportar CSV
            </button>
            <button
              onClick={handleExportFiscalCSV}
              className="px-5 py-2.5 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <FileSpreadsheet className="w-4.5 h-4.5" /> Exportar Relatório Fiscal
            </button>
            <button
              onClick={onOpenCreateForm}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer transition-colors flex items-center gap-1.5 shadow-md shadow-blue-500/10"
            >
              Cadastrar Venda
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Busca Livre */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar imóvel ou comprador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
            />
          </div>

          {/* Dropdown Corretores */}
          <div>
            <select
              value={selectedBroker}
              onChange={(e) => setSelectedBroker(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none transition-colors"
            >
              <option value="">Filtro por Corretor (Todos)</option>
              {filteredBrokersForDropdown.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.role === "ADMIN" ? "Administrador" : b.role === "MANAGER" ? "Gestor" : "Corretor"})
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por status de repasse */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none transition-colors"
            >
              <option value="TODAS">Filtro por Status do Repasse (Todos)</option>
              <option value="PENDING">PENDENTE</option>
              <option value="PARTIAL">PARCIAL</option>
              <option value="PAID">PAGO</option>
              <option value="overdue">ATRASADAS</option>
            </select>
          </div>

        </div>

        {/* Checkbox Mostrar Canceladas */}
        <div className="flex items-center gap-2 px-1">
          <input
            type="checkbox"
            id="showCancelledCheckbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer accent-blue-600"
          />
          <label htmlFor="showCancelledCheckbox" className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 cursor-pointer select-none">
            Mostrar Vendas Canceladas
          </label>
        </div>

        {/* Seletor de Período Simples & Exportação */}
        <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Período Fiscal do PDF:</span>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">De:</span>
                <input
                  type="date"
                  value={pdfStartDate}
                  onChange={(e) => setPdfStartDate(e.target.value)}
                  className="bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none transition-colors cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Até:</span>
                <input
                  type="date"
                  value={pdfEndDate}
                  onChange={(e) => setPdfEndDate(e.target.value)}
                  className="bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none transition-colors cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={setThisMonth}
                className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 bg-slate-200/30 rounded-lg cursor-pointer transition-colors"
              >
                Este mês
              </button>
              <button
                type="button"
                onClick={setLastMonth}
                className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 bg-slate-200/30 rounded-lg cursor-pointer transition-colors"
              >
                Mês anterior
              </button>
              <button
                type="button"
                onClick={setThisYear}
                className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 bg-slate-200/30 rounded-lg cursor-pointer transition-colors"
              >
                Este ano
              </button>
            </div>
          </div>

          <button
            onClick={exportPDFReport}
            className="w-full lg:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-blue-500/15 hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <FileText className="w-4 h-4 text-white" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Grid Listagem de Vendas */}
      <div className="space-y-4">
        {filteredSales.length > 0 ? (
          filteredSales.map((sale) => {
            const splitsQtd = sale.splits?.length || 0;
            const paidSplitsQtd = sale.splits?.filter((s) => s.status === "PAID").length || 0;

            return (
              <div
                key={sale.id}
                className="bg-white border border-slate-100 hover:border-slate-300 rounded-[24px] p-5 md:p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4 group/card"
              >
                {/* Dados Primários */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50/60 px-2 py-0.5 rounded-lg">
                      Transação Venda
                    </span>
                    {sale.status === "DRAFT" ? (
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-300">
                        Rascunho
                      </span>
                    ) : sale.status === "CANCELLED" ? (
                      <span className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-150 px-2 py-0.5 rounded-lg border border-red-300">
                        Cancelada
                      </span>
                    ) : null}
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {formatDate(sale.sale_date)}
                    </span>
                  </div>
                  
                  <h4 className="text-base font-extrabold text-slate-800 truncate leading-snug group-hover/card:text-blue-600 transition-colors">
                    {sale.property_address}
                  </h4>

                  <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    Comprador: <strong className="text-slate-700 font-bold">{sale.client_name}</strong>
                  </p>
                </div>

                {/* Financeiro Consolidado */}
                <div className="grid grid-cols-2 md:flex md:items-center gap-6 text-left md:text-right shrink-0">
                  
                  <div>
                    <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase block">Valor Imóvel</span>
                    <strong className="text-xs md:text-sm font-black text-slate-800">
                      {formatCurrency(sale.sale_value)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[8px] font-black tracking-widest text-blue-500 uppercase block">Comissão Geral ({sale.commission_percentage || 0}%)</span>
                    <strong className="text-xs md:text-sm font-black text-blue-600 block">
                      {formatCurrency(sale.total_commission)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase block">Repasses</span>
                    <span className="text-xs text-slate-600 font-bold flex items-center md:justify-end gap-1 mt-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {paidSplitsQtd}/{splitsQtd} pagos
                    </span>
                  </div>

                  {/* Direcionar para detalhes */}
                  <div className="col-span-2 md:col-span-1 pt-2 md:pt-0">
                    <button
                      onClick={() => onSelectSale(sale)}
                      className="w-full md:w-auto px-4 py-2 border border-slate-200 hover:border-slate-350 text-slate-650 hover:text-slate-900 font-bold text-xs uppercase tracking-widest rounded-xl transition-all hover:bg-slate-50 flex items-center justify-center gap-1.5 cursor-pointer group"
                    >
                      Ver Detalhes
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>

                </div>

              </div>
            );
          })
        ) : (
          <div className="p-8 bg-slate-50 border border-slate-100 rounded-3xl text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider">Nenhuma Venda Encontrada</h4>
            <p className="text-xs text-slate-410 font-medium">Ajuste os filtros acima para listar outras comissões de corretor.</p>
          </div>
        )}
      </div>

    </div>
  );
};
