import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { Plus, Search, Download, FileText, Pencil, Trash2, X, Users, Printer } from "lucide-react";
import { db, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "../../firebase";
import { CurrencyInput } from "../ui/CurrencyInput";
import { ConfirmModal } from "../ui/ConfirmModal";

// Ficha de pré-cadastro de interessados no loteamento Cidade Jardim.
// Guardada na mesma coleção das propostas Bella White (regras já publicadas),
// marcada com tipo = TIPO_INTERESSADO; a tela de propostas ignora esses registros.
export const TIPO_INTERESSADO = "interessado_cidade_jardim";
const COLECAO = "propostas_bella_white";
const EMPREENDIMENTO = "Loteamento Cidade Jardim";

type StatusInteressado = "interessado" | "contatado" | "prioridade" | "comprou" | "desistiu";

const STATUS: { id: StatusInteressado; label: string; classe: string }[] = [
  { id: "interessado", label: "Interessado", classe: "bg-blue-50 text-blue-800 border-blue-200" },
  { id: "contatado", label: "Contatado", classe: "bg-amber-50 text-amber-800 border-amber-200" },
  { id: "prioridade", label: "Prioridade", classe: "bg-violet-50 text-violet-800 border-violet-200" },
  { id: "comprou", label: "Comprou no lançamento", classe: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { id: "desistiu", label: "Desistiu", classe: "bg-zinc-100 text-zinc-600 border-zinc-200" }
];

interface Interessado {
  id?: string;
  tipo: typeof TIPO_INTERESSADO;
  empreendimento: string;
  companyId: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  status: StatusInteressado;
  nome: string;
  cpf: string;
  dataNascimento: string;
  telefone: string;
  email: string;
  cidade: string;
  estadoCivil: string;
  profissao: string;
  rendaFamiliar: number;
  quantidadeLotes: number;
  preferenciaLote: string;
  finalidade: string;
  formaPagamento: string;
  entradaDisponivel: number;
  parcelaPretendida: number;
  comoConheceu: string;
  corretor: string;
  observacoes: string;
}

const vazio = (user: any): Interessado => {
  const agora = new Date().toISOString();
  return {
    tipo: TIPO_INTERESSADO,
    empreendimento: EMPREENDIMENTO,
    companyId: user?.companyId || "",
    createdBy: user?.uid || "",
    createdByName: user?.displayName || "",
    createdAt: agora,
    updatedAt: agora,
    status: "interessado",
    nome: "",
    cpf: "",
    dataNascimento: "",
    telefone: "",
    email: "",
    cidade: "",
    estadoCivil: "",
    profissao: "",
    rendaFamiliar: 0,
    quantidadeLotes: 1,
    preferenciaLote: "",
    finalidade: "Moradia",
    formaPagamento: "Parcelado direto com a loteadora",
    entradaDisponivel: 0,
    parcelaPretendida: 0,
    comoConheceu: "",
    corretor: user?.displayName || "",
    observacoes: ""
  };
};

const brl = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");
const statusDe = (id: StatusInteressado) => STATUS.find((s) => s.id === id) || STATUS[0];

// Logo da Fidelité em base64 para os PDFs (carregada uma vez)
let logoCache: Promise<string | null> | null = null;
const carregarLogo = (): Promise<string | null> => {
  if (!logoCache) {
    logoCache = fetch("/logo-fidelite.png")
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => b ? new Promise<string | null>((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = () => res(null);
        fr.readAsDataURL(b);
      }) : null)
      .catch(() => null);
  }
  return logoCache;
};

// Fora do componente para não recriar os campos a cada tecla (perderia o foco)
const Campo: React.FC<{ id: string; label: string; children: React.ReactNode; className?: string }> = ({ id, label, children, className }) => (
  <div className={className}>
    <label htmlFor={id} className="block text-[13px] font-medium text-zinc-700 mb-1">{label}</label>
    {children}
  </div>
);

interface Props {
  currentUser?: any;
}

export const InteressadosCidadeJardim: React.FC<Props> = ({ currentUser }) => {
  const [lista, setLista] = useState<Interessado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusInteressado | "todos">("todos");
  const [ficha, setFicha] = useState<Interessado | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<Interessado | null>(null);

  const ehAdmin = ["admin", "manager", "superadmin"].includes(currentUser?.role);

  const carregar = async () => {
    setCarregando(true);
    try {
      let snap: any;
      try {
        snap = await getDocs(query(collection(db, COLECAO), where("tipo", "==", TIPO_INTERESSADO)));
      } catch {
        // Sem permissão para ver todos: carrega só os cadastrados por este usuário
        snap = await getDocs(query(collection(db, COLECAO), where("tipo", "==", TIPO_INTERESSADO), where("createdBy", "==", currentUser?.uid || "")));
      }
      const itens: Interessado[] = [];
      snap.forEach((d: any) => itens.push({ id: d.id, ...d.data() }));
      const daEmpresa = itens.filter((i) => !currentUser?.companyId || !i.companyId || i.companyId === currentUser.companyId);
      daEmpresa.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      setLista(daEmpresa);
    } catch (err) {
      console.error("Erro ao carregar interessados", err);
      toast.error("Não foi possível carregar os cadastros. Verifique a conexão e tente de novo.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return lista.filter((i) => {
      if (filtroStatus !== "todos" && i.status !== filtroStatus) return false;
      if (!t) return true;
      return [i.nome, i.cpf, i.telefone, i.email, i.cidade, i.corretor].some((v) => (v || "").toLowerCase().includes(t));
    });
  }, [lista, busca, filtroStatus]);

  const contagem = useMemo(() => {
    const c: Record<string, number> = { todos: lista.length };
    STATUS.forEach((s) => (c[s.id] = lista.filter((i) => i.status === s.id).length));
    return c;
  }, [lista]);

  const salvar = async () => {
    if (!ficha) return;
    if (!ficha.nome.trim()) return toast.error("Informe o nome do interessado.");
    if (!ficha.telefone.trim()) return toast.error("Informe um telefone ou WhatsApp para contato.");
    const telNovo = ficha.telefone.replace(/\D/g, "");
    const repetido = lista.find((i) => i.id !== ficha.id && telNovo && i.telefone.replace(/\D/g, "") === telNovo);
    if (repetido) toast.warning(`Atenção: ${repetido.nome} já está cadastrado com esse telefone.`);

    setSalvando(true);
    try {
      const { id, ...dados } = { ...ficha, updatedAt: new Date().toISOString() };
      if (id) {
        await updateDoc(doc(db, COLECAO, id), dados);
        toast.success("Cadastro atualizado.");
      } else {
        await addDoc(collection(db, COLECAO), dados);
        toast.success("Interessado cadastrado.");
      }
      setFicha(null);
      await carregar();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível salvar. Verifique a conexão e tente de novo.");
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExcluir = async () => {
    if (!excluir?.id) return;
    try {
      await deleteDoc(doc(db, COLECAO, excluir.id));
      toast.success("Cadastro excluído.");
      setExcluir(null);
      await carregar();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível excluir. Só administradores podem excluir cadastros.");
    }
  };

  const alterarStatus = async (i: Interessado, status: StatusInteressado) => {
    if (!i.id) return;
    try {
      await updateDoc(doc(db, COLECAO, i.id), { status, updatedAt: new Date().toISOString() });
      setLista((l) => l.map((x) => (x.id === i.id ? { ...x, status } : x)));
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível alterar a situação.");
    }
  };

  // ---------- Exportação ----------
  const baixarPlanilha = () => {
    if (filtrados.length === 0) return toast.error("Nenhum cadastro para exportar.");
    const cab = ["Data do cadastro", "Situação", "Nome", "CPF", "Nascimento", "Telefone", "E-mail", "Cidade", "Estado civil", "Profissão",
      "Renda familiar", "Qtd. lotes", "Preferência de lote", "Finalidade", "Forma de pagamento", "Entrada disponível", "Parcela pretendida",
      "Como conheceu", "Corretor", "Observações"];
    const esc = (v: any) => {
      const s = String(v ?? "");
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = filtrados.map((i) => [
      dataBr(i.createdAt), statusDe(i.status).label, i.nome, i.cpf, i.dataNascimento ? i.dataNascimento.split("-").reverse().join("/") : "",
      i.telefone, i.email, i.cidade, i.estadoCivil, i.profissao, brl(i.rendaFamiliar), i.quantidadeLotes, i.preferenciaLote, i.finalidade,
      i.formaPagamento, brl(i.entradaDisponivel), brl(i.parcelaPretendida), i.comoConheceu, i.corretor, i.observacoes
    ].map(esc).join(";"));
    const csv = "﻿" + [cab.join(";"), ...linhas].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `interessados_cidade_jardim_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtrados.length} cadastro(s) exportado(s).`);
  };

  // Cabeçalho dos PDFs com a logo da Fidelité (public/logo-fidelite.png)
  const cabecalhoPdf = (pdf: jsPDF, titulo: string, logo: string | null) => {
    if (logo) {
      pdf.addImage(logo, "PNG", 14, 6, 36, 13.3);
    } else {
      pdf.setTextColor(0, 51, 141);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("Fidelité", 14, 14);
      pdf.setTextColor(220, 38, 38);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text("negócios imobiliários", 14, 19);
    }
    pdf.setTextColor(0, 51, 141);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(titulo, 196, 12, { align: "right" });
    pdf.setTextColor(100, 116, 139);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`${EMPREENDIMENTO} · gerado em ${new Date().toLocaleDateString("pt-BR")}`, 196, 17, { align: "right" });
    pdf.setDrawColor(0, 51, 141);
    pdf.setLineWidth(0.6);
    pdf.line(14, 23, 196, 23);
    pdf.setLineWidth(0.2);
    pdf.setTextColor(0, 0, 0);
  };

  const baixarListaPdf = async () => {
    if (filtrados.length === 0) return toast.error("Nenhum cadastro para exportar.");
    const logo = await carregarLogo();
    const pdf = new jsPDF();
    const titulo = "INTERESSADOS — PRÉ-LANÇAMENTO";
    cabecalhoPdf(pdf, titulo, logo);
    const cols = [
      { l: "Cadastro", w: 20 }, { l: "Nome", w: 50 }, { l: "Telefone", w: 30 }, { l: "Cidade", w: 28 },
      { l: "Lotes", w: 12 }, { l: "Pagamento", w: 26 }, { l: "Situação", w: 16 }
    ];
    let y = 32;
    const cab = () => {
      pdf.setFillColor(241, 245, 249);
      pdf.rect(14, y - 5, 182, 7, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      let x = 16;
      cols.forEach((c) => { pdf.text(c.l.toUpperCase(), x, y); x += c.w; });
      y += 7;
    };
    pdf.setFontSize(9);
    pdf.text(`${filtrados.length} interessado(s)`, 14, y);
    y += 8;
    cab();
    pdf.setFont("helvetica", "normal");
    filtrados.forEach((i, idx) => {
      if (y > 280) { pdf.addPage(); cabecalhoPdf(pdf, titulo, logo); y = 32; cab(); pdf.setFont("helvetica", "normal"); }
      if (idx % 2 === 1) { pdf.setFillColor(248, 250, 252); pdf.rect(14, y - 5, 182, 7, "F"); }
      pdf.setFontSize(7.5);
      const valores = [dataBr(i.createdAt), i.nome, i.telefone, i.cidade, String(i.quantidadeLotes || ""),
        i.formaPagamento.startsWith("À vista") ? "À vista" : i.formaPagamento.startsWith("Financ") ? "Financiamento" : "Parcelado",
        statusDe(i.status).label];
      let x = 16;
      valores.forEach((v, k) => { pdf.text(pdf.splitTextToSize(v || "", cols[k].w - 2)[0] || "", x, y); x += cols[k].w; });
      y += 7;
    });
    pdf.save(`interessados_cidade_jardim_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const imprimirFicha = async (i: Interessado) => {
    const logo = await carregarLogo();
    const pdf = new jsPDF();
    cabecalhoPdf(pdf, "FICHA DE INTERESSE", logo);
    let y = 34;
    const secao = (t: string) => {
      y += 2;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(15, 39, 74);
      pdf.text(t, 14, y);
      pdf.setDrawColor(203, 213, 225);
      pdf.line(14, y + 2, 196, y + 2);
      pdf.setTextColor(0, 0, 0);
      y += 9;
    };
    const campo = (rotulo: string, valor: string, x = 14, largura = 182) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(rotulo.toUpperCase(), x, y);
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      const linhas = pdf.splitTextToSize(valor || "—", largura - 4);
      pdf.text(linhas, x, y + 5);
      return 5 + linhas.length * 5;
    };
    const par = (a: [string, string], b: [string, string]) => {
      const h = Math.max(campo(a[0], a[1], 14, 90), campo(b[0], b[1], 108, 88));
      y += h + 4;
    };
    secao("Dados do interessado");
    par(["Nome", i.nome], ["CPF", i.cpf]);
    par(["Telefone / WhatsApp", i.telefone], ["E-mail", i.email]);
    par(["Data de nascimento", i.dataNascimento ? i.dataNascimento.split("-").reverse().join("/") : ""], ["Cidade", i.cidade]);
    par(["Estado civil", i.estadoCivil], ["Profissão", i.profissao]);
    par(["Renda familiar", i.rendaFamiliar ? brl(i.rendaFamiliar) : ""], ["Como conheceu", i.comoConheceu]);
    secao("Interesse no loteamento");
    par(["Quantidade de lotes", String(i.quantidadeLotes || "")], ["Finalidade", i.finalidade]);
    par(["Preferência de lote", i.preferenciaLote], ["Forma de pagamento", i.formaPagamento]);
    par(["Entrada disponível", i.entradaDisponivel ? brl(i.entradaDisponivel) : ""], ["Parcela que cabe no orçamento", i.parcelaPretendida ? brl(i.parcelaPretendida) : ""]);
    secao("Atendimento");
    par(["Corretor", i.corretor], ["Situação", statusDe(i.status).label]);
    y += campo("Observações", i.observacoes) + 4;
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Cadastrado em ${dataBr(i.createdAt)} por ${i.createdByName || "—"}. Pré-cadastro sem reserva de lote; a escolha da unidade ocorre no dia do lançamento.`, 14, Math.min(y + 6, 280), { maxWidth: 182 });
    y = Math.min(y + 30, 270);
    pdf.setDrawColor(15, 23, 42);
    pdf.line(30, y, 100, y);
    pdf.line(115, y, 185, y);
    pdf.setTextColor(0, 0, 0);
    pdf.text("Interessado", 65, y + 5, { align: "center" });
    pdf.text("Corretor", 150, y + 5, { align: "center" });
    pdf.save(`ficha_${(i.nome || "interessado").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`);
  };

  // ---------- Form helpers ----------
  const set = (campo: keyof Interessado, valor: any) => setFicha((f) => (f ? { ...f, [campo]: valor } : f));
  const inp = "w-full h-10 px-3 border border-zinc-300 rounded-lg text-sm text-zinc-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600";

  return (
    <div className="space-y-4 pb-20">
      {/* Cabeçalho */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Pré-lançamento</p>
          <h2 className="text-xl font-semibold text-zinc-900">Interessados — Loteamento Cidade Jardim</h2>
          <p className="text-sm text-zinc-600">Fichas dos clientes interessados, guardadas até o dia do lançamento.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={baixarPlanilha} className="h-10 px-3 rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-800 hover:bg-zinc-50 flex items-center gap-2">
            <Download className="w-4 h-4" /> Planilha (Excel)
          </button>
          <button type="button" onClick={baixarListaPdf} className="h-10 px-3 rounded-lg border border-zinc-300 bg-white text-sm font-medium text-zinc-800 hover:bg-zinc-50 flex items-center gap-2">
            <FileText className="w-4 h-4" /> Lista em PDF
          </button>
          <button type="button" onClick={() => setFicha(vazio(currentUser))} className="h-10 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo cadastro
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-3 rounded-2xl border border-zinc-200 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CPF, telefone, cidade ou corretor"
            aria-label="Buscar interessado" className={`${inp} pl-9`} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[{ id: "todos", label: "Todos" } as const, ...STATUS].map((s) => (
            <button key={s.id} type="button" onClick={() => setFiltroStatus(s.id as any)}
              className={`h-8 px-3 rounded-full text-[13px] font-medium border transition-colors ${filtroStatus === s.id ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50"}`}>
              {s.label} <span className="tabular-nums opacity-70">{contagem[s.id] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        {carregando ? (
          <p className="p-6 text-sm text-zinc-600">Carregando cadastros…</p>
        ) : filtrados.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
            <p className="text-sm text-zinc-700 font-medium">{lista.length === 0 ? "Nenhum interessado cadastrado ainda." : "Nenhum cadastro com esse filtro."}</p>
            {lista.length === 0 && (
              <button type="button" onClick={() => setFicha(vazio(currentUser))} className="mt-3 h-9 px-4 rounded-lg bg-blue-700 text-white text-sm font-semibold">Cadastrar o primeiro</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Interessado</th>
                  <th className="px-4 py-2.5 font-medium hidden md:table-cell">Contato</th>
                  <th className="px-4 py-2.5 font-medium hidden lg:table-cell">Interesse</th>
                  <th className="px-4 py-2.5 font-medium">Situação</th>
                  <th className="px-4 py-2.5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtrados.map((i) => (
                  <tr key={i.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-zinc-900">{i.nome}</p>
                      <p className="text-xs text-zinc-600">{i.cidade || "—"} · cadastrado em {dataBr(i.createdAt)} · {i.corretor || i.createdByName}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-zinc-800">{i.telefone}</p>
                      <p className="text-xs text-zinc-600">{i.email}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-zinc-800">{i.quantidadeLotes || 1} lote(s) · {i.finalidade}</p>
                      <p className="text-xs text-zinc-600">{i.formaPagamento}{i.entradaDisponivel ? ` · entrada ${brl(i.entradaDisponivel)}` : ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select value={i.status} onChange={(e) => alterarStatus(i, e.target.value as StatusInteressado)} aria-label={`Situação de ${i.nome}`}
                        className={`h-8 px-2 rounded-full text-xs font-medium border ${statusDe(i.status).classe}`}>
                        {STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" title="Baixar ficha em PDF" aria-label={`Baixar ficha de ${i.nome}`} onClick={() => imprimirFicha(i)} className="w-8 h-8 rounded-md text-zinc-600 hover:bg-zinc-100 flex items-center justify-center"><Printer className="w-4 h-4" /></button>
                        <button type="button" title="Editar" aria-label={`Editar ${i.nome}`} onClick={() => setFicha({ ...vazio(currentUser), ...i })} className="w-8 h-8 rounded-md text-zinc-600 hover:bg-zinc-100 flex items-center justify-center"><Pencil className="w-4 h-4" /></button>
                        {ehAdmin && (
                          <button type="button" title="Excluir" aria-label={`Excluir ${i.nome}`} onClick={() => setExcluir(i)} className="w-8 h-8 rounded-md text-red-600 hover:bg-red-50 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ficha */}
      {ficha && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-start md:items-center justify-center p-4 overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-ficha" className="bg-white w-full max-w-3xl rounded-xl shadow-xl">
            <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between">
              <div>
                <h3 id="titulo-ficha" className="text-lg font-semibold text-zinc-900">{ficha.id ? "Editar cadastro" : "Ficha de interesse — Cidade Jardim"}</h3>
                <p className="text-sm text-zinc-600">Pré-cadastro, sem reserva de lote.</p>
              </div>
              <button type="button" onClick={() => setFicha(null)} aria-label="Fechar" className="w-10 h-10 rounded-lg hover:bg-zinc-100 flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Dados do interessado</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Campo id="f-nome" label="Nome completo *" className="md:col-span-2"><input id="f-nome" className={inp} value={ficha.nome} onChange={(e) => set("nome", e.target.value)} /></Campo>
                  <Campo id="f-cpf" label="CPF"><input id="f-cpf" className={inp} value={ficha.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" /></Campo>
                  <Campo id="f-tel" label="Telefone / WhatsApp *"><input id="f-tel" className={inp} value={ficha.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(62) 90000-0000" /></Campo>
                  <Campo id="f-email" label="E-mail"><input id="f-email" type="email" className={inp} value={ficha.email} onChange={(e) => set("email", e.target.value)} /></Campo>
                  <Campo id="f-nasc" label="Data de nascimento"><input id="f-nasc" type="date" className={inp} value={ficha.dataNascimento} onChange={(e) => set("dataNascimento", e.target.value)} /></Campo>
                  <Campo id="f-cidade" label="Cidade onde mora"><input id="f-cidade" className={inp} value={ficha.cidade} onChange={(e) => set("cidade", e.target.value)} /></Campo>
                  <Campo id="f-ec" label="Estado civil">
                    <select id="f-ec" className={inp} value={ficha.estadoCivil} onChange={(e) => set("estadoCivil", e.target.value)}>
                      {["", "Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"].map((v) => <option key={v} value={v}>{v || "Selecione"}</option>)}
                    </select>
                  </Campo>
                  <Campo id="f-prof" label="Profissão"><input id="f-prof" className={inp} value={ficha.profissao} onChange={(e) => set("profissao", e.target.value)} /></Campo>
                  <Campo id="f-renda" label="Renda familiar mensal"><CurrencyInput id="f-renda" className={inp} value={ficha.rendaFamiliar || ""} onChange={(v) => set("rendaFamiliar", v)} /></Campo>
                  <Campo id="f-como" label="Como conheceu" className="md:col-span-2">
                    <select id="f-como" className={inp} value={ficha.comoConheceu} onChange={(e) => set("comoConheceu", e.target.value)}>
                      {["", "Indicação", "Instagram / Facebook", "WhatsApp", "Placa / outdoor", "Site", "Plantão / visita", "Outro"].map((v) => <option key={v} value={v}>{v || "Selecione"}</option>)}
                    </select>
                  </Campo>
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Interesse no loteamento</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Campo id="f-qtd" label="Quantidade de lotes"><input id="f-qtd" type="number" min={1} className={inp} value={ficha.quantidadeLotes || ""} onChange={(e) => set("quantidadeLotes", parseInt(e.target.value) || 1)} /></Campo>
                  <Campo id="f-fin" label="Finalidade">
                    <select id="f-fin" className={inp} value={ficha.finalidade} onChange={(e) => set("finalidade", e.target.value)}>
                      {["Moradia", "Investimento", "Construir para vender", "Comércio"].map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </Campo>
                  <Campo id="f-pag" label="Forma de pagamento">
                    <select id="f-pag" className={inp} value={ficha.formaPagamento} onChange={(e) => set("formaPagamento", e.target.value)}>
                      {["Parcelado direto com a loteadora", "À vista", "Financiamento bancário"].map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </Campo>
                  <Campo id="f-pref" label="Preferência de lote (tamanho, posição, esquina...)" className="md:col-span-3"><input id="f-pref" className={inp} value={ficha.preferenciaLote} onChange={(e) => set("preferenciaLote", e.target.value)} /></Campo>
                  <Campo id="f-ent" label="Entrada disponível"><CurrencyInput id="f-ent" className={inp} value={ficha.entradaDisponivel || ""} onChange={(v) => set("entradaDisponivel", v)} /></Campo>
                  <Campo id="f-parc" label="Parcela que cabe no orçamento"><CurrencyInput id="f-parc" className={inp} value={ficha.parcelaPretendida || ""} onChange={(v) => set("parcelaPretendida", v)} /></Campo>
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Atendimento</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Campo id="f-cor" label="Corretor responsável"><input id="f-cor" className={inp} value={ficha.corretor} onChange={(e) => set("corretor", e.target.value)} /></Campo>
                  <Campo id="f-st" label="Situação">
                    <select id="f-st" className={inp} value={ficha.status} onChange={(e) => set("status", e.target.value)}>
                      {STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </Campo>
                  <Campo id="f-obs" label="Observações" className="md:col-span-3">
                    <textarea id="f-obs" rows={3} className={`${inp} h-auto py-2`} value={ficha.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
                  </Campo>
                </div>
              </section>
            </div>

            <div className="px-5 py-4 border-t border-zinc-200 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setFicha(null)} className="h-10 px-4 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-100">Cancelar</button>
              <button type="button" onClick={salvar} disabled={salvando} className="h-10 px-5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold disabled:opacity-60">
                {salvando ? "Salvando…" : ficha.id ? "Salvar alterações" : "Cadastrar interessado"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!excluir}
        title="Excluir cadastro"
        message={`Excluir o cadastro de ${excluir?.nome || ""}? Essa ação não pode ser desfeita.`}
        confirmText="Excluir cadastro"
        cancelText="Manter"
        confirmColor="red"
        onConfirm={confirmarExcluir}
        onCancel={() => setExcluir(null)}
      />
    </div>
  );
};
