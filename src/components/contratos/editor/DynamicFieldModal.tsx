import React, { useState } from "react";
import { 
  X, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  Building, 
  User, 
  DollarSign, 
  Calendar, 
  ShieldCheck, 
  MapPin,
  Sparkles,
  HelpCircle
} from "lucide-react";
import { ContratoLocacao, GuaranteeType } from "../types/contractTypes";

interface DynamicFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: ContratoLocacao;
  onUpdateContractData: (updatedFields: Partial<ContratoLocacao>) => void;
}

export const DynamicFieldModal: React.FC<DynamicFieldModalProps> = ({
  isOpen,
  onClose,
  contract,
  onUpdateContractData
}) => {
  const [activeTab, setActiveTab] = useState<"imovel" | "locador" | "locatario" | "fiador" | "comercial">("comercial");

  // Local state for editing form
  const [imovel, setImovel] = useState(contract.imovel || ({} as any));
  const [locador, setLocador] = useState(contract.locador || ({} as any));
  const [locatario, setLocatario] = useState(contract.locatarios?.[0] || ({} as any));
  const [fiador, setFiador] = useState(contract.fiadores?.[0] || ({} as any));
  const [condicoes, setCondicoes] = useState(contract.condicoes || ({} as any));

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateContractData({
      imovel,
      locador,
      locatarios: [locatario],
      fiadores: condicoes.modalidadeGarantia === "fiador" ? [fiador] : [],
      condicoes
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Campos Dinâmicos e Cadastro do Contrato
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Altere os dados cadastrais para atualizar automaticamente todas as variáveis vinculadas no texto.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 gap-2 bg-white">
          <button
            onClick={() => setActiveTab("comercial")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "comercial"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Condições & Valores
          </button>

          <button
            onClick={() => setActiveTab("imovel")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "imovel"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building className="w-4 h-4" />
            Dados do Imóvel
          </button>

          <button
            onClick={() => setActiveTab("locatario")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "locatario"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <User className="w-4 h-4" />
            Locatário (Inquilino)
          </button>

          <button
            onClick={() => setActiveTab("locador")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "locador"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <User className="w-4 h-4" />
            Locador (Proprietário)
          </button>

          <button
            onClick={() => setActiveTab("fiador")}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "fiador"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Fiador / Garantia
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs">
          {/* TAB 1: COMERCIAL */}
          {activeTab === "comercial" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Valor do Aluguel (R$)*</label>
                <input
                  type="number"
                  value={condicoes.valorAluguel || 0}
                  onChange={(e) => setCondicoes({ ...condicoes, valorAluguel: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Dia do Vencimento*</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={condicoes.diaVencimento || 10}
                  onChange={(e) => setCondicoes({ ...condicoes, diaVencimento: parseInt(e.target.value) || 10 })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Índice de Reajuste*</label>
                <select
                  value={condicoes.indiceReajuste || "IPCA"}
                  onChange={(e) => setCondicoes({ ...condicoes, indiceReajuste: e.target.value as any })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                >
                  <option value="IPCA">IPCA (IBGE)</option>
                  <option value="IGP-M">IGP-M (FGV)</option>
                  <option value="INPC">INPC (IBGE)</option>
                  <option value="FIPE-ZAP">FIPE-ZAP</option>
                  <option value="FIXO">Valor Fixo sem reajuste</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Prazo em Meses*</label>
                <input
                  type="number"
                  value={condicoes.prazoMeses || 30}
                  onChange={(e) => setCondicoes({ ...condicoes, prazoMeses: parseInt(e.target.value) || 30 })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Data Início (Posse)*</label>
                <input
                  type="date"
                  value={condicoes.dataInicio || ""}
                  onChange={(e) => setCondicoes({ ...condicoes, dataInicio: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Data Término*</label>
                <input
                  type="date"
                  value={condicoes.dataTermino || ""}
                  onChange={(e) => setCondicoes({ ...condicoes, dataTermino: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Modalidade de Garantia*</label>
                <select
                  value={condicoes.modalidadeGarantia || "caucao"}
                  onChange={(e) => setCondicoes({ ...condicoes, modalidadeGarantia: e.target.value as GuaranteeType })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                >
                  <option value="caucao">Caução em Dinheiro (até 3 meses)</option>
                  <option value="fiador">Fiador Solidário</option>
                  <option value="credpago">CredPago / Fiança Digital</option>
                  <option value="seguro_fianca">Seguro Fiança Locatícia</option>
                  <option value="titulo_capitalizacao">Título de Capitalização</option>
                  <option value="sem_garantia">Sem Garantia</option>
                </select>
              </div>

              {condicoes.modalidadeGarantia === "caucao" && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Valor da Caução (R$)</label>
                  <input
                    type="number"
                    value={condicoes.valorGarantia || condicoes.valorAluguel * 3}
                    onChange={(e) => setCondicoes({ ...condicoes, valorGarantia: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">Multa por Atraso (%)</label>
                <input
                  type="number"
                  value={condicoes.multaAtrasoPercent ?? 10}
                  onChange={(e) => setCondicoes({ ...condicoes, multaAtrasoPercent: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Seguro Incêndio Anual (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={condicoes.seguroIncendioAnual || ""}
                  onChange={(e) => setCondicoes({ ...condicoes, seguroIncendioAnual: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Comarca do Foro</label>
                <input
                  type="text"
                  value={condicoes.cidadeForo || "Goiânia"}
                  onChange={(e) => setCondicoes({ ...condicoes, cidadeForo: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Estado do Foro (UF)</label>
                <input
                  type="text"
                  value={condicoes.estadoForo || "Goiás"}
                  onChange={(e) => setCondicoes({ ...condicoes, estadoForo: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>
          )}

          {/* TAB 2: IMÓVEL */}
          {activeTab === "imovel" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Logradouro / Endereço*</label>
                <input
                  type="text"
                  value={imovel.endereco || ""}
                  onChange={(e) => setImovel({ ...imovel, endereco: e.target.value })}
                  placeholder="Ex: Av. T-63"
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Número</label>
                <input
                  type="text"
                  value={imovel.numero || ""}
                  onChange={(e) => setImovel({ ...imovel, numero: e.target.value })}
                  placeholder="Ex: 1200"
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Complemento / Apto</label>
                <input
                  type="text"
                  value={imovel.complemento || ""}
                  onChange={(e) => setImovel({ ...imovel, complemento: e.target.value })}
                  placeholder="Ex: Apto 504, Bloco B"
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Bairro*</label>
                <input
                  type="text"
                  value={imovel.bairro || ""}
                  onChange={(e) => setImovel({ ...imovel, bairro: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">CEP</label>
                <input
                  type="text"
                  value={imovel.cep || ""}
                  onChange={(e) => setImovel({ ...imovel, cep: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Cidade*</label>
                <input
                  type="text"
                  value={imovel.cidade || "Goiânia"}
                  onChange={(e) => setImovel({ ...imovel, cidade: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Estado (UF)</label>
                <input
                  type="text"
                  value={imovel.estado || "GO"}
                  onChange={(e) => setImovel({ ...imovel, estado: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Tipo de Imóvel</label>
                <input
                  type="text"
                  value={imovel.tipoImovel || "Apartamento Residencial"}
                  onChange={(e) => setImovel({ ...imovel, tipoImovel: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Vagas de Garagem</label>
                <input
                  type="text"
                  value={imovel.vagasGaragem || ""}
                  onChange={(e) => setImovel({ ...imovel, vagasGaragem: e.target.value })}
                  placeholder="Ex: 02 vagas cobertas (nº 12 e 13)"
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Matrícula no Cartório</label>
                <input
                  type="text"
                  value={imovel.matricula || ""}
                  onChange={(e) => setImovel({ ...imovel, matricula: e.target.value })}
                  placeholder="Ex: 124.589"
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>
          )}

          {/* TAB 3: LOCATÁRIO */}
          {activeTab === "locatario" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Nome Completo do Locatário*</label>
                <input
                  type="text"
                  value={locatario.nome || ""}
                  onChange={(e) => setLocatario({ ...locatario, nome: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">CPF/CNPJ*</label>
                <input
                  type="text"
                  value={locatario.cpfCnpj || ""}
                  onChange={(e) => setLocatario({ ...locatario, cpfCnpj: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">RG</label>
                <input
                  type="text"
                  value={locatario.rg || ""}
                  onChange={(e) => setLocatario({ ...locatario, rg: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nacionalidade</label>
                <input
                  type="text"
                  value={locatario.nacionalidade || "brasileiro(a)"}
                  onChange={(e) => setLocatario({ ...locatario, nacionalidade: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Estado Civil</label>
                <input
                  type="text"
                  value={locatario.estadoCivil || "solteiro(a)"}
                  onChange={(e) => setLocatario({ ...locatario, estadoCivil: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Profissão</label>
                <input
                  type="text"
                  value={locatario.profissao || ""}
                  onChange={(e) => setLocatario({ ...locatario, profissao: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">E-mail</label>
                <input
                  type="email"
                  value={locatario.email || ""}
                  onChange={(e) => setLocatario({ ...locatario, email: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={locatario.telefone || ""}
                  onChange={(e) => setLocatario({ ...locatario, telefone: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-slate-700 font-bold mb-1">Endereço Atual do Locatário</label>
                <input
                  type="text"
                  value={locatario.endereco || ""}
                  onChange={(e) => setLocatario({ ...locatario, endereco: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>
          )}

          {/* TAB 4: LOCADOR */}
          {activeTab === "locador" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Nome Completo do Locador*</label>
                <input
                  type="text"
                  value={locador.nome || ""}
                  onChange={(e) => setLocador({ ...locador, nome: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">CPF/CNPJ*</label>
                <input
                  type="text"
                  value={locador.cpfCnpj || ""}
                  onChange={(e) => setLocador({ ...locador, cpfCnpj: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">RG</label>
                <input
                  type="text"
                  value={locador.rg || ""}
                  onChange={(e) => setLocador({ ...locador, rg: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Estado Civil</label>
                <input
                  type="text"
                  value={locador.estadoCivil || "casado(a)"}
                  onChange={(e) => setLocador({ ...locador, estadoCivil: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Profissão</label>
                <input
                  type="text"
                  value={locador.profissao || ""}
                  onChange={(e) => setLocador({ ...locador, profissao: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Endereço do Locador</label>
                <input
                  type="text"
                  value={locador.endereco || ""}
                  onChange={(e) => setLocador({ ...locador, endereco: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Chave PIX do Locador</label>
                <input
                  type="text"
                  value={locador.pix || ""}
                  onChange={(e) => setLocador({ ...locador, pix: e.target.value })}
                  placeholder="Para repasse do aluguel"
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>
          )}

          {/* TAB 5: FIADOR */}
          {activeTab === "fiador" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Nome Completo do Fiador</label>
                <input
                  type="text"
                  value={fiador.nome || ""}
                  onChange={(e) => setFiador({ ...fiador, nome: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">CPF do Fiador</label>
                <input
                  type="text"
                  value={fiador.cpfCnpj || ""}
                  onChange={(e) => setFiador({ ...fiador, cpfCnpj: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">RG do Fiador</label>
                <input
                  type="text"
                  value={fiador.rg || ""}
                  onChange={(e) => setFiador({ ...fiador, rg: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nome do Cônjuge Anuente</label>
                <input
                  type="text"
                  value={fiador.conjugeNome || ""}
                  onChange={(e) => setFiador({ ...fiador, conjugeNome: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">CPF do Cônjuge</label>
                <input
                  type="text"
                  value={fiador.conjugeCpf || ""}
                  onChange={(e) => setFiador({ ...fiador, conjugeCpf: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>As variáveis do documento serão sincronizadas imediatamente.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              Atualizar Documento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
