import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Save, 
  Camera, 
  Upload, 
  Trash2, 
  Eye, 
  DollarSign, 
  Droplet, 
  Building2, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle,
  Sparkles,
  Layers,
  ArrowRight,
  Info
} from "lucide-react";
import { 
  FaturaHidrometro, 
  EdificioHidrometro, 
  LeituraUnidade, 
  UnidadeApartamento,
  CompanySettings,
  UserProfile
} from "../../types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface LancamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fatura: FaturaHidrometro) => Promise<void>;
  edificios: EdificioHidrometro[];
  faturasExistentes: FaturaHidrometro[];
  faturaParaEditar?: FaturaHidrometro | null;
  onOpenFotoViewer: (url: string, titulo: string, subtitulo: string) => void;
  currentUser?: UserProfile | null;
  companySettings?: CompanySettings | null;
}

// Client-side image compression to base64
async function compressImageFile(file: File, maxWidth = 1280, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedBase64);
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const LancamentoModal: React.FC<LancamentoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  edificios,
  faturasExistentes,
  faturaParaEditar,
  onOpenFotoViewer,
  currentUser,
  companySettings
}) => {
  const [selectedEdificioId, setSelectedEdificioId] = useState<string>(
    faturaParaEditar?.edificioId || (edificios.length > 0 ? edificios[0].id : "")
  );

  const [mesReferencia, setMesReferencia] = useState<string>(
    faturaParaEditar?.mesReferencia || new Date().toISOString().slice(0, 7) // YYYY-MM
  );

  const [dataLeitura, setDataLeitura] = useState<string>(
    faturaParaEditar?.dataLeitura || new Date().toISOString().slice(0, 10)
  );

  const [valorTotalConta, setValorTotalConta] = useState<number>(
    faturaParaEditar?.valorTotalConta || 0
  );

  const [consumoTotalContaM3, setConsumoTotalContaM3] = useState<number>(
    faturaParaEditar?.consumoTotalContaM3 || 0
  );

  const [ratearAreaComumIgual, setRatearAreaComumIgual] = useState<boolean>(
    faturaParaEditar?.ratearAreaComumIgualitariamente ?? true
  );

  const [leituras, setLeituras] = useState<LeituraUnidade[]>(
    faturaParaEditar?.leituras || []
  );

  const [observacoes, setObservacoes] = useState<string>(
    faturaParaEditar?.observacoes || ""
  );

  const [statusFatura, setStatusFatura] = useState<"rascunho" | "fechado">(
    faturaParaEditar?.status === "fechado" ? "fechado" : "rascunho"
  );

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [uploadingUnidadeId, setUploadingUnidadeId] = useState<string | null>(null);

  const currentEdificio = useMemo(() => {
    return edificios.find((e) => e.id === selectedEdificioId) || null;
  }, [edificios, selectedEdificioId]);

  // Months label helper
  const mesAnoTexto = useMemo(() => {
    if (!mesReferencia) return "";
    const [year, month] = mesReferencia.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    return `${monthNames[date.getMonth()]} de ${date.getFullYear()}`;
  }, [mesReferencia]);

  // Initialize readings when building or edit item changes
  useEffect(() => {
    if (!isOpen) return;

    if (faturaParaEditar) {
      setSelectedEdificioId(faturaParaEditar.edificioId);
      setMesReferencia(faturaParaEditar.mesReferencia);
      setDataLeitura(faturaParaEditar.dataLeitura);
      setValorTotalConta(faturaParaEditar.valorTotalConta);
      setConsumoTotalContaM3(faturaParaEditar.consumoTotalContaM3 || 0);
      setRatearAreaComumIgual(faturaParaEditar.ratearAreaComumIgualitariamente ?? true);
      setLeituras(faturaParaEditar.leituras || []);
      setObservacoes(faturaParaEditar.observacoes || "");
      setStatusFatura(faturaParaEditar.status === "fechado" ? "fechado" : "rascunho");
      return;
    }

    if (!currentEdificio) return;

    // Search for the most recent previous invoice for this building
    const previousInvoices = faturasExistentes
      .filter((f) => f.edificioId === currentEdificio.id && f.mesReferencia < mesReferencia)
      .sort((a, b) => b.mesReferencia.localeCompare(a.mesReferencia));

    const latestPreviousInvoice = previousInvoices[0] || null;

    // Create initial reading rows for all units of this building
    const initialLeituras: LeituraUnidade[] = (currentEdificio.unidades || []).map((unit) => {
      // Find what the previous reading was
      let prevReading = 0;
      if (latestPreviousInvoice) {
        const foundPrevUnit = latestPreviousInvoice.leituras.find(
          (l) => l.unidadeId === unit.id || l.numeroUnidade === unit.numero
        );
        if (foundPrevUnit && foundPrevUnit.leituraAtual > 0) {
          prevReading = foundPrevUnit.leituraAtual;
        } else {
          prevReading = unit.leituraAnteriorBase || 0;
        }
      } else {
        prevReading = unit.leituraAnteriorBase || 0;
      }

      return {
        unidadeId: unit.id,
        numeroUnidade: unit.numero,
        bloco: unit.bloco || "",
        moradorNome: unit.moradorNome || "",
        moradorTelefone: unit.moradorTelefone || "",
        hidrometroNumero: unit.hidrometroNumero || "",
        leituraAnterior: prevReading,
        leituraAtual: prevReading, // start with same as prev
        consumoM3: 0,
        valorConsumoM3: 0,
        valorAreaComumRateio: 0,
        valorTotalAPagar: 0,
        statusLeitura: "pendente"
      };
    });

    setLeituras(initialLeituras);
  }, [isOpen, selectedEdificioId, mesReferencia, faturaParaEditar]);

  // Recalculate consumption and financial values across all units
  const calculatedTotals = useMemo(() => {
    let totalConsumoApartamentos = 0;
    let unitsWithReadings = 0;

    leituras.forEach((l) => {
      const consumo = Math.max(0, (Number(l.leituraAtual) || 0) - (Number(l.leituraAnterior) || 0));
      totalConsumoApartamentos += consumo;
      if (l.leituraAtual > 0 || l.consumoM3 > 0 || l.statusLeitura === "concluida") {
        unitsWithReadings++;
      }
    });

    // Total concessionaire consumption
    const totalGeralConsumo = consumoTotalContaM3 > 0 ? consumoTotalContaM3 : totalConsumoApartamentos;

    // Difference in common area (if concessionaire consumption exceeds apartments sum)
    const consumoDiferencaAreaComum = Math.max(0, totalGeralConsumo - totalConsumoApartamentos);

    // Calculated tariff per m³
    const tarifaM3 = totalGeralConsumo > 0 && valorTotalConta > 0
      ? valorTotalConta / totalGeralConsumo
      : (totalConsumoApartamentos > 0 && valorTotalConta > 0 ? valorTotalConta / totalConsumoApartamentos : 0);

    const valorAreaComumTotal = consumoDiferencaAreaComum * tarifaM3;
    const countUnits = leituras.length || 1;
    const valorAreaComumPerUnit = ratearAreaComumIgual
      ? valorAreaComumTotal / countUnits
      : 0;

    return {
      totalConsumoApartamentos,
      totalGeralConsumo,
      consumoDiferencaAreaComum,
      valorAreaComumTotal,
      tarifaM3,
      valorAreaComumPerUnit,
      unitsWithReadings,
      totalUnits: leituras.length
    };
  }, [leituras, valorTotalConta, consumoTotalContaM3, ratearAreaComumIgual]);

  // Update a single unit reading
  const handleUpdateUnitReading = (index: number, field: "leituraAnterior" | "leituraAtual", val: number) => {
    const updated = [...leituras];
    const item = { ...updated[index] };

    if (field === "leituraAnterior") {
      item.leituraAnterior = Number(val) || 0;
    } else {
      item.leituraAtual = Number(val) || 0;
    }

    const consumo = Math.max(0, item.leituraAtual - item.leituraAnterior);
    item.consumoM3 = Number(consumo.toFixed(3));
    item.statusLeitura = item.leituraAtual > 0 ? "concluida" : "pendente";

    updated[index] = item;
    setLeituras(updated);
  };

  // Attach photo to single unit
  const handleUploadPhoto = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const unidadeId = leituras[index].unidadeId;
    setUploadingUnidadeId(unidadeId);

    try {
      toast.info("Processando e otimizando foto do hidrômetro...");
      const compressedBase64 = await compressImageFile(file, 1280, 0.75);

      const updated = [...leituras];
      updated[index] = {
        ...updated[index],
        fotoHidrometroUrl: compressedBase64,
        fotoNome: file.name,
        dataLeitura: new Date().toISOString()
      };
      setLeituras(updated);
      toast.success(`Foto anexada para o Apto ${updated[index].numeroUnidade}!`);
    } catch (err: any) {
      toast.error("Erro ao carregar foto: " + (err?.message || "Tente novamente"));
    } finally {
      setUploadingUnidadeId(null);
    }
  };

  // Remove photo from single unit
  const handleRemovePhoto = (index: number) => {
    const updated = [...leituras];
    updated[index] = {
      ...updated[index],
      fotoHidrometroUrl: undefined,
      fotoNome: undefined
    };
    setLeituras(updated);
    toast.info("Foto removida.");
  };

  // Submit Save
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEdificioId || !currentEdificio) {
      toast.error("Selecione um edifício.");
      return;
    }

    if (!mesReferencia) {
      toast.error("Selecione o mês de referência.");
      return;
    }

    if (valorTotalConta <= 0) {
      toast.error("Informe o valor total da conta de água (R$).");
      return;
    }

    if (leituras.length === 0) {
      toast.error("Nenhum apartamento encontrado para este edifício.");
      return;
    }

    setIsSaving(true);

    try {
      // Calculate final financial values for each unit before saving
      let finalLeituras: LeituraUnidade[] = leituras.map((l) => {
        const consumo = Math.max(0, l.leituraAtual - l.leituraAnterior);
        const valorConsumo = consumo * calculatedTotals.tarifaM3;
        
        let valorAreaComumRateio = 0;
        if (ratearAreaComumIgual) {
          valorAreaComumRateio = calculatedTotals.valorAreaComumPerUnit;
        } else if (calculatedTotals.totalConsumoApartamentos > 0) {
          // Proportional common area
          valorAreaComumRateio =
            (consumo / calculatedTotals.totalConsumoApartamentos) * calculatedTotals.valorAreaComumTotal;
        }

        const valorTotal = valorConsumo + valorAreaComumRateio;

        return {
          ...l,
          consumoM3: Number(consumo.toFixed(3)),
          valorConsumoM3: Number(valorConsumo.toFixed(2)),
          valorAreaComumRateio: Number(valorAreaComumRateio.toFixed(2)),
          valorTotalAPagar: Number(valorTotal.toFixed(2)),
          statusLeitura: l.leituraAtual > 0 ? "concluida" : "pendente"
        };
      });

      // Strict cent reconciliation so sum of all apartments equals exactly the total invoice down to R$ 0.00
      if (finalLeituras.length > 0 && valorTotalConta > 0) {
        const sumCalculated = finalLeituras.reduce((acc, l) => acc + l.valorTotalAPagar, 0);
        const diffCents = Number((valorTotalConta - sumCalculated).toFixed(2));
        if (diffCents !== 0 && Math.abs(diffCents) < 1.0) {
          // Adjust on the unit with highest consumption (or first unit)
          let targetIdx = 0;
          let maxConsumo = -1;
          finalLeituras.forEach((l, idx) => {
            if (l.consumoM3 > maxConsumo) {
              maxConsumo = l.consumoM3;
              targetIdx = idx;
            }
          });
          finalLeituras[targetIdx].valorTotalAPagar = Number((finalLeituras[targetIdx].valorTotalAPagar + diffCents).toFixed(2));
          finalLeituras[targetIdx].valorConsumoM3 = Number((finalLeituras[targetIdx].valorConsumoM3 + diffCents).toFixed(2));
        }
      }

      const faturaPayload: FaturaHidrometro = {
        id: faturaParaEditar?.id || `fatura_hidro_${Date.now()}`,
        edificioId: currentEdificio.id,
        edificioNome: currentEdificio.nome,
        imobiliaria: currentEdificio.imobiliaria || "Fidelité Imobiliária",
        mesReferencia,
        mesAnoTexto,
        dataLeitura,
        valorTotalConta: Number(valorTotalConta),
        consumoTotalContaM3: Number(consumoTotalContaM3) || calculatedTotals.totalConsumoApartamentos,
        tarifaM3Calculada: Number(calculatedTotals.tarifaM3.toFixed(4)),
        consumoTotalApartamentosM3: Number(calculatedTotals.totalConsumoApartamentos.toFixed(3)),
        consumoDiferencaAreaComumM3: Number(calculatedTotals.consumoDiferencaAreaComum.toFixed(3)),
        valorDiferencaAreaComum: Number(calculatedTotals.valorAreaComumTotal.toFixed(2)),
        ratearAreaComumIgualitariamente: ratearAreaComumIgual,
        leituras: finalLeituras,
        status: statusFatura,
        observacoes,
        updatedAt: new Date().toISOString(),
        criadoPorUid: currentUser?.uid || "",
        criadoPorNome: currentUser?.displayName || "Administrador"
      };

      await onSave(faturaPayload);
      toast.success(
        faturaParaEditar ? "Lançamento atualizado com sucesso!" : "Medição de água cadastrada com sucesso!"
      );
      onClose();
    } catch (err: any) {
      toast.error("Erro ao salvar lançamento: " + (err?.message || "Tente novamente"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-5xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/80 to-indigo-50/80 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Droplet className="w-6 h-6 fill-white text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 leading-none">
                    {faturaParaEditar ? "Editar Lançamento de Água" : "Novo Lançamento & Rateio de Água"}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                    Fidelité Imobiliária
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Lance a fatura da concessionária, registre a leitura e anexe a foto dos hidrômetros.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2.5 hover:bg-white rounded-2xl text-slate-400 hover:text-slate-700 transition-all shadow-sm cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {/* Top Row: Building & Invoice Details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-slate-50/80 rounded-3xl border border-slate-200/80">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  Edifício / Condomínio *
                </label>
                <select
                  required
                  value={selectedEdificioId}
                  onChange={(e) => setSelectedEdificioId(e.target.value)}
                  disabled={!!faturaParaEditar}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
                >
                  {edificios.map((ed) => (
                    <option key={ed.id} value={ed.id}>
                      {ed.nome} ({ed.unidades?.length || 0} aptos)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  Mês de Referência *
                </label>
                <input
                  type="month"
                  required
                  value={mesReferencia}
                  onChange={(e) => setMesReferencia(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Valor da Fatura Geral (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0,00"
                  value={valorTotalConta || ""}
                  onChange={(e) => setValorTotalConta(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Droplet className="w-3.5 h-3.5 text-blue-600" />
                  Consumo na Fatura (m³)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="Opcional (ex: 120)"
                  value={consumoTotalContaM3 || ""}
                  onChange={(e) => setConsumoTotalContaM3(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Live Calculation Cards Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider block">
                  Consumo Total Aptos
                </span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {calculatedTotals.totalConsumoApartamentos.toFixed(2)} m³
                </span>
                <span className="text-[10px] text-slate-400">
                  {calculatedTotals.unitsWithReadings} de {calculatedTotals.totalUnits} medidos
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider block">
                  Tarifa Rateada / m³
                </span>
                <span className="text-xl font-black text-emerald-700 mt-1 block">
                  R$ {calculatedTotals.tarifaM3.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400">R$ total ÷ m³ medidos</span>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider block">
                  Diferença Área Comum
                </span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {calculatedTotals.consumoDiferencaAreaComum.toFixed(2)} m³
                </span>
                <span className="text-[10px] text-slate-400">
                  {calculatedTotals.valorAreaComumTotal > 0
                    ? `R$ ${calculatedTotals.valorAreaComumTotal.toFixed(2)} total`
                    : "Sem excedente"}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                  Rateio Área Comum
                </span>
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={ratearAreaComumIgual}
                    onChange={(e) => setRatearAreaComumIgual(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-[11px] font-bold text-slate-700">Dividir igual p/ aptos</span>
                </label>
              </div>
            </div>

            {/* Readings Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                    <Droplet className="w-4 h-4 text-blue-600" />
                    Leituras Individuais dos Apartamentos ({leituras.length})
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Digite a Leitura Atual. O consumo e o valor a pagar são calculados instantaneamente.
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black text-blue-600 uppercase">
                    {mesAnoTexto}
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[420px] custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Apto / Unidade</th>
                        <th className="py-3 px-4">Morador</th>
                        <th className="py-3 px-3 w-28">Leitura Ant. (m³)</th>
                        <th className="py-3 px-3 w-32">Leitura Atual (m³)</th>
                        <th className="py-3 px-3 text-center">Consumo</th>
                        <th className="py-3 px-3 text-right">Valor Apto (R$)</th>
                        <th className="py-3 px-4 text-center">Foto Hidrômetro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {leituras.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            Nenhum apartamento cadastrado neste edifício.
                          </td>
                        </tr>
                      ) : (
                        leituras.map((leitura, idx) => {
                          const consumo = Math.max(0, leitura.leituraAtual - leitura.leituraAnterior);
                          const isNegative = leitura.leituraAtual > 0 && leitura.leituraAtual < leitura.leituraAnterior;
                          const valorIndividual =
                            consumo * calculatedTotals.tarifaM3 +
                            (ratearAreaComumIgual ? calculatedTotals.valorAreaComumPerUnit : 0);

                          return (
                            <tr
                              key={leitura.unidadeId || idx}
                              className={`transition-colors ${
                                isNegative
                                  ? "bg-red-50/60 hover:bg-red-50"
                                  : leitura.leituraAtual > 0
                                  ? "bg-blue-50/20 hover:bg-blue-50/40"
                                  : "hover:bg-slate-50"
                              }`}
                            >
                              {/* Unit number */}
                              <td className="py-3 px-4 font-black text-slate-900">
                                <div className="flex items-center gap-2">
                                  <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-black text-xs">
                                    {leitura.numeroUnidade}
                                  </span>
                                  {leitura.bloco && (
                                    <span className="text-[10px] text-slate-400 font-normal">
                                      {leitura.bloco}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Resident */}
                              <td className="py-3 px-4 text-slate-600 font-medium">
                                <div className="truncate max-w-[150px]">
                                  {leitura.moradorNome || (
                                    <span className="text-slate-300 italic">Sem nome</span>
                                  )}
                                </div>
                              </td>

                              {/* Previous Reading */}
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  step="any"
                                  value={leitura.leituraAnterior}
                                  onChange={(e) =>
                                    handleUpdateUnitReading(idx, "leituraAnterior", parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </td>

                              {/* Current Reading */}
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  step="any"
                                  placeholder="0"
                                  value={leitura.leituraAtual === 0 ? "" : leitura.leituraAtual}
                                  onChange={(e) =>
                                    handleUpdateUnitReading(idx, "leituraAtual", parseFloat(e.target.value) || 0)
                                  }
                                  className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-black focus:bg-white focus:outline-none focus:ring-2 ${
                                    isNegative
                                      ? "border-red-400 bg-red-50 text-red-700 focus:ring-red-500"
                                      : "border-blue-300 bg-blue-50/50 text-blue-900 focus:ring-blue-500"
                                  }`}
                                />
                                {isNegative && (
                                  <span className="text-[9px] font-bold text-red-600 flex items-center gap-0.5 mt-0.5">
                                    <AlertTriangle className="w-3 h-3" /> Menor que anterior!
                                  </span>
                                )}
                              </td>

                              {/* Consumption */}
                              <td className="py-3 px-3 text-center">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-black ${
                                    consumo > 0
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-slate-100 text-slate-400"
                                  }`}
                                >
                                  {consumo.toFixed(2)} m³
                                </span>
                              </td>

                              {/* Unit Value */}
                              <td className="py-3 px-3 text-right font-black text-slate-900">
                                <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 font-black inline-block">
                                  R$ {valorIndividual.toFixed(2)}
                                </span>
                              </td>

                              {/* Photo upload / preview */}
                              <td className="py-2 px-4 text-center">
                                {leitura.fotoHidrometroUrl ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    <div
                                      onClick={() =>
                                        onOpenFotoViewer(
                                          leitura.fotoHidrometroUrl!,
                                          `Hidrômetro Apto ${leitura.numeroUnidade}`,
                                          `Leitura: ${leitura.leituraAtual} m³ • ${currentEdificio?.nome}`
                                        )
                                      }
                                      className="relative group cursor-pointer w-10 h-10 rounded-xl overflow-hidden border border-blue-200 bg-slate-100 hover:border-blue-500 shadow-sm transition-all"
                                      title="Clique para ampliar foto"
                                    >
                                      <img
                                        src={leitura.fotoHidrometroUrl}
                                        alt={`Hidrômetro ${leitura.numeroUnidade}`}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                                        <Eye className="w-3.5 h-3.5" />
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleRemovePhoto(idx)}
                                      className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                                      title="Remover Foto"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <label
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-slate-500 hover:text-blue-600 text-[11px] font-bold cursor-pointer transition-all ${
                                      uploadingUnidadeId === leitura.unidadeId ? "opacity-50 pointer-events-none" : ""
                                    }`}
                                  >
                                    <Camera className="w-3.5 h-3.5 text-blue-500" />
                                    <span>{uploadingUnidadeId === leitura.unidadeId ? "Enviando..." : "Foto"}</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      onChange={(e) => handleUploadPhoto(idx, e)}
                                      className="hidden"
                                    />
                                  </label>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Notes & Final Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="md:col-span-2">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Observações Gerais do Rateio / Edifício (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Fatura paga pela Fidelité, taxa de esgoto inclusa, medição conferida pelo zelador..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                  Status do Lançamento
                </label>
                <select
                  value={statusFatura}
                  onChange={(e) => setStatusFatura(e.target.value as "rascunho" | "fechado")}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="rascunho">Em Rascunho / Aberto</option>
                  <option value="fechado">Fechado & Pronto para Exportar</option>
                </select>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-xl shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{faturaParaEditar ? "Atualizar Rateio" : "Salvar & Calcular Rateio"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
