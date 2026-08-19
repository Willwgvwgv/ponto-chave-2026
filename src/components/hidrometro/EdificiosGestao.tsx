import React, { useState } from "react";
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  Users, 
  Gauge, 
  Sparkles, 
  Home, 
  Phone, 
  CheckCircle2, 
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Layers
} from "lucide-react";
import { EdificioHidrometro, UnidadeApartamento } from "../../types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface EdificiosGestaoProps {
  edificios: EdificioHidrometro[];
  onSaveEdificio: (edificio: EdificioHidrometro) => Promise<void>;
  onDeleteEdificio: (id: string) => Promise<void>;
  isAdmin: boolean;
}

export const EdificiosGestao: React.FC<EdificiosGestaoProps> = ({
  edificios,
  onSaveEdificio,
  onDeleteEdificio,
  isAdmin
}) => {
  const [selectedEdificioId, setSelectedEdificioId] = useState<string | null>(
    edificios.length > 0 ? edificios[0].id : null
  );

  // Edit / Create Edifício Modal state
  const [isEdificioModalOpen, setIsEdificioModalOpen] = useState(false);
  const [editingEdificio, setEditingEdificio] = useState<Partial<EdificioHidrometro> | null>(null);

  // Quick unit generator state
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [startFloor, setStartFloor] = useState(1);
  const [endFloor, setEndFloor] = useState(4);
  const [unitsPerFloor, setUnitsPerFloor] = useState(4);
  const [blockPrefix, setBlockPrefix] = useState("");

  // Edit Single Unit modal state
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Partial<UnidadeApartamento> | null>(null);
  const [unitEditIndex, setUnitEditIndex] = useState<number | null>(null);

  const currentEdificio = edificios.find((e) => e.id === selectedEdificioId) || null;

  const handleOpenNewEdificio = () => {
    setEditingEdificio({
      nome: "",
      imobiliaria: "Fidelité Imobiliária",
      endereco: "",
      cidade: "",
      concessionaria: "Saneago",
      codigoLigacao: "",
      unidades: [],
      tipoRateioPadrao: "proporcional_consumo",
      taxaMinimaFixa: 0,
      taxaAreaComumFixa: 0
    });
    setIsEdificioModalOpen(true);
  };

  const handleOpenEditEdificio = (ed: EdificioHidrometro) => {
    setEditingEdificio({ ...ed });
    setIsEdificioModalOpen(true);
  };

  const handleSaveEdificioForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEdificio?.nome?.trim()) {
      toast.error("Informe o nome do edifício/condomínio.");
      return;
    }

    try {
      const payload: EdificioHidrometro = {
        id: editingEdificio.id || `edf_${Date.now()}`,
        nome: editingEdificio.nome.trim(),
        imobiliaria: editingEdificio.imobiliaria || "Fidelité Imobiliária",
        endereco: editingEdificio.endereco || "",
        cidade: editingEdificio.cidade || "",
        concessionaria: editingEdificio.concessionaria || "Saneago",
        codigoLigacao: editingEdificio.codigoLigacao || "",
        unidades: editingEdificio.unidades || [],
        tipoRateioPadrao: editingEdificio.tipoRateioPadrao || "proporcional_consumo",
        taxaMinimaFixa: Number(editingEdificio.taxaMinimaFixa) || 0,
        taxaAreaComumFixa: Number(editingEdificio.taxaAreaComumFixa) || 0,
        updatedAt: new Date().toISOString()
      };

      await onSaveEdificio(payload);
      setSelectedEdificioId(payload.id);
      setIsEdificioModalOpen(false);
      setEditingEdificio(null);
      toast.success("Edifício salvo com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar edifício: " + (err?.message || "Tente novamente"));
    }
  };

  // Quick unit generation
  const handleGenerateUnits = async () => {
    if (!currentEdificio) return;

    const newUnits: UnidadeApartamento[] = [...currentEdificio.unidades];
    let createdCount = 0;

    for (let floor = startFloor; floor <= endFloor; floor++) {
      for (let u = 1; u <= unitsPerFloor; u++) {
        const numStr = `${floor}${u < 10 ? `0${u}` : u}`;
        const unitName = blockPrefix ? `${blockPrefix} - ${numStr}` : numStr;

        // Check if already exists
        const exists = newUnits.some((unit) => unit.numero === unitName);
        if (!exists) {
          newUnits.push({
            id: `unit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            numero: unitName,
            bloco: blockPrefix || undefined,
            moradorNome: "",
            moradorTelefone: "",
            hidrometroNumero: `HID-${unitName}`,
            leituraAnteriorBase: 0,
            status: "ocupado"
          });
          createdCount++;
        }
      }
    }

    if (createdCount === 0) {
      toast.info("Nenhuma nova unidade gerada (todas já existiam).");
      setIsGeneratorOpen(false);
      return;
    }

    const updatedEdificio: EdificioHidrometro = {
      ...currentEdificio,
      unidades: newUnits,
      updatedAt: new Date().toISOString()
    };

    await onSaveEdificio(updatedEdificio);
    setIsGeneratorOpen(false);
    toast.success(`${createdCount} apartamentos gerados com sucesso!`);
  };

  // Save single unit edit
  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEdificio || !editingUnit || !editingUnit.numero?.trim()) {
      toast.error("Informe o número da unidade / apartamento.");
      return;
    }

    const units = [...currentEdificio.unidades];
    const unitToSave: UnidadeApartamento = {
      id: editingUnit.id || `unit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      numero: editingUnit.numero.trim(),
      bloco: editingUnit.bloco || "",
      moradorNome: editingUnit.moradorNome || "",
      moradorTelefone: editingUnit.moradorTelefone || "",
      moradorEmail: editingUnit.moradorEmail || "",
      hidrometroNumero: editingUnit.hidrometroNumero || "",
      leituraAnteriorBase: Number(editingUnit.leituraAnteriorBase) || 0,
      observacao: editingUnit.observacao || "",
      status: editingUnit.status || "ocupado"
    };

    if (unitEditIndex !== null && unitEditIndex >= 0) {
      units[unitEditIndex] = unitToSave;
    } else {
      units.push(unitToSave);
    }

    // Sort naturally by unit number
    units.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));

    const updated: EdificioHidrometro = {
      ...currentEdificio,
      unidades: units,
      updatedAt: new Date().toISOString()
    };

    await onSaveEdificio(updated);
    setIsUnitModalOpen(false);
    setEditingUnit(null);
    setUnitEditIndex(null);
    toast.success("Apartamento atualizado com sucesso!");
  };

  const handleDeleteUnit = async (idxToDelete: number) => {
    if (!currentEdificio) return;
    if (!window.confirm("Deseja realmente remover este apartamento do edifício?")) return;

    const units = currentEdificio.unidades.filter((_, idx) => idx !== idxToDelete);
    const updated: EdificioHidrometro = {
      ...currentEdificio,
      unidades: units,
      updatedAt: new Date().toISOString()
    };

    await onSaveEdificio(updated);
    toast.success("Apartamento removido.");
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-none">
                Edifícios & Apartamentos Cadastrados
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Gerencie os condomínios da Fidelité Imobiliária e configure as unidades para medição de água.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenNewEdificio}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Edifício / Condomínio
        </button>
      </div>

      {edificios.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center space-y-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h4 className="text-base font-bold text-slate-800">Nenhum edifício cadastrado ainda</h4>
            <p className="text-xs text-slate-500 mt-1">
              Cadastre o primeiro edifício ou condomínio para começar a lançar medições e calcular o rateio da água.
            </p>
            <button
              onClick={handleOpenNewEdificio}
              className="mt-5 px-6 py-3 bg-blue-600 text-white text-xs font-black uppercase tracking-wider rounded-2xl hover:bg-blue-700 transition-all shadow-md cursor-pointer"
            >
              + Cadastrar Primeiro Edifício
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Building List Selector */}
          <div className="lg:col-span-1 space-y-3">
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">
              Selecione o Edifício
            </div>
            <div className="space-y-2">
              {edificios.map((ed) => {
                const isSelected = ed.id === selectedEdificioId;
                return (
                  <div
                    key={ed.id}
                    onClick={() => setSelectedEdificioId(ed.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20"
                        : "bg-white text-slate-800 border-slate-100 hover:border-slate-300 shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="font-black text-sm leading-snug">{ed.nome}</div>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {ed.unidades?.length || 0} aptos
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span
                        className={`text-[11px] truncate max-w-[140px] ${
                          isSelected ? "text-blue-100" : "text-slate-400"
                        }`}
                      >
                        {ed.cidade || ed.concessionaria || "Fidelité"}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditEdificio(ed);
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isSelected
                              ? "hover:bg-white/20 text-white"
                              : "hover:bg-slate-100 text-slate-400 hover:text-blue-600"
                          }`}
                          title="Editar Edifício"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Deseja excluir o edifício ${ed.nome}?`)) {
                                onDeleteEdificio(ed.id);
                              }
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isSelected
                                ? "hover:bg-red-500 text-white"
                                : "hover:bg-red-50 text-slate-400 hover:text-red-600"
                            }`}
                            title="Excluir Edifício"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Selected Building Units and Config */}
          <div className="lg:col-span-3 space-y-6">
            {currentEdificio ? (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
                {/* Header of selected building */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-black text-slate-900">{currentEdificio.nome}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                        {currentEdificio.imobiliaria || "Fidelité Imobiliária"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1.5">
                      {currentEdificio.endereco && <span>📍 {currentEdificio.endereco}</span>}
                      {currentEdificio.concessionaria && (
                        <span>💧 Concessionária: {currentEdificio.concessionaria}</span>
                      )}
                      {currentEdificio.codigoLigacao && (
                        <span>🔢 Matrícula: {currentEdificio.codigoLigacao}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsGeneratorOpen(true)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Gerar vários apartamentos em lote"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Gerador Rápido
                    </button>
                    <button
                      onClick={() => {
                        setEditingUnit({
                          numero: "",
                          bloco: "",
                          moradorNome: "",
                          moradorTelefone: "",
                          hidrometroNumero: "",
                          leituraAnteriorBase: 0,
                          status: "ocupado"
                        });
                        setUnitEditIndex(null);
                        setIsUnitModalOpen(true);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/10 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar Apto
                    </button>
                  </div>
                </div>

                {/* Units List */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Home className="w-4 h-4 text-blue-500" />
                      Lista de Unidades ({currentEdificio.unidades?.length || 0})
                    </h4>
                  </div>

                  {currentEdificio.unidades?.length === 0 ? (
                    <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl text-center">
                      <p className="text-xs font-bold text-slate-500">
                        Nenhum apartamento cadastrado neste edifício.
                      </p>
                      <div className="mt-3 flex items-center justify-center gap-3">
                        <button
                          onClick={() => setIsGeneratorOpen(true)}
                          className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-black text-xs rounded-xl"
                        >
                          Usar Gerador Rápido
                        </button>
                        <button
                          onClick={() => {
                            setEditingUnit({
                              numero: "",
                              bloco: "",
                              moradorNome: "",
                              moradorTelefone: "",
                              hidrometroNumero: "",
                              leituraAnteriorBase: 0,
                              status: "ocupado"
                            });
                            setUnitEditIndex(null);
                            setIsUnitModalOpen(true);
                          }}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                        >
                          Adicionar Manualmente
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50">
                            <th className="py-3 px-4 rounded-l-xl">Unidade / Apto</th>
                            <th className="py-3 px-4">Morador / Inquilino</th>
                            <th className="py-3 px-4">WhatsApp / Tel</th>
                            <th className="py-3 px-4">Nº Hidrômetro</th>
                            <th className="py-3 px-4">Leitura Base (m³)</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right rounded-r-xl">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {currentEdificio.unidades.map((unit, uIdx) => (
                            <tr key={unit.id || uIdx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4 font-black text-slate-900">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-black text-xs shrink-0">
                                    {unit.numero}
                                  </div>
                                  <div>
                                    <span>Apto {unit.numero}</span>
                                    {unit.bloco && (
                                      <span className="text-[10px] text-slate-400 block font-normal">
                                        Bloco: {unit.bloco}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-medium text-slate-700">
                                {unit.moradorNome || (
                                  <span className="text-slate-300 italic">Não informado</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-slate-600">
                                {unit.moradorTelefone ? (
                                  <div className="flex items-center gap-1 font-mono text-[11px]">
                                    <Phone className="w-3 h-3 text-green-600" />
                                    {unit.moradorTelefone}
                                  </div>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 font-mono text-slate-600">
                                {unit.hidrometroNumero || (
                                  <span className="text-slate-300 italic">Auto</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 font-bold text-slate-800">
                                {unit.leituraAnteriorBase || 0} m³
                              </td>

                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    unit.status === "desocupado"
                                      ? "bg-amber-50 text-amber-700 border border-amber-100"
                                      : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                  }`}
                                >
                                  {unit.status === "desocupado" ? "Desocupado" : "Ocupado"}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingUnit({ ...unit });
                                      setUnitEditIndex(uIdx);
                                      setIsUnitModalOpen(true);
                                    }}
                                    className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                                    title="Editar Unidade"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUnit(uIdx)}
                                    className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                                    title="Remover Unidade"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* MODAL: Criar / Editar Edifício */}
      <AnimatePresence>
        {isEdificioModalOpen && editingEdificio && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEdificioModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {editingEdificio.id ? "Editar Edifício" : "Novo Edifício / Condomínio"}
                    </h3>
                    <p className="text-xs text-slate-400">Dados do imóvel e da concessionária de água</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEdificioModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdificioForm} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                    Nome do Edifício / Condomínio *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Residencial Bella Vista, Edifício Solar..."
                    value={editingEdificio.nome || ""}
                    onChange={(e) => setEditingEdificio({ ...editingEdificio, nome: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Imobiliária Responsável
                    </label>
                    <input
                      type="text"
                      value={editingEdificio.imobiliaria || "Fidelité Imobiliária"}
                      onChange={(e) =>
                        setEditingEdificio({ ...editingEdificio, imobiliaria: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Concessionária de Água
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Saneago, Sabesp, Copasa..."
                      value={editingEdificio.concessionaria || ""}
                      onChange={(e) =>
                        setEditingEdificio({ ...editingEdificio, concessionaria: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Endereço
                    </label>
                    <input
                      type="text"
                      placeholder="Rua, Número, Bairro"
                      value={editingEdificio.endereco || ""}
                      onChange={(e) =>
                        setEditingEdificio({ ...editingEdificio, endereco: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      Matrícula / Código Ligação
                    </label>
                    <input
                      type="text"
                      placeholder="Nº da conta de água"
                      value={editingEdificio.codigoLigacao || ""}
                      onChange={(e) =>
                        setEditingEdificio({ ...editingEdificio, codigoLigacao: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEdificioModalOpen(false)}
                    className="px-5 py-3 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Edifício
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Gerador Rápido de Unidades */}
      <AnimatePresence>
        {isGeneratorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGeneratorOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1, y: 0 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Gerador Rápido de Apartamentos</h3>
                    <p className="text-xs text-slate-400">Crie dezenas de apartamentos em segundos</p>
                  </div>
                </div>
                <button onClick={() => setIsGeneratorOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-black text-slate-500 uppercase tracking-wider mb-1">
                      Andar Inicial
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={startFloor}
                      onChange={(e) => setStartFloor(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-black text-slate-500 uppercase tracking-wider mb-1">
                      Andar Final
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={endFloor}
                      onChange={(e) => setEndFloor(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-black text-slate-500 uppercase tracking-wider mb-1">
                      Aptos por Andar
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={unitsPerFloor}
                      onChange={(e) => setUnitsPerFloor(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-black text-slate-500 uppercase tracking-wider mb-1">
                      Bloco / Torre (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Bloco A"
                      value={blockPrefix}
                      onChange={(e) => setBlockPrefix(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-800">
                  <p className="font-bold">Exemplo de nomes gerados:</p>
                  <p className="text-[11px] text-blue-600 mt-0.5">
                    {blockPrefix ? `${blockPrefix} - ` : ""}101, {blockPrefix ? `${blockPrefix} - ` : ""}102 ...{" "}
                    {blockPrefix ? `${blockPrefix} - ` : ""}{endFloor}0{unitsPerFloor} (Total: {(Math.max(1, endFloor - startFloor + 1)) * unitsPerFloor} apartamentos)
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGeneratorOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGenerateUnits}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-500/20"
                >
                  Gerar Apartamentos
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Criar / Editar Apartamento Individual */}
      <AnimatePresence>
        {isUnitModalOpen && editingUnit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUnitModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1, y: 0 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {unitEditIndex !== null ? "Editar Apartamento" : "Novo Apartamento"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {currentEdificio?.nome || "Fidelité Imobiliária"}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsUnitModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveUnit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                      Nº da Unidade / Apto *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 101, 202"
                      value={editingUnit.numero || ""}
                      onChange={(e) => setEditingUnit({ ...editingUnit, numero: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                      Bloco / Torre
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Bloco 01"
                      value={editingUnit.bloco || ""}
                      onChange={(e) => setEditingUnit({ ...editingUnit, bloco: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                    Nome do Morador / Inquilino
                  </label>
                  <input
                    type="text"
                    placeholder="Nome completo ou responsável"
                    value={editingUnit.moradorNome || ""}
                    onChange={(e) => setEditingUnit({ ...editingUnit, moradorNome: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                      WhatsApp / Telefone
                    </label>
                    <input
                      type="text"
                      placeholder="(62) 99999-9999"
                      value={editingUnit.moradorTelefone || ""}
                      onChange={(e) =>
                        setEditingUnit({ ...editingUnit, moradorTelefone: e.target.value })
                      }
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                      Nº Hidrômetro
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: H-101"
                      value={editingUnit.hidrometroNumero || ""}
                      onChange={(e) =>
                        setEditingUnit({ ...editingUnit, hidrometroNumero: e.target.value })
                      }
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                      Leitura Base Inicial (m³)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0"
                      value={editingUnit.leituraAnteriorBase ?? 0}
                      onChange={(e) =>
                        setEditingUnit({
                          ...editingUnit,
                          leituraAnteriorBase: Number(e.target.value) || 0
                        })
                      }
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                      Status da Unidade
                    </label>
                    <select
                      value={editingUnit.status || "ocupado"}
                      onChange={(e) =>
                        setEditingUnit({
                          ...editingUnit,
                          status: e.target.value as "ocupado" | "desocupado"
                        })
                      }
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ocupado">Ocupado</option>
                      <option value="desocupado">Desocupado</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsUnitModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Salvar Unidade
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
