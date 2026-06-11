import React, { useState } from 'react';
import { 
  Tag, 
  Plus, 
  Trash2, 
  Edit2,
  Palette,
  Check,
  FolderOpen,
  Home,
  Briefcase,
  TrendingUp,
  Pin,
  HelpCircle
} from 'lucide-react';
import { FinancialCategory } from '../../types';
import { ConfirmModal } from '../ui/ConfirmModal';

interface CategoriasTabProps {
  categories: FinancialCategory[];
  onAddCategory: (
    name: string,
    type: 'RECEITA' | 'DESPESA',
    group: string,
    color: string,
    icon: string,
    grupo: 'locacao' | 'caixa',
    natureza: 'entrada' | 'saida',
    comportamento: 'fixo' | 'variavel' | 'nao_aplicavel',
    origem: 'locacao' | 'venda' | 'administracao' | 'servicos' | 'outros'
  ) => void;
  onDeleteCategory: (id: string) => void;
  onUpdateCategory?: (
    id: string,
    name: string,
    group: string,
    color: string,
    grupo: 'locacao' | 'caixa',
    natureza: 'entrada' | 'saida',
    comportamento: 'fixo' | 'variavel' | 'nao_aplicavel',
    origem: 'locacao' | 'venda' | 'administracao' | 'servicos' | 'outros'
  ) => void;
}

export const CategoriasTab: React.FC<CategoriasTabProps> = ({
  categories,
  onAddCategory,
  onDeleteCategory,
  onUpdateCategory
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);
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

  // Base state for new category
  const [nomeForm, setNomeForm] = useState('');
  const [grupoForm, setGrupoForm] = useState<'locacao' | 'caixa'>('locacao');
  const [naturezaForm, setNaturezaForm] = useState<'entrada' | 'saida'>('entrada');
  const [comportamentoForm, setComportamentoForm] = useState<'fixo' | 'variavel' | 'nao_aplicavel'>('nao_aplicavel');
  const [origemForm, setOrigemForm] = useState<'locacao' | 'venda' | 'administracao' | 'servicos' | 'outros'>('locacao');
  const [colorForm, setColorForm] = useState('#059669');

  // Base state for editing category
  const [editNome, setEditNome] = useState('');
  const [editGrupo, setEditGrupo] = useState<'locacao' | 'caixa'>('locacao');
  const [editNatureza, setEditNatureza] = useState<'entrada' | 'saida'>('entrada');
  const [editComportamento, setEditComportamento] = useState<'fixo' | 'variavel' | 'nao_aplicavel'>('nao_aplicavel');
  const [editOrigem, setEditOrigem] = useState<'locacao' | 'venda' | 'administracao' | 'servicos' | 'outros'>('locacao');
  const [editColor, setEditColor] = useState('#059669');

  const sampleColors = [
    '#059669', // Verde Esmeralda (Locações/Receita)
    '#0d9488', // Teal
    '#2563eb', // Azul Royal
    '#4f46e5', // Indigo
    '#0891b2', // Cyan
    '#e11d48', // Vermelho Escuro (Saídas/Repasses)
    '#dd2727', // Vermelho Puro
    '#ea580c', // Laranja
    '#d97706', // Amber (Tráfego, Combustível, etc)
    '#7c3aed', // Roxo (Manutenções)
    '#db2777', // Rosa
    '#64748b', // Slate Fixo
    '#475569', // Slate Forte
    '#1e293b'  // Dark Slate
  ];

  // Helper when changing natureza in add form
  const handleNaturezaChange = (val: 'entrada' | 'saida') => {
    setNaturezaForm(val);
    if (val === 'entrada') {
      setComportamentoForm('nao_aplicavel');
    } else {
      setComportamentoForm('fixo');
    }
  };

  // Helper when changing natureza in edit form
  const handleEditNaturezaChange = (val: 'entrada' | 'saida') => {
    setEditNatureza(val);
    if (val === 'entrada') {
      setEditComportamento('nao_aplicavel');
    } else {
      setEditComportamento('fixo');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeForm) return;

    // Map new fields to compatible types
    const legacyType = naturezaForm === 'entrada' ? 'RECEITA' : 'DESPESA';
    const legacyGroup = grupoForm === 'locacao' ? 'Locações' : 'Caixa';

    // Submit
    onAddCategory(
      nomeForm,
      legacyType,
      legacyGroup,
      colorForm,
      'Tag',
      grupoForm,
      naturezaForm,
      comportamentoForm,
      origemForm
    );

    // Reset Form
    setNomeForm('');
    setIsAddOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editNome) return;

    const legacyGroup = editGrupo === 'locacao' ? 'Locações' : 'Caixa';

    if (onUpdateCategory) {
      onUpdateCategory(
        editingCategory.id,
        editNome,
        legacyGroup,
        editColor,
        editGrupo,
        editNatureza,
        editComportamento,
        editOrigem
      );
    }
    setEditingCategory(null);
  };

  // Human readables translations
  const behaviorLabels = {
    fixo: "📌 Custo Fixo",
    variavel: "📈 Custo Variável",
    nao_aplicavel: "N/A"
  };

  const originLabels = {
    locacao: "Locação",
    venda: "Venda",
    administracao: "Administração",
    servicos: "Serviços",
    outros: "Outros"
  };

  // Filter Categories visually
  const locacoesEntradas = categories.filter(c => c.grupo === 'locacao' && c.natureza === 'entrada');
  const locacoesSaidas = categories.filter(c => c.grupo === 'locacao' && c.natureza === 'saida');

  const caixaEntradas = categories.filter(c => c.grupo === 'caixa' && c.natureza === 'entrada');
  const caixaSaidasFixas = categories.filter(c => c.grupo === 'caixa' && c.natureza === 'saida' && c.comportamento === 'fixo');
  const caixaSaidasVariaveis = categories.filter(c => c.grupo === 'caixa' && c.natureza === 'saida' && c.comportamento === 'variavel');

  // Helper to render beautiful rows
  const renderCategoryRaw = (cat: FinancialCategory) => (
    <div key={cat.id} className="flex justify-between items-center px-4 py-3 hover:bg-slate-50 transition-colors group">
      <div className="flex items-center gap-3">
        <div 
          className="w-3.5 h-3.5 rounded-full border border-white shrink-0 shadow-sm" 
          style={{ backgroundColor: cat.color || '#475569' }} 
        />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-800 leading-tight">
            {cat.nome || cat.name}
          </span>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
            Origem: {originLabels[cat.origem] || 'Outros'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {cat.comportamento && cat.comportamento !== 'nao_aplicavel' && (
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${cat.comportamento === 'fixo' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}`}>
            {cat.comportamento === 'fixo' ? 'FIXO' : 'VARIÁVEL'}
          </span>
        )}
        {cat.isDefault ? (
          <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-500 font-black text-[8px] uppercase tracking-wider rounded-md">
            Padrão
          </span>
        ) : (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => {
                setEditingCategory(cat);
                setEditNome(cat.nome || cat.name);
                setEditGrupo(cat.grupo || 'locacao');
                setEditNatureza(cat.natureza || 'entrada');
                setEditComportamento(cat.comportamento || 'nao_aplicavel');
                setEditOrigem(cat.origem || 'locacao');
                setEditColor(cat.color || '#059669');
              }}
              className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
              title="Editar"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setConfirmState({
                  open: true,
                  title: "Remover categoria",
                  message: `Deseja realmente remover a categoria personalizada "${cat.nome || cat.name}"? Esta ação não pode ser desfeita.`,
                  confirmColor: "red",
                  onConfirm: () => {
                    setConfirmState(prev => ({ ...prev, open: false }));
                    onDeleteCategory(cat.id);
                  }
                });
              }}
              className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors"
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight">Categorias Financeiras</h2>
          <p className="text-xs text-slate-500">Fluxos de classificação personalizados para estruturação do DRE Gerencial imobiliário.</p>
        </div>
        <button
          onClick={() => {
            setNomeForm('');
            setGrupoForm('locacao');
            setNaturezaForm('entrada');
            setComportamentoForm('nao_aplicavel');
            setOrigemForm('locacao');
            setColorForm('#059669');
            setIsAddOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-blue-500/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nova Categoria
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn pb-12">
        {/* 🏠 GRUPO LOCAÇÕES */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                <Home className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase leading-tight">
                  🏠 Locações
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Operações correlatas ao fluxo de locação</p>
              </div>
            </div>

            {/* Subgrupo: Entradas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-teal-600 uppercase tracking-widest bg-teal-50 px-2 py-0.5 rounded-md">📥 Entradas</span>
                <span className="text-[10px] font-bold text-slate-400 font-mono">({locacoesEntradas.length})</span>
              </div>
              <div className="bg-slate-50/50 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {locacoesEntradas.length === 0 ? (
                  <p className="p-4 text-[10px] text-slate-400 font-black uppercase text-center">Nenhuma categoria cadastrada</p>
                ) : (
                  locacoesEntradas.map(cat => renderCategoryRaw(cat))
                )}
              </div>
            </div>

            {/* Subgrupo: Saídas */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-2 py-0.5 rounded-md">📤 Saídas</span>
                <span className="text-[10px] font-bold text-slate-400 font-mono">({locacoesSaidas.length})</span>
              </div>
              <div className="bg-slate-50/50 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {locacoesSaidas.length === 0 ? (
                  <p className="p-4 text-[10px] text-slate-400 font-black uppercase text-center">Nenhuma categoria cadastrada</p>
                ) : (
                  locacoesSaidas.map(cat => renderCategoryRaw(cat))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 💼 GRUPO CAIXA */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <Briefcase className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase leading-tight">
                💼 Caixa Imobiliária
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Operações administrativas e fluxo direto corporativo</p>
            </div>
          </div>

          {/* Subgrupo: Entradas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">📥 Entradas</span>
              <span className="text-[10px] font-bold text-slate-400 font-mono">({caixaEntradas.length})</span>
            </div>
            <div className="bg-slate-50/50 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              {caixaEntradas.length === 0 ? (
                <p className="p-4 text-[10px] text-slate-400 font-black uppercase text-center">Nenhuma categoria cadastrada</p>
              ) : (
                caixaEntradas.map(cat => renderCategoryRaw(cat))
              )}
            </div>
          </div>

          {/* Subgrupo: Saídas Fixas */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md">📌 Saídas Fixas</span>
              <span className="text-[10px] font-bold text-slate-400 font-mono">({caixaSaidasFixas.length})</span>
            </div>
            <div className="bg-slate-50/50 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              {caixaSaidasFixas.length === 0 ? (
                <p className="p-4 text-[10px] text-slate-400 font-black uppercase text-center">Nenhuma categoria cadastrada</p>
              ) : (
                caixaSaidasFixas.map(cat => renderCategoryRaw(cat))
              )}
            </div>
          </div>

          {/* Subgrupo: Saídas Variáveis */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md">📈 Saídas Variáveis</span>
              <span className="text-[10px] font-bold text-slate-400 font-mono">({caixaSaidasVariaveis.length})</span>
            </div>
            <div className="bg-slate-50/50 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              {caixaSaidasVariaveis.length === 0 ? (
                <p className="p-4 text-[10px] text-slate-400 font-black uppercase text-center">Nenhuma categoria cadastrada</p>
              ) : (
                caixaSaidasVariaveis.map(cat => renderCategoryRaw(cat))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nova Categoria */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddOpen(false)} />
          <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="px-8 pt-8 pb-4 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-md font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                <Tag className="w-5 h-5 text-blue-500" /> Nova Categoria
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Adicione uma nova classificação ao seu DRE</p>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              {/* Form Body - scrollable */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nome da Categoria</label>
                  <input
                    type="text"
                    placeholder="Ex: Auditorias, Portais Pagos"
                    value={nomeForm}
                    onChange={(e) => setNomeForm(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold"
                    required
                  />
                </div>

                {/* Grupo */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Grupo Visual</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGrupoForm('locacao')}
                      className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${grupoForm === 'locacao' ? 'border-teal-500 bg-teal-50 text-teal-700 font-black' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'}`}
                    >
                      <Home className="w-3.5 h-3.5" />
                      Locações
                    </button>
                    <button
                      type="button"
                      onClick={() => setGrupoForm('caixa')}
                      className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${grupoForm === 'caixa' ? 'border-blue-500 bg-blue-50 text-blue-700 font-black' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'}`}
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      Caixa
                    </button>
                  </div>
                </div>

                {/* Natureza */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Natureza</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleNaturezaChange('entrada')}
                      className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${naturezaForm === 'entrada' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-black' : 'border-slate-200 text-slate-600 bg-white'}`}
                    >
                      📥 Entrada
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNaturezaChange('saida')}
                      className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${naturezaForm === 'saida' ? 'border-rose-500 bg-rose-50 text-rose-700 font-black' : 'border-slate-200 text-slate-600 bg-white'}`}
                    >
                      📤 Saída
                    </button>
                  </div>
                </div>

                {/* Comportamento (only visible if Saida) */}
                {naturezaForm === 'saida' && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Comportamento</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setComportamentoForm('fixo')}
                        className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${comportamentoForm === 'fixo' ? 'border-amber-500 bg-amber-50 text-amber-700 font-black' : 'border-slate-200 text-slate-600 bg-white'}`}
                      >
                        📌 Custo Fixo
                      </button>
                      <button
                        type="button"
                        onClick={() => setComportamentoForm('variavel')}
                        className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${comportamentoForm === 'variavel' ? 'border-purple-500 bg-purple-50 text-purple-700 font-black' : 'border-slate-200 text-slate-600 bg-white'}`}
                      >
                        📈 Custo Variável
                      </button>
                    </div>
                  </div>
                )}

                {/* Origem */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Origem da Receita/Despesa</label>
                  <select
                    value={origemForm}
                    onChange={(e: any) => setOrigemForm(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-755 cursor-pointer"
                    required
                  >
                    <option value="locacao">Locações</option>
                    <option value="venda">Vendas</option>
                    <option value="administracao">Taxas de Administração</option>
                    <option value="servicos">Serviços e Consultorias</option>
                    <option value="outros">Outros Financiamentos</option>
                  </select>
                </div>

                {/* Cores */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5" /> Seletor de Cores
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {sampleColors.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColorForm(c)}
                        className={`w-8 h-8 rounded-full border border-white shadow-xs transition-all flex items-center justify-center relative ${colorForm === c ? 'scale-110 shadow-md ring-2 ring-blue-500/20' : 'hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                      >
                        {colorForm === c && <Check className="w-4 h-4 text-white drop-shadow-xs" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Form Footer */}
              <div className="px-8 pb-8 pt-4 border-t border-slate-100 flex-shrink-0 flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
                >
                  Salvar Nova Categoria
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all text-center cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Categoria */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingCategory(null)} />
          <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="px-8 pt-8 pb-4 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-md font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                <Edit2 className="w-5 h-5 text-blue-500" /> Editar Categoria
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Ajuste as configurações desta classificação</p>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nome da Categoria</label>
                  <input
                    type="text"
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold"
                    required
                  />
                </div>

                {/* Grupo */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Grupo Visual</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEditGrupo('locacao')}
                      className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${editGrupo === 'locacao' ? 'border-teal-500 bg-teal-50 text-teal-700 font-black' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'}`}
                    >
                      <Home className="w-3.5 h-3.5" />
                      Locações
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditGrupo('caixa')}
                      className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${editGrupo === 'caixa' ? 'border-blue-500 bg-blue-50 text-blue-700 font-black' : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'}`}
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      Caixa
                    </button>
                  </div>
                </div>

                {/* Natureza */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Natureza</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleEditNaturezaChange('entrada')}
                      className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${editNatureza === 'entrada' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-black' : 'border-slate-200 text-slate-600 bg-white'}`}
                    >
                      📥 Entrada
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditNaturezaChange('saida')}
                      className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${editNatureza === 'saida' ? 'border-rose-500 bg-rose-50 text-rose-700 font-black' : 'border-slate-200 text-slate-600 bg-white'}`}
                    >
                      📤 Saída
                    </button>
                  </div>
                </div>

                {/* Comportamento (only visible if Saida) */}
                {editNatureza === 'saida' && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Comportamento</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setEditComportamento('fixo')}
                        className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${editComportamento === 'fixo' ? 'border-amber-500 bg-amber-50 text-amber-700 font-black' : 'border-slate-200 text-slate-600 bg-white'}`}
                      >
                        📌 Custo Fixo
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditComportamento('variavel')}
                        className={`py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${editComportamento === 'variavel' ? 'border-purple-500 bg-purple-50 text-purple-700 font-black' : 'border-slate-200 text-slate-600 bg-white'}`}
                      >
                        📈 Custo Variável
                      </button>
                    </div>
                  </div>
                )}

                {/* Origem */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Origem da Receita/Despesa</label>
                  <select
                    value={editOrigem}
                    onChange={(e: any) => setEditOrigem(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-755 cursor-pointer"
                    required
                  >
                    <option value="locacao">Locações</option>
                    <option value="venda">Vendas</option>
                    <option value="administracao">Taxas de Administração</option>
                    <option value="servicos">Serviços e Consultorias</option>
                    <option value="outros">Outros Financiamentos</option>
                  </select>
                </div>

                {/* Cores */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5" /> Seletor de Cores
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {sampleColors.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className={`w-8 h-8 rounded-full border border-white shadow-xs transition-all flex items-center justify-center relative ${editColor === c ? 'scale-110 shadow-md ring-2 ring-blue-500/20' : 'hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                      >
                        {editColor === c && <Check className="w-4 h-4 text-white drop-shadow-xs" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Form Footer */}
              <div className="px-8 pb-8 pt-4 border-t border-slate-100 flex-shrink-0 flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
                >
                  Salvar Alterações
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all text-center cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
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
