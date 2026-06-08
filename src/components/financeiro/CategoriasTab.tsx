import React, { useState } from 'react';
import { 
  Tag, 
  Plus, 
  Trash2, 
  Edit2,
  Palette,
  Check,
  FolderDot
} from 'lucide-react';
import { FinancialCategory } from '../../types';

interface CategoriasTabProps {
  categories: FinancialCategory[];
  onAddCategory: (name: string, type: 'RECEITA' | 'DESPESA', group: string, color: string, icon: string) => void;
  onDeleteCategory: (id: string) => void;
  onUpdateCategory?: (id: string, name: string, group: string, color: string) => void;
}

export const CategoriasTab: React.FC<CategoriasTabProps> = ({
  categories,
  onAddCategory,
  onDeleteCategory,
  onUpdateCategory
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);

  // States for new category
  const [name, setName] = useState('');
  const [type, setType] = useState<'RECEITA' | 'DESPESA'>('RECEITA');
  const [group, setGroup] = useState('Operacional');
  const [color, setColor] = useState('#16a34a');

  // States for editing category
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editColor, setEditColor] = useState('');

  const groupsByType = {
    RECEITA: ['Operacional', 'Diversas'],
    DESPESA: ['Pessoal', 'Estrutura', 'Marketing', 'Tecnologia', 'Impostos', 'Deslocamento', 'Diversas']
  };

  const handleGroupReset = (newType: 'RECEITA' | 'DESPESA') => {
    setType(newType);
    setGroup(groupsByType[newType][0]);
    setColor(newType === 'RECEITA' ? '#16a34a' : '#dc2626');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !group) return;
    onAddCategory(name, type, group, color, 'Tag');
    setName('');
    setIsAddOpen(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editName || !editGroup) return;
    if (onUpdateCategory) {
      onUpdateCategory(editingCategory.id, editName, editGroup, editColor);
    }
    setEditingCategory(null);
  };

  const sampleColors = [
    '#16a34a', // Verde Operacional
    '#dc2626', // Vermelho Pessoal
    '#ea580c', // Laranja Estrutura
    '#7c3aed', // Roxo Marketing
    '#0284c7', // Azul Tecnologia
    '#b45309', // Amarelo Impostos
    '#0f766e', // Teal Deslocamento
    '#475569', // Slate Diversas
    '#fbbf24', // Amarelo Claro
    '#4ade80'  // Verde Claro
  ];

  // Helper to group categories
  const getGroupedCategories = (typeVal: 'RECEITA' | 'DESPESA') => {
    const list = categories.filter(c => c.type === typeVal);
    const groups: Record<string, FinancialCategory[]> = {};
    
    // Sort logically by predefined order or fallback
    const groupOrder = groupsByType[typeVal];
    groupOrder.forEach(g => {
      groups[g] = [];
    });

    list.forEach(c => {
      const g = c.group || 'Diversas';
      if (!groups[g]) {
        groups[g] = [];
      }
      groups[g].push(c);
    });

    // Remove empty groups to avoid clutter
    Object.keys(groups).forEach(k => {
      if (groups[k].length === 0) {
        delete groups[k];
      }
    });

    return groups;
  };

  const groupedReceitas = getGroupedCategories('RECEITA');
  const groupedDespesas = getGroupedCategories('DESPESA');

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-end">
        <button
          onClick={() => {
            setName('');
            setType('RECEITA');
            setGroup('Operacional');
            setColor('#16a34a');
            setIsAddOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors shadow-lg shadow-blue-500/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nova Categoria Personalizada
        </button>
      </div>

      {/* Grid de Categorias por Tipo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
        
        {/* RECEITAS */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-xs font-black text-teal-600 tracking-wider uppercase flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="w-2.5 h-2.5 bg-teal-500 rounded-full" />
            Classificações de Receita
          </h3>

          <div className="space-y-6 max-h-[600px] overflow-y-auto pr-1">
            {Object.keys(groupedReceitas).length === 0 ? (
              <p className="text-xs text-slate-400 font-bold uppercase">Nenhuma categoria de receita cadastrada.</p>
            ) : (
              Object.entries(groupedReceitas).map(([groupName, items]) => (
                <div key={groupName} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FolderDot className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{groupName}</span>
                    <span className="text-[9px] font-bold text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded-md">({items.length})</span>
                  </div>
                  <div className="bg-slate-50/50 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                    {items.map(cat => (
                      <div key={cat.id} className="flex justify-between items-center px-4 py-3 hover:bg-white transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full border border-white shrink-0 shadow-sm" style={{ backgroundColor: cat.color }} />
                          <div>
                            <span className="text-xs font-bold text-slate-700 block leading-tight">{cat.name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-bold uppercase tracking-wider">
                            {cat.group}
                          </span>
                          {cat.isDefault ? (
                            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 font-black text-[8px] uppercase tracking-wider rounded-md">
                              Padrão
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setEditName(cat.name);
                                  setEditGroup(cat.group || 'Operacional');
                                  setEditColor(cat.color);
                                }}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Deseja realmente remover a categoria "${cat.name}"?`)) {
                                    onDeleteCategory(cat.id);
                                  }
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
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* DESPESAS */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <h3 className="text-xs font-black text-rose-500 tracking-wider uppercase flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
            Classificações de Despesa
          </h3>

          <div className="space-y-6 max-h-[600px] overflow-y-auto pr-1">
            {Object.keys(groupedDespesas).length === 0 ? (
              <p className="text-xs text-slate-400 font-bold uppercase">Nenhuma categoria de despesa cadastrada.</p>
            ) : (
              Object.entries(groupedDespesas).map(([groupName, items]) => (
                <div key={groupName} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FolderDot className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{groupName}</span>
                    <span className="text-[9px] font-bold text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded-md">({items.length})</span>
                  </div>
                  <div className="bg-slate-50/50 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                    {items.map(cat => (
                      <div key={cat.id} className="flex justify-between items-center px-4 py-3 hover:bg-white transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full border border-white shrink-0 shadow-sm" style={{ backgroundColor: cat.color }} />
                          <div>
                            <span className="text-xs font-bold text-slate-700 block leading-tight">{cat.name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-bold uppercase tracking-wider">
                            {cat.group}
                          </span>
                          {cat.isDefault ? (
                            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 font-black text-[8px] uppercase tracking-wider rounded-md">
                              Padrão
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setEditName(cat.name);
                                  setEditGroup(cat.group || 'Pessoal');
                                  setEditColor(cat.color);
                                }}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Deseja realmente remover a categoria "${cat.name}"?`)) {
                                    onDeleteCategory(cat.id);
                                  }
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
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Modal Nova Categoria */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddOpen(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header fixo */}
            <div className="px-8 pt-8 pb-4 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-md font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                <Tag className="w-5 h-5 text-blue-500" /> Nova Categoria
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Crie agrupamentos personalizados de relatórios</p>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden font-sans">
              {/* Conteúdo rolável */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => handleGroupReset('RECEITA')}
                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${type === 'RECEITA' ? 'bg-white text-emerald-600 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Receita
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGroupReset('DESPESA')}
                    className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${type === 'DESPESA' ? 'bg-white text-rose-500 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Despesa
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nome da Categoria</label>
                  <input
                    type="text"
                    placeholder="Ex: Consultorias, Manutenção Predial"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Agrupamento Corporativo / Grupo</label>
                  <select
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-755 cursor-pointer"
                    required
                  >
                    {groupsByType[type].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5" /> Seletor de Cores
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {sampleColors.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-8 h-8 rounded-full border border-white shadow-sm transition-transform flex items-center justify-center relative ${color === c ? 'scale-110 shadow-md ring-2 ring-blue-500/20' : 'hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                      >
                        {color === c && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rodapé fixo */}
              <div className="px-8 pb-8 pt-4 border-t border-slate-100 flex-shrink-0 flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
                >
                  Salvar Categoria
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all text-center cursor-pointer"
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
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-fadeIn">
            {/* Header fixo */}
            <div className="px-8 pt-8 pb-4 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-md font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                <Edit2 className="w-5 h-5 text-blue-500" /> Editar Categoria
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Ajuste as configurações desta categoria personalizada</p>
            </div>

            <form onSubmit={handleEditSubmit} className="flex-1 flex flex-col overflow-hidden font-sans">
              {/* Conteúdo rolável */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nome da Categoria</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Agrupamento Corporativo / Grupo</label>
                  <select
                    value={editGroup}
                    onChange={(e) => setEditGroup(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-755 cursor-pointer"
                    required
                  >
                    {groupsByType[editingCategory.type].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5" /> Seletor de Cores
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {sampleColors.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className={`w-8 h-8 rounded-full border border-white shadow-sm transition-transform flex items-center justify-center relative ${editColor === c ? 'scale-110 shadow-md ring-2 ring-blue-500/20' : 'hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                      >
                        {editColor === c && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rodapé fixo */}
              <div className="px-8 pb-8 pt-4 border-t border-slate-100 flex-shrink-0 flex flex-col gap-3">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-[#10px] shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-all hover:scale-[1.01] active:scale-95 cursor-pointer"
                >
                  Salvar Alterações
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all text-center cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
