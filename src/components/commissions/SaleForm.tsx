import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Save, RotateCcw, AlertTriangle, ShieldCheck, MapPin, User, Calendar, Percent, AlertCircle, FileText, X, CheckCircle2, XCircle, Loader2, Users, DollarSign, CreditCard, GitBranch } from "lucide-react";
import { ComissoneUser, Sale, BrokerSplit } from "../../types";
import { useAutoSave, decodeDraft } from "../../hooks/useAutoSave";
import { round2 } from "../../hooks/useQueries";
import { stripDoc, isValidCPF, isValidCNPJ, isValidDoc, maskDoc, getDocType } from "../../lib/utils";
import { ConfirmModal } from "../ui/ConfirmModal";

interface SaleFormProps {
  agencyId: string;
  team: ComissoneUser[];
  onSave: (saleData: Omit<Sale, "id">, splitsData: Omit<BrokerSplit, "id">[]) => void;
  onCancel: () => void;
  editingSale?: Sale | null;
  onUpdate?: (saleId: string, saleData: Partial<Sale>, splitsData: Omit<BrokerSplit, "id">[]) => void;
}

interface TempSplit {
  id?: string;
  brokerId: string;
  role: "CAPTADOR" | "VENDEDOR" | "GESTOR" | "";
  percentage: number | string;
}

interface DocFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onValidate: (isValid: boolean) => void;
  required?: boolean;
}

const DocField: React.FC<DocFieldProps> = ({
  label,
  value,
  onChange,
  onValidate,
  required = false
}) => {
  const [status, setStatus] = useState<'neutral' | 'valid' | 'invalid' | 'correcting'>('neutral');
  const [error, setError] = useState('');
  const [hadError, setHadError] = useState(false);

  // Validação interna para atualizar o layout/UI
  const runValidation = (val: string, showUI: boolean) => {
    const digits = stripDoc(val);
    if (digits.length === 0) {
      if (required) {
        if (showUI) {
          setError('Documento obrigatório');
          setStatus('invalid');
          setHadError(true);
        }
        onValidate(false);
      } else {
        if (showUI) {
          setError('');
          setStatus('neutral');
          setHadError(false);
        }
        onValidate(true);
      }
      return;
    }

    if (digits.length < 11 || (digits.length > 11 && digits.length < 14)) {
      if (showUI) {
        setError('CPF ou CNPJ inválido');
        setStatus('invalid');
        setHadError(true);
      }
      onValidate(false);
      return;
    }

    if (digits.length === 11) {
      if (isValidCPF(val)) {
        if (showUI) {
          setError('');
          setStatus('valid');
          setHadError(false);
        }
        onValidate(true);
      } else {
        if (showUI) {
          setError('CPF inválido — verifique os números digitados');
          setStatus('invalid');
          setHadError(true);
        }
        onValidate(false);
      }
      return;
    }

    // digits.length >= 14
    if (isValidCNPJ(val)) {
      if (showUI) {
        setError('');
        setStatus('valid');
        setHadError(false);
      }
      onValidate(true);
    } else {
      if (showUI) {
        setError('CNPJ inválido — verifique os números digitados');
        setStatus('invalid');
        setHadError(true);
      }
      onValidate(false);
    }
  };

  // Executa validação silenciosa no mount ou quando o valor mudar (ex: carregando rascunho)
  useEffect(() => {
    const digits = stripDoc(value);
    if (digits.length === 11) {
      const valid = isValidCPF(value);
      onValidate(valid);
      if (valid) {
        setStatus('valid');
        setError('');
      }
    } else if (digits.length === 14) {
      const valid = isValidCNPJ(value);
      onValidate(valid);
      if (valid) {
        setStatus('valid');
        setError('');
      }
    } else {
      onValidate(false);
    }
  }, [value, onValidate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const masked = maskDoc(raw);
    onChange(masked);

    const digits = stripDoc(masked);
    const valid = digits.length === 11 ? isValidCPF(masked) : (digits.length === 14 ? isValidCNPJ(masked) : false);
    onValidate(valid);

    if (hadError) {
      setStatus('correcting');
    } else {
      setStatus('neutral');
    }
  };

  const handleBlur = () => {
    runValidation(value, true);
  };

  // Classes de borda e background do input
  let borderClass = 'border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';
  if (status === 'valid') {
    borderClass = 'border-[1.5px] border-emerald-450 bg-emerald-50/10 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20';
  } else if (status === 'invalid') {
    borderClass = 'border-[1.5px] border-red-400 bg-red-50/10 focus:border-red-500 focus:ring-2 focus:ring-red-500/20';
  } else if (status === 'correcting') {
    borderClass = 'border-[1.5px] border-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20';
  }

  const digitsCount = stripDoc(value).length;
  const docType = getDocType(value);
  const labelText = docType ? `${docType} do ${label}` : `CPF ou CNPJ do ${label}`;

  return (
    <div className="flex flex-col relative w-full">
      <div className="flex items-center justify-between mb-1.5 h-4">
        <label className="block text-[10px] font-black uppercase tracking-widest text-[#1e3a5f]">
          {labelText}
        </label>
        {status === 'valid' && docType && (
          <span className="text-[9px] font-black text-emerald-600 bg-emerald-100/50 px-1.5 py-0.5 rounded uppercase tracking-wide border border-emerald-250">
            {docType} Válido
          </span>
        )}
      </div>
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="000.000.000-00 ou 00.000.000/0000-00"
          className={`w-full h-12 bg-white rounded-[10px] pl-4 pr-10 text-sm font-semibold text-slate-850 focus:outline-none transition-all duration-200 ${borderClass}`}
        />
        <div className="absolute right-3.5 flex items-center pointer-events-none">
          {status === 'valid' && (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 transition-transform duration-300 transform scale-100 ease-out" />
          )}
          {status === 'invalid' && (
            <XCircle className="w-5 h-5 text-red-500 animate-fade" />
          )}
          {status === 'correcting' && (
            <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
          )}
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-500 font-semibold mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3" />
          {error}
        </p>
      )}
    </div>
  );
};


export const SaleForm: React.FC<SaleFormProps> = ({
  agencyId,
  team,
  onSave,
  onCancel,
  editingSale,
  onUpdate
}) => {
  // Form states
  const [propertyAddress, setPropertyAddress] = useState(editingSale?.property_address || "");
  const [saleDate, setSaleDate] = useState(editingSale?.sale_date || new Date().toISOString().split("T")[0]);
  const [dataVencimentoNf, setDataVencimentoNf] = useState(editingSale?.data_vencimento_nf || "");
  const [saleValue, setSaleValue] = useState<number>(editingSale?.sale_value || 0);
  const [saleValueDisplay, setSaleValueDisplay] = useState(
    editingSale?.sale_value 
      ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(editingSale.sale_value)
      : ""
  );
  const [commissionPercentage, setCommissionPercentage] = useState<number | string>(editingSale?.commission_percentage ?? 6);
  const [clientName, setClientName] = useState(editingSale?.client_name || "");
  const [buyerDocType, setBuyerDocType] = useState<'CPF' | 'CNPJ'>(editingSale?.buyer_doc_type || 'CPF');
  const [buyerDoc, setBuyerDoc] = useState(editingSale?.buyer_doc || "");
  const [sellerName, setSellerName] = useState(editingSale?.seller_name || "");
  const [sellerDocType, setSellerDocType] = useState<'CPF' | 'CNPJ'>(editingSale?.seller_doc_type || 'CPF');
  const [sellerDoc, setSellerDoc] = useState(editingSale?.seller_doc || "");

  const [buyerDocValid, setBuyerDocValid] = useState(!!editingSale?.buyer_doc);
  const [sellerDocValid, setSellerDocValid] = useState(!!editingSale?.seller_doc);

  const [buyerDocError, setBuyerDocError] = useState("");
  const [sellerDocError, setSellerDocError] = useState("");
  const [draftToRestore, setDraftToRestore] = useState<any | null>(null);

  const [tempSplits, setTempSplits] = useState<TempSplit[]>(
    editingSale?.splits 
      ? editingSale.splits.map((s, idx) => ({
          id: s.id || `split-${idx}-${Date.now()}-${Math.random()}`,
          brokerId: s.broker_id,
          role: s.role,
          percentage: s.percentage
        }))
      : [
          { id: `split-0-${Date.now()}`, brokerId: "", role: "VENDEDOR", percentage: 60 },
          { id: `split-1-${Date.now()}`, brokerId: "", role: "CAPTADOR", percentage: 40 }
        ]
  );

  useEffect(() => {
    console.log('splits ao montar:', tempSplits);
  }, []);

  useEffect(() => {
    console.log('=== DEBUG TEAM ===');
    console.log('companyId:', agencyId);
    console.log('team recebido:', team);
    console.log('team length:', team?.length);
  }, [team, agencyId]);

  const [splitDivisionType, setSplitDivisionType] = useState<"commission" | "vgv">("commission");
  const [activeQuickDist, setActiveQuickDist] = useState<"50-50" | "60-40" | "70-30" | "100" | "custom">("custom");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Installment states
  const [isInstallment, setIsInstallment] = useState(editingSale?.is_installment || false);
  const [entradaValue, setEntradaValue] = useState<number>(editingSale?.entrada_value || 0);
  const [entradaValueDisplay, setEntradaValueDisplay] = useState(
    editingSale?.entrada_value 
      ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(editingSale.entrada_value)
      : ""
  );
  const [installmentCount, setInstallmentCount] = useState<number>(editingSale?.installment_count || 1);
  const [installmentValue, setInstallmentValue] = useState<number>(editingSale?.installment_value || 0);
  const [installmentValueDisplay, setInstallmentValueDisplay] = useState(
    editingSale?.installment_value 
      ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(editingSale.installment_value)
      : ""
  );
  const [firstInstallmentDate, setFirstInstallmentDate] = useState(
    editingSale?.first_installment_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );

  // Carregar rascunho no mount se existir
  useEffect(() => {
    if (editingSale) return;
    try {
      const stored = localStorage.getItem("comissone_sale_draft");
      if (stored) {
        const draft = decodeDraft<{
          propertyAddress: string;
          saleDate: string;
          dataVencimentoNf?: string;
          saleValue: number;
          commissionPercentage: number;
          clientName: string;
          sellerName?: string;
          tempSplits: TempSplit[];
          splitDivisionType?: "commission" | "vgv";
          activeQuickDist?: "50-50" | "60-40" | "70-30" | "100" | "custom";
          buyerDocType?: 'CPF' | 'CNPJ';
          buyerDoc?: string;
          sellerDocType?: 'CPF' | 'CNPJ';
          sellerDoc?: string;
        }>(stored);

        if (draft && (draft.propertyAddress || draft.clientName || draft.sellerName || draft.saleValue > 0 || draft.dataVencimentoNf || draft.buyerDoc || draft.sellerDoc)) {
          setDraftToRestore(draft);
        }
      }
    } catch (e) {
      console.error("Erro ao ler rascunho de comissão:", e);
    }
  }, [editingSale]);

  const handleApplyDraft = (draft: any) => {
    setPropertyAddress(draft.propertyAddress || "");
    setSaleDate(draft.saleDate || new Date().toISOString().split("T")[0]);
    setDataVencimentoNf(draft.dataVencimentoNf || "");
    
    const sVal = draft.saleValue || 0;
    setSaleValue(sVal);
    if (sVal > 0) {
      const formatted = new Intl.NumberFormat("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(sVal);
      setSaleValueDisplay(formatted);
    } else {
      setSaleValueDisplay("");
    }

    setCommissionPercentage(draft.commissionPercentage || 6);
    setClientName(draft.clientName || "");
    setSellerName(draft.sellerName || "");
    setTempSplits(draft.tempSplits || []);
    if (draft.splitDivisionType) {
      setSplitDivisionType(draft.splitDivisionType);
    }
    if (draft.activeQuickDist) {
      setActiveQuickDist(draft.activeQuickDist);
    }
    setBuyerDocType(draft.buyerDocType || 'CPF');
    setBuyerDoc(draft.buyerDoc || "");
    setSellerDocType(draft.sellerDocType || 'CPF');
    setSellerDoc(draft.sellerDoc || "");
  };

  // Hook do AutoSave ativo a cada 2000ms
  useAutoSave({
    key: "sale_draft",
    data: {
      propertyAddress,
      saleDate,
      dataVencimentoNf,
      saleValue,
      commissionPercentage,
      clientName,
      sellerName,
      tempSplits,
      splitDivisionType,
      activeQuickDist,
      buyerDocType,
      buyerDoc,
      sellerDocType,
      sellerDoc
    },
    debounceMs: 2000,
    disabled: !!editingSale
  });

  // Cálculos dinâmicos
  const numericCommissionPercentage = typeof commissionPercentage === "string" ? parseFloat(commissionPercentage.replace(",", ".")) || 0 : commissionPercentage || 0;
  const totalCommission = round2((saleValue * numericCommissionPercentage) / 100);

  const calculatedSum = round2(entradaValue + (installmentCount * installmentValue));
  const isSumMatching = Math.abs(calculatedSum - totalCommission) < 0.01;

  // Quando a comissão total, entrada ou quantidade de parcelas mudar, sugerimos o valor de parcela correspondente
  useEffect(() => {
    if (isInstallment) {
      const remaining = Math.max(0, totalCommission - entradaValue);
      const suggestedVal = round2(remaining / Math.max(1, installmentCount));
      setInstallmentValue(suggestedVal);
      setInstallmentValueDisplay(
        new Intl.NumberFormat("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(suggestedVal)
      );
    }
  }, [totalCommission, entradaValue, installmentCount, isInstallment]);

  const sumPercentage = tempSplits.reduce((acc, s) => {
    const val = typeof s.percentage === "string" ? parseFloat(s.percentage.replace(",", ".")) || 0 : s.percentage || 0;
    return acc + val;
  }, 0);
  const isPercentageValid = splitDivisionType === "vgv"
    ? (sumPercentage > 0 && round2(sumPercentage) <= round2(numericCommissionPercentage))
    : (round2(sumPercentage) === 100);
  const allBrokersSelected = tempSplits.every(s => s.brokerId !== "");
  const hasZeroPercentage = tempSplits.some(s => {
    const val = typeof s.percentage === "string" ? parseFloat(s.percentage.replace(",", ".")) || 0 : s.percentage || 0;
    return val === 0;
  });

  // Filtro de corretores autorizados para aparecer no dropdown (qualquer usuário no sistema/capatador/sócio/corretor)
  const filteredBrokers = useMemo(() => team.filter(b => {
    const isCompanyProfile = b.name?.toLowerCase().includes("fidelité") || b.email?.toLowerCase().includes("fidelite");
    if (isCompanyProfile) return false;

    // Permitir qualquer usuário ativo no sistema poder receber splits de vendas
    return true;
  }), [team]);

  const getBrokerDisplayRole = (b: ComissoneUser): string => {
    const rawRole = String(b.role || "").toUpperCase();
    if (rawRole === "ADMIN") {
      return "Corretor";
    }
    if (rawRole === "MANAGER" || rawRole === "GESTOR") {
      return "Gestor";
    }
    if (rawRole === "CAPTADOR") {
      return "Captador";
    }
    return "Corretor";
  };

  const sociosIds = useMemo(() => {
    return team
      .filter((u) => u.isSocio === true)
      .map((u) => u.id);
  }, [team]);

  const getAvailableBrokers = (currentIdx: number) => {
    // Outros IDs de corretores já selecionados nas outras linhas de splits
    const otherSelectedBrokerIds = tempSplits
      .filter((_, i) => i !== currentIdx)
      .map((s) => s.brokerId)
      .filter((id) => id !== "" && id !== "AGENCY");

    return filteredBrokers.filter((b) => {
      const isSocio = b.isSocio === true || sociosIds.includes(b.id);
      if (isSocio) {
        return true; // Sócios sempre estão disponíveis
      }
      return !otherSelectedBrokerIds.includes(b.id);
    });
  };

  const getBrokerDropdownLabel = (b: ComissoneUser): string => {
    const isSocio = b.isSocio === true || sociosIds.includes(b.id);
    if (isSocio) {
      return `⭐ ${b.name} (Sócio)`;
    }
    const roleLabel = b.cargoComissao
      ? b.cargoComissao.charAt(0) + b.cargoComissao.slice(1).toLowerCase()
      : getBrokerDisplayRole(b).toLowerCase();
    return `${b.name} (${roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)})`;
  };

  const toggleSplitDivisionType = () => {
    const nextType = splitDivisionType === "commission" ? "vgv" : "commission";
    setSplitDivisionType(nextType);
    setActiveQuickDist("custom");

    const factor = commissionPercentage || 6;
    const updatedSplits = tempSplits.map(sp => {
      let nextPerc = sp.percentage;
      if (nextType === "vgv") {
        nextPerc = round2((sp.percentage * factor) / 100);
      } else {
        nextPerc = round2((sp.percentage * 100) / factor);
      }
      return { ...sp, percentage: nextPerc };
    });
    setTempSplits(updatedSplits);
  };

  const handleQuickDistribution = (type: "50-50" | "60-40" | "70-30" | "100" | "custom") => {
    if (type === "custom") {
      return;
    }

    let numRows = 2;
    let pctArray = [50, 50];

    if (type === "100") {
      numRows = 1;
      pctArray = [100];
    } else if (type === "60-40") {
      numRows = 2;
      pctArray = [60, 40];
    } else if (type === "70-30") {
      numRows = 2;
      pctArray = [70, 30];
    }

    if (splitDivisionType === "vgv") {
      const factor = commissionPercentage || 6;
      pctArray = pctArray.map(pct => round2((pct * factor) / 100));
    }

    const nextSplits: TempSplit[] = Array.from({ length: numRows }).map((_, i) => {
      const existing = tempSplits[i];
      let roleDefault: "VENDEDOR" | "CAPTADOR" | "GESTOR" = "VENDEDOR";
      if (numRows === 2) {
        roleDefault = i === 0 ? "VENDEDOR" : "CAPTADOR";
      } else if (numRows === 1) {
        roleDefault = "VENDEDOR";
      }
      return {
        id: existing?.id || `split-qd-${i}-${Date.now()}-${Math.random()}`,
        brokerId: existing ? existing.brokerId : "",
        role: existing ? existing.role : roleDefault,
        percentage: pctArray[i]
      };
    });

    setTempSplits(nextSplits);
  };

  const navigateToUsersTab = () => {
    const navButtons = Array.from(document.querySelectorAll("aside button, nav button, aside a, nav a"));
    const usersButton = navButtons.find(btn => 
      btn.textContent?.includes("Config. Usuários") || 
      btn.textContent?.includes("Usuários") ||
      btn.textContent?.toLowerCase().includes("user")
    ) as HTMLElement | undefined;

    if (usersButton) {
      usersButton.click();
    } else {
      alert("Acesse 'Config. Usuários' no menu lateral para cadastrar corretores.");
    }
  };

  const handleAddSplit = () => {
    const limit = splitDivisionType === "vgv" ? (typeof commissionPercentage === "string" ? parseFloat(commissionPercentage.replace(",", ".")) || 0 : commissionPercentage || 0) : 100;
    const remainingPercentage = round2(limit - sumPercentage);
    const defaultPercentage = Math.max(0, remainingPercentage);
    setTempSplits([...tempSplits, { id: `split-add-${Date.now()}-${Math.random()}`, brokerId: "", role: "GESTOR", percentage: defaultPercentage }]);
    setActiveQuickDist("custom");
  };

  const handleRemoveSplit = (idx: number) => {
    setTempSplits(tempSplits.filter((_, i) => i !== idx));
    setActiveQuickDist("custom");
  };

  const handleSplitChange = (idx: number, field: keyof TempSplit, val: any) => {
    if (field === "percentage") {
      setActiveQuickDist("custom");
    }
    setTempSplits(
      tempSplits.map((item, i) => {
        if (i === idx) {
          if (field === "percentage") {
            if (val === "") {
              return { ...item, percentage: "" };
            }
            const normalized = String(val).replace(",", ".");
            const parsed = parseFloat(normalized);
            const constrained = isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
            if (typeof val === "string" && (val.endsWith(".") || val.endsWith(","))) {
              return { ...item, percentage: val };
            }
            return {
              ...item,
              percentage: constrained
            };
          }
          if (field === "brokerId") {
            // Find selected broker from team
            const selectedBroker = team.find(b => b.id === val);
            let nextRole = item.role;
            if (selectedBroker) {
              const cargo = selectedBroker.cargoComissao;
              if (cargo === "CORRETOR") {
                nextRole = "VENDEDOR";
              } else if (cargo === "CAPTADOR") {
                nextRole = "CAPTADOR";
              } else if (cargo === "GESTOR") {
                nextRole = "GESTOR";
              } else if (cargo === "SOCIO") {
                nextRole = "";
              }
            }
            return { ...item, brokerId: val, role: nextRole };
          }
          return { ...item, [field]: val };
        }
        return item;
      })
    );
  };

  const handleClearDraft = () => {
    setPropertyAddress("");
    setDataVencimentoNf("");
    setSaleValue(0);
    setSaleValueDisplay("");
    setClientName("");
    setBuyerDocType("CPF");
    setBuyerDoc("");
    setSellerDocType("CPF");
    setSellerDoc("");
    setBuyerDocError("");
    setSellerDocError("");
    setBuyerDocValid(false);
    setSellerDocValid(false);
    setSplitDivisionType("commission");
    setActiveQuickDist("custom");
    setTempSplits([
      { id: `split-clear-0-${Date.now()}`, brokerId: "", role: "VENDEDOR", percentage: 60 },
      { id: `split-clear-1-${Date.now()}`, brokerId: "", role: "CAPTADOR", percentage: 40 }
    ]);
    localStorage.removeItem("comissone_sale_draft");
  };

  const handleCancel = () => {
    const hasPopulated = propertyAddress.trim() !== "" || clientName.trim() !== "" || saleValue > 0;
    if (hasPopulated) {
      setShowDiscardConfirm(true);
    } else {
      onCancel();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!propertyAddress.trim()) {
      alert("Informe o endereço do imóvel vendido.");
      return;
    }
    if (!clientName.trim()) {
      alert("Informe o nome do cliente.");
      return;
    }
    if (!sellerName.trim()) {
      alert("Informe o nome do vendedor / proprietário.");
      return;
    }

    // Validar documento do comprador
    if (!buyerDoc.trim()) {
      alert("Documento comprador obrigatório.");
      return;
    }
    const cleanBuyer = stripDoc(buyerDoc);
    const buyerType = getDocType(buyerDoc);
    if (buyerType === "CPF") {
      if (!isValidCPF(buyerDoc)) {
        alert("CPF do comprador inválido.");
        return;
      }
    } else if (buyerType === "CNPJ") {
      if (!isValidCNPJ(buyerDoc)) {
        alert("CNPJ do comprador inválido.");
        return;
      }
    } else {
      alert("Documento do comprador inválido.");
      return;
    }

    // Validar documento do vendedor
    if (!sellerDoc.trim()) {
      alert("Documento vendedor obrigatório.");
      return;
    }
    const cleanSeller = stripDoc(sellerDoc);
    const sellerType = getDocType(sellerDoc);
    if (sellerType === "CPF") {
      if (!isValidCPF(sellerDoc)) {
        alert("CPF do vendedor inválido.");
        return;
      }
    } else if (sellerType === "CNPJ") {
      if (!isValidCNPJ(sellerDoc)) {
        alert("CNPJ do vendedor inválido.");
        return;
      }
    } else {
      alert("Documento do vendedor inválido.");
      return;
    }

    if (saleValue <= 0) {
      alert("O valor da venda deve ser maior que zero.");
      return;
    }
    if (commissionPercentage <= 0) {
      alert("A porcentagem de comissão deve ser maior que zero.");
      return;
    }
    if (tempSplits.length === 0) {
      alert("Adicione pelo menos um split de corretor.");
      return;
    }
    if (tempSplits.some(s => !s.brokerId)) {
      alert("Selecione o corretor em todas as linhas antes de salvar.");
      return;
    }
    if (tempSplits.some(s => !s.role)) {
      alert("Selecione o papel / função para todos os recebedores.");
      return;
    }

    // Validar múltiplos papéis e regras de duplicidade por corretor a nível de negócio
    const occurrences: { [id: string]: { count: number; roles: string[] } } = {};
    for (const s of tempSplits) {
      if (s.brokerId && s.brokerId !== "AGENCY") {
        if (!occurrences[s.brokerId]) {
          occurrences[s.brokerId] = { count: 0, roles: [] };
        }
        occurrences[s.brokerId].count += 1;
        if (s.role) {
          occurrences[s.brokerId].roles.push(s.role);
        }
      }
    }

    for (const bId of Object.keys(occurrences)) {
      const brokerObj = team.find((b) => b.id === bId);
      const isSocio = brokerObj?.isSocio === true || sociosIds.includes(bId);
      const { count, roles } = occurrences[bId];
      const brokerName = brokerObj?.name || "Corretor";

      if (isSocio) {
        if (count > 3) {
          alert(`O sócio ${brokerName} não pode participar mais do que 3 vezes na mesma divisão de comissão.`);
          return;
        }
        const uniqueRoles = new Set(roles);
        if (uniqueRoles.size !== roles.length) {
          alert(`O sócio ${brokerName} está selecionado com o mesmo papel mais de uma vez. Cada participação deve ter papel/função distinto.`);
          return;
        }
      } else {
        if (count > 1) {
          alert(`O corretor ${brokerName} não pode participar mais do que uma vez na mesma divisão de comissão.`);
          return;
        }
      }
    }
    if (hasZeroPercentage) {
      alert("Ajuste ou remova os splits com percentual igual a zero antes de salvar.");
      return;
    }
    if (!isPercentageValid) {
      if (splitDivisionType === "vgv") {
        alert(`As porcentagens dos splits somam ${sumPercentage}%. Ela deve ser maior que zero e não pode ultrapassar a comissão contratada de ${commissionPercentage}% do VGV.`);
      } else {
        alert(`As porcentagens dos splits somam ${sumPercentage}%. Ela deve somar exatamente 100%.`);
      }
      return;
    }

    if (isInstallment) {
      if (entradaValue < 0 || installmentValue < 0 || installmentCount <= 0) {
        alert("Os valores de entrada, número de parcelas e valor de parcela devem ser válidos.");
        return;
      }
      if (!firstInstallmentDate) {
        alert("Preencha a data do primeiro vencimento.");
        return;
      }
      if (!isSumMatching) {
        alert("O total planejado do parcelamento não bate com a comissão total da imobiliária. Por favor, ajuste os valores para bater com " + formatCurrency(totalCommission));
        return;
      }
    }

    // Estrutura o SaleData
    const saleData: Omit<Sale, "id"> = {
      agency_id: agencyId,
      sale_date: saleDate,
      property_address: propertyAddress,
      sale_value: saleValue,
      commission_percentage: commissionPercentage,
      total_commission: totalCommission,
      client_name: clientName,
      seller_name: sellerName,
      status: "ACTIVE",
      data_vencimento_nf: dataVencimentoNf || "",
      created_at: new Date().toISOString(),
      buyer_doc_type: buyerDocType,
      buyer_doc: buyerDoc,
      seller_doc_type: sellerDocType,
      seller_doc: sellerDoc,
      is_installment: isInstallment,
      entrada_value: isInstallment ? entradaValue : 0,
      installment_count: isInstallment ? installmentCount : 0,
      installment_value: isInstallment ? installmentValue : 0,
      first_installment_date: isInstallment ? firstInstallmentDate : ""
    };

    // Estrutura os SplitsData
    const defaultForecast = new Date();
    defaultForecast.setDate(defaultForecast.getDate() + 30);
    const defaultForecastStr = defaultForecast.toISOString().split("T")[0];

    const splitsData: Omit<BrokerSplit, "id">[] = tempSplits.map(s => {
      const brokerObj = s.brokerId === "AGENCY" ? null : team.find(b => b.id === s.brokerId);
      const brokerName = s.brokerId === "AGENCY" ? "Agência (Imobiliária)" : (brokerObj?.name || "Corretor");
      
      const calculatedValue = splitDivisionType === "vgv"
        ? round2((saleValue * s.percentage) / 100)
        : round2((totalCommission * s.percentage) / 100);

      // Fator de proporção baseado no total da comissão
      const brokerFactor = totalCommission > 0 ? (calculatedValue / totalCommission) : 0;

      if (isInstallment) {
        // Calcule a entrada proporcional de cada corretor
        const brokerEntrada = round2(entradaValue * brokerFactor);
        // Calcule o saldo restante de cada corretor após entrada
        const brokerSaldo = calculatedValue - brokerEntrada;
        const brokerInstallmentVal = round2(brokerSaldo / installmentCount);

        return {
          sale_id: "",
          agency_id: agencyId,
          broker_id: s.brokerId,
          broker_name: brokerName,
          role: s.role,
          percentage: s.percentage,
          calculated_value: calculatedValue,
          status: "PENDING",
          forecast_date: firstInstallmentDate,
          entrada_value: brokerEntrada,
          installment_count: installmentCount,
          installment_value: brokerInstallmentVal,
          first_installment_date: firstInstallmentDate,
          installment_number: 1,
          created_at: new Date().toISOString()
        };
      } else {
        return {
          sale_id: editingSale?.id || "",
          agency_id: agencyId,
          broker_id: s.brokerId,
          broker_name: brokerName,
          role: s.role,
          percentage: s.percentage,
          calculated_value: calculatedValue,
          status: "PENDING",
          forecast_date: defaultForecastStr,
          created_at: new Date().toISOString()
        };
      }
    });

    if (editingSale && onUpdate) {
      const updatedStatus = editingSale.status === "DRAFT" ? "ACTIVE" : editingSale.status;
      onUpdate(editingSale.id, { ...saleData, status: updatedStatus }, splitsData);
    } else {
      onSave(saleData, splitsData);
    }
    localStorage.removeItem("comissone_sale_draft");
  };

  const handleSaveAsDraft = () => {
    if (!propertyAddress.trim()) {
      alert("Informe pelo menos o endereço do imóvel vendido para salvar o rascunho.");
      return;
    }

    const saleData: Omit<Sale, "id"> = {
      agency_id: agencyId,
      sale_date: saleDate,
      property_address: propertyAddress,
      sale_value: saleValue,
      commission_percentage: typeof commissionPercentage === "string" ? parseFloat(commissionPercentage.replace(",", ".")) || 0 : commissionPercentage || 0,
      total_commission: totalCommission,
      client_name: clientName || "Rascunho",
      seller_name: sellerName || "",
      status: "DRAFT",
      data_vencimento_nf: dataVencimentoNf || "",
      created_at: editingSale?.created_at || new Date().toISOString(),
      buyer_doc_type: buyerDocType,
      buyer_doc: buyerDoc,
      seller_doc_type: sellerDocType,
      seller_doc: sellerDoc,
      is_installment: isInstallment,
      entrada_value: isInstallment ? entradaValue : 0,
      installment_count: isInstallment ? installmentCount : 0,
      installment_value: isInstallment ? installmentValue : 0,
      first_installment_date: isInstallment ? firstInstallmentDate : ""
    };

    const defaultForecast = new Date();
    defaultForecast.setDate(defaultForecast.getDate() + 30);
    const defaultForecastStr = defaultForecast.toISOString().split("T")[0];

    const splitsData: Omit<BrokerSplit, "id">[] = tempSplits.map(s => {
      const brokerObj = s.brokerId === "AGENCY" ? null : team.find(b => b.id === s.brokerId);
      const brokerName = s.brokerId === "AGENCY" ? "Agência (Imobiliária)" : (brokerObj?.name || "Corretor");
      
      const pct = typeof s.percentage === "string" ? parseFloat(s.percentage) || 0 : s.percentage || 0;
      const calculatedValue = splitDivisionType === "vgv"
        ? round2((saleValue * pct) / 100)
        : round2((totalCommission * pct) / 100);

      return {
        sale_id: editingSale?.id || "",
        agency_id: agencyId,
        broker_id: s.brokerId,
        broker_name: s.brokerId ? brokerName : "",
        role: s.role || "VENDEDOR",
        percentage: pct,
        calculated_value: calculatedValue,
        status: "PENDING",
        forecast_date: isInstallment ? firstInstallmentDate : defaultForecastStr,
        entrada_value: isInstallment ? round2(entradaValue * (pct / 100)) : 0,
        installment_count: isInstallment ? installmentCount : 0,
        installment_value: isInstallment ? round2((calculatedValue - round2(entradaValue * (pct / 100))) / installmentCount) : 0,
        first_installment_date: isInstallment ? firstInstallmentDate : "",
        installment_number: isInstallment ? 1 : null,
        created_at: new Date().toISOString()
      };
    });

    if (editingSale && onUpdate) {
      onUpdate(editingSale.id, { ...saleData, status: "DRAFT" }, splitsData);
    } else {
      onSave({ ...saleData, status: "DRAFT" }, splitsData);
    }
    localStorage.removeItem("comissone_sale_draft");
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm max-w-4xl mx-auto overflow-hidden animate-fade-in-up">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.98);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in-up {
          opacity: 0;
          animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-down {
          animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
        .delay-300 { animation-delay: 300ms; }
        .delay-400 { animation-delay: 400ms; }
        .delay-500 { animation-delay: 500ms; }
      ` }} />

      {/* 1. Header do formulário: Faixa de gradiente azul escuro */}
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2563eb] text-white p-8 rounded-t-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">Cadastrar Nova Venda</h2>
          <p className="text-xs text-blue-200 font-bold uppercase tracking-widest mt-1 font-sans">
            Lance uma nova venda de imóvel com divisão (split) de comissão
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClearDraft}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/40 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Limpar Rascunho Atual"
          >
            <RotateCcw className="w-3.5 h-3.5 text-white" />
            Limpar Rascunho
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
        
        {/* Bloco 1: Informações do Imóvel */}
        <div className="bg-slate-50/40 border border-slate-100 rounded-xl p-5 space-y-4 animate-fade-in-up delay-100">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
            <h3 className="text-xs font-black uppercase tracking-widest text-[#1e3a5f]">Informações do Imóvel</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-3">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-450 mb-1.5">
                Endereço Completo do Imóvel
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Av. Atlântica, Edifício Atlantis, Apto 502"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  className="w-full h-12 bg-white border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-[10px] pl-10 pr-4 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-450 mb-1.5">
                Data da Venda
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="date"
                  required
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full h-12 bg-white border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-[10px] pl-10 pr-4 text-sm font-semibold text-slate-800 focus:outline-none transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-450 mb-1.5 flex items-center gap-1">
                Vencimento Emissão NF
                <span className="text-[9px] lowercase font-normal text-slate-400">(opcional)</span>
              </label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="date"
                  value={dataVencimentoNf}
                  onChange={(e) => setDataVencimentoNf(e.target.value)}
                  className="w-full h-12 bg-white border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-[10px] pl-10 pr-4 text-sm font-semibold text-slate-800 focus:outline-none transition-all duration-200"
                  title="Prazo limite para emissão de Nota Fiscal"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bloco 2: Participantes do Negócio */}
        <div className="bg-slate-50/40 border border-slate-100 rounded-xl p-5 space-y-4 animate-fade-in-up delay-200 font-sans">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Users className="w-4 h-4 text-blue-600 shrink-0" />
            <h3 className="text-xs font-black uppercase tracking-widest text-[#1e3a5f]">Participantes do Negócio</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Nome do Comprador */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-450 mb-1.5">
                Nome do Comprador (Cliente)
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Alberto de Souza"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full h-12 bg-white border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-[10px] pl-10 pr-4 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200"
                />
              </div>
            </div>

            {/* Documento do Comprador */}
            <DocField
              label="Comprador"
              value={buyerDoc}
              onChange={setBuyerDoc}
              onValidate={setBuyerDocValid}
              required={true}
            />

            {/* Nome do Vendedor / Proprietário */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#1e3a5f] mb-1.5">
                Nome do Vendedor / Proprietário
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Maria Oliveira"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  className="w-full h-12 bg-white border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-[10px] pl-10 pr-4 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200"
                />
              </div>
            </div>

            {/* Documento do Vendedor/Proprietário */}
            <DocField
              label="Vendedor"
              value={sellerDoc}
              onChange={setSellerDoc}
              onValidate={setSellerDocValid}
              required={true}
            />
          </div>
        </div>

        {/* Bloco 3: Valores e Comissão Geral */}
        <div className="bg-slate-50/40 border border-slate-100 rounded-xl p-5 space-y-4 animate-fade-in-up delay-300">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <DollarSign className="w-4 h-4 text-blue-600 shrink-0" />
            <h3 className="text-xs font-black uppercase tracking-widest text-[#1e3a5f]">Valores e Comissão Geral</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {/* Campo Monetário VGV */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-450">
                Valor de Venda (R$)
              </label>
              <div className="relative mt-2">
                <div className="absolute left-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-blue-100 text-blue-700 text-[10px] font-black rounded-lg pointer-events-none">
                  R$
                </div>
                <input
                  type="text"
                  required
                  placeholder="0,00"
                  value={saleValueDisplay}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    const cleanVal = rawValue.replace(/\D/g, "");
                    if (!cleanVal) {
                      setSaleValueDisplay("");
                      setSaleValue(0);
                      return;
                    }
                    const numericValue = parseFloat(cleanVal) / 100;
                    setSaleValue(numericValue);
                    const formatted = new Intl.NumberFormat("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(numericValue);
                    setSaleValueDisplay(formatted);
                  }}
                  className="w-full h-12 bg-blue-50/30 border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-[10px] pl-14 pr-4 text-lg font-black text-blue-700 placeholder-slate-400 focus:outline-none transition-all duration-200"
                />
              </div>
            </div>

            {/* Percentual Comissão */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-450">
                Comissão da Imobiliária (%)
              </label>
              <div className="relative mt-2">
                <Percent className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="number"
                  step="0.1"
                  required
                  value={commissionPercentage}
                  onChange={(e) => setCommissionPercentage(e.target.value)}
                  className="w-full h-12 bg-white border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-[10px] pl-4 pr-10 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none transition-all duration-200"
                />
              </div>
            </div>

            {/* Card comissão total */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border-[1.5px] border-blue-200 flex flex-col justify-center min-h-[90px]">
              <span className="block text-xs font-black uppercase tracking-widest text-[#1e3a5f] mb-1">
                Receita de Comissão Total
              </span>
              <div className="text-2xl font-black text-blue-700 leading-none">
                {formatCurrency(totalCommission)}
              </div>
              <span className="block text-xs text-blue-400 font-semibold mt-1">
                Gerada a partir de {commissionPercentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Bloco 4: Forma de Recebimento da Comissão */}
        <div className="bg-slate-50/40 border border-slate-100 rounded-xl p-5 space-y-4 animate-fade-in-up delay-400">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
                <h3 className="text-xs font-black uppercase tracking-widest text-[#1e3a5f]">Forma de Recebimento da Comissão</h3>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 font-sans">
                Defina se a comissão será paga em cota única ou parcelada
              </p>
            </div>
            {/* 6. Toggle À Vista / Parcelado */}
            <div className="flex bg-slate-100 rounded-[10px] p-1 shadow-inner shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setIsInstallment(false)}
                className={`px-4 py-2 rounded-[8px] text-xs font-black transition-all duration-200 cursor-pointer ${
                  !isInstallment
                    ? "bg-white text-slate-800 shadow-sm"
                    : "bg-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                À Vista
              </button>
              <button
                type="button"
                onClick={() => setIsInstallment(true)}
                className={`px-4 py-2 rounded-[8px] text-xs font-black transition-all duration-200 cursor-pointer ${
                  isInstallment
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Parcelado
              </button>
            </div>
          </div>

          {isInstallment && (
            <div className="space-y-4 animate-slide-down">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Entrada */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-455">
                    Valor de Entrada (R$)
                  </label>
                  <div className="relative mt-1">
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded pointer-events-none font-sans">
                      R$
                    </div>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={entradaValueDisplay}
                      onChange={(e) => {
                        const rawUnit = e.target.value;
                        const cleanUnit = rawUnit.replace(/\D/g, "");
                        if (!cleanUnit) {
                          setEntradaValueDisplay("");
                          setEntradaValue(0);
                          return;
                        }
                        const bValue = parseFloat(cleanUnit) / 100;
                        setEntradaValue(bValue);
                        setEntradaValueDisplay(
                          new Intl.NumberFormat("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(bValue)
                        );
                      }}
                      className="w-full h-12 bg-blue-50/30 border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-[10px] pl-12 pr-3 text-sm font-black text-blue-750 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Número de Parcelas */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-454">
                    Número de Parcelas
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="Ex: 5"
                    value={installmentCount}
                    onChange={(e) => setInstallmentCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-12 bg-white border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-[10px] px-3 text-sm font-semibold text-slate-800 focus:outline-none transition-colors"
                  />
                </div>

                {/* Valor de Cada Parcela */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-455">
                    Valor da Parcela (R$)
                  </label>
                  <div className="relative mt-1">
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded pointer-events-none font-sans">
                      R$
                    </div>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={installmentValueDisplay}
                      onChange={(e) => {
                        const rawUnit = e.target.value;
                        const cleanUnit = rawUnit.replace(/\D/g, "");
                        if (!cleanUnit) {
                          setInstallmentValueDisplay("");
                          setInstallmentValue(0);
                          return;
                        }
                        const bValue = parseFloat(cleanUnit) / 100;
                        setInstallmentValue(bValue);
                        setInstallmentValueDisplay(
                          new Intl.NumberFormat("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(bValue)
                        );
                      }}
                      className="w-full h-12 bg-blue-50/30 border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-[10px] pl-12 pr-3 text-sm font-black text-blue-750 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Data do Primeiro Vencimento */}
                <div className="space-y-1">
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-455">
                    Primeiro Vencimento
                  </label>
                  <input
                    type="date"
                    required={isInstallment}
                    value={firstInstallmentDate}
                    onChange={(e) => setFirstInstallmentDate(e.target.value)}
                    className="w-full h-12 bg-white border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-[10px] px-3 text-sm font-semibold text-slate-850 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Informação sobre os demais vencimentos */}
              <p className="text-[10px] text-slate-450 font-bold uppercase font-sans">
                * As demais datas são calculadas automaticamente somando 30 dias cada.
              </p>

              {/* 7. Card de Resumo do Parcelamento */}
              <div id="installment-summary-card" className="border-l-4 border-l-blue-600 bg-gradient-to-r from-blue-50 to-white p-5 rounded-r-2xl border-y border-r border-slate-100 space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#1e3a5f]">Resumo do Parcelamento</h4>
                <div className="space-y-2 text-xs font-semibold text-slate-705">
                  <p className="flex items-center">
                    <span className="text-blue-500 mr-2 font-black">•</span>
                    Entrada: <strong className="font-black text-blue-700 ml-1.5">{formatCurrency(entradaValue)}</strong> — paga na assinatura
                  </p>
                  <p className="flex items-center">
                    <span className="text-blue-500 mr-2 font-black">•</span>
                    {installmentCount} {installmentCount === 1 ? "parcela" : "parcelas"} de <strong className="font-black text-blue-700 ml-1.5">{formatCurrency(installmentValue)}</strong> — a partir de {firstInstallmentDate ? firstInstallmentDate.split("-").reverse().join("/") : ""}
                  </p>
                  <div className="pt-3 mt-3 border-t border-dashed border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-slate-850 font-black">Total Planejado: <strong className="text-blue-700 font-extrabold text-sm">{formatCurrency(calculatedSum)}</strong></span>
                    <div className="shrink-0 flex items-center">
                      {isSumMatching ? (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1 font-black text-[10px] uppercase tracking-wide">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ✓ Bate com o total
                        </span>
                      ) : (
                        <span className="text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full flex items-center gap-1 font-black text-[10px] uppercase tracking-wide animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          ✗ Diferença de {formatCurrency(Math.abs(calculatedSum - totalCommission))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bloco 5: Splits de Corretores */}
        <div className="bg-slate-50/40 border border-slate-100 rounded-xl p-5 space-y-4 animate-fade-in-up delay-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-blue-600 shrink-0" />
                <h3 className="text-xs font-black uppercase tracking-widest text-[#1e3a5f]">Splits de Repasse</h3>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 font-sans">
                Divida as receitas de comissão entre a agência e corretores
              </p>
            </div>
            
            <button
              type="button"
              onClick={handleAddSplit}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all flex items-center shadow-md shadow-blue-500/10 self-start sm:self-center"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Corretor
            </button>
          </div>

          {/* Alternação de tipo de divisão */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-100/50 p-4 rounded-[12px] border border-slate-100">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#1e3a5f]">Modo de Divisão dos Splits</span>
              <span className="text-[9px] font-semibold text-slate-400 font-sans">Escolha se os percentuais se referem à comissão ou ao valor da venda (VGV)</span>
            </div>
            <div className="flex bg-slate-100 rounded-[10px] p-1 shadow-inner shrink-0 self-start lg:self-center">
              <button
                type="button"
                onClick={() => {
                  if (splitDivisionType !== "commission") {
                    toggleSplitDivisionType();
                  }
                }}
                className={`px-3 py-1.5 rounded-[8px] text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  splitDivisionType === "commission"
                    ? "bg-white text-slate-800 shadow-sm font-black"
                    : "bg-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                % da Comissão ({formatCurrency(totalCommission)})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (splitDivisionType !== "vgv") {
                    toggleSplitDivisionType();
                  }
                }}
                className={`px-3 py-1.5 rounded-[8px] text-[9px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  splitDivisionType === "vgv"
                    ? "bg-blue-600 text-white shadow-sm font-black"
                    : "bg-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                % do VGV ({formatCurrency(saleValue)})
              </button>
            </div>
          </div>

          {/* Botões de distribuição rápida */}
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-[#1e3a5f] shrink-0">Distribuição Rápida:</span>
            <div className="flex flex-wrap gap-1.5">
              {(["50-50", "60-40", "70-30", "100", "custom"] as const).map((type) => {
                const labelMap = {
                  "50-50": "50/50",
                  "60-40": "60/40 (Vendedor/Captador)",
                  "70-30": "70/30",
                  "100": "100%",
                  "custom": "Personalizado"
                };
                const isActive = activeQuickDist === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setActiveQuickDist(type);
                      handleQuickDistribution(type);
                    }}
                    className={`px-3 py-1.5 rounded-[8px] text-[9px] font-extrabold uppercase tracking-wide transition-all duration-200 border cursor-pointer ${
                      isActive
                        ? "bg-[#1e3a5f] border-[#1e3a5f] text-white font-black shadow-md shadow-blue-500/10"
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-350 hover:text-[#1e3a5f] hover:bg-slate-50"
                    }`}
                  >
                    {labelMap[type]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Barra de Progresso Visual de Divisão */}
          <div className="space-y-1.5 font-sans bg-white p-3 rounded-lg border border-slate-100">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
              <span className="text-[#1e3a5f]">Progresso da Alocação</span>
              <span>
                {sumPercentage}%{splitDivisionType === "commission" ? " / 100%" : ` / ${commissionPercentage}% (Contratada)`}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
              <div 
                className={`h-full transition-all duration-350 ${
                  sumPercentage === (splitDivisionType === "commission" ? 100 : commissionPercentage)
                    ? "bg-emerald-500"
                    : sumPercentage > (splitDivisionType === "commission" ? 100 : commissionPercentage)
                      ? "bg-rose-500 animate-pulse"
                      : "bg-amber-400"
                }`}
                style={{ width: `${Math.min(100, (sumPercentage / (splitDivisionType === "commission" ? 100 : commissionPercentage || 1) * 100))}%` }}
              />
            </div>
          </div>

          <div className="space-y-3">
            {tempSplits.map((item, idx) => {
              const splitPctNum = typeof item.percentage === "string" ? parseFloat(item.percentage.replace(",", ".")) || 0 : item.percentage || 0;
              const commPctNum = typeof commissionPercentage === "string" ? parseFloat(commissionPercentage.replace(",", ".")) || 0 : commissionPercentage || 0;

              const itemCalculatedValue = splitDivisionType === "vgv"
                ? round2((saleValue * splitPctNum) / 100)
                : round2((totalCommission * splitPctNum) / 100);

              // Percentual equivalente no outro modo
              let equivalentText = "";
              if (splitDivisionType === "commission") {
                const equivPct = (splitPctNum * commPctNum) / 100;
                equivalentText = `equivale a ${round2(equivPct).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}% do VGV`;
              } else {
                const factor = commPctNum || 1;
                const equivPct = (splitPctNum * 100) / factor;
                equivalentText = `equivale a ${round2(equivPct).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}% da comissão`;
              }

              let leftBorderClass = "border-l-4 border-l-slate-200";
              if (item.brokerId === "AGENCY") {
                leftBorderClass = "border-l-4 border-l-amber-500";
              } else if (item.role === "VENDEDOR") {
                leftBorderClass = "border-l-4 border-l-blue-500";
              } else if (item.role === "CAPTADOR") {
                leftBorderClass = "border-l-4 border-l-emerald-500";
              } else if (item.role === "GESTOR") {
                leftBorderClass = "border-l-4 border-l-purple-500";
              }

              return (
                <div key={item.id || idx} className={`grid grid-cols-1 md:grid-cols-[1.5fr_1.2fr_165px_110px_45px] gap-3 bg-white p-4 border-y border-r border-slate-100 rounded-r-2xl ${leftBorderClass} items-center overflow-visible shadow-sm hover:shadow-md transition-shadow duration-200 animate-fade-in md:space-y-0 space-y-2`}>
                  
                  {/* Corretor dropdown */}
                  <div className="w-full">
                    <label className="block text-[8px] font-bold uppercase tracking-wider text-[#1e3a5f] mb-1">
                      Selecione o Recebedor
                    </label>
                    <select
                      required
                      value={item.brokerId}
                      onChange={(e) => handleSplitChange(idx, "brokerId", e.target.value)}
                      className="w-full h-12 bg-white border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-[10px] px-3 text-xs text-slate-800 font-semibold focus:outline-none transition-all duration-200"
                    >
                      <option value="">Selecione...</option>
                      <optgroup label="── Imobiliária ── font-sans">
                        <option value="AGENCY">Agência (Imobiliária)</option>
                      </optgroup>
                      <optgroup label="── Corretores & Gestores ── font-sans">
                        {getAvailableBrokers(idx).map(b => (
                          <option key={b.id} value={b.id}>
                            {getBrokerDropdownLabel(b)}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* Papel */}
                  <div className="w-full">
                    <label className="block text-[8px] font-bold uppercase tracking-wider text-[#1e3a5f] mb-1">
                      Papel / Função
                    </label>
                    <select
                      value={item.role}
                      required
                      onChange={(e) => handleSplitChange(idx, "role", e.target.value)}
                      className="w-full h-12 bg-white border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-[10px] px-3 text-xs text-slate-800 font-semibold focus:outline-none transition-all duration-200"
                    >
                      <option value="">Selecione um papel...</option>
                      <option value="VENDEDOR">Vendedor</option>
                      <option value="CAPTADOR">Captador</option>
                      <option value="GESTOR">Gestor / Coordenador</option>
                    </select>
                  </div>

                  {/* Porcentagem */}
                  <div className="w-full overflow-visible">
                    <label className="block text-[8px] font-bold uppercase tracking-wider text-[#1e3a5f] mb-1 col-span-2">
                      Percentual
                    </label>
                    <div className="flex items-center gap-2 min-w-[145px] overflow-visible">
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={item.percentage === 0 || item.percentage === "" ? "" : item.percentage}
                          onChange={(e) => handleSplitChange(idx, "percentage", e.target.value)}
                          placeholder="0"
                          className="w-20 min-w-[80px] h-12 text-center font-black text-slate-800 text-sm border border-slate-200 bg-white rounded-lg px-2 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                        />
                        <span className="text-slate-500 font-bold text-sm shrink-0">%</span>
                      </div>
                      
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleSplitChange(idx, "percentage", parseFloat(e.target.value));
                          }
                        }}
                        className="bg-white border-[1.5px] border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-[10px] px-1 py-1.5 text-[9px] font-bold text-slate-500 focus:outline-none h-12 max-w-[62px] cursor-pointer shrink-0 transition-all duration-200"
                        title="Atalhos rápidos"
                      >
                        <option value="">Atalhos</option>
                        {splitDivisionType === "vgv" ? (
                          <>
                            <option value="1">1.0%</option>
                            <option value="1.5">1.5%</option>
                            <option value="2">2.0%</option>
                            <option value="2.5">2.5%</option>
                            <option value="3">3.0%</option>
                            <option value="4">4.0%</option>
                            <option value="5">5.0%</option>
                            <option value="6">6.0%</option>
                          </>
                        ) : (
                          <>
                            <option value="10">10%</option>
                            <option value="20">20%</option>
                            <option value="25">25%</option>
                            <option value="30">30%</option>
                            <option value="40">40%</option>
                            <option value="50">50%</option>
                            <option value="60">60%</option>
                            <option value="70">70%</option>
                            <option value="100">100%</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Valor do repasse calculado */}
                  <div className="text-right font-mono w-full">
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400 font-sans">
                      Repasse Gerado
                    </span>
                    <strong className="text-xs font-black text-slate-800 block mt-1">
                      {formatCurrency(itemCalculatedValue)}
                    </strong>
                    <span className="block text-[9px] text-slate-400 font-medium italic mt-0.5 font-sans">
                      {equivalentText}
                    </span>
                  </div>

                  {/* Ação de remover / Indicador de percentual zerado */}
                  <div className="text-center flex items-center justify-center gap-2 w-full">
                    {(item.percentage || 0) === 0 && (
                      <div 
                        className="text-red-800 animate-pulse cursor-help flex items-center justify-center p-1.5 bg-red-50 border border-red-200 rounded-lg shrink-0" 
                        title="Percentual zerado — remova esta linha ou ajuste o valor."
                      >
                        <X className="w-3.5 h-3.5 font-black" />
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={tempSplits.length <= 1}
                      onClick={() => handleRemoveSplit(idx)}
                      className="text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-slate-350 p-1.5 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Remover corretor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Validação de soma de porcentagem */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              {!allBrokersSelected ? (
                <span className="text-[10px] font-black text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  Selecione o recebedor em todas as linhas antes de salvar.
                </span>
              ) : hasZeroPercentage ? (
                <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  Remova ou ajuste as linhas com percentual zerado.
                </span>
              ) : isPercentageValid ? (
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  {splitDivisionType === "vgv" 
                    ? `Soma atual de ${sumPercentage}% do VGV válida (comissão total contratada: ${commissionPercentage}% do VGV)`
                    : "Divisão de repasses equilibrada em 100% da comissão"
                  }
                </span>
              ) : (
                <span className="text-[10px] font-black text-rose-600 bg-rose-50 border border-rose-220 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-sans">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-650 shrink-0" />
                  {splitDivisionType === "vgv"
                    ? `Soma atual de ${sumPercentage}% ultrapassa o limite de comissão de ${commissionPercentage}% do VGV.`
                    : `Os splits somam ${sumPercentage}%. Ajuse para totalizar exatamente 100% da comissão.`
                  }
                </span>
              )}
            </div>
            
            <div className="text-xs font-bold text-slate-450 uppercase">
              {splitDivisionType === "vgv" ? (
                <span>Soma atual: <strong className="text-blue-600 font-black">{sumPercentage}%</strong> de <strong className="font-black">{commissionPercentage}%</strong> do VGV</span>
              ) : (
                <span>Porcentagem total: <strong className={(isPercentageValid && allBrokersSelected && !hasZeroPercentage) ? "text-emerald-600 font-black" : "text-rose-600 font-black"}>{sumPercentage}%</strong> / 100%</span>
              )}
            </div>
          </div>

        </div>

        {/* Rodapé e Ações */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCancel}
            className="px-6 py-3 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 bg-white rounded-2xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          {(!editingSale || editingSale.status === "DRAFT") && (
            <button
              type="button"
              onClick={handleSaveAsDraft}
              className="px-6 py-3 border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-2xl text-xs font-black uppercase tracking-widest transition-colors cursor-pointer"
            >
              Salvar como rascunho
            </button>
          )}
          
          <button
            type="submit"
            disabled={!isPercentageValid || !allBrokersSelected || hasZeroPercentage || !buyerDocValid || !sellerDocValid}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/15 cursor-pointer"
          >
            {editingSale ? "Salvar Alterações" : "Salvar Venda"}
          </button>
        </div>

      </form>

      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="discard-confirm-modal">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            onClick={() => setShowDiscardConfirm(false)} 
          />
          <div className="relative bg-white w-full max-w-sm rounded-[32px] p-6 md:p-8 shadow-2xl text-slate-800 space-y-5 flex flex-col items-center text-center border border-slate-100 animate-scaleUp">
            <div className="mx-auto w-12 h-12 bg-rose-50 border border-rose-100 text-rose-500 rounded-2xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Dados não salvos</h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Você tem dados não salvos. Deseja descartar as alterações?
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2 w-full">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="w-full py-3 bg-[#3B82F6] hover:bg-blue-600 hover:scale-[1.01] active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onCancel();
                }}
                className="w-full py-3 bg-white hover:bg-slate-50 border border-slate-200 hover:scale-[1.01] active:scale-95 text-rose-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={draftToRestore !== null}
        title="Restaurar rascunho"
        message="Você tem um rascunho de venda não finalizado. Deseja restaurar as informações preenchidas anteriormente?"
        confirmText="Restaurar"
        cancelText="Descartar"
        confirmColor="blue"
        onConfirm={() => {
          handleApplyDraft(draftToRestore);
          setDraftToRestore(null);
        }}
        onCancel={() => {
          localStorage.removeItem("comissone_sale_draft");
          setDraftToRestore(null);
        }}
      />
    </div>
  );
};
