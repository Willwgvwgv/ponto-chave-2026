import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  Camera, 
  Check, 
  X, 
  Trash2, 
  Edit2, 
  Download, 
  ChevronRight, 
  ChevronLeft,
  Home,
  User,
  MapPin,
  Briefcase,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Save,
  Printer,
  Upload,
  Settings
} from 'lucide-react';
import { 
  db, 
  auth, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  limit
} from '../firebase';
import { Vistoria, ComodoVistoria, ItemVistoria, CompanySettings, LocatarioVistoria } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { printVistoriaHTML } from '../utils/vistoriaHtmlTemplate';

const COMODOS_PADRAO = [
  { nome: 'QUARTOS', itens: ['Portas', 'Janelas', 'Piso', 'Pintura', 'Instalações Elétricas', 'Móveis Planejados', 'Ar Condicionado'] },
  { nome: 'BANHEIROS', itens: ['Portas', 'Janelas', 'Piso', 'Revestimento', 'Instalações Elétricas', 'Registros e Metais', 'Vaso Sanitário', 'Bancadas de Granito', 'Box de Vidro', 'Instalações Hidráulicas'] },
  { nome: 'SALA', itens: ['Portas', 'Janelas', 'Piso', 'Pintura', 'Instalações Elétricas', 'Rodapés'] },
  { nome: 'COZINHA', itens: ['Portas', 'Janelas', 'Piso', 'Revestimento', 'Instalações Elétricas', 'Registros e Metais', 'Bancadas', 'Móveis Planejados', 'Pia e Sifão', 'Instalações Hidráulicas'] },
  { nome: 'LAVANDERIA', itens: ['Portas', 'Janelas', 'Piso', 'Revestimento', 'Registros e Metais', 'Instalações Hidráulicas', 'Pia/Tanque'] },
  { nome: 'SACADA / VARANDA', itens: ['Piso', 'Guarda-corpo', 'Pintura', 'Instalações Elétricas', 'Piso e Revestimento'] },
  { nome: 'QUINTAL / ÁREA EXTERNA', itens: ['Piso', 'Pintura Externa', 'Instalações Elétricas Externas', 'Muros', 'Portões'] },
  { nome: 'GARAGEM', itens: ['Piso', 'Pintura', 'Portão Eletrônico', 'Instalações Elétricas'] },
  { nome: 'OUTROS / PERSONALIZADO', itens: ['Geral'] }
];

interface VistoriaViewProps {
  isAdmin: boolean;
  user: any;
}

export const VistoriaView = ({ isAdmin, user, profile, companySettings }: { isAdmin: boolean; user: any; profile: any; companySettings: CompanySettings | null }) => {
  const [vistorias, setVistorias] = useState<Vistoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isAddingComodo, setIsAddingComodo] = useState(false);
  const [newComodoName, setNewComodoName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(COMODOS_PADRAO[0].nome);
  const [editingVistoria, setEditingVistoria] = useState<Vistoria | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusVistoria, setStatusVistoria] = useState<"Agendada" | "Em Andamento" | "Aguardando Laudo" | "Concluída" | "Cancelada">("Agendada");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("Todos");
  
  // Brand Config State
  const [brandName, setBrandName] = useState(companySettings?.name || '');
  const [brandSubtitle, setBrandSubtitle] = useState(companySettings?.subtitle || '');
  const [brandLogo, setBrandLogo] = useState(companySettings?.logoUrl || '');
  const [brandAddress, setBrandAddress] = useState(companySettings?.address || '');
  const [brandPhone, setBrandPhone] = useState(companySettings?.phone || '');
  const [brandEmail, setBrandEmail] = useState(companySettings?.email || '');
  const [brandWebsite, setBrandWebsite] = useState(companySettings?.website || '');
  const [brandCreci, setBrandCreci] = useState(companySettings?.creci || '');
  const [brandCnpj, setBrandCnpj] = useState(companySettings?.cnpj || '');
  const [brandCity, setBrandCity] = useState(companySettings?.city || 'Aparecida de Goiânia');
  const [brandState, setBrandState] = useState(companySettings?.state || 'GO');
  const [brandDefaultTexto, setBrandDefaultTexto] = useState('');
  const [brandDefaultTextoLaudo, setBrandDefaultTextoLaudo] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    if (companySettings) {
      setBrandName(companySettings.name);
      setBrandSubtitle(companySettings.subtitle);
      setBrandLogo(companySettings.logoUrl || '');
      setBrandAddress(companySettings.address || '');
      setBrandPhone(companySettings.phone || '');
      setBrandEmail(companySettings.email || '');
      setBrandWebsite(companySettings.website || '');
      setBrandCreci(companySettings.creci || '');
      setBrandCnpj(companySettings.cnpj || '');
      setBrandCity(companySettings.city || 'Bela Vista de Goiás');
      setBrandState(companySettings.state || 'GO');
      setBrandDefaultTexto(companySettings.defaultTextoContrato || '');
      setBrandDefaultTextoLaudo(companySettings.defaultTextoLaudo || '');
      
      if (!editingVistoria && !isCreating) {
        setLocador({
          nome: companySettings.name || 'FIDELITÉ NEGÓCIOS IMOBILIÁRIOS LTDA',
          cnpj: companySettings.cnpj || '',
          endereco: companySettings.address || ''
        });
      }
    }
  }, [companySettings]);

  const handleSaveConfig = async () => {
    if (!isAdmin) return;
    setIsSavingConfig(true);
    try {
      if (companySettings?.id) {
        await updateDoc(doc(db, "companies", companySettings.id), {
          name: brandName,
          subtitle: brandSubtitle,
          logoUrl: brandLogo,
          address: brandAddress,
          phone: brandPhone,
          email: brandEmail,
          website: brandWebsite,
          creci: brandCreci,
          cnpj: brandCnpj,
          city: brandCity,
          state: brandState,
          defaultTextoContrato: brandDefaultTexto,
          defaultTextoLaudo: brandDefaultTextoLaudo,
          updatedAt: serverTimestamp()
        });
        toast.success("Branding da vistoria atualizado com sucesso!");
        setIsConfigOpen(false);
      }
    } catch (error) {
      toast.error("Erro ao salvar configurações de marca.");
      console.error(error);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error("Logo muito grande. Use arquivos menores que 1.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setBrandLogo(reader.result as string);
      toast.success("Logo carregada! Clique em salvar para confirmar.");
    };
    reader.readAsDataURL(file);
  };
  
  // Form State
  const [formStep, setFormStep] = useState(0);
  const DEFAULT_LOCATARIO: LocatarioVistoria = {
    nome: '',
    cpf: '',
    rg: '',
    nacionalidade: 'BRASILEIRO(A)',
    dataNascimento: '',
    naturalidade: '',
    filiacao: '',
    endereco: '',
    cep: '',
    email: '',
    telefone: ''
  };

  const [locatarios, setLocatarios] = useState<LocatarioVistoria[]>([{ ...DEFAULT_LOCATARIO }]);

  const handleAddLocatario = () => {
    const prev = locatarios[locatarios.length - 1];
    setLocatarios(prevLocs => [
      ...prevLocs,
      {
        ...DEFAULT_LOCATARIO,
        endereco: prev?.endereco || '',
        cep: prev?.cep || ''
      }
    ]);
    toast.success(`Inquilino ${locatarios.length + 1} adicionado!`);
  };

  const handleRemoveLocatario = (idx: number) => {
    if (locatarios.length <= 1) {
      toast.error("A vistoria precisa ter pelo menos 1 inquilino.");
      return;
    }
    setLocatarios(prev => prev.filter((_, i) => i !== idx));
    toast.info("Inquilino removido.");
  };

  const handleUpdateLocatario = (idx: number, field: keyof LocatarioVistoria, value: string) => {
    setLocatarios(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleCopyAddressFromFirst = (idx: number) => {
    const first = locatarios[0];
    if (!first) return;
    setLocatarios(prev => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        endereco: first.endereco || '',
        cep: first.cep || ''
      };
      return next;
    });
    toast.success("Endereço e CEP copiados do 1º inquilino!");
  };

  const [textoContrato, setTextoContrato] = useState('');
  const [textoLaudo, setTextoLaudo] = useState('');
  const [styleContrato, setStyleContrato] = useState({ fontSize: 9, textAlign: 'justify' as const, isBold: false });
  const [styleLaudo, setStyleLaudo] = useState({ fontSize: 9, textAlign: 'justify' as const, isBold: false });
  const [imovel, setImovel] = useState({ endereco: '' });
  const [locador, setLocador] = useState({
    nome: companySettings?.name || 'FIDELITE NEGOCIOS IMOBILIARIOS LTDA',
    cnpj: companySettings?.name ? '' : '37.194.924/0001-86',
    endereco: companySettings?.name ? '' : 'AVENIDA SENADOR PEDRO LUDOVICO Nº 180, SALA 17, CENTRO, BELA VISTA DE GOIÁS, CEP: 75.240-000'
  });

  useEffect(() => {
    if (companySettings && !editingVistoria) {
      setLocador({
        nome: companySettings.name,
        cnpj: '',
        endereco: ''
      });
    }
  }, [companySettings, editingVistoria]);
  const [comodos, setComodos] = useState<ComodoVistoria[]>(
    COMODOS_PADRAO.map(c => ({
      nome: c.nome,
      itens: c.itens.map(i => ({ nome: i, ok: true, ressalva: '' })),
      fotos: []
    }))
  );
  const [dataVistoria, setDataVistoria] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [vistoriaCity, setVistoriaCity] = useState(companySettings?.city || 'Aparecida de Goiânia');
  const [vistoriaState, setVistoriaState] = useState(companySettings?.state || 'GO');

  useEffect(() => {
    if (!user || !profile) return;

    const cid = profile.companyId || 'default';
    const q = query(
      collection(db, 'vistorias'), 
      where('companyId', '==', cid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vistoria));
      setVistorias(data.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      }));
      setLoading(false);
    }, (error) => {
      console.error("Firestore Listener Error:", error);
      toast.error("Erro ao carregar vistorias.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, profile, isAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    try {
      const primaryLocatario = locatarios[0] || DEFAULT_LOCATARIO;
      // Fotos são usadas exclusivamente em memória durante a sessão para geração do PDF
      const sanitizedComodos = comodos.map(c => ({
        ...c,
        fotos: []
      }));

      const data = {
        corretorId: user?.uid || 'anonymous',
        corretorNome: user?.displayName || profile?.displayName || 'Corretor',
        companyId: profile?.companyId || 'default',
        companyLogo: companySettings?.logoUrl || null,
        companyName: companySettings?.name || 'FIDELITE',
        companySubtitle: companySettings?.subtitle || 'Negócios Imobiliários',
        textoContrato,
        textoLaudo,
        styleContrato,
        styleLaudo,
        locatario: primaryLocatario,
        locatarios,
        imovel,
        locador,
        comodos: sanitizedComodos,
        status: statusVistoria,
        data: dataVistoria,
        companyCity: vistoriaCity,
        companyState: vistoriaState,
        updatedAt: serverTimestamp()
      };

      if (editingVistoria) {
        await updateDoc(doc(db, 'vistorias', editingVistoria.id), data);
        toast.success('Vistoria atualizada!');
      } else {
        await addDoc(collection(db, 'vistorias'), {
          ...data,
          createdAt: serverTimestamp()
        });
        toast.success('Vistoria criada!');
      }
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar vistoria.');
    }
  };

  const resetForm = () => {
    setIsCreating(false);
    setEditingVistoria(null);
    setStatusVistoria("Agendada");
    setFormStep(0);
    setStyleContrato({ fontSize: 9, textAlign: 'justify', isBold: false });
    setStyleLaudo({ fontSize: 9, textAlign: 'justify', isBold: false });
    setLocatarios([{ ...DEFAULT_LOCATARIO }]);
    setLocador({
      nome: brandName || companySettings?.name || 'FIDELITÉ NEGÓCIOS IMOBILIÁRIOS LTDA',
      cnpj: brandCnpj || companySettings?.cnpj || '',
      endereco: brandAddress || companySettings?.address || ''
    });
    setTextoContrato(brandDefaultTexto || companySettings?.defaultTextoContrato || `O(A) LOCATÁRIO(A), acima qualificado(a), declara, para os devidos fins, que nesta data recebeu as chaves do imóvel locado, passando a ter a posse do referido bem.

Declara, ainda, que teve ciência das condições do imóvel, conforme laudo de vistoria elaborado pela imobiliária, o qual foi devidamente apresentado, acompanhado e conferido, concordando integralmente com seu estado de conservação no ato da entrega.

O(A) LOCATÁRIO(A) assume, a partir desta data, total responsabilidade pela guarda, conservação e demais obrigações previstas no contrato de locação.`);
    setTextoLaudo(brandDefaultTextoLaudo || companySettings?.defaultTextoLaudo || `1) O presente laudo é parte integrante do contrato de locação celebrado entre o(a) locador(a) e o(a) locatário(a). Qualquer restrição ao registro deverá ser comunicada ao(à) LOCADOR(a) por escrito, dentro de 07 (sete) dias a contar da data da assinatura deste documento.

Vistoriado o imóvel acima descrito, foi constatado que o mesmo se encontra em bom estado de conservação, com todos os seus pertences, utensílios e acessórios em perfeito estado de funcionamento e conservação, sendo que dessa forma o(a) LOCATÁRIO(a) se compromete a devolvê-lo, findo o prazo contratual, em igual situação.`);
    setImovel({ endereco: '' });
    setComodos(COMODOS_PADRAO.map(c => ({
      nome: c.nome,
      itens: c.itens.map(i => ({ nome: i, ok: true, ressalva: '' })),
      fotos: []
    })));
    setVistoriaCity(companySettings?.city || 'Aparecida de Goiânia');
    setVistoriaState(companySettings?.state || 'GO');
  };

  const handleEdit = (v: Vistoria) => {
    setEditingVistoria(v);
    if (v.locatarios && Array.isArray(v.locatarios) && v.locatarios.length > 0) {
      setLocatarios(v.locatarios.map(l => ({ ...DEFAULT_LOCATARIO, ...l })));
    } else if (v.locatario) {
      setLocatarios([{ ...DEFAULT_LOCATARIO, ...v.locatario }]);
    } else {
      setLocatarios([{ ...DEFAULT_LOCATARIO }]);
    }
    setTextoContrato(v.textoContrato || `O(A) LOCATÁRIO(A), acima qualificado(a), declara, para os devidos fins, que nesta data recebeu as chaves do imóvel locado, passando a ter a posse do referido bem.

Declara, ainda, que teve ciência das condições do imóvel, conforme laudo de vistoria elaborado pela imobiliária, o qual foi devidamente apresentado, acompanhado e conferido, concordando integralmente com seu estado de conservação no ato da entrega.

O(A) LOCATÁRIO(A) assume, a partir desta data, total responsabilidade pela guarda, conservação e demais obrigações previstas no contrato de locação.`);
    setTextoLaudo(v.textoLaudo || `1) O presente laudo é parte integrante do contrato de locação celebrado entre o(a) locador(a) e o(a) locatário(a). Qualquer restrição ao registro deverá ser comunicada ao(à) LOCADOR(a) por escrito, dentro de 07 (sete) dias a contar da data da assinatura deste documento.

Vistoriado o imóvel acima descrito, foi constatado que o mesmo se encontra em bom estado de conservação, com todos os seus pertences, utensílios e acessórios em perfeito estado de funcionamento e conservação, sendo que dessa forma o(a) LOCATÁRIO(a) se compromete a devolvê-lo, findo o prazo contratual, em igual situação.`);
    setStyleContrato(v.styleContrato || { fontSize: 9, textAlign: 'justify', isBold: false });
    setStyleLaudo(v.styleLaudo || { fontSize: 9, textAlign: 'justify', isBold: false });
    setImovel(v.imovel);
    setLocador(v.locador);
    setComodos(v.comodos);
    setDataVistoria(v.data);
    setVistoriaCity(v.companyCity || companySettings?.city || 'Bela Vista de Goiás');
    setVistoriaState(v.companyState || companySettings?.state || 'GO');
    setStatusVistoria(v.status || "Agendada");
    setIsCreating(true);
  };

  const handlePhotoUpload = async (cIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files) as File[];
    const toastId = "uploading-photo";
    toast.loading(`Processando e otimizando ${fileList.length} foto(s)...`, { id: toastId });

    try {
      const processPromises = fileList.map(async (file) => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 1000; // Resolução otimizada para PDF
              let width = img.width;
              let height = img.height;

              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);

              // Converte direto para Data URL em memória (sem fetch e sem tráfego de rede)
              const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
              resolve(dataUrl);
            };
            img.onerror = () => reject(new Error("Erro ao carregar imagem"));
          };
          reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
        });
      });

      const processedDataUrls = await Promise.all(processPromises);

      const newComodos = [...comodos];
      newComodos[cIdx] = {
        ...newComodos[cIdx],
        fotos: [...(newComodos[cIdx].fotos || []), ...processedDataUrls]
      };
      setComodos(newComodos);
      
      toast.success(`${processedDataUrls.length} foto(s) anexada(s)!`, { id: toastId });
    } catch (error: any) {
      console.error("Photo processing error:", error);
      toast.error(error.message || "Erro ao processar fotos.", { id: toastId });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleRemovePhoto = (cIdx: number, pIdx: number) => {
    const newComodos = [...comodos];
    newComodos[cIdx].fotos.splice(pIdx, 1);
    setComodos(newComodos);
    toast.success("Foto removida.");
  };

  const handleAddComodo = () => {
    if (!newComodoName.trim()) {
      toast.error("Informe o nome do cômodo.");
      return;
    }

    const template = COMODOS_PADRAO.find(t => t.nome === selectedTemplate);
    const newComodo: ComodoVistoria = {
      nome: newComodoName.toUpperCase(),
      itens: (template?.itens || []).map(i => ({ nome: i, ok: true, ressalva: '' })),
      fotos: []
    };

    setComodos([...comodos, newComodo]);
    setNewComodoName('');
    setIsAddingComodo(false);
    toast.success("Cômodo adicionado!");
  };

  const handleRemoveComodo = (cIdx: number) => {
    if (comodos.length <= 1) {
      toast.error("A vistoria deve ter pelo menos um cômodo.");
      return;
    }
    const newComodos = [...comodos];
    newComodos.splice(cIdx, 1);
    setComodos(newComodos);
    toast.success("Cômodo removido.");
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      console.log(`Tentando excluir vistoria ID: ${id}`);
      await deleteDoc(doc(db, 'vistorias', id));
      console.log(`Vistoria ${id} excluída com sucesso.`);
      toast.success('Vistoria excluída.');
      setIsConfirmingDelete(null);
    } catch (error: any) {
      console.error("Error deleting:", error);
      toast.error(`Erro ao excluir: ${error.message || 'Sem detalhes'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredVistorias = vistorias.filter(v => {
    const tenantNames = (v.locatarios && v.locatarios.length > 0)
      ? v.locatarios.map(l => l.nome || '').join(' ')
      : (v.locatario?.nome || '');
    const matchesSearch = tenantNames.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.imovel?.endereco || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchedStatus = selectedStatusFilter === "Todos" || (v.status || "Agendada") === selectedStatusFilter;
    return matchesSearch && matchedStatus;
  });

  const generatePDF = async (vistoria: Vistoria) => {
    const toastId = toast.loading("Gerando termo de vistoria em alta fidelidade...");
    try {
      printVistoriaHTML(vistoria, companySettings);
      toast.success("Documento gerado e pronto para impressão/PDF!", { id: toastId });
    } catch (error) {
      console.error("Erro ao gerar termo de vistoria:", error);
      toast.error("Ocorreu um erro ao gerar o documento.", { id: toastId });
    }
  };

  if (isCreating) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto pb-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {editingVistoria ? 'Editar Vistoria' : 'Nova Vistoria'}
            </h2>
            <p className="text-sm text-slate-500 font-medium">Preencha os dados do contrato e vistoria.</p>
          </div>
          <button 
            onClick={resetForm}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Steps */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
          {['Dados Iniciais', 'Comodos', 'Finalização'].map((step, idx) => (
            <button
              key={step}
              onClick={() => setFormStep(idx)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                formStep === idx 
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-200" 
                  : "bg-slate-100 text-slate-400 hover:bg-slate-200"
              )}
            >
              {step}
            </button>
          ))}
        </div>

        <motion.div
          key={formStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          {formStep === 0 && (
            <div className="grid gap-6">
              {/* Card de Locatários / Inquilinos */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">
                        {locatarios.length > 1 ? "Dados dos Inquilinos / Locatários" : "Dados do Inquilino / Locatário"}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">
                        {locatarios.length === 1 ? "1 inquilino cadastrado" : `${locatarios.length} inquilinos cadastrados`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLocatario}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-blue-500/20 active:scale-95 cursor-pointer"
                    title="Adicionar mais um inquilino"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Inquilino</span>
                  </button>
                </div>
                
                <div className="space-y-6">
                  {locatarios.map((loc, idx) => (
                    <div 
                      key={idx} 
                      className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/70 relative transition-all hover:border-blue-200"
                    >
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider rounded-lg">
                            {idx === 0 ? "Inquilino 1 (Principal)" : `Inquilino ${idx + 1}`}
                          </span>
                          {loc.nome && (
                            <span className="text-xs font-bold text-slate-600 truncate max-w-[200px] md:max-w-md">
                              {loc.nome}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleCopyAddressFromFirst(idx)}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                              title="Copiar mesmo endereço do Inquilino 1"
                            >
                              Copiar Endereço do 1º
                            </button>
                          )}
                          {locatarios.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLocatario(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title={`Remover Inquilino ${idx + 1}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Nome Completo</label>
                          <input 
                            type="text" 
                            value={loc.nome}
                            onChange={e => handleUpdateLocatario(idx, 'nome', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="Nome do inquilino"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">CPF</label>
                          <input 
                            type="text" 
                            value={loc.cpf}
                            onChange={e => handleUpdateLocatario(idx, 'cpf', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="000.000.000-00"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Data Nascimento</label>
                          <input 
                            type="text" 
                            value={loc.dataNascimento}
                            onChange={e => handleUpdateLocatario(idx, 'dataNascimento', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="DD/MM/AAAA"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Naturalidade</label>
                          <input 
                            type="text" 
                            value={loc.naturalidade}
                            onChange={e => handleUpdateLocatario(idx, 'naturalidade', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="Cidade/Estado"
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Filiação</label>
                          <input 
                            type="text" 
                            value={loc.filiacao || ''}
                            onChange={e => handleUpdateLocatario(idx, 'filiacao', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="Nome dos pais"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">E-mail</label>
                          <input 
                            type="email" 
                            value={loc.email}
                            onChange={e => handleUpdateLocatario(idx, 'email', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="email@exemplo.com"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Telefone</label>
                          <input 
                            type="text" 
                            value={loc.telefone}
                            onChange={e => handleUpdateLocatario(idx, 'telefone', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="(00) 00000-0000"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">RG</label>
                          <input 
                            type="text" 
                            value={loc.rg}
                            onChange={e => handleUpdateLocatario(idx, 'rg', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="RG"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Nacionalidade</label>
                          <input 
                            type="text" 
                            value={loc.nacionalidade}
                            onChange={e => handleUpdateLocatario(idx, 'nacionalidade', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="BRASILEIRO(A)"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Endereço Residencial</label>
                          <input 
                            type="text" 
                            value={loc.endereco}
                            onChange={e => handleUpdateLocatario(idx, 'endereco', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="Rua, Número, Bairro..."
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">CEP</label>
                          <input 
                            type="text" 
                            value={loc.cep}
                            onChange={e => handleUpdateLocatario(idx, 'cep', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200/80 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                            placeholder="00000-000"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddLocatario}
                    className="w-full py-3.5 border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/50 hover:bg-blue-50 text-blue-600 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>Adicionar Outro Inquilino</span>
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="font-bold text-slate-900">Dados do Locador</h3>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Nome / Razão Social</label>
                    <input 
                      type="text" 
                      value={locador.nome}
                      onChange={e => setLocador({...locador, nome: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all"
                      placeholder="Nome do proprietário ou imobiliária"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">CNPJ / CPF</label>
                    <input 
                      type="text" 
                      value={locador.cnpj}
                      onChange={e => setLocador({...locador, cnpj: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all"
                      placeholder="Identificação do locador"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Endereço</label>
                    <input 
                      type="text" 
                      value={locador.endereco}
                      onChange={e => setLocador({...locador, endereco: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all"
                      placeholder="Endereço do locador"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-purple-600" />
                  </div>
                  <h3 className="font-bold text-slate-900">TERMO DE CONSTATAÇÃO</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Introdução e Declarações (Pág 1)</label>
                        <button 
                          onClick={() => setTextoContrato(brandDefaultTexto || companySettings?.defaultTextoContrato || `O(A) LOCATÁRIO(A), acima qualificado(a), declara, para os devidos fins, que nesta data recebeu as chaves do imóvel locado, passando a ter a posse do referido bem.

Declara, ainda, que teve ciência das condições do imóvel, conforme laudo de vistoria elaborado pela imobiliária, o qual foi devidamente apresentado, acompanhado e conferido, concordando integralmente com seu estado de conservação no ato da entrega.

O(A) LOCATÁRIO(A) assume, a partir desta data, total responsabilidade pela guarda, conservação e demais obrigações previstas no contrato de locação.`)}
                          className="text-[9px] text-blue-500 font-bold hover:underline"
                          title="Restaurar para o texto padrão definido nas configurações"
                        >
                          [RESTAURAR PADRÃO]
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <select 
                          value={styleContrato.fontSize}
                          onChange={e => setStyleContrato({...styleContrato, fontSize: Number(e.target.value)})}
                          className="text-[10px] bg-slate-100 border-none rounded px-1"
                        >
                          {[8, 9, 10, 11, 12, 14].map(s => <option key={s} value={s}>{s}px</option>)}
                        </select>
                        <button 
                          type="button"
                          onClick={() => setStyleContrato({...styleContrato, isBold: !styleContrato.isBold})}
                          className={cn("p-1 rounded transition-colors", styleContrato.isBold ? "bg-purple-100 text-purple-700" : "hover:bg-slate-100")}
                        >
                          <span className="font-bold text-xs px-1">B</span>
                        </button>
                        {(['left', 'center', 'right', 'justify'] as const).map(a => (
                          <button 
                            key={a}
                            type="button"
                            onClick={() => setStyleContrato({...styleContrato, textAlign: a})}
                            className={cn("p-1 rounded text-[10px] transition-colors", styleContrato.textAlign === a ? "bg-purple-100 text-purple-700" : "hover:bg-slate-100")}
                          >
                            {a.charAt(0).toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea 
                      value={textoContrato}
                      onChange={e => setTextoContrato(e.target.value)}
                      rows={6}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                      placeholder="Texto que aparecerá no Termo de Constatação (Página 1)..."
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">2. Laudo de Vistoria (Cláusulas Finais - Página Final)</label>
                        <button 
                          onClick={() => setTextoLaudo(brandDefaultTextoLaudo || companySettings?.defaultTextoLaudo || `1) O presente laudo é parte integrante do contrato de locação celebrado entre o(a) locador(a) e o(a) locatário(a). Qualquer restrição ao registro deverá ser comunicada ao(à) LOCADOR(a) por escrito, dentro de 07 (sete) dias a contar da data da assinatura deste documento.\n\nVistoriado o imóvel acima descrito, foi constatado que o mesmo se encontra em bom estado de conservação, com todos os seus pertences, utensílios e acessórios em perfeito estado de funcionamento e conservação, sendo que dessa forma o(a) LOCATÁRIO(a) se compromete a devolvê-lo, findo o prazo contratual, em igual situação.`)}
                          className="text-[9px] text-blue-500 font-bold hover:underline"
                          title="Restaurar para o texto padrão definido nas configurações"
                        >
                          [RESTAURAR PADRÃO]
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <select 
                          value={styleLaudo.fontSize}
                          onChange={e => setStyleLaudo({...styleLaudo, fontSize: Number(e.target.value)})}
                          className="text-[10px] bg-slate-100 border-none rounded px-1"
                        >
                          {[8, 9, 10, 11, 12, 14].map(s => <option key={s} value={s}>{s}px</option>)}
                        </select>
                        <button 
                          type="button"
                          onClick={() => setStyleLaudo({...styleLaudo, isBold: !styleLaudo.isBold})}
                          className={cn("p-1 rounded transition-colors", styleLaudo.isBold ? "bg-purple-100 text-purple-700" : "hover:bg-slate-100")}
                        >
                          <span className="font-bold text-xs px-1">B</span>
                        </button>
                        {(['left', 'center', 'right', 'justify'] as const).map(a => (
                          <button 
                            key={a}
                            type="button"
                            onClick={() => setStyleLaudo({...styleLaudo, textAlign: a})}
                            className={cn("p-1 rounded text-[10px] transition-colors", styleLaudo.textAlign === a ? "bg-purple-100 text-purple-700" : "hover:bg-slate-100")}
                          >
                            {a.charAt(0).toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea 
                      value={textoLaudo}
                      onChange={e => setTextoLaudo(e.target.value)}
                      rows={8}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                      placeholder="Este texto aparecerá ao final, antes das assinaturas..."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="font-bold text-slate-900">DADOS DO IMÓVEL</h3>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Endereço Completo</label>
                  <input 
                    type="text" 
                    value={imovel.endereco}
                    onChange={e => setImovel({...imovel, endereco: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Rua, Número, Complemento, Bairro, Cidade/UF"
                  />
                </div>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Data da Vistoria</label>
                    <input 
                      type="date" 
                      value={dataVistoria}
                      onChange={e => setDataVistoria(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Cidade da Vistoria</label>
                    <input 
                      type="text" 
                      value={vistoriaCity}
                      onChange={e => setVistoriaCity(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all"
                      placeholder="Ex: Bela Vista de Goiás"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">UF (Estado)</label>
                    <input 
                      type="text" 
                      value={vistoriaState}
                      onChange={e => setVistoriaState(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all"
                      placeholder="Ex: GO"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {formStep === 1 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-sm font-bold text-slate-700">Adicionar novos cômodos à vistoria</p>
                <button
                  onClick={() => setIsAddingComodo(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-md"
                >
                  <Plus className="w-4 h-4" /> Adicionar Cômodo
                </button>
              </div>

              <AnimatePresence>
                {isAddingComodo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                      <div className="bg-white p-6 rounded-3xl space-y-4 shadow-xl border border-slate-100">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-slate-900 border-l-4 border-blue-600 pl-3">Adicionar Novo Cômodo</h4>
                          <button 
                            onClick={() => setIsAddingComodo(false)}
                            className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                          >
                            <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                          </button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Nome do Cômodo</label>
                            <input
                              type="text"
                              value={newComodoName}
                              onChange={e => setNewComodoName(e.target.value)}
                              placeholder="Ex: Quarto Suíte, Banheiro Social..."
                              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 text-slate-900 placeholder:text-slate-300 transition-all"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Template de Itens</label>
                            <select
                              value={selectedTemplate}
                              onChange={e => setSelectedTemplate(e.target.value)}
                              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 text-slate-900 transition-all"
                            >
                              {COMODOS_PADRAO.map(t => (
                                <option key={t.nome} value={t.nome}>{t.nome}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <button
                          onClick={handleAddComodo}
                          className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-blue-200"
                        >
                          Confirmar Adição
                        </button>
                      </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {comodos.map((comodo, cIdx) => (
                <div key={`${comodo.nome}-${cIdx}`} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
                        <Home className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex bg-white rounded-lg p-1 border border-slate-100">
                        <input
                          type="text"
                          value={comodo.nome}
                          onChange={e => {
                            const newComodos = [...comodos];
                            newComodos[cIdx].nome = e.target.value.toUpperCase();
                            setComodos(newComodos);
                          }}
                          className="text-[10px] font-black uppercase tracking-tight border-none bg-transparent focus:ring-0 w-32"
                        />
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleRemoveComodo(cIdx)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Remover cômodo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {comodo.itens.map((item, iIdx) => (
                      <div key={item.nome} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-3 rounded-2xl bg-slate-50/50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-700">{item.nome}</span>
                          <div className="flex bg-white rounded-lg p-1 border border-slate-100">
                            <button
                              onClick={() => {
                                const newComodos = [...comodos];
                                newComodos[cIdx].itens[iIdx].ok = true;
                                setComodos(newComodos);
                              }}
                              className={cn(
                                "px-3 py-1 rounded text-[10px] font-black transition-all",
                                item.ok ? "bg-green-500 text-white shadow-sm" : "text-slate-400 hover:bg-slate-50"
                              )}
                            >
                              OK
                            </button>
                            <button
                              onClick={() => {
                                const newComodos = [...comodos];
                                newComodos[cIdx].itens[iIdx].ok = false;
                                setComodos(newComodos);
                              }}
                              className={cn(
                                "px-3 py-1 rounded text-[10px] font-black transition-all",
                                !item.ok ? "bg-red-500 text-white shadow-sm" : "text-slate-400 hover:bg-slate-50"
                              )}
                            >
                              RESSALVA
                            </button>
                          </div>
                        </div>
                        
                        {!item.ok && (
                          <input 
                            type="text"
                            placeholder="Descreva a ressalva..."
                            value={item.ressalva}
                            onChange={e => {
                              const newComodos = [...comodos];
                              newComodos[cIdx].itens[iIdx].ressalva = e.target.value;
                              setComodos(newComodos);
                            }}
                            className="text-xs px-3 py-2 border-none bg-white rounded-lg focus:ring-1 focus:ring-red-200"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Room Photos */}
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Fotos do Cômodo</p>
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {comodo.fotos.map((foto, pIdx) => (
                        <div key={pIdx} className="relative aspect-square rounded-2xl overflow-hidden group/photo ring-1 ring-slate-100">
                          <img 
                            src={foto} 
                            alt={`Foto ${pIdx + 1}`} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover/photo:scale-110"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            onClick={() => handleRemovePhoto(cIdx, pIdx)}
                            className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover/photo:opacity-100 transition-all hover:bg-red-600 shadow-lg"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      
                      <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 hover:border-blue-300 hover:bg-blue-50 transition-all text-slate-400 hover:text-blue-500 cursor-pointer group/add">
                        <Camera className="w-5 h-5 group-hover/add:scale-110 transition-transform" />
                        <span className="text-[8px] font-bold">Adicionar</span>
                        <input 
                          type="file" 
                          accept="image/*"
                          multiple
                          onChange={(e) => handlePhotoUpload(cIdx, e)}
                          className="hidden" 
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {formStep === 2 && (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center space-y-6">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Tudo pronto!</h3>
                <p className="text-slate-500 font-medium">Revise as informações e salve para gerar o contrato.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-left p-6 bg-slate-50 rounded-3xl">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {locatarios.length > 1 ? `Inquilinos / Locatários (${locatarios.length})` : 'Inquilino / Locatário'}
                  </p>
                  <div className="space-y-1 mt-0.5">
                    {locatarios.map((loc, idx) => (
                      <p key={idx} className="text-sm font-bold text-slate-900">
                        {loc.nome || `Inquilino ${idx + 1} (Não informado)`}
                        {loc.cpf ? <span className="text-xs font-normal text-slate-500 ml-1.5">({loc.cpf})</span> : null}
                      </p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Imóvel</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{imovel.endereco || 'Não informado'}</p>
                </div>
                <div className="col-span-2 mt-2 border-t border-slate-200/60 pt-4 text-left">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Status da Vistoria</label>
                  <select 
                    value={statusVistoria}
                    onChange={(e) => setStatusVistoria(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-2.5 text-sm font-black focus:outline-none transition-colors text-slate-800"
                  >
                    <option value="Agendada">Agendada</option>
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Aguardando Laudo">Aguardando Laudo</option>
                    <option value="Concluída">Concluída</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handleSave}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-5 h-5" />
                  Salvar Vistoria
                </button>
                <button
                  onClick={() => {
                    const tempVistoria: Vistoria = {
                      id: 'preview',
                      corretorId: user.uid,
                      corretorNome: user.displayName || profile?.displayName || 'Corretor',
                      companyId: profile?.companyId || 'default',
                      textoContrato,
                      textoLaudo,
                      styleContrato,
                      styleLaudo,
                      locatario: locatarios[0] || DEFAULT_LOCATARIO,
                      locatarios: locatarios,
                      imovel,
                      locador,
                      comodos,
                      status: 'rascunho',
                      data: dataVistoria,
                      companyCity: vistoriaCity,
                      companyState: vistoriaState,
                      createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
                      updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any
                    };
                    generatePDF(tempVistoria);
                  }}
                  className="w-full py-4 bg-blue-50 text-blue-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center justify-center gap-2 border-2 border-blue-100 cursor-pointer"
                >
                  <Printer className="w-5 h-5" />
                  Visualizar PDF
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
               disabled={formStep === 0}
               onClick={() => setFormStep(prev => prev - 1)}
               className="flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-900 disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            {formStep < 2 && (
              <button
                onClick={() => setFormStep(prev => prev + 1)}
                className="flex items-center gap-2 px-6 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-900 hover:bg-slate-200 transition-all"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Vistorias</h1>
          <p className="text-slate-500 font-medium mt-1">Gestão de contratos e laudos de vistoria técnica.</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button 
              onClick={() => setIsConfigOpen(true)}
              className="p-4 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-300 rounded-2xl transition-all shadow-sm group"
              title="Configurações de Marca do PDF"
            >
              <Settings className="w-6 h-6 group-hover:rotate-45 transition-transform duration-500" />
            </button>
          )}
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95"
          >
            <Plus className="w-5 h-5" /> Nova Vistoria
          </button>
        </div>
      </div>

      <div className="relative mb-5 max-w-2xl group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-slate-900 transition-colors pointer-events-none" />
        <input 
          type="text" 
          placeholder="Buscar por locatário ou endereço..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-14 pr-4 py-5 bg-white border-none rounded-[28px] text-sm font-semibold shadow-xl shadow-slate-200/50 focus:ring-4 focus:ring-slate-900/5 transition-all outline-none"
        />
      </div>

      {/* Filtros de Status */}
      <div className="flex flex-wrap items-center gap-2 mb-10">
        {["Todos", "Agendada", "Em Andamento", "Aguardando Laudo", "Concluída", "Cancelada"].map((status) => (
          <button
            key={status}
            onClick={() => setSelectedStatusFilter(status)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border",
              selectedStatusFilter === status
                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25"
                : "bg-white text-slate-500 border-slate-150 hover:bg-slate-50 hover:border-slate-300"
            )}
          >
            {status}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-400 animate-pulse">CARREGANDO VISTORIAS...</p>
        </div>
      ) : filteredVistorias.length === 0 ? (
        <div className="bg-white rounded-[40px] p-12 text-center border-2 border-dashed border-slate-100">
           <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-2">Nenhuma vistoria</h3>
          <p className="text-slate-400 font-medium mb-8 max-w-xs mx-auto">Comece agora criando seu primeiro contrato de vistoria.</p>
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-bold text-sm"
          >
            Criar Minha Primeira Vistoria
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVistorias.map((vistoria) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={vistoria.id}
              className="group bg-white rounded-3xl border border-slate-100 hover:border-blue-200 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all p-5 overflow-hidden relative active:scale-[0.98]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">
                    <FileText className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <span className={cn(
                    "px-3 py-1 text-[9px] font-black rounded-lg uppercase tracking-wider text-white shadow-sm",
                    (!vistoria.status || vistoria.status === "Agendada") && "bg-[#2563eb] shadow-blue-500/10",
                    vistoria.status === "Em Andamento" && "bg-[#f59e0b] shadow-amber-500/10",
                    vistoria.status === "Aguardando Laudo" && "bg-[#7c3aed] shadow-purple-500/10",
                    (vistoria.status === "Concluída" || vistoria.status === "concluido") && "bg-[#16a34a] shadow-emerald-500/10",
                    (vistoria.status === "Cancelada" || vistoria.status === "cancelado") && "bg-[#dc2626] shadow-red-500/10"
                  )}>
                    {vistoria.status || "Agendada"}
                  </span>
                </div>
                <div className="flex gap-1">
                   <button 
                    onClick={() => handleEdit(vistoria)}
                    className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsConfirmingDelete(vistoria.id);
                    }}
                    className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div>
                  <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-all">
                    {vistoria.locatarios && vistoria.locatarios.length > 0
                      ? vistoria.locatarios.map(l => l.nome).filter(Boolean).join(' • ') || vistoria.locatario?.nome || 'Sem nome'
                      : (vistoria.locatario?.nome || 'Sem nome')}
                  </h4>
                  {vistoria.locatarios && vistoria.locatarios.length > 1 && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded-md">
                      {vistoria.locatarios.length} inquilinos
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="text-[10px] font-bold leading-none truncate">{vistoria.imovel.endereco}</span>
                  </div>
                  {vistoria.locador?.nome && (
                    <div className="flex items-center gap-1.5 mt-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Locador:</span>
                      <span className="text-[9px] font-bold text-slate-600 truncate">{vistoria.locador.nome}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">Corretor</span>
                    <span className="text-[10px] font-bold text-slate-500">{vistoria.corretorNome}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">Data</span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {format(new Date(vistoria.data), "dd/MM/yyyy")}
                    </span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => generatePDF(vistoria)}
                className="w-full py-3 bg-slate-50 group-hover:bg-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> Imprimir Contrato
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>

      {/* Configuration Modal */}
      <AnimatePresence>
        {isConfigOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfigOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col"
            >
              <div className="p-8 pb-4 flex justify-between items-center bg-white sticky top-0 z-10">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Marca da Vistoria</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Logo e Nome no PDF</p>
                </div>
                <button onClick={() => setIsConfigOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative group shrink-0">
                    <div className="w-32 h-32 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                      {brandLogo ? (
                        <img src={brandLogo} alt="Logo" className="w-full h-full object-contain p-2" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-slate-200" />
                      )}
                    </div>
                    <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-slate-900 text-white rounded-xl shadow-lg border-4 border-white flex items-center justify-center cursor-pointer hover:scale-110 transition-all">
                      <Upload className="w-5 h-5" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </label>
                  </div>
                  <div className="w-full space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome da Empresa</label>
                      <input 
                        type="text" 
                        value={brandName}
                        onChange={e => setBrandName(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900/10 transition-all"
                        placeholder="Ex: Minha Imobiliária"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Subtítulo do PDF</label>
                      <input 
                        type="text" 
                        value={brandSubtitle}
                        onChange={e => setBrandSubtitle(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-slate-900/10 transition-all"
                        placeholder="Ex: Negócios Imobiliários"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cidade</label>
                    <input 
                      type="text" 
                      value={brandCity}
                      onChange={e => setBrandCity(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium"
                      placeholder="Ex: Bela Vista de Goiás"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Estado (UF)</label>
                    <input 
                      type="text" 
                      value={brandState}
                      onChange={e => setBrandState(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium"
                      placeholder="Ex: GO"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CRECI</label>
                    <input 
                      type="text" 
                      value={brandCreci}
                      onChange={e => setBrandCreci(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium"
                      placeholder="Ex: 30716J"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CNPJ</label>
                    <input 
                      type="text" 
                      value={brandCnpj}
                      onChange={e => setBrandCnpj(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium"
                      placeholder="Ex: 00.000.000/0001-00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
                    <input 
                      type="text" 
                      value={brandPhone}
                      onChange={e => setBrandPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium"
                      placeholder="(62) 3157-2612"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                    <input 
                      type="text" 
                      value={brandEmail}
                      onChange={e => setBrandEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium"
                      placeholder="email@fidelite.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Website</label>
                    <input 
                      type="text" 
                      value={brandWebsite}
                      onChange={e => setBrandWebsite(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium"
                      placeholder="www.fidelite.com"
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Endereço da Empresa</label>
                  <textarea 
                    value={brandAddress}
                    onChange={e => setBrandAddress(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium resize-none h-24"
                    placeholder="Rua, Número, Setor, Cidade - UF"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Introdução Padronizada (Texto Página 1)</label>
                  <textarea 
                    value={brandDefaultTexto}
                    onChange={e => setBrandDefaultTexto(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium h-32"
                    placeholder="Este texto aparecerá na abertura das novas vistorias..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cláusulas Finais Padrão (Página Final)</label>
                  <textarea 
                    value={brandDefaultTextoLaudo}
                    onChange={e => setBrandDefaultTextoLaudo(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium h-32"
                    placeholder="Este texto aparecerá no laudo final das novas vistorias..."
                  />
                </div>

                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                  <p className="text-[10px] text-blue-700 leading-relaxed font-bold italic">
                    Este logo e dados serão usados no rodapé da primeira página e no cabeçalho de todas as páginas do PDF.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSaveConfig}
                    disabled={isSavingConfig}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 disabled:opacity-50 transition-all sticky bottom-0"
                  >
                    {isSavingConfig ? "Salvando..." : "Salvar Configurações de Marca"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isConfirmingDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmingDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Excluir Vistoria?</h3>
              <p className="text-slate-500 font-medium text-sm mb-8">
                Esta ação é permanente e não pode ser desfeita. Tem certeza que deseja remover este contrato?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setIsConfirmingDelete(null)}
                  className="py-3 px-6 bg-slate-100 text-slate-900 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  disabled={isDeleting}
                  onClick={() => handleDelete(isConfirmingDelete)}
                  className="py-3 px-6 bg-red-500 text-white rounded-2xl font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-200 disabled:opacity-50"
                >
                  {isDeleting ? "Excluindo..." : "Sim, Excluir"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};