import React, { useState, useEffect } from "react";
import { ArrowLeft, User, DollarSign, Calendar, Percent, MapPin, Share2, Printer, Eye, ClipboardCheck, X, AlertTriangle, FileText, AlertCircle, Key, Pencil } from "lucide-react";
import { Sale, BrokerSplit, ComissoneUser } from "../../types";
import { StatusBadge } from "./StatusBadge";
import { ForecastModal } from "./ForecastModal";
import { PaymentModal } from "./PaymentModal";
import { 
  db, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDoc, 
  setDoc, 
  getDocs,
  handleFirestoreError,
  OperationType
} from "../../firebase";
import { getContaPrincipal, getCategoriaId } from "../../hooks/useQueries";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { ConfirmModal } from "../ui/ConfirmModal";

interface SaleDetailProps {
  sale: Sale;
  onGoBack: () => void;
  onUpdateForecast: (splitId: string, forecastDate: string) => void;
  onRegisterPayment: (
    splitId: string,
    paidValue: number,
    isPartial: boolean,
    remainingValue: number,
    newForecastDate: string,
    paymentMethod: "PIX" | "TED" | "CHEQUE",
    notes: string,
    receiptData: string | null
  ) => void;
  onToggleNfEmitida?: (nfEmitida: boolean) => void;
  team?: ComissoneUser[];
  onEditSale?: (sale: Sale) => void;
  onPublishSale?: (saleId: string) => void;
  onDeleteSale?: (saleId: string) => void;
  onUpdateStatus?: (saleId: string, status: "ACTIVE" | "CANCELLED" | "DRAFT") => void;
}

export const SaleDetail: React.FC<SaleDetailProps> = ({
  sale,
  onGoBack,
  onUpdateForecast,
  onRegisterPayment,
  onToggleNfEmitida,
  team = [],
  onEditSale,
  onPublishSale,
  onDeleteSale,
  onUpdateStatus
}) => {
  const [selectedSplitForForecast, setSelectedSplitForForecast] = useState<BrokerSplit | null>(null);
  const [selectedSplitForPayment, setSelectedSplitForPayment] = useState<BrokerSplit | null>(null);
  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | null>(null);

  // Estados locais para controle de parcelas em tempo real
  const [currentSplits, setCurrentSplits] = useState<BrokerSplit[]>(sale.splits || []);
  const [activeInlinePayment, setActiveInlinePayment] = useState<{
    splitId: string;
    type: "entry" | "installment";
    installmentNumber?: number;
  } | null>(null);

  // Estados locais para formulário de pagamento inline
  const [inlinePaymentDate, setInlinePaymentDate] = useState("");
  const [inlinePaymentMethod, setInlinePaymentMethod] = useState<"PIX" | "TED" | "CHEQUE" | "DINHEIRO">("PIX");
  const [inlinePaidValue, setInlinePaidValue] = useState(0);
  const [inlinePaidValueDisplay, setInlinePaidValueDisplay] = useState("");
  const [inlineNotes, setInlineNotes] = useState("");

  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

  const [financialTransactions, setFinancialTransactions] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmColor?: "red" | "blue" | "green";
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    message: "",
    confirmColor: "red",
    onConfirm: () => {}
  });

  // Escuta em tempo real as transações financeiras automáticas vinculadas a esta venda
  useEffect(() => {
    const txRef = collection(db, "financial_transactions");
    const q = query(
      txRef, 
      where("companyId", "==", sale.agency_id),
      where("commissionRef", "==", sale.id), 
      where("origin", "==", "AUTOMATICO")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // ordena por data de vencimento
      list.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      setFinancialTransactions(list);
    }, (error) => {
      console.error("Erro no onSnapshot das transacoes financeiras:", error);
      handleFirestoreError(error, OperationType.GET, "financial_transactions");
    });

    return () => unsubscribe();
  }, [sale.id]);

  const handleDeleteSale = async () => {
    setConfirmState({
      open: true,
      title: "Confirmar Exclusão",
      message: "Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.",
      confirmColor: "red",
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, open: false }));
        try {
          if (onDeleteSale) {
            await onDeleteSale(sale.id);
          }
          onGoBack();
        } catch (err) {
          console.error("Erro ao excluir venda:", err);
          toast.error("Erro ao excluir venda.");
        }
      }
    });
  };

  // Escuta em tempo real os splits desta venda
  useEffect(() => {
    const splitsRef = collection(db, "broker_splits");
    const q = query(
      splitsRef,
      where("agency_id", "==", sale.agency_id),
      where("sale_id", "==", sale.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: BrokerSplit[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as BrokerSplit);
      });
      if (list.length > 0) {
        list.sort((a, b) => a.created_at.localeCompare(b.created_at));
        setCurrentSplits(list);
      }
    }, (error) => {
      console.error("Erro no onSnapshot do cronograma:", error);
      handleFirestoreError(error, OperationType.GET, "broker_splits");
    });

    return () => unsubscribe();
  }, [sale.id]);

  // Sincroniza em caso de mudança de prop reativa
  useEffect(() => {
    if (sale.splits && sale.splits.length > 0) {
      setCurrentSplits(sale.splits);
    }
  }, [sale.splits]);

  const getInstallmentsForSplit = (split: BrokerSplit) => {
    if (split.installments_status && split.installments_status.length > 0) {
      return split.installments_status;
    }

    const count = split.installment_count || 1;
    const instValue = split.installment_value || 0;
    const firstDate = split.first_installment_date || split.forecast_date || new Date().toISOString().split("T")[0];

    return Array.from({ length: count }, (_, idx) => {
      const num = idx + 1;
      let dueDate = firstDate;
      try {
        const d = new Date(firstDate + "T12:00:00");
        d.setMonth(d.getMonth() + idx);
        dueDate = d.toISOString().split("T")[0];
      } catch (e) {
        console.error(e);
      }

      return {
        number: num,
        status: "PENDING" as "PENDING" | "PARTIAL" | "PAID",
        due_date: dueDate,
        calculated_value: instValue,
        paid_value: 0,
        payment_date: null,
        payment_method: null,
        notes: ""
      };
    });
  };

  const getDaysOverdue = (dateStr: string) => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const today = new Date(todayStr + "T00:00:00");
      const due = new Date(dateStr + "T00:00:00");
      const diffTime = today.getTime() - due.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch {
      return 0;
    }
  };

  const openInlinePaymentForm = (split: BrokerSplit, type: "entry" | "installment", instNum?: number) => {
    const today = new Date().toISOString().split("T")[0];
    setInlinePaymentDate(today);
    setInlinePaymentMethod("PIX");
    setInlineNotes("");

    if (type === "entry") {
      const val = split.entrada_value || 0;
      setInlinePaidValue(val);
      setInlinePaidValueDisplay(val.toString());
      setActiveInlinePayment({ splitId: split.id, type, installmentNumber: undefined });
    } else if (type === "installment" && instNum !== undefined) {
      const insts = getInstallmentsForSplit(split);
      const inst = insts.find(i => i.number === instNum);
      const val = inst ? inst.calculated_value : (split.installment_value || 0);
      setInlinePaidValue(val);
      setInlinePaidValueDisplay(val.toString());
      setActiveInlinePayment({ splitId: split.id, type, installmentNumber: instNum });
    }
  };

  const handleRegisterBrokerPayment = async (
    split: BrokerSplit,
    type: "entry" | "installment",
    installmentIndex: number | null,
    paidValue: number,
    paymentDate: string,
    paymentMethod: "PIX" | "TED" | "CHEQUE" | "DINHEIRO",
    notes: string
  ) => {
    try {
      const splitRef = doc(db, "broker_splits", split.id);
      let updates: Partial<BrokerSplit> = {};

      let updatedInstallments = [...(split.installments_status || [])];

      if (updatedInstallments.length === 0 && (split.installment_count ?? 0) > 1) {
        const count = split.installment_count || 1;
        const instValue = split.installment_value || 0;
        const firstDate = split.first_installment_date || split.forecast_date || new Date().toISOString().split("T")[0];

        updatedInstallments = Array.from({ length: count }, (_, idx) => {
          const num = idx + 1;
          let dueDate = firstDate;
          try {
            const d = new Date(firstDate + "T12:00:00");
            d.setMonth(d.getMonth() + idx);
            dueDate = d.toISOString().split("T")[0];
          } catch (e) {
            console.error(e);
          }

          return {
            number: num,
            status: "PENDING",
            due_date: dueDate,
            calculated_value: instValue,
            paid_value: 0,
            payment_date: null,
            payment_method: null,
            notes: ""
          };
        });
      }

      if (type === "entry") {
        updates = {
          ...updates,
          entry_paid: true,
          entry_paid_value: paidValue,
          entry_payment_date: paymentDate,
          entry_payment_method: paymentMethod as any,
          entry_notes: notes
        };
      } else if (type === "installment" && installmentIndex !== null) {
        const idx = updatedInstallments.findIndex(i => i.number === installmentIndex);
        if (idx !== -1) {
          const inst = updatedInstallments[idx];
          const fullVal = inst.calculated_value;
          const isFullyPaid = round2(paidValue) === round2(fullVal);

          updatedInstallments[idx] = {
            ...inst,
            status: isFullyPaid ? "PAID" : "PARTIAL",
            paid_value: paidValue,
            payment_date: paymentDate,
            payment_method: paymentMethod,
            notes: notes,
            remaining_value: isFullyPaid ? 0 : round2(fullVal - paidValue)
          };
        }
        updates = {
          ...updates,
          installments_status: updatedInstallments
        };
      }

      const hasEntryPlanned = (split.entrada_value ?? 0) > 0;
      const isEntryPaid = hasEntryPlanned ? (updates.entry_paid || split.entry_paid) : true;
      const allInstPaid = updatedInstallments.every(i => i.status === "PAID");
      const anyInstPaidOrPartial = updatedInstallments.some(i => i.status === "PAID" || i.status === "PARTIAL");
      const isAnyEntryPaid = updates.entry_paid || split.entry_paid;

      if (isEntryPaid && allInstPaid) {
        updates.status = "PAID";
        updates.payment_date = paymentDate;
        updates.payment_method = paymentMethod as any;
      } else if (anyInstPaidOrPartial || isAnyEntryPaid) {
        updates.status = "PARTIAL";
      } else {
        updates.status = "PENDING";
      }

      await updateDoc(splitRef, updates);

      // Sincronização automática para reconciliação dos lançamentos financeiros correspondentes
      try {
        const txsRef = collection(db, "financial_transactions");
        let infoToken = "";
        if (type === "entry") {
          infoToken = "Entrada";
        } else if (type === "installment" && installmentIndex !== null) {
          const totalInsts = split.installment_count || updatedInstallments.length || 1;
          infoToken = `${installmentIndex}/${totalInsts}`;
        }

        if (infoToken) {
          const qTx = query(
            txsRef,
            where("commissionRef", "==", sale.id),
            where("origin", "==", "AUTOMATICO"),
            where("installmentInfo", "==", infoToken)
          );
          const snapTx = await getDocs(qTx);
          for (const docTx of snapTx.docs) {
            await updateDoc(doc(db, "financial_transactions", docTx.id), {
              status: "CONCILIADO",
              reconciledAt: new Date().toISOString()
            });
          }
        }
      } catch (errSync) {
        console.warn("Erro ao sincronizar status para o financeiro:", errSync);
      }

      // Atualiza estado local de forma imediata
      setCurrentSplits(prev => prev.map(s => s.id === split.id ? { ...s, ...updates } : s));

      const formattedNum = type === "entry" ? "Entrada" : `Parcela ${installmentIndex}`;
      toast.success(`Pagamento registrado — ${split.broker_name} — ${formattedNum}`);
      setActiveInlinePayment(null);

    } catch (error) {
      console.error("Erro ao registrar pagamento:", error);
      toast.error("Erro de permissão ou conexão ao registrar o pagamento.");
    }
  };

  const getSplitGeneralStatus = (sp: BrokerSplit) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const ints = getInstallmentsForSplit(sp);
    const hasEntryPlanned = (sp.entrada_value ?? 0) > 0;
    const isEntryPaid = hasEntryPlanned ? sp.entry_paid : true;
    const allInstPaid = ints.every(i => i.status === "PAID");

    if (isEntryPaid && allInstPaid) {
      return { label: "PAGO", colorClass: "bg-emerald-50 text-emerald-800 border-emerald-100" };
    }

    const anyPartiallyPaid = ints.some(i => i.status === "PAID" || i.status === "PARTIAL") || sp.entry_paid;
    const anyOverdue = ints.some(i => i.status !== "PAID" && i.due_date < todayStr);

    if (anyOverdue) {
      return { label: "ATRASADO", colorClass: "bg-rose-50 text-rose-800 border-rose-100 animate-pulse" };
    }
    if (anyPartiallyPaid) {
      return { label: "EM DIA", colorClass: "bg-blue-50 text-blue-800 border-blue-100" };
    }
    return { label: "PENDENTE", colorClass: "bg-orange-50 text-orange-850 border-orange-100" };
  };

  const exportCronogramaPdf = (split: BrokerSplit) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const doc = new jsPDF();

    // Set fonts
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate 900
    doc.text("PONTO CHAVE IMOBILIÁRIA", 20, 20);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // slate 500
    doc.text("Sistema de Gestão de Saldos e Comissões", 20, 25);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 140, 25);

    // Horizon Line
    doc.setDrawColor(226, 232, 240); // slate 200
    doc.line(20, 28, 190, 28);

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("CRONOGRAMA DE PAGAMENTOS DO CORRETOR", 20, 36);

    // Find CPF
    const brokerObj = team?.find(b => b.id === split.broker_id);
    const cpfFormatted = brokerObj?.cpf || "Não cadastrado";

    // Left column information
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("DADOS DO CORRETOR", 20, 44);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Nome: `, 20, 49);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(`${split.broker_name}`, 32, 49);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`CPF: `, 20, 54);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(`${cpfFormatted}`, 32, 54);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Papel: `, 20, 59);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(`${getRoleLabel(split.role)} (${split.percentage}%)`, 32, 59);

    // Right column information (Venda)
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("DADOS DA TRANSAÇÃO", 110, 44);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Imóvel: `, 110, 49);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    // Split long address if needed
    const addrText = sale.property_address || "Não informado";
    const addrLines = doc.splitTextToSize(addrText, 75);
    doc.text(addrLines, 125, 49);

    const yOffsetNext = 49 + (addrLines.length * 4);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Data Venda: `, 110, yOffsetNext);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(`${formatDate(sale.sale_date)}`, 130, yOffsetNext);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Valor Venda: `, 110, yOffsetNext + 5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(`${formatCurrency(sale.sale_value)}`, 132, yOffsetNext + 5);

    const startTableY = Math.max(72, yOffsetNext + 12);
    doc.line(20, startTableY - 3, 190, startTableY - 3);

    // Table header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setFillColor(248, 250, 252); // slate 50
    doc.setTextColor(71, 85, 105);
    doc.rect(20, startTableY, 170, 7, "F");

    doc.text("Nº / Item", 22, startTableY + 5);
    doc.text("Data Prevista", 52, startTableY + 5);
    doc.text("Valor", 85, startTableY + 5);
    doc.text("Status", 115, startTableY + 5);
    doc.text("Data Pago", 140, startTableY + 5);
    doc.text("Meio Pag.", 165, startTableY + 5);

    // Load installments & entrance info
    const ints = getInstallmentsForSplit(split);
    let currentY = startTableY + 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);

    // Render row helper
    const drawRow = (label: string, dueDate: string, value: number, status: string, payDate: string, payMethod: string) => {
      doc.setFillColor(255, 255, 255);
      doc.rect(20, currentY, 170, 7, "F");
      doc.setTextColor(51, 65, 85);

      doc.text(label, 22, currentY + 5);
      doc.text(dueDate, 52, currentY + 5);
      doc.text(formatCurrency(value), 85, currentY + 5);

      // Status text and color
      if (status === "PAID" || status === "PAGO") {
        doc.setTextColor(16, 185, 129); // emerald 500
        doc.text("PAGO", 115, currentY + 5);
      } else if (status === "PARTIAL" || status === "PARCIAL") {
        doc.setTextColor(245, 158, 11); // amber 500
        doc.text("PARCIAL", 115, currentY + 5);
      } else if (dueDate !== "Na assinatura" && dueDate < todayStr) {
        doc.setTextColor(239, 68, 68); // red 500
        doc.text("ATRASADO", 115, currentY + 5);
      } else {
        doc.setTextColor(59, 130, 246); // blue 500
        doc.text("PENDENTE", 115, currentY + 5);
      }

      doc.setTextColor(51, 65, 85);
      doc.text(payDate, 140, currentY + 5);
      doc.text(payMethod, 165, currentY + 5);

      doc.setDrawColor(241, 245, 249); // slate 100 border
      doc.line(20, currentY + 7, 190, currentY + 7);
      currentY += 7;
    };

    // 1. Entrance row
    const entranceVal = split.entrada_value || 0;
    const entryStatus = split.entry_paid ? "PAID" : "PENDING";
    const entryPayDate = split.entry_payment_date ? formatDate(split.entry_payment_date) : "—";
    const entryPayMethod = split.entry_payment_method || "—";
    drawRow("Entrada", "Na assinatura", entranceVal, entryStatus, entryPayDate, entryPayMethod);

    // 2. Installments rows
    ints.forEach(i => {
      const payDate = i.payment_date ? formatDate(i.payment_date) : "—";
      const payMethod = i.payment_method || "—";
      const labelStatus = i.status;
      drawRow(`Parcela ${i.number}/${split.installment_count}`, formatDate(i.due_date), i.calculated_value, labelStatus, payDate, payMethod);
    });

    // Calculate totals
    const totalContratado = split.calculated_value;
    const totalRecebido = (split.entry_paid ? (split.entry_paid_value || split.entrada_value || 0) : 0) + ints.reduce((acc, current) => acc + (current.paid_value || 0), 0);
    const totalPendente = totalContratado - totalRecebido;

    currentY += 5;
    // Totais Card
    doc.setFillColor(248, 250, 252);
    doc.rect(20, currentY, 170, 25, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(20, currentY, 170, 25, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("CÁLCULO DOS TOTAIS DO REPASSE", 25, currentY + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Contratado: `, 25, currentY + 13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(`${formatCurrency(totalContratado)}`, 55, currentY + 13);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Total Recebido: `, 25, currentY + 19);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129); // green
    doc.text(`${formatCurrency(totalRecebido)}`, 55, currentY + 19);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Saldo Restante Pendente: `, 105, currentY + 13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(totalPendente > 0 ? 239 : 51, totalPendente > 0 ? 68 : 65, totalPendente > 0 ? 68 : 85); // red if positive
    doc.text(`${formatCurrency(totalPendente)}`, 147, currentY + 13);

    // Footer area
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate 400
    doc.text("Documento gerado pelo sistema Ponto Chave — uso interno", 20, 275);

    // Save file
    const sanitizeName = split.broker_name.replace(/\s+/g, "_");
    const sanitizeAddr = (sale.property_address || "imovel").split(",")[0].trim().substring(0, 15).replace(/\s+/g, "_");
    const filename = `Cronograma_${sanitizeName}_${sanitizeAddr}.pdf`;
    doc.save(filename);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const getRoleLabel = (role: string) => {
    const maps: Record<string, string> = {
      CAPTADOR: "Captação",
      VENDEDOR: "Venda / Intermediação",
      GESTOR: "Gestão / Coordenação"
    };
    return maps[role] || role;
  };

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

  const isInstallmentSale = currentSplits.some(sp => (sp.installment_count ?? 0) > 1);

  // Calcule parcelas vencidas
  const todayStr = new Date().toISOString().split("T")[0];
  let overdueCount = 0;
  currentSplits.forEach(sp => {
    if ((sp.installment_count ?? 1) > 1) {
      const installments = getInstallmentsForSplit(sp);
      installments.forEach(inst => {
        if (inst.status === "PENDING" && inst.due_date < todayStr) {
          overdueCount++;
        }
      });
    }
  });

  const scrollToSchedule = () => {
    const el = document.getElementById("payment-schedule-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };


  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn">
      
      {/* Voltar e Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onGoBack}
          className="p-2 bg-slate-50 border border-slate-150 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Gerenciador de Repasses</span>
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Detalhes de Vendas</h2>
        </div>
      </div>

      {/* Alerta de parcelas atrasadas */}
      {overdueCount > 0 && isInstallmentSale && (
        <div className="bg-red-50 border border-red-200/80 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 text-red-700 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-red-900 tracking-tight">Pagamento(s) em atraso detectado(s)</h4>
              <p className="text-xs text-red-700 font-medium">
                {overdueCount} parcela{overdueCount > 1 ? "s" : ""} com pagamento em atraso — regularize antes do fechamento fiscal.
              </p>
            </div>
          </div>
          <button
            onClick={scrollToSchedule}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl cursor-pointer shadow-md shadow-red-500/15 whitespace-nowrap transition-colors"
          >
            Ver parcelas atrasadas
          </button>
        </div>
      )}

      {/* Grid de consolidação de dados da venda */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        
        <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-6">
          
          <div className="md:col-span-4 pb-4 border-b border-slate-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Endereço do Lote / Imóvel</span>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5 leading-snug">
                <MapPin className="w-4 h-4 text-slate-450 shrink-0" />
                {sale.property_address}
              </h3>
            </div>
            <div className="text-right sm:text-right flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Status da Venda</span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border mt-1 ${
                sale.status === "ACTIVE" 
                  ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                  : sale.status === "DRAFT"
                    ? "bg-slate-100 text-slate-700 border-slate-350"
                    : "bg-red-50 text-red-800 border-red-100"
              }`}>
                {sale.status === "ACTIVE" ? "Ativa" : sale.status === "DRAFT" ? "Rascunho" : "Cancelada"}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 mt-2 justify-end">
                {sale.status === "DRAFT" && onPublishSale && (
                  <button
                    type="button"
                    onClick={() => onPublishSale(sale.id)}
                    className="block text-[9px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-3 py-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    Publicar Venda
                  </button>
                )}
                
                {(sale.status === "ACTIVE" || sale.status === "DRAFT") && onEditSale && (
                  <button
                    type="button"
                    onClick={() => onEditSale(sale)}
                    className="block text-[9px] font-black uppercase tracking-widest border border-blue-500 text-blue-600 hover:bg-blue-50 rounded-xl px-3 py-1.5 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    Editar Venda
                  </button>
                )}

                {sale.status === "ACTIVE" && onUpdateStatus && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmState({
                        open: true,
                        title: "Confirmar Cancelamento",
                        message: "Tem certeza que deseja cancelar esta venda? Ela não será listada nas comissões ativas por padrão.",
                        confirmColor: "red",
                        onConfirm: () => {
                          setConfirmState(prev => ({ ...prev, open: false }));
                          onUpdateStatus(sale.id, "CANCELLED");
                        }
                      });
                    }}
                    className="block text-[9px] font-black uppercase tracking-widest bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl px-3 py-1.5 transition-all cursor-pointer"
                  >
                    Cancelar Venda
                  </button>
                )}

                {sale.status === "CANCELLED" && onUpdateStatus && (
                  <button
                    type="button"
                    onClick={() => onUpdateStatus(sale.id, "ACTIVE")}
                    className="block text-[9px] font-black uppercase tracking-widest bg-emerald-50 hover:bg-emerald-100 text-emerald-750 border border-emerald-200 rounded-xl px-3 py-1.5 transition-all cursor-pointer"
                  >
                    Reativar Venda
                  </button>
                )}

                {onDeleteSale && (
                  <button
                    type="button"
                    onClick={handleDeleteSale}
                    className="block text-[9px] font-black uppercase tracking-widest bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl px-3 py-1.5 transition-all cursor-pointer"
                  >
                    Excluir Venda
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Atributos secundários em cards */}
          <div className="space-y-1.5">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Comprador</span>
            <div className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center text-xs">
                <User className="w-3.5 h-3.5" />
              </div>
              {sale.client_name}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Investimento de Venda</span>
            <div className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center text-xs">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
              {formatCurrency(sale.sale_value)}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Data da Transação</span>
            <div className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center text-xs">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              {formatDate(sale.sale_date)}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Vencimento Emissão NF</span>
            {sale.data_vencimento_nf ? (
              <div className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <div className="w-7 h-7 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center text-xs">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                {formatDate(sale.data_vencimento_nf)}
              </div>
            ) : (
              <div className="text-slate-400 text-xs font-semibold mt-1">
                Não configurada
              </div>
            )}
          </div>

          {/* Resumo da receita e Nota Fiscal */}
          <div className="md:col-span-4 bg-blue-50/50 rounded-2xl p-5 border border-blue-100/50 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex gap-8">
              <div>
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest block">Taxa de Comissão Pactuada</span>
                <strong className="text-sm font-black text-blue-700">{sale.commission_percentage}% da Venda</strong>
              </div>
              <div>
                <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest block">Total de Comissão Bruta</span>
                <strong className="text-sm md:text-base font-black text-blue-800">{formatCurrency(sale.total_commission)}</strong>
              </div>
            </div>

            {/* Controle de Nota Fiscal */}
            {sale.data_vencimento_nf ? (
              <div className="flex items-center gap-3 bg-white/80 p-2 px-3.5 rounded-xl border border-blue-100 animate-fadeIn self-start md:self-auto">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Faturamento Fiscal [DRE]</span>
                  <div className="text-[11px] font-semibold text-slate-650 flex items-center gap-1">
                    Prazo de emissão: <span className="font-extrabold text-slate-800">{formatDate(sale.data_vencimento_nf)}</span>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => onToggleNfEmitida?.(!sale.nf_emitida)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border ${
                    sale.nf_emitida
                      ? "bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-600"
                      : "bg-amber-500 border-amber-400 text-white hover:bg-amber-405"
                  }`}
                  title={sale.nf_emitida ? "Status: Nota Fiscal já emitida!" : "Status: Nota Fiscal pendente de emissão!"}
                >
                  {sale.nf_emitida ? "Emitida ✓" : "Pendente ⚠"}
                </button>
              </div>
            ) : null}
          </div>

        </div>

        {/* Lançamentos Financeiros Integrados */}
        <div className="p-6 md:p-8 border-b border-slate-100 space-y-5 bg-slate-50/20">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                Lançamentos Financeiros Integrados
                <span className="bg-blue-50 text-blue-700 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-blue-100">
                  AUTOMÁTICO
                </span>
              </h4>
              <p className="text-[10px] text-slate-400 font-semibold">
                Integração direta entre Comissões e o módulo Financeiro
              </p>
            </div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {financialTransactions.length} lançamentos vinculados
            </span>
          </div>

          {financialTransactions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {financialTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 hover:border-slate-300 transition-all"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <strong className="text-xs font-extrabold text-slate-800 block truncate">
                      {tx.description}
                    </strong>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                      <span>Data: {formatDate(tx.date)}</span>
                      {tx.installmentInfo && (
                        <span className="bg-purple-50 text-purple-700 text-[8px] px-1.5 py-0.5 rounded border border-purple-100">
                          {tx.installmentInfo === 'Entrada' ? 'Entrada' : `Parcela ${tx.installmentInfo}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-1.5 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                    <strong className={`text-xs font-black ${tx.type === 'RECEITA' ? 'text-teal-650' : 'text-rose-600'}`}>
                      {tx.type === 'RECEITA' ? '+' : '-'} {formatCurrency(Math.abs(tx.amount))}
                    </strong>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                      tx.status === 'CONCILIADO'
                        ? 'bg-emerald-50 text-emerald-750 border-emerald-100/60'
                        : tx.status === 'AGENDADO'
                        ? 'bg-purple-50 text-purple-750 border-purple-100/60'
                        : tx.status === 'PENDENTE'
                        ? 'bg-amber-50 text-amber-750 border-amber-100/60'
                        : tx.status === 'CANCELADO'
                        ? 'bg-red-50 text-red-750 border-red-100/60'
                        : 'bg-slate-50 text-slate-500 border-slate-100/60'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-white border border-dashed border-slate-200 rounded-3xl text-[11px] text-slate-400 font-semibold">
              Nenhum lançamento financeiro automático gerado para esta venda.
            </div>
          )}
        </div>

        {/* Listagem de Divisões (Splits) de Comissões */}
        <div className="p-6 md:p-8 space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-700">Divisão de Repasses (Splits)</h4>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {sale.splits?.length || 0} repasses envolvidos
            </span>
          </div>

          <div className="space-y-4">
            {sale.splits && sale.splits.length > 0 ? (
              sale.splits.map((split) => (
                <div
                  key={split.id}
                  className="bg-white border border-slate-150 rounded-3xl p-5 md:p-6 shadow-sm space-y-4 hover:border-slate-300 hover:shadow-md transition-all animate-fadeIn"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    {/* Informações primárias do corretor e papel */}
                    <div>
                      <div className="flex items-center gap-2.5">
                        <strong className="text-sm font-extrabold text-slate-900">{split.broker_name}</strong>
                        <StatusBadge status={split.status} />
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        Função: <span className="font-bold text-slate-700">{getRoleLabel(split.role)}</span> · Cota: <span className="font-extrabold text-indigo-600">{split.percentage}%</span>
                      </p>
                    </div>

                    {/* Valor e Ações */}
                    <div className="flex items-center justify-between md:justify-end gap-6">
                      <div className="text-left md:text-right">
                        <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase">Valor de Direito</span>
                        <strong className="text-sm md:text-base font-black text-slate-800 block">
                          {formatCurrency(split.calculated_value)}
                        </strong>
                      </div>

                      {/* Botões contextuais se pendente ou parcial */}
                      {split.status !== "PAID" ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedSplitForForecast(split)}
                            className="bg-slate-50 border border-slate-150 hover:bg-slate-100 text-slate-600 font-bold text-[10px] uppercase tracking-widest py-2 px-3.5 rounded-xl cursor-pointer transition-colors"
                          >
                            Reagendar
                          </button>
                          <button
                            onClick={() => setSelectedSplitForPayment(split)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-widest py-2 px-4 rounded-xl cursor-pointer transition-colors shadow-md shadow-emerald-500/10"
                          >
                            Pagar
                          </button>
                        </div>
                      ) : (
                        <div className="text-right flex items-center gap-2">
                          {split.receipt_data && (
                            <button
                              onClick={() => setActiveReceiptUrl(split.receipt_data || null)}
                              className="px-3 py-1.5 border border-emerald-100 hover:bg-emerald-50 rounded-lg text-emerald-700 text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Recibo
                            </button>
                          )}
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 select-none font-sans border border-emerald-100">
                            <ClipboardCheck className="w-3.5 h-3.5 text-emerald-500" />
                            Pago Realizado
                          </span>
                        </div>
                      )}

                    </div>

                  </div>

                  {/* Informações detalhadas do pagamento se concluído ou parcial */}
                  {(split.status === "PAID" || split.status === "PARTIAL" || split.payment_date) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 bg-slate-50/50 p-3 rounded-2xl">
                      <div>
                        <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase block">Data Operação</span>
                        <strong className="text-xs font-black text-slate-700 select-all">{formatDate(split.payment_date || "")}</strong>
                      </div>
                      <div>
                        <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase block">Meio de Repasse</span>
                        <strong className="text-xs font-black text-slate-700">{split.payment_method || "TED"}</strong>
                      </div>
                      <div>
                        <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase block">Previsão Inicial</span>
                        <strong className="text-xs font-black text-slate-700">{formatDate(split.forecast_date)}</strong>
                      </div>
                      {split.notes && (
                        <div className="sm:col-span-3 border-t border-slate-100/60 pt-2 text-[11px] text-slate-500 font-medium">
                          Observações: <strong className="text-slate-750 font-bold">{split.notes}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Previsão Simples se for pendente e sem pagamento ainda */}
                  {(split.status === "PENDING" || split.status === "pending" || split.status === "overdue" || split.status === "OVERDUE") && !split.payment_date && (
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                      <span>Previsão de Pagamento Pactuada:</span>
                      <strong className="text-slate-800 font-black flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        {formatDate(split.forecast_date)}
                      </strong>
                    </div>
                  )}

                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 font-medium text-center py-6">
                Nenhum corretor associado à esta venda.
              </p>
            )}
           </div>

         </div>

       </div>

      {/* SEÇÃO DE CRONOGRAMA DE PAGAMENTO */}
      {isInstallmentSale ? (() => {
        const totalCommissionVal = sale.total_commission;
        const totalEntradaPlanned = currentSplits.reduce((acc, sp) => acc + (sp.entrada_value || 0), 0);
        const totalEntradaReceived = currentSplits.reduce((acc, sp) => {
          return acc + (sp.entry_paid ? (sp.entry_paid_value ?? sp.entrada_value ?? 0) : 0);
        }, 0);
        const totalParceladoPlanned = totalCommissionVal - totalEntradaPlanned;
        const totalParcelasPaidReceived = currentSplits.reduce((acc, sp) => {
          const insts = getInstallmentsForSplit(sp);
          return acc + insts.reduce((sum, inst) => sum + (inst.paid_value || 0), 0);
        }, 0);
        const totalReceived = totalEntradaReceived + totalParcelasPaidReceived;
        const percentReceived = totalCommissionVal > 0 ? (totalReceived / totalCommissionVal) * 100 : 0;
        const percentReceivedRounded = round2(percentReceived);

        // Helper internally to generate initials for avatar
        const getInitials = (name: string) => {
          if (!name) return "";
          const parts = name.trim().split(" ");
          if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
          return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        };

        const getRoleBadgeClass = (role: string) => {
          switch (role) {
            case "CAPTADOR":
              return "bg-indigo-50 text-indigo-700 border-indigo-200";
            case "VENDEDOR":
              return "bg-emerald-50 text-emerald-700 border-emerald-200";
            case "GESTOR":
              return "bg-purple-50 text-purple-700 border-purple-200";
            default:
              return "bg-slate-50 text-slate-705 border-slate-200";
          }
        };

        const getCalendarColorClass = (status: string, overdue: boolean) => {
          if (status === "PAID") return "text-emerald-500";
          if (overdue) return "text-rose-500 animate-pulse";
          if (status === "PARTIAL") return "text-amber-500";
          return "text-blue-500";
        };

        return (
          <div id="payment-schedule-section" className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Controles do Cronograma</span>
                <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">Cronograma de Pagamento</h4>
              </div>
              <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold uppercase tracking-widest px-3 py-1 rounded-full self-start sm:self-auto animate-fadeIn">
                Venda Parcelada
              </span>
            </div>

            {/* Individual broker timeline cards */}
            <div className="space-y-6">
              {currentSplits.filter(sp => (sp.installment_count ?? 1) > 1).map((sp) => {
                const totalContratado = sp.calculated_value;
                const entryValue = sp.entrada_value || 0;
                const entryReceived = sp.entry_paid ? (sp.entry_paid_value ?? sp.entrada_value ?? 0) : 0;
                const installments = getInstallmentsForSplit(sp);
                const installmentsReceived = installments.reduce((sum, inst) => sum + (inst.paid_value || 0), 0);
                const totalBrokerReceived = entryReceived + installmentsReceived;
                const percentBrokerReceived = totalContratado > 0 ? (totalBrokerReceived / totalContratado) * 100 : 0;
                const percentBrokerReceivedRounded = round2(percentBrokerReceived);
                
                const brokerOverdueCount = installments.filter(inst => inst.status !== "PAID" && inst.due_date < todayStr).length;

                return (
                  <div className="border border-slate-200 hover:border-slate-300 rounded-2xl p-5 md:p-6 bg-white space-y-5 shadow-sm transition-all animate-fadeIn" key={sp.id}>
                    
                    {/* Card Header: avatar com iniciais, nome, papel com badge colorido, percentual e valor total */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-black text-xs border border-slate-200 uppercase shrink-0">
                          {getInitials(sp.broker_name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-sm font-black text-slate-800 leading-none">{sp.broker_name}</strong>
                            <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border rounded inline-block ${getRoleBadgeClass(sp.role)}`}>
                              {getRoleLabel(sp.role)}
                            </span>
                            <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border rounded inline-block ` + getSplitGeneralStatus(sp).colorClass}>
                              {getSplitGeneralStatus(sp).label}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                            Cota: <span className="text-indigo-600 font-black">{sp.percentage}%</span> · Total: <span className="text-slate-700 font-black">{formatCurrency(sp.calculated_value)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        <button
                          onClick={() => exportCronogramaPdf(sp)}
                          className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          Referência PDF
                        </button>
                      </div>
                    </div>

                    {/* Barra de progresso no topo do card: Verde proporcional ao percentual recebido. Texto: R$ X.XXX,XX recebidos de R$ X.XXX,XX totais */}
                    <div className="space-y-1.5 bg-slate-50/50 p-4 border border-slate-150 rounded-xl">
                      <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-500 rounded-full" 
                          style={{ width: `${Math.min(100, percentBrokerReceivedRounded)}%` }} 
                        />
                      </div>
                      <div className="flex justify-between items-center text-[9.5px] text-slate-500 font-bold uppercase tracking-wider">
                        <span>Progresso de Repasse</span>
                        <span className="text-slate-700 font-black">
                          {formatCurrency(totalBrokerReceived)} recebidos de {formatCurrency(totalContratado)} totais ({percentBrokerReceivedRounded}%)
                        </span>
                      </div>
                    </div>

                    {/* Banner vermelho se houver parcela atrasada: 'X parcela(s) em atraso — regularize antes do fechamento fiscal' */}
                    {brokerOverdueCount > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center gap-2.5 text-red-800 animate-pulse">
                        <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-600" />
                        <span className="text-[10px] font-extrabold uppercase tracking-wider">
                          {brokerOverdueCount} parcela{brokerOverdueCount > 1 ? "s" : ""} em atraso — regularize antes do fechamento fiscal
                        </span>
                      </div>
                    )}

                    {/* Inline payment form wrapper */}
                    {activeInlinePayment && activeInlinePayment.splitId === sp.id && (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 animate-scaleIn font-sans">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <h5 className="text-[11px] font-black text-slate-705 uppercase tracking-widest">
                            {activeInlinePayment.type === "entry" ? (
                              `Registrar Pagamento — Entrada — ${sp.broker_name}`
                            ) : (
                              `Registrar Pagamento — Parcela ${activeInlinePayment.installmentNumber} de ${sp.installment_count} — ${sp.broker_name}`
                            )}
                          </h5>
                          <button
                            onClick={() => setActiveInlinePayment(null)}
                            className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {/* Data */}
                          <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-sans">Data do Pagamento</label>
                            <input
                              type="date"
                              value={inlinePaymentDate}
                              onChange={(e) => setInlinePaymentDate(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 font-semibold"
                            />
                          </div>

                          {/* Metodo */}
                          <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-sans">Meio de Repasse</label>
                            <select
                              value={inlinePaymentMethod}
                              onChange={(e) => setInlinePaymentMethod(e.target.value as any)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 font-semibold cursor-pointer"
                            >
                              <option value="PIX">PIX</option>
                              <option value="TED">TED</option>
                              <option value="CHEQUE">CHEQUE</option>
                              <option value="DINHEIRO">DINHEIRO</option>
                            </select>
                          </div>

                          {/* Valor Pago */}
                          <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-sans">Valor Pago (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={inlinePaidValueDisplay}
                              onChange={(e) => {
                                setInlinePaidValueDisplay(e.target.value);
                                setInlinePaidValue(parseFloat(e.target.value) || 0);
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 font-semibold"
                            />
                          </div>

                          {/* Observacoes */}
                          <div className="sm:col-span-3 space-y-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-sans">Observação (Opcional)</label>
                            <input
                              type="text"
                              placeholder="ex: Pago com comissão padrão"
                              value={inlineNotes}
                              onChange={(e) => setInlineNotes(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-slate-800 font-semibold"
                            />
                          </div>
                        </div>

                        {/* Display remaining balance if partial payment */}
                        {(() => {
                          const plannedValue = activeInlinePayment.type === "entry" 
                            ? (sp.entrada_value || 0) 
                            : (() => {
                                const insts = getInstallmentsForSplit(sp);
                                const instObj = insts.find(i => i.number === activeInlinePayment.installmentNumber);
                                return instObj ? instObj.calculated_value : (sp.installment_value || 0);
                              })();
                          const diff = plannedValue - inlinePaidValue;
                          if (inlinePaidValue > 0 && diff > 0.01) {
                            return (
                              <div className="text-amber-705 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2 text-[10px] font-bold">
                                Saldo restante desta parcela: <strong className="font-sans font-extrabold">{formatCurrency(diff)}</strong> (será marcado como PARCIAL)
                              </div>
                            );
                          }
                          return null;
                        })()}

                        <div className="flex justify-end gap-2 pt-1 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => setActiveInlinePayment(null)}
                            className="bg-slate-200 hover:bg-slate-350 text-slate-700 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRegisterBrokerPayment(
                              sp, 
                              activeInlinePayment.type, 
                              activeInlinePayment.installmentNumber ?? null, 
                              inlinePaidValue, 
                              inlinePaymentDate, 
                              inlinePaymentMethod, 
                              inlineNotes
                            )}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-md shadow-blue-500/10"
                          >
                            Confirmar Pagamento
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Vertical Timeline container */}
                    <div className="relative pl-4 border-l border-dashed border-slate-200 ml-3 py-1.5 space-y-6">
                      
                      {/* Line 0 — Entrada: ícone chave, valor, status (verde=pago, cinza=pendente), botão '+ Registrar Entrada' se pendente */}
                      {(sp.entrada_value ?? 0) > 0 && (
                        <div className="relative pl-6">
                          {/* Bullet Icon */}
                          <div className={`absolute -left-[24px] top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            sp.entry_paid 
                              ? "bg-emerald-500 border-emerald-400 text-white" 
                              : "bg-white border-slate-300 text-slate-400"
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${sp.entry_paid ? "bg-white" : "bg-slate-300"}`} />
                          </div>

                          {/* Flex core row */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="space-y-1">
                              <h6 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                                <Key className={`w-3.5 h-3.5 shrink-0 ${sp.entry_paid ? "text-emerald-500" : "text-slate-400"}`} />
                                Entrada — na assinatura
                              </h6>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">vencimento: imediato</p>
                              
                              {/* Pago details */}
                              {sp.entry_paid ? (
                                <p className="text-[10px] text-slate-600 font-semibold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg inline-block mt-1 animate-scaleIn">
                                  Pago em {formatDate(sp.entry_payment_date || "")} · {sp.entry_payment_method}
                                  {sp.entry_notes && <span className="block italic text-[9px] text-slate-400 font-medium">Obs: {sp.entry_notes}</span>}
                                </p>
                              ) : (
                                <span className="text-[10px] text-slate-455 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg inline-block mt-1 font-semibold uppercase tracking-wider">
                                  Pendente
                                </span>
                              )}
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-4 shrink-0">
                              <div className="text-left sm:text-right font-sans">
                                <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase block">Valor</span>
                                <span className="text-xs font-black text-slate-800">{formatCurrency(sp.entrada_value || 0)}</span>
                                {sp.entry_paid && sp.entry_paid_value !== undefined && sp.entry_paid_value !== sp.entrada_value && (
                                  <span className="text-[9px] font-medium text-slate-500 block">Valor real pago: {formatCurrency(sp.entry_paid_value)}</span>
                                )}
                              </div>

                              {/* Button + Registrar Entrada inline if pending */}
                              {!sp.entry_paid && (
                                <button
                                  onClick={() => openInlinePaymentForm(sp, "entry")}
                                  className="text-[10px] bg-blue-50 border border-blue-150 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-500 font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg cursor-pointer transition-all shrink-0 mt-1"
                                >
                                  + Registrar Entrada
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Lines 1 to N — Parcelas: ícone calendário colorido por status, data DD/MM/AAAA, valor, badge 'X dias em atraso' se vencida, botão '+ Registrar Pagamento' se pendente */}
                      {installments.map((inst) => {
                        const overdue = inst.status !== "PAID" && inst.due_date < todayStr;
                        const isPaid = inst.status === "PAID";
                        const isPartial = inst.status === "PARTIAL";

                        // Bullet coloring class
                        let bulletColorClass = "bg-white border-slate-300 text-slate-400";
                        let bulletInnerClass = "bg-slate-300";

                        if (isPaid) {
                          bulletColorClass = "bg-emerald-500 border-emerald-400 text-white";
                          bulletInnerClass = "bg-white";
                        } else if (overdue) {
                          bulletColorClass = "bg-rose-500 border-rose-400 text-white animate-pulse";
                          bulletInnerClass = "bg-white";
                        } else if (isPartial) {
                          bulletColorClass = "bg-amber-500 border-amber-400 text-white";
                          bulletInnerClass = "bg-white";
                        } else {
                          bulletColorClass = "bg-blue-600 border-blue-500 text-white";
                          bulletInnerClass = "bg-white";
                        }

                        return (
                          <div className="relative pl-6" key={inst.number}>
                            {/* Bullet Icon */}
                            <div className={`absolute -left-[24px] top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${bulletColorClass}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${bulletInnerClass}`} />
                            </div>

                            {/* Flex core row */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="space-y-1">
                                <h6 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                                  <Calendar className={`w-3.5 h-3.5 shrink-0 ${getCalendarColorClass(inst.status, overdue)}`} />
                                  Parcela {inst.number} de {sp.installment_count}
                                </h6>
                                <p className="text-[10px] text-slate-500 font-semibold block">
                                  Previsão: <span className="font-extrabold text-slate-700">{formatDate(inst.due_date)}</span>
                                </p>

                                {/* Overdue indicator */}
                                {overdue && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-100 animate-pulse mt-1">
                                    {getDaysOverdue(inst.due_date)} dia{getDaysOverdue(inst.due_date) > 1 ? "s" : ""} em atraso
                                  </span>
                                )}

                                {/* Paid indicators */}
                                {(isPaid || isPartial) && (
                                  <p className="text-[10px] text-slate-500 font-semibold bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-lg inline-block mt-1 animate-scaleIn">
                                    Registrado: <span className="text-slate-800 font-bold">{formatDate(inst.payment_date || "")}</span> · {inst.payment_method}
                                    {inst.notes && <span className="block italic text-[9px] text-slate-400 font-medium">Obs: {inst.notes}</span>}
                                  </p>
                                )}
                              </div>

                              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-4 shrink-0">
                                <div className="text-left sm:text-right font-sans">
                                  <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase block">Valor</span>
                                  <span className="text-xs font-black text-slate-800 block">{formatCurrency(inst.calculated_value)}</span>
                                  {isPartial && inst.remaining_value !== undefined && (
                                    <span className="text-[9px] font-bold text-amber-500 block mt-0.5">Pend: {formatCurrency(inst.remaining_value)} (Pago: {formatCurrency(inst.paid_value)})</span>
                                  )}
                                </div>

                                {/* Registrar Pagamento Button inline */}
                                {(inst.status === "PENDING" || inst.status === "PARTIAL") && (
                                  <button
                                    onClick={() => openInlinePaymentForm(sp, "installment", inst.number)}
                                    className="text-[10px] bg-blue-50 border border-blue-150 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-500 font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg cursor-pointer transition-all shrink-0 mt-1"
                                  >
                                    + Registrar Pagamento
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        );
      })() : (
        /* Para vendas à vista exibir card simples: 'Venda à vista — sem cronograma de parcelas'. Botão 'Marcar como Pago' por split */
        <div id="payment-schedule-section" className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 md:p-8 space-y-4 font-sans animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Controles de Repasse</span>
              <h4 className="text-base font-black text-slate-800 uppercase tracking-tight">Cronograma de Pagamento</h4>
            </div>
            <span className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold uppercase tracking-widest px-3 py-1 rounded-full self-start sm:self-auto uppercase">
              Venda à Vista
            </span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-150 text-center space-y-5">
            <p className="text-xs text-slate-550 font-bold uppercase tracking-wider">Venda à vista — sem cronograma de parcelas</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {currentSplits.map(sp => {
                const isPaid = sp.status === "PAID";
                return (
                  <div key={sp.id} className="bg-white border border-slate-150 p-4 rounded-xl flex items-center justify-between gap-4 shadow-sm hover:border-slate-300 transition-all font-sans">
                    <div className="text-left font-sans">
                      <span className="text-[11px] font-black text-slate-800 block uppercase">{sp.broker_name}</span>
                      <span className="text-[10px] font-bold text-indigo-600 block mt-0.5">Cota: {sp.percentage}% ({formatCurrency(sp.calculated_value)})</span>
                    </div>

                    {isPaid ? (
                      <span className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border border-emerald-100/80">
                        Pago Realizado ✓
                      </span>
                    ) : (
                      <button
                        onClick={() => setSelectedSplitForPayment(sp)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-widest px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-500/10"
                      >
                        Marcar como Pago
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modais de Gerência */}
      <ForecastModal
        isOpen={selectedSplitForForecast !== null}
        onClose={() => setSelectedSplitForForecast(null)}
        currentDate={selectedSplitForForecast?.forecast_date || ""}
        brokerName={selectedSplitForForecast?.broker_name || ""}
        onSave={(newDate) => {
          if (selectedSplitForForecast) {
            onUpdateForecast(selectedSplitForForecast.id, newDate);
          }
        }}
      />

      {selectedSplitForPayment && (
        <PaymentModal
          isOpen={selectedSplitForPayment !== null}
          onClose={() => setSelectedSplitForPayment(null)}
          split={selectedSplitForPayment}
          discountBalance={team.find(u => (u.uid === selectedSplitForPayment.broker_id || u.id === selectedSplitForPayment.broker_id))?.adiantamento || 0}
          onRegisterPayment={onRegisterPayment}
        />
      )}

      {/* Visualização do comprovante Base64 popup */}
      {activeReceiptUrl && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-xl overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">Visualizar Comprovante</h3>
              <button
                onClick={() => setActiveReceiptUrl(null)}
                className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 bg-slate-100 flex items-center justify-center max-h-[60vh] overflow-y-auto">
              {activeReceiptUrl.startsWith("data:application/pdf") ? (
                <iframe
                  src={activeReceiptUrl}
                  title="PDF Receipt"
                  className="w-full h-96 border-none rounded-xl"
                />
              ) : (
                <img
                  src={activeReceiptUrl}
                  alt="Comprovante de pagamento"
                  className="max-w-full max-h-[50vh] object-contain rounded-xl shadow-md border border-slate-200"
                />
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmColor={confirmState.confirmColor}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
};
