import React, { useState, useEffect, useMemo } from "react";
import { 
  Droplet, 
  Building2, 
  Plus, 
  Calendar, 
  DollarSign, 
  FileText, 
  Printer, 
  Camera, 
  Search, 
  TrendingUp, 
  BarChart3, 
  Trash2, 
  Edit3, 
  Eye, 
  Send, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  Sparkles,
  Share2,
  Users,
  Gauge,
  Filter
} from "lucide-react";
import { 
  db,
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  serverTimestamp 
} from "../../firebase";
import { 
  EdificioHidrometro, 
  FaturaHidrometro, 
  CompanySettings, 
  UserProfile 
} from "../../types";
import { EdificiosGestao } from "./EdificiosGestao";
import { LancamentoModal } from "./LancamentoModal";
import { RelatorioExportModal } from "./RelatorioExportModal";
import { ComprovanteIndividualModal } from "./ComprovanteIndividualModal";
import { FotoViewerModal } from "./FotoViewerModal";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  LineChart, 
  Line 
} from "recharts";

interface HidrometroViewProps {
  isAdmin: boolean;
  user: any;
  profile: UserProfile | null;
  companySettings: CompanySettings | null;
}

// Initial mock buildings for Fidelité Imobiliária if no buildings exist
const INITIAL_EDIFICIOS_SAMPLE: EdificioHidrometro[] = [
  {
    id: "edf_fidelite_prime",
    nome: "Residencial Fidelité Prime",
    imobiliaria: "Fidelité Imobiliária",
    endereco: "Av. T-63, St. Bueno",
    cidade: "Goiânia - GO",
    concessionaria: "Saneago",
    codigoLigacao: "984210-4",
    tipoRateioPadrao: "proporcional_consumo",
    unidades: [
      { id: "u_101", numero: "101", moradorNome: "Carlos Eduardo Silva", moradorTelefone: "(62) 98111-2233", hidrometroNumero: "HID-101", leituraAnteriorBase: 142.5, status: "ocupado" },
      { id: "u_102", numero: "102", moradorNome: "Mariana Souza Lima", moradorTelefone: "(62) 98222-3344", hidrometroNumero: "HID-102", leituraAnteriorBase: 198.0, status: "ocupado" },
      { id: "u_201", numero: "201", moradorNome: "Fernando Ribeiro", moradorTelefone: "(62) 98333-4455", hidrometroNumero: "HID-201", leituraAnteriorBase: 215.3, status: "ocupado" },
      { id: "u_202", numero: "202", moradorNome: "Patrícia Mendes", moradorTelefone: "(62) 98444-5566", hidrometroNumero: "HID-202", leituraAnteriorBase: 176.8, status: "ocupado" },
      { id: "u_301", numero: "301", moradorNome: "Lucas Vasconcelos", moradorTelefone: "(62) 98555-6677", hidrometroNumero: "HID-301", leituraAnteriorBase: 160.2, status: "ocupado" },
      { id: "u_302", numero: "302", moradorNome: "Beatriz Nogueira", moradorTelefone: "(62) 98666-7788", hidrometroNumero: "HID-302", leituraAnteriorBase: 130.4, status: "ocupado" }
    ]
  },
  {
    id: "edf_bella_vista",
    nome: "Condomínio Residencial Bella Vista",
    imobiliaria: "Fidelité Imobiliária",
    endereco: "Rua 15, St. Marista",
    cidade: "Goiânia - GO",
    concessionaria: "Saneago",
    codigoLigacao: "745120-1",
    tipoRateioPadrao: "proporcional_consumo",
    unidades: [
      { id: "bv_101", numero: "101", moradorNome: "Juliana Castro", moradorTelefone: "(62) 99123-4567", hidrometroNumero: "BV-101", leituraAnteriorBase: 89.0, status: "ocupado" },
      { id: "bv_102", numero: "102", moradorNome: "Rodrigo Almeida", moradorTelefone: "(62) 99234-5678", hidrometroNumero: "BV-102", leituraAnteriorBase: 112.4, status: "ocupado" },
      { id: "bv_201", numero: "201", moradorNome: "Camila Fernandes", moradorTelefone: "(62) 99345-6789", hidrometroNumero: "BV-201", leituraAnteriorBase: 95.8, status: "ocupado" },
      { id: "bv_202", numero: "202", moradorNome: "Gabriel Martins", moradorTelefone: "(62) 99456-7890", hidrometroNumero: "BV-202", leituraAnteriorBase: 104.2, status: "ocupado" }
    ]
  }
];

export const HidrometroView: React.FC<HidrometroViewProps> = ({
  isAdmin,
  user,
  profile,
  companySettings
}) => {
  // Navigation subtabs
  const [activeSubTab, setActiveSubTab] = useState<"lancamentos" | "edificios" | "historico">("lancamentos");

  // State collections
  const [edificios, setEdificios] = useState<EdificioHidrometro[]>([]);
  const [faturas, setFaturas] = useState<FaturaHidrometro[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [selectedEdificioFilter, setSelectedEdificioFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [isLancamentoModalOpen, setIsLancamentoModalOpen] = useState(false);
  const [faturaParaEditar, setFaturaParaEditar] = useState<FaturaHidrometro | null>(null);

  const [isRelatorioModalOpen, setIsRelatorioModalOpen] = useState(false);
  const [selectedFaturaParaRelatorio, setSelectedFaturaParaRelatorio] = useState<FaturaHidrometro | null>(null);

  const [isComprovanteModalOpen, setIsComprovanteModalOpen] = useState(false);
  const [selectedFaturaParaComprovante, setSelectedFaturaParaComprovante] = useState<FaturaHidrometro | null>(null);
  const [selectedUnidadeIdParaComprovante, setSelectedUnidadeIdParaComprovante] = useState<string | null>(null);

  const [fotoViewerData, setFotoViewerData] = useState<{
    isOpen: boolean;
    url: string | null;
    titulo: string;
    subtitulo: string;
  }>({
    isOpen: false,
    url: null,
    titulo: "",
    subtitulo: ""
  });

  // ---- Dados (Firestore) ----
  // Antes, o Firestore não tinha regra para estas coleções: toda gravação era recusada
  // e o sistema guardava só no navegador (localStorage), sem avisar. As fotos também
  // iam dentro do lançamento, o que estoura o limite de 1 MB por documento.
  // Agora: tudo com companyId, fotos em documentos próprios (hidrometro_fotos) e erro visível.
  const companyId = profile?.companyId || "";
  const ehSuperAdmin = (user?.email || profile?.email) === "williangyn10@gmail.com" || profile?.role === "superadmin";
  const [fotosPorId, setFotosPorId] = useState<Record<string, string>>({});
  const [faturasBrutas, setFaturasBrutas] = useState<FaturaHidrometro[]>([]);

  // Junta duas listas (filtrada pela empresa + leitura geral do superadmin) sem repetir.
  const juntarPorId = <T extends { id: string }>(a: T[], b: T[]) => {
    const m = new Map<string, T>();
    [...a, ...b].forEach((x) => m.set(x.id, x));
    return Array.from(m.values());
  };

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    const parar: Array<() => void> = [];
    const ouvir = <T,>(nome: string, aoReceber: (lista: T[], origem: string) => void, origem: string, filtrar: boolean) => {
      const ref = collection(db, nome);
      const q = filtrar ? query(ref, where("companyId", "==", companyId)) : ref;
      parar.push(onSnapshot(q, (snap: any) => {
        const lista: any[] = [];
        snap.forEach((d: any) => lista.push({ id: d.id, ...d.data() }));
        aoReceber(lista as T[], origem);
      }, (err: any) => {
        // A leitura geral (registros antigos sem empresa) só vale para o superadmin; pode falhar para os demais.
        if (filtrar) {
          console.error(`Hidrômetro: sem acesso a ${nome}`, err);
          toast.error("Hidrômetro: sem permissão para ler os dados. Confira se as regras do Firebase estão publicadas.");
          setLoading(false);
        }
      }));
    };
    const fontes: Record<string, Record<string, any[]>> = { ed: {}, fat: {}, foto: {} };
    const juntar = (tipo: "ed" | "fat" | "foto") => Object.values(fontes[tipo]).reduce((acc: any[], l) => juntarPorId(acc, l), []);
    const origens = ehSuperAdmin ? [["empresa", true], ["geral", false]] as const : [["empresa", true]] as const;
    origens.forEach(([origem, filtrar]) => {
      ouvir<EdificioHidrometro>("hidrometro_edificios", (l, o) => { fontes.ed[o] = l; setEdificios(juntar("ed") as EdificioHidrometro[]); }, origem, filtrar);
      ouvir<FaturaHidrometro>("hidrometro_faturas", (l, o) => {
        fontes.fat[o] = l;
        const todas = (juntar("fat") as FaturaHidrometro[]).sort((a, b) => (b.mesReferencia || "").localeCompare(a.mesReferencia || ""));
        setFaturasBrutas(todas);
        setLoading(false);
      }, origem, filtrar);
      ouvir<{ id: string; foto: string }>("hidrometro_fotos", (l, o) => {
        fontes.foto[o] = l;
        const mapa: Record<string, string> = {};
        (juntar("foto") as any[]).forEach((f) => { if (f.foto) mapa[f.id] = f.foto; });
        setFotosPorId(mapa);
      }, origem, filtrar);
    });
    return () => parar.forEach((p) => p());
  }, [companyId, ehSuperAdmin]);

  // Lançamentos com as fotos de volta no lugar (a tela e os relatórios não mudam).
  useEffect(() => {
    setFaturas(faturasBrutas.map((f) => ({
      ...f,
      fotoFaturaGeralUrl: f.fotoFaturaGeralUrl || ((f as any).fotoFaturaGeralRef ? fotosPorId[(f as any).fotoFaturaGeralRef] : undefined),
      leituras: (f.leituras || []).map((l) => (l.fotoRef && !l.fotoHidrometroUrl && fotosPorId[l.fotoRef]
        ? { ...l, fotoHidrometroUrl: fotosPorId[l.fotoRef] }
        : l))
    })));
  }, [faturasBrutas, fotosPorId]);

  // Registros antigos no servidor sem companyId: só o superadmin enxerga. Quando ele abre a tela,
  // a empresa é gravada neles, e passam a aparecer para a equipe (ex.: Maely).
  const [empresaGravada, setEmpresaGravada] = useState(false);
  useEffect(() => {
    if (empresaGravada || loading || !companyId || !ehSuperAdmin) return;
    const semEmpresaEd = edificios.filter((e: any) => !e.companyId);
    const semEmpresaFat = faturasBrutas.filter((f: any) => !f.companyId);
    if (!semEmpresaEd.length && !semEmpresaFat.length) return;
    setEmpresaGravada(true);
    (async () => {
      let ok = 0;
      for (const e of semEmpresaEd) { try { await updateDoc(doc(db, "hidrometro_edificios", e.id), { companyId }); ok++; } catch (err) { console.error(err); } }
      for (const f of semEmpresaFat) {
        try {
          await updateDoc(doc(db, "hidrometro_faturas", f.id), { companyId });
          const refs = [...(f.leituras || []).map((l) => l.fotoRef).filter(Boolean) as string[], ...((f as any).fotoFaturaGeralRef ? [(f as any).fotoFaturaGeralRef] : [])];
          for (const r of refs) { try { await updateDoc(doc(db, "hidrometro_fotos", r), { companyId }); } catch { /* foto pode não existir */ } }
          ok++;
        } catch (err) { console.error(err); }
      }
      if (ok) toast.success(`${ok} registro(s) antigos do Hidrômetro liberados para a equipe.`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, companyId, ehSuperAdmin, edificios, faturasBrutas]);

  // Recupera o que ficou salvo só neste navegador (quando o Firebase recusava a gravação).
  const [recuperacaoFeita, setRecuperacaoFeita] = useState(false);
  useEffect(() => {
    if (recuperacaoFeita || loading || !companyId) return;
    setRecuperacaoFeita(true);
    const exemplos = new Set(INITIAL_EDIFICIOS_SAMPLE.map((e) => e.id));
    let locaisEd: EdificioHidrometro[] = [];
    let locaisFat: FaturaHidrometro[] = [];
    try { locaisEd = JSON.parse(localStorage.getItem("hidrometro_edificios_cache") || "[]"); } catch { /* ignora */ }
    try { locaisFat = JSON.parse(localStorage.getItem("hidrometro_faturas_cache") || "[]"); } catch { /* ignora */ }
    const faltaEd = locaisEd.filter((e) => e?.id && !exemplos.has(e.id) && !edificios.some((x) => x.id === e.id));
    const faltaFat = locaisFat.filter((f) => f?.id && !faturasBrutas.some((x) => x.id === f.id));
    if (!faltaEd.length && !faltaFat.length) return;
    (async () => {
      let ok = 0;
      for (const e of faltaEd) { try { await salvarEdificio(e, false); ok++; } catch { /* segue */ } }
      for (const f of faltaFat) { try { await salvarFatura(f, false); ok++; } catch { /* segue */ } }
      if (ok) {
        toast.success(`${ok} registro(s) que estavam só neste navegador foram enviados para o servidor.`);
        try {
          localStorage.removeItem("hidrometro_edificios_cache");
          localStorage.removeItem("hidrometro_faturas_cache");
        } catch { /* ignora */ }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, companyId]);

  const semUndef = (o: any): any => JSON.parse(JSON.stringify(o, (_k, v) => (v === undefined ? null : v)));

  const salvarEdificio = async (edificio: EdificioHidrometro, _avisar = true) => {
    const dados = semUndef({ ...edificio, companyId: (edificio as any).companyId || companyId, updatedAt: new Date().toISOString() });
    try {
      await setDoc(doc(db, "hidrometro_edificios", edificio.id), dados);
    } catch (err: any) {
      console.error("Hidrômetro: erro ao salvar edifício", err);
      // O modal mostra a mensagem; aqui só ela fica clara.
      throw new Error(mensagemErro(err, "o edifício"));
    }
  };

  // Fotos (base64) vão cada uma para um documento próprio; o lançamento guarda só a referência.
  const salvarFatura = async (fatura: FaturaHidrometro, _avisar = true) => {
    const cid = (fatura as any).companyId || companyId;
    try {
      const leituras = [];
      for (const l of fatura.leituras || []) {
        if (l.fotoHidrometroUrl && l.fotoHidrometroUrl.startsWith("data:")) {
          const fotoId = `${fatura.id}__${l.unidadeId}`;
          await setDoc(doc(db, "hidrometro_fotos", fotoId), { companyId: cid, faturaId: fatura.id, unidadeId: l.unidadeId, foto: l.fotoHidrometroUrl, updatedAt: new Date().toISOString() });
          leituras.push({ ...l, fotoHidrometroUrl: "", fotoRef: fotoId });
        } else {
          leituras.push(l);
        }
      }
      let geral: any = {};
      if (fatura.fotoFaturaGeralUrl && fatura.fotoFaturaGeralUrl.startsWith("data:")) {
        const fotoId = `${fatura.id}__geral`;
        await setDoc(doc(db, "hidrometro_fotos", fotoId), { companyId: cid, faturaId: fatura.id, unidadeId: "geral", foto: fatura.fotoFaturaGeralUrl, updatedAt: new Date().toISOString() });
        geral = { fotoFaturaGeralUrl: "", fotoFaturaGeralRef: fotoId };
      }
      const dados = semUndef({ ...fatura, ...geral, leituras, companyId: cid, updatedAt: new Date().toISOString() });
      await setDoc(doc(db, "hidrometro_faturas", fatura.id), dados);
    } catch (err: any) {
      console.error("Hidrômetro: erro ao salvar lançamento", err);
      // O modal mostra a mensagem; aqui só ela fica clara.
      throw new Error(mensagemErro(err, "o lançamento"));
    }
  };

  const mensagemErro = (err: any, oque: string) => {
    const m = String(err?.code || err?.message || "");
    if (/permission|insufficient/i.test(m)) return `Não foi possível salvar ${oque}: sem permissão. Confira se as regras do Firebase estão publicadas.`;
    if (/too large|exceeds|maximum size|1048576/i.test(m)) return `Não foi possível salvar ${oque}: alguma foto ficou grande demais. Tire a foto de novo ou use uma menor.`;
    if (/offline|unavailable|network/i.test(m)) return `Não foi possível salvar ${oque}: sem conexão. Tente de novo.`;
    return `Não foi possível salvar ${oque}. Nada foi gravado; tente de novo.`;
  };

  // Save Edifício Handler
  const handleSaveEdificio = async (edificio: EdificioHidrometro) => {
    await salvarEdificio(edificio);
  };

  // Delete Edifício Handler
  const handleDeleteEdificio = async (id: string) => {
    try {
      await deleteDoc(doc(db, "hidrometro_edificios", id));
      toast.success("Edifício excluído.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível excluir o edifício (só o administrador exclui).");
    }
  };

  // Save Fatura Handler
  const handleSaveFatura = async (fatura: FaturaHidrometro) => {
    await salvarFatura(fatura);
  };

  // Delete Fatura Handler
  const handleDeleteFatura = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este lançamento de água?")) return;
    try {
      const f = faturasBrutas.find((x) => x.id === id);
      await deleteDoc(doc(db, "hidrometro_faturas", id));
      const refs = [
        ...((f?.leituras || []).map((l) => l.fotoRef).filter(Boolean) as string[]),
        ...((f as any)?.fotoFaturaGeralRef ? [(f as any).fotoFaturaGeralRef] : [])
      ];
      await Promise.all(refs.map((r) => deleteDoc(doc(db, "hidrometro_fotos", r)).catch(() => undefined)));
      toast.success("Lançamento excluído com sucesso.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível excluir o lançamento (só o administrador exclui).");
    }
  };

  // Photo viewer trigger
  const handleOpenFotoViewer = (url: string, titulo: string, subtitulo: string) => {
    setFotoViewerData({
      isOpen: true,
      url,
      titulo,
      subtitulo
    });
  };

  // Filtered Faturas
  const filteredFaturas = useMemo(() => {
    return faturas.filter((f) => {
      const matchEdificio =
        selectedEdificioFilter === "all" || f.edificioId === selectedEdificioFilter;
      const matchSearch =
        !searchQuery.trim() ||
        f.edificioNome?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.mesAnoTexto?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.mesReferencia?.includes(searchQuery);
      return matchEdificio && matchSearch;
    });
  }, [faturas, selectedEdificioFilter, searchQuery]);

  // Overall Quick Stats
  const stats = useMemo(() => {
    const totalMedicoes = faturas.length;
    const totalValorRateado = faturas.reduce((acc, f) => acc + (f.valorTotalConta || 0), 0);
    const totalVolumeM3 = faturas.reduce((acc, f) => acc + (f.consumoTotalApartamentosM3 || 0), 0);
    const totalApartamentos = edificios.reduce((acc, e) => acc + (e.unidades?.length || 0), 0);

    return {
      totalMedicoes,
      totalValorRateado,
      totalVolumeM3,
      totalApartamentos,
      totalEdificios: edificios.length
    };
  }, [faturas, edificios]);

  // Chart data for history tab
  const chartHistoryData = useMemo(() => {
    const sorted = [...faturas].reverse(); // chronological
    return sorted.map((f) => ({
      mes: f.mesReferencia,
      edificio: f.edificioNome,
      consumoM3: Number(f.consumoTotalApartamentosM3.toFixed(1)),
      valorTotal: Number(f.valorTotalConta.toFixed(2)),
      tarifaM3: Number(f.tarifaM3Calculada.toFixed(2))
    }));
  }, [faturas]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Clean Top Header */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0 shadow-sm">
            <Droplet className="w-5 h-5 fill-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                Hidrômetro & Rateio de Água
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200">
                Fidelité Imobiliária
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Lançamento de faturas, medições individuais com fotos comprobatórias e demonstrativos oficiais por apartamento.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveSubTab("edificios")}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Building2 className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Edifícios ({edificios.length})</span>
          </button>

          <button
            onClick={() => {
              setFaturaParaEditar(null);
              setIsLancamentoModalOpen(true);
            }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            Lançar Medição de Água
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Edifícios Fidelité
            </span>
            <span className="text-2xl font-black text-slate-900 mt-0.5 block">
              {stats.totalEdificios}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {stats.totalApartamentos} unidades ativas
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Medições Realizadas
            </span>
            <span className="text-2xl font-black text-slate-900 mt-0.5 block">
              {stats.totalMedicoes}
            </span>
            <span className="text-[10px] font-bold text-slate-400">Faturas processadas</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold shrink-0">
            <Droplet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Volume Total Medido
            </span>
            <span className="text-2xl font-black text-slate-900 mt-0.5 block">
              {stats.totalVolumeM3.toFixed(1)} m³
            </span>
            <span className="text-[10px] font-bold text-slate-400">Consumo nos hidrômetros</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Total Rateado (R$)
            </span>
            <span className="text-2xl font-black text-emerald-700 mt-0.5 block">
              R$ {stats.totalValorRateado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] font-bold text-slate-400">Distribuído aos aptos</span>
          </div>
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab("lancamentos")}
          className={`py-3 px-6 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "lancamentos"
              ? "border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-2xl"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Droplet className="w-4 h-4" />
          Lançamentos & Rateios ({faturas.length})
        </button>

        <button
          onClick={() => setActiveSubTab("edificios")}
          className={`py-3 px-6 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "edificios"
              ? "border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-2xl"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Edifícios & Apartamentos ({edificios.length})
        </button>

        <button
          onClick={() => setActiveSubTab("historico")}
          className={`py-3 px-6 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === "historico"
              ? "border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-2xl"
              : "border-transparent text-slate-400 hover:text-slate-700"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Histórico & Gráficos de Consumo
        </button>
      </div>

      {/* SUBTAB 1: Lançamentos & Rateios */}
      {activeSubTab === "lancamentos" && (
        <div className="space-y-6">
          {/* Filter and search bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por edifício ou mês..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={selectedEdificioFilter}
                onChange={(e) => setSelectedEdificioFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos os Edifícios</option>
                {edificios.map((ed) => (
                  <option key={ed.id} value={ed.id}>
                    {ed.nome}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setFaturaParaEditar(null);
                setIsLancamentoModalOpen(true);
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3px]" />
              Nova Medição
            </button>
          </div>

          {/* List of Invoices / Cycles */}
          {filteredFaturas.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto">
                <Droplet className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h4 className="text-base font-bold text-slate-800">
                  Nenhum lançamento de água registrado
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Toda vez que a fatura de água do condomínio chegar, clique em "Nova Medição" para registrar as leituras e calcular os valores de cada morador.
                </p>
                <button
                  onClick={() => {
                    setFaturaParaEditar(null);
                    setIsLancamentoModalOpen(true);
                  }}
                  className="mt-5 px-6 py-3 bg-blue-600 text-white text-xs font-black uppercase tracking-wider rounded-2xl hover:bg-blue-700 transition-all shadow-md cursor-pointer"
                >
                  + Lançar Primeira Medição
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredFaturas.map((fatura) => {
                const fotosCount = fatura.leituras.filter((l) => !!l.fotoHidrometroUrl).length;
                const totalAptos = fatura.leituras.length;

                return (
                  <div
                    key={fatura.id}
                    className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                  >
                    {/* Building & Month Details */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                        <Droplet className="w-6 h-6 fill-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-black text-slate-900 leading-tight">
                            {fatura.edificioNome}
                          </h4>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                            {fatura.mesAnoTexto || fatura.mesReferencia}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              fatura.status === "fechado"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : "bg-amber-50 text-amber-700 border border-amber-100"
                            }`}
                          >
                            {fatura.status === "fechado" ? "Fechado & Calculado" : "Rascunho / Em aberto"}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
                          <span>📅 Leitura: {new Date(fatura.dataLeitura + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                          <span>🏢 {totalAptos} apartamentos</span>
                          <span className="flex items-center gap-1 font-bold text-blue-600">
                            <Camera className="w-3.5 h-3.5" />
                            {fotosCount} fotos de hidrômetros
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary values */}
                    <div className="flex items-center gap-6 border-y lg:border-y-0 lg:border-x border-slate-100 py-3 lg:py-0 lg:px-6">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Consumo Medido
                        </span>
                        <span className="text-base font-black text-slate-800 mt-0.5 block font-mono">
                          {fatura.consumoTotalApartamentosM3.toFixed(2)} m³
                        </span>
                        <span className="text-[10px] text-slate-400">
                          R$ {fatura.tarifaM3Calculada.toFixed(2)}/m³
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                          Total da Fatura
                        </span>
                        <span className="text-xl font-black text-emerald-700 mt-0.5 block">
                          R$ {fatura.valorTotalConta.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-bold">
                          100% rateado
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center flex-wrap gap-2 justify-end">
                      <button
                        onClick={() => {
                          setSelectedFaturaParaRelatorio(fatura);
                          setIsRelatorioModalOpen(true);
                        }}
                        className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Ver relatório completo com fotos"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Relatório / PDF
                      </button>

                      <button
                        onClick={() => {
                          setSelectedFaturaParaComprovante(fatura);
                          setSelectedUnidadeIdParaComprovante(fatura.leituras?.[0]?.unidadeId || null);
                          setIsComprovanteModalOpen(true);
                        }}
                        className="px-4 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Enviar comprovante via WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" />
                        WhatsApp
                      </button>

                      <button
                        onClick={() => {
                          setFaturaParaEditar(fatura);
                          setIsLancamentoModalOpen(true);
                        }}
                        className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-xl transition-colors cursor-pointer"
                        title="Editar Medições"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteFatura(fatura.id)}
                          className="p-2.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
                          title="Excluir Lançamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: Edifícios & Apartamentos */}
      {activeSubTab === "edificios" && (
        <EdificiosGestao
          edificios={edificios}
          onSaveEdificio={handleSaveEdificio}
          onDeleteEdificio={handleDeleteEdificio}
          isAdmin={isAdmin}
        />
      )}

      {/* SUBTAB 3: Histórico & Indicadores */}
      {activeSubTab === "historico" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                Evolução Mensal de Consumo & Faturamento
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Acompanhe o consumo total em metros cúbicos (m³) e o valor em reais das faturas ao longo do tempo.
              </p>
            </div>

            {chartHistoryData.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Dados insuficientes para gerar gráficos. Registre medições para visualizar o comparativo histórico.
              </div>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartHistoryData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="mes" stroke="#94A3B8" fontSize={11} />
                    <YAxis yAxisId="left" orientation="left" stroke="#3B82F6" fontSize={11} unit=" m³" />
                    <YAxis yAxisId="right" orientation="right" stroke="#10B981" fontSize={11} unit=" R$" />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        name === "consumoM3" ? `${val} m³` : `R$ ${val}`,
                        name === "consumoM3" ? "Consumo Medido" : "Valor Fatura"
                      ]}
                      contentStyle={{
                        borderRadius: "16px",
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="consumoM3" name="Consumo (m³)" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                    <Bar yAxisId="right" dataKey="valorTotal" name="Valor Total (R$)" fill="#10B981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Tips for Leak Detection */}
          <div className="p-6 bg-amber-50/60 border border-amber-200 rounded-3xl flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="text-xs text-amber-900 space-y-1">
              <h4 className="font-black uppercase tracking-wider text-amber-950">
                Auditoria de Consumo & Detecção de Vazamentos
              </h4>
              <p>
                O sistema compara a Leitura Anterior com a Leitura Atual. Caso um apartamento apresente consumo mais de 50% superior à sua média habitual, o sistema sinaliza no lançamento para verificação in loco de possíveis vazamentos em válvulas de descarga, torneiras ou tubulações.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Lançamento de Medição */}
      <LancamentoModal
        isOpen={isLancamentoModalOpen}
        onClose={() => {
          setIsLancamentoModalOpen(false);
          setFaturaParaEditar(null);
        }}
        onSave={handleSaveFatura}
        edificios={edificios}
        faturasExistentes={faturas}
        faturaParaEditar={faturaParaEditar}
        onOpenFotoViewer={handleOpenFotoViewer}
        currentUser={profile}
        companySettings={companySettings}
      />

      {/* MODAL 2: Relatório Completo para Impressão & Exportação com Fotos */}
      <RelatorioExportModal
        isOpen={isRelatorioModalOpen}
        onClose={() => {
          setIsRelatorioModalOpen(false);
          setSelectedFaturaParaRelatorio(null);
        }}
        fatura={selectedFaturaParaRelatorio}
        onOpenFotoViewer={handleOpenFotoViewer}
        faturasExistentes={faturas}
        companySettings={companySettings}
      />

      {/* MODAL 3: Comprovante Individual WhatsApp */}
      <ComprovanteIndividualModal
        isOpen={isComprovanteModalOpen}
        onClose={() => {
          setIsComprovanteModalOpen(false);
          setSelectedFaturaParaComprovante(null);
          setSelectedUnidadeIdParaComprovante(null);
        }}
        fatura={selectedFaturaParaComprovante}
        initialUnidadeId={selectedUnidadeIdParaComprovante}
        onOpenFotoViewer={handleOpenFotoViewer}
        companySettings={companySettings}
      />

      {/* MODAL 4: Visualizador de Fotos em Alta Resolução */}
      <FotoViewerModal
        isOpen={fotoViewerData.isOpen}
        onClose={() => setFotoViewerData((prev) => ({ ...prev, isOpen: false }))}
        fotoUrl={fotoViewerData.url}
        titulo={fotoViewerData.titulo}
        subtitulo={fotoViewerData.subtitulo}
      />
    </div>
  );
};
