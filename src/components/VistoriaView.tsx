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
  Settings,
  Mic,
  PenTool,
  UserCheck
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

  // Evita que o navegador abra/navegue para uma imagem arrastada acidentalmente
  // fora de uma área de dropzone (o que faria perder o formulário preenchido).
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
    };
  }, []);

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

  const [tipoVistoria, setTipoVistoria] = useState<'entrada' | 'saida'>('entrada');
  const [vistoriaEntradaId, setVistoriaEntradaId] = useState<string | null>(null);
  const [vistoriadorNome, setVistoriadorNome] = useState('');
  const [descricaoGeral, setDescricaoGeral] = useState('');
  const [fotosGerais, setFotosGerais] = useState<string[]>([]);
  const [isGerandoLaudo, setIsGerandoLaudo] = useState(false);
  const [isGravandoAudio, setIsGravandoAudio] = useState(false);
  const [statusAssinatura, setStatusAssinatura] = useState<'nao_enviado' | 'enviado' | 'assinado'>('nao_enviado');
  const [linkAssinatura, setLinkAssinatura] = useState('');
  const speechRecognitionRef = React.useRef<any>(null);
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
        tipo: tipoVistoria,
        vistoriaEntradaId: tipoVistoria === 'saida' ? vistoriaEntradaId : null,
        vistoriadorNome,
        descricaoGeral,
        statusAssinatura,
        linkAssinatura,
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
    setTipoVistoria('entrada');
    setVistoriaEntradaId(null);
    setVistoriadorNome(user?.displayName || profile?.displayName || '');
    setDescricaoGeral('');
    setFotosGerais([]);
    setStatusAssinatura('nao_enviado');
    setLinkAssinatura('');
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
    setTipoVistoria(v.tipo || 'entrada');
    setVistoriaEntradaId(v.vistoriaEntradaId || null);
    setVistoriadorNome(v.vistoriadorNome || v.corretorNome || user?.displayName || '');
    setDescricaoGeral(v.descricaoGeral || '');
    setStatusAssinatura(v.statusAssinatura || 'nao_enviado');
    setLinkAssinatura(v.linkAssinatura || '');
    setFotosGerais([]);
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

  const processImageFiles = async (fileList: File[]): Promise<string[]> => {
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

    return Promise.all(processPromises);
  };

  // Suporte a arrastar-e-soltar (drag and drop) de imagens direto do computador/celular.
  // Sem isso, o navegador tenta abrir o arquivo numa aba nova em vez de anexá-lo.
  const extractImageFiles = (dataTransfer: DataTransfer): File[] => {
    return Array.from(dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
  };

  const handleDropZoneEvents = (onFiles: (files: File[]) => void) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = extractImageFiles(e.dataTransfer);
      if (files.length > 0) onFiles(files);
    }
  });

  const processAndAttachComodoPhotos = async (cIdx: number, fileList: File[]) => {
    if (fileList.length === 0) return;
    const toastId = "uploading-photo";
    toast.loading(`Processando e otimizando ${fileList.length} foto(s)...`, { id: toastId });

    try {
      const processedDataUrls = await processImageFiles(fileList);

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
    }
  };

  const handlePhotoUpload = async (cIdx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processAndAttachComodoPhotos(cIdx, Array.from(files));
    if (e.target) e.target.value = '';
  };

  // Fotos "soltas" da vistoria — não é necessário indicar de qual cômodo é cada uma.
  // Ficam todas juntas num único painel; a descrição geral abaixo é que dá o contexto pra IA.
  const processAndAttachFotosGerais = async (fileList: File[]) => {
    if (fileList.length === 0) return;
    const toastId = "uploading-photo-geral";
    toast.loading(`Processando e otimizando ${fileList.length} foto(s)...`, { id: toastId });

    try {
      const processedDataUrls = await processImageFiles(fileList);
      setFotosGerais(prev => [...prev, ...processedDataUrls]);
      toast.success(`${processedDataUrls.length} foto(s) anexada(s)!`, { id: toastId });
    } catch (error: any) {
      console.error("Photo processing error:", error);
      toast.error(error.message || "Erro ao processar fotos.", { id: toastId });
    }
  };

  const handlePhotoUploadGeral = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processAndAttachFotosGerais(Array.from(files));
    if (e.target) e.target.value = '';
  };

  const handleRemoveFotoGeral = (pIdx: number) => {
    setFotosGerais(prev => prev.filter((_, i) => i !== pIdx));
  };

  const handleToggleGravacaoVoz = () => {
    const SpeechRecognitionApi = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionApi) {
      toast.error('Seu navegador não suporta ditado por voz. Tente usar o Google Chrome.');
      return;
    }

    if (isGravandoAudio) {
      speechRecognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsGravandoAudio(true);
      toast.info('Ouvindo... fale a descrição da vistoria.');
    };

    recognition.onresult = (event: any) => {
      let textoFinal = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          textoFinal += event.results[i][0].transcript;
        }
      }
      if (textoFinal.trim()) {
        setDescricaoGeral(prev => (prev ? `${prev.trim()} ${textoFinal.trim()}` : textoFinal.trim()));
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Erro no reconhecimento de voz:', event.error);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        toast.error('Erro ao capturar áudio. Tente novamente.');
      }
    };

    recognition.onend = () => {
      setIsGravandoAudio(false);
    };

    speechRecognitionRef.current = recognition;
    recognition.start();
  };

  const handleEnviarParaAssinatura = async (vistoria: Vistoria) => {
    // 1) Gera e força o download do PDF (pra já ter o arquivo pronto pra subir no CredPago)
    await generatePDF(vistoria, { forceDownload: true });

    // 2) Abre o CredPago/CredSign numa nova aba
    window.open('https://credpago.com.br/credsign/', '_blank');

    // 3) Marca como "enviado" — o próprio usuário confirma quando terminar de subir o arquivo lá
    setStatusAssinatura('enviado');

    toast('PDF baixado! Agora é só subir esse arquivo no CredPago que abriu na outra aba.', {
      duration: 6000,
      icon: '📄'
    });
  };

  const handleGerarLaudoComIA = async () => {
    if (!descricaoGeral.trim() && comodos.every(c => c.itens.every(i => i.ok))) {
      toast.error('Escreva uma descrição geral ou marque alguma ressalva nos cômodos antes de gerar o laudo.');
      return;
    }

    setIsGerandoLaudo(true);
    const toastId = 'gerando-laudo';
    toast.loading('Gerando texto do laudo com IA...', { id: toastId });

    try {
      const ressalvas = comodos.flatMap(c =>
        c.itens.filter(i => !i.ok).map(i => `${c.nome} - ${i.nome}: ${i.ressalva || 'sem detalhes'}`)
      );

      // As fotos aqui são só os destaques de danos (usadas pra IA dar ênfase no laudo).
      // O total real de fotos da vistoria inclui também as fotos gerais de cada cômodo,
      // adicionadas na etapa seguinte — por isso contamos as duas coisas separadamente.
      const quantidadeFotosDestaque = fotosGerais.length;
      const quantidadeFotosTotal = quantidadeFotosDestaque + comodos.reduce((acc, c) => acc + (c.fotos?.length || 0), 0);

      const idToken = await auth.currentUser?.getIdToken();

      const resp = await fetch('/api/vistoria/gerar-laudo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          tipo: tipoVistoria,
          enderecoImovel: imovel.endereco,
          descricaoGeral,
          ressalvas,
          quantidadeFotosDestaque,
          quantidadeFotosTotal,
          textoLaudoAtual: textoLaudo
        })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Não foi possível gerar o laudo agora.');
      }

      const { textoLaudo: novoTexto } = await resp.json();
      setTextoLaudo(novoTexto);
      toast.success('Laudo gerado! Revise o texto antes de salvar.', { id: toastId });
    } catch (error: any) {
      console.error('Erro ao gerar laudo com IA:', error);
      toast.error(error.message || 'Erro ao gerar laudo com IA.', { id: toastId });
    } finally {
      setIsGerandoLaudo(false);
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

  const generatePDF = async (vistoria: Vistoria, options?: { forceDownload?: boolean }) => {
    // Helper data (definido cedo para poder ser usado já na capa)
    const formatDateHelper = (dateStr?: string) => {
      if (!dateStr) return format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      try {
        const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00:00');
        return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      } catch {
        return format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      }
    };

    const toastId = toast.loading("Gerando PDF, aguarde...");
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
    const width = pdf.internal.pageSize.getWidth();
    let y = 0;
    
    // Safety check for dynamic data fallback
    const logoToUse = vistoria.companyLogo || companySettings?.logoUrl;
    const nameToUse = vistoria.companyName || companySettings?.name;
    const subtitleToUse = vistoria.companySubtitle || companySettings?.subtitle;
    const locadorToUse = vistoria.locador || { 
      nome: brandName || companySettings?.name || 'FIDELITÉ NEGÓCIOS IMOBILIÁRIOS LTDA',
      cnpj: brandCnpj || companySettings?.cnpj || '37.194.924/0001-86',
      endereco: brandAddress || companySettings?.address || 'AVENIDA SENADOR PEDRO LUDOVICO Nº 180, SALA 17, CENTRO, BELA VISTA DE GOIÁS, CEP: 75.240-000'
    };
    const tituloDocumento = vistoria.tipo === 'saida'
      ? 'TERMO DE VISTORIA DE SAÍDA E DEVOLUÇÃO DE CHAVES'
      : 'TERMO DE VISTORIA DE ENTRADA E ENTREGA DE CHAVES';
    
    // --- REUSABLE HEADER & FOOTER FUNCTION ---
    const addHeaderAndFooter = (doc: jsPDF, isFirstPage: boolean) => {
      if (isFirstPage) {
        // Cabeçalho completo (apenas na pág 1)
        doc.setDrawColor(0, 157, 160); 
        doc.setLineWidth(0.4);
        doc.roundedRect(6, 12, 198, 38, 4, 4, 'S');

        if (logoToUse) {
          try {
            const imgProps = doc.getImageProperties(logoToUse);
            const maxW = 55;
            const maxH = 28;
            const ratio = imgProps.width / imgProps.height;
            let targetW = maxW;
            let targetH = targetW / ratio;
            if (targetH > maxH) {
              targetH = maxH;
              targetW = targetH * ratio;
            }
            const logoX = 195 - targetW;
            const logoY = 16 + (maxH - targetH) / 2;

            doc.setFillColor(15, 23, 42); 
            const barEndX = logoX - 5;
            doc.rect(0, 22, Math.max(80, barEndX - 10), 18, 'F');
            doc.roundedRect(barEndX - 20, 22, 20, 18, 9, 9, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            let tituloFontSize = 13;
            doc.setFontSize(tituloFontSize);
            const maxTituloWidth = barEndX - 25; // espaço disponível antes da logo
            while (doc.getTextWidth(tituloDocumento) > maxTituloWidth && tituloFontSize > 8) {
              tituloFontSize -= 0.5;
              doc.setFontSize(tituloFontSize);
            }
            doc.text(tituloDocumento, 20, 33.5);

            const format = logoToUse.toLowerCase().includes('png') || logoToUse.includes('image/png') ? 'PNG' : 'JPEG';
            doc.addImage(logoToUse, format, logoX, logoY, targetW, targetH, undefined, 'SLOW');
          } catch (e) {
            renderFallbackHeader(doc);
          }
        } else {
          renderFallbackHeader(doc);
        }

        // Rodapé completo (apenas na pág 1)
        const footerY = 285;
        doc.setDrawColor(0, 48, 102); // Azul Marinho
        doc.setLineWidth(0.3);
        doc.line(75, footerY - 5, 75, footerY + 12);
        doc.line(130, footerY - 5, 130, footerY + 12);
        doc.setFillColor(0, 48, 102); // Azul Marinho
        doc.rect(width - 10, footerY - 10, 10, 25, 'F');

        doc.setTextColor(0, 48, 102); // Azul Marinho
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const addr = brandAddress || (brandCity && brandState ? `${brandCity} - ${brandState}` : (brandCity || brandState || ''));
        const splitAddr = doc.splitTextToSize(addr.toUpperCase(), 60);
        doc.text(splitAddr, 10, footerY);

        const contactLines = [brandPhone, brandEmail, brandWebsite].filter(Boolean).join('\n');
        const splitContact = doc.splitTextToSize(contactLines, 45);
        doc.text(splitContact, 80, footerY);

        const creciText = brandCreci ? (brandCreci.toUpperCase().includes('CRECI') ? brandCreci : `CRECI: ${brandCreci}`) : '';
        const companyLines = [brandName?.toUpperCase(), creciText].filter(Boolean).join('\n');
        const splitCompany = doc.splitTextToSize(companyLines, 55);
        doc.text(splitCompany, 135, footerY);
      } else {
        // Cabeçalho minimalista para outras páginas (apenas número da página)
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Página ${doc.getNumberOfPages()}`, 190, 10);
      }
    };

    const renderFallbackHeader = (doc: jsPDF) => {
      doc.setFillColor(15, 23, 42); 
      doc.rect(0, 22, 115, 18, 'F');
      doc.roundedRect(100, 22, 25, 18, 9, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      let tituloFontSizeFallback = 13;
      doc.setFontSize(tituloFontSizeFallback);
      const maxTituloWidthFallback = 95; // espaço disponível antes do nome da marca (x=140)
      while (doc.getTextWidth(tituloDocumento) > maxTituloWidthFallback && tituloFontSizeFallback > 8) {
        tituloFontSizeFallback -= 0.5;
        doc.setFontSize(tituloFontSizeFallback);
      }
      doc.text(tituloDocumento, 20, 33.5);
      
      if (brandName) {
        doc.setTextColor(0, 48, 102);
        doc.setFontSize(18);
        const splitBrand = doc.splitTextToSize(brandName.toUpperCase(), 55);
        doc.text(splitBrand, 140, 28);
      }
    };

    const checkPageBreak = (currentY: number, needed: number) => {
      if (currentY + needed > 280) {
        pdf.addPage();
        addHeaderAndFooter(pdf, false);
        return 25; // Começa mais alto em páginas sem cabeçalho grande
      }
      return currentY;
    };

    // --- INÍCIO DA RENDERIZAÇÃO ---
    addHeaderAndFooter(pdf, true);
    y = 70;

    // CAPA — dados essenciais de identificação (endereço, data, vistoriador responsável)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 48, 102);
    const enderecoCapa = pdf.splitTextToSize((vistoria.imovel?.endereco || '').toUpperCase(), 170);
    pdf.text(enderecoCapa, 20, y);
    y += enderecoCapa.length * 6 + 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(60, 60, 60);
    pdf.text(`DATA DA VISTORIA: ${formatDateHelper((vistoria as any).dataVistoria || vistoria.data)}`, 20, y);
    y += 6;
    pdf.text(`VISTORIADOR RESPONSÁVEL: ${(vistoria.vistoriadorNome || vistoria.corretorNome || '').toUpperCase()}`, 20, y);
    pdf.setTextColor(0, 0, 0);
    y += 12;

    const drawSectionHeader = (title: string, yPos: number) => {
      const upperTitle = title.toUpperCase();
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      const textWidth = pdf.getTextWidth(upperTitle);
      const boxWidth = textWidth + 10;

      pdf.setFillColor(0, 48, 102); // Azul Marinho Fidelité
      pdf.roundedRect(20, yPos - 6, boxWidth, 8, 2, 2, 'F'); 
      
      pdf.setTextColor(255, 255, 255);
      pdf.text(upperTitle, 25, yPos);
      pdf.setTextColor(0, 0, 0);
      return yPos + 10;
    };

    // CONSIDERAÇÕES PRELIMINARES, CONTESTAÇÃO E CRITÉRIOS DE VISTORIA (nova página, logo após a capa)
    pdf.addPage();
    addHeaderAndFooter(pdf, false);
    y = 35;
    y = drawSectionHeader('CONSIDERAÇÕES PRELIMINARES', y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);

    const printParagraph = (text: string, startY: number): number => {
      let yy = startY;
      const lines = pdf.splitTextToSize(text, 170);
      lines.forEach((line: string) => {
        yy = checkPageBreak(yy, 5);
        pdf.text(line, 20, yy);
        yy += 4.2;
      });
      return yy + 4;
    };

    y = printParagraph(
      'Este relatório de vistoria tem por objetivo retratar o estado de conservação e funcionamento do imóvel na data de sua realização, em atendimento ao disposto no art. 22, inciso V, e art. 23, inciso III, ambos da Lei nº 8.245/91 (Lei do Inquilinato).',
      y
    );
    y = printParagraph(
      'A presente vistoria foi realizada por observação estética da construção e acabamentos, não se atendo a aspectos estruturais de solidez, fundações e vícios ocultos.',
      y
    );
    y = printParagraph(
      'O(a) locatário(a) declara estar ciente de que deverá devolver o imóvel nas mesmas condições em que o recebeu, conforme descrição constante deste laudo, ressalvado o desgaste natural decorrente do uso normal.',
      y
    );

    y = checkPageBreak(y, 15);
    y = drawSectionHeader('PRAZO PARA CONTESTAÇÃO', y);
    y = printParagraph(
      'Terá o(a) locatário(a) 10 (dez) dias corridos, a contar da data de assinatura deste termo, para se manifestar sobre o seu conteúdo, exceção feita a implicações originárias de chuva, cujo prazo se inicia a partir do primeiro evento.',
      y
    );
    y = printParagraph(
      'Toda e qualquer contestação deverá ser feita por escrito, seguindo a mesma numeração de itens deste laudo, e acompanhada de fotos que comprovem a divergência apontada, encaminhada ao departamento responsável pela administração do imóvel.',
      y
    );
    y = printParagraph(
      'A ausência de manifestação dentro do prazo estabelecido caracteriza a plena concordância do(a) locatário(a) com o conteúdo deste laudo, não sendo admitida contestação posterior, inclusive no momento da rescisão contratual.',
      y
    );

    y = checkPageBreak(y, 15);
    y = drawSectionHeader('CRITÉRIOS DE ESTADO DE CONSERVAÇÃO', y);
    pdf.setFontSize(8.5);

    const criterios: [string, string][] = [
      ['NOVO', 'Primeiro uso. Pintura recente com cobrimento completo da superfície, sem retoques.'],
      ['BOM', 'Sem sinais relevantes de desgaste, ou com pequenas irregularidades que não comprometem o uso ou a integridade do item.'],
      ['REGULAR', 'Presença de manchas, riscos, lascas ou pequenas perfurações, desgaste leve pela ação do tempo, ou pequenas falhas na pintura.'],
      ['RUIM', 'Danos relevantes: descascamentos, trincas, infiltrações, deterioração de revestimento ou demais avarias que comprometem a aparência ou o funcionamento do item.']
    ];

    criterios.forEach(([label, desc]) => {
      y = checkPageBreak(y, 12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${label}:`, 20, y);
      pdf.setFont('helvetica', 'normal');
      const descLines = pdf.splitTextToSize(desc, 150);
      pdf.text(descLines, 42, y);
      y += Math.max(5, descLines.length * 4.2) + 2;
    });

    // DADOS DO LOCATÁRIO (nova página)
    pdf.addPage();
    addHeaderAndFooter(pdf, false);
    y = 35;

    // DADOS DO LOCATÁRIO
    const locatariosList: LocatarioVistoria[] = (vistoria.locatarios && vistoria.locatarios.length > 0)
      ? vistoria.locatarios
      : (vistoria.locatario ? [vistoria.locatario] : [{ ...DEFAULT_LOCATARIO }]);

    const sectionTitle = locatariosList.length > 1 ? 'DADOS DOS LOCATÁRIOS' : 'DADOS DO LOCATÁRIO';
    y = drawSectionHeader(sectionTitle, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    
    locatariosList.forEach((loc, idx) => {
      const prefix = locatariosList.length > 1 ? `LOCATÁRIO ${idx + 1}: ` : 'LOCATÁRIO: ';
      const locatarioInfo = [
        `${prefix}${(loc.nome || '').toUpperCase()}`,
        `CPF: ${loc.cpf || ''}${loc.rg ? `  |  RG: ${loc.rg}` : ''}`,
        `E-MAIL: ${loc.email || ''}  |  TEL: ${loc.telefone || ''}`,
        ...(loc.endereco ? [`ENDEREÇO: ${loc.endereco}${loc.cep ? `  -  CEP: ${loc.cep}` : ''}`] : [])
      ];
      
      locatarioInfo.forEach(line => {
        const splitLine = pdf.splitTextToSize(line, 170);
        y = checkPageBreak(y, splitLine.length * 5);
        pdf.text(splitLine, 20, y);
        y += (splitLine.length * 5);
      });

      if (idx < locatariosList.length - 1) {
        y += 2;
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.1);
        pdf.line(20, y, 190, y);
        y += 4;
      }
    });

    // DADOS DO LOCADOR
    y += 5;
    y = checkPageBreak(y, 35);
    y = drawSectionHeader('DADOS DO LOCADOR', y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    
    const locadorNameText = pdf.splitTextToSize(`LOCADOR: ${(locadorToUse.nome || '').toUpperCase()}`, 170);
    pdf.text(locadorNameText, 20, y);
    y += (locadorNameText.length * 5);
    pdf.text(`CNPJ: ${locadorToUse.cnpj || ''}`, 20, y);
    y += 5;
    const locadorEndText = pdf.splitTextToSize(`ENDEREÇO: ${locadorToUse.endereco || ''}`, 170);
    pdf.text(locadorEndText, 20, y);
    y += (locadorEndText.length * 5);

    if (brandPhone) {
      pdf.text(`TEL: ${brandPhone}`, 20, y);
      y += 5;
    }
    if (brandEmail) {
      pdf.text(`E-MAIL: ${brandEmail}`, 20, y);
      y += 5;
    }
    if (brandCreci) {
      pdf.text(`CRECI: ${brandCreci}`, 20, y);
      y += 5;
    }
    y += 5;

    // DADOS DO IMÓVEL
    y = checkPageBreak(y, 20);
    y = drawSectionHeader('DADOS DO IMÓVEL', y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    
    pdf.text(`ENDEREÇO: ${(vistoria.imovel.endereco || '').toUpperCase()}`, 20, y, { maxWidth: 170 });
    y += 15;

    // DECLARAÇÃO DE RECEBIMENTO DE CHAVES
    y = checkPageBreak(y, 30);
    y = drawSectionHeader('DECLARAÇÃO DE RECEBIMENTO DE CHAVES', y);
    
    const sC = {
      fontSize: vistoria.styleContrato?.fontSize || 9,
      textAlign: vistoria.styleContrato?.textAlign || 'justify' as const,
      isBold: !!vistoria.styleContrato?.isBold
    };
    
    pdf.setFontSize(sC.fontSize);
    pdf.setFont('helvetica', sC.isBold ? 'bold' : 'normal');
    y += 3; 

    const splitContract = pdf.splitTextToSize(vistoria.textoContrato || '', 170);
    splitContract.forEach((line: string) => {
      y = checkPageBreak(y, 5);
      // Reinforce font after potential page break
      pdf.setFont('helvetica', sC.isBold ? 'bold' : 'normal');
      pdf.setFontSize(sC.fontSize);
      
      const xPos = sC.textAlign === 'center' ? 105 : sC.textAlign === 'right' ? 190 : 20;
      pdf.text(line, xPos, y, { align: sC.textAlign });
      y += sC.fontSize * 0.55;
    });

    // CONDIÇÕES DO IMÓVEL (Início na página 2)
    pdf.addPage();
    addHeaderAndFooter(pdf, false);
    y = 35;
    y = drawSectionHeader('CONDIÇÕES DO IMÓVEL', y);
    pdf.setTextColor(0, 0, 0);

    vistoria.comodos.forEach((comodo) => {
      y = checkPageBreak(y, 25);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 48, 102); // Azul Marinho
      const comodoNomeStr = comodo.nome.toUpperCase();
      pdf.text(comodoNomeStr, 20, y);
      
      const comodoTextWidth = pdf.getTextWidth(comodoNomeStr);
      y += 2;
      pdf.setDrawColor(0, 48, 102); // Azul Marinho
      pdf.setLineWidth(0.2);
      pdf.line(20, y, 20 + comodoTextWidth, y); // Somente em baixo do texto
      y += 8;

      pdf.setTextColor(0, 0, 0);
      comodo.itens.forEach((item) => {
        const ressalvaText = item.ok ? '' : (item.ressalva || 'Nenhuma ressalva');
        const ressalvaLines = ressalvaText ? pdf.splitTextToSize(`Ressalva: ${ressalvaText}`, 155) : [];
        const itemHeight = ressalvaText ? 15 + (ressalvaLines.length * 4) : 10;
        
        y = checkPageBreak(y, itemHeight);
        y += 5; // Padding superior

        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(item.nome, 25, y);
        
        pdf.setTextColor(item.ok ? 22 : 180, item.ok ? 163 : 0, item.ok ? 74 : 0);
        pdf.text(item.ok ? '[ OK ]' : '[ RESSALVA ]', 160, y);
        pdf.setTextColor(0, 0, 0);

        if (!item.ok) {
          y += 4; // Ajuste entre linha as opções de ressalvas
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(110, 110, 110);
          pdf.text(ressalvaLines, 25, y);
          y += (ressalvaLines.length * 3.5); // Espaçamento entre linhas reduzido
        } else {
          y += 3;
        }
        
        y += 2;
        pdf.setDrawColor(240, 240, 240); // Linha bem clara como na imagem
        pdf.setLineWidth(0.1);
        pdf.line(20, y, 190, y);
        y += 2; // Espaço após a linha
      });

      // Fotos do Cômodo (Imediatamente após o checklist) - 3 por linha (6 por página)
      if (comodo.fotos && comodo.fotos.length > 0) {
        y += 5;
        for (let i = 0; i < comodo.fotos.length; i++) {
          if (i % 3 === 0) {
            y = checkPageBreak(y, 65);
          }
          try {
            const rowIdx = i % 3;
            const x = 20 + (rowIdx * 60); // 3 fotos de 55mm com 5mm de gap
            pdf.addImage(comodo.fotos[i], 'JPEG', x, y, 55, 45, undefined, 'FAST');
            
            if (rowIdx === 2 || i === comodo.fotos.length - 1) {
              y += 50; // Altura da foto + gap
            }
          } catch (e) {
            console.error("Error adding image", e);
          }
        }
      }
      y += 10;
    });

    // FOTOS GERAIS DA VISTORIA (fotos soltas, não vinculadas a um cômodo específico)
    if (vistoria.fotosGerais && vistoria.fotosGerais.length > 0) {
      pdf.addPage();
      addHeaderAndFooter(pdf, false);
      y = 35;
      y = drawSectionHeader('REGISTRO FOTOGRÁFICO GERAL', y);
      y += 5;

      for (let i = 0; i < vistoria.fotosGerais.length; i++) {
        if (i % 3 === 0) {
          y = checkPageBreak(y, 65);
          if (y === 35 && i > 0) {
            // checkPageBreak já adicionou nova página; garante o cabeçalho
            addHeaderAndFooter(pdf, false);
          }
        }
        try {
          const rowIdx = i % 3;
          const x = 20 + (rowIdx * 60);
          pdf.addImage(vistoria.fotosGerais[i], 'JPEG', x, y, 55, 45, undefined, 'FAST');

          if (rowIdx === 2 || i === vistoria.fotosGerais.length - 1) {
            y += 50;
          }
        } catch (e) {
          console.error('Error adding general photo', e);
        }
      }
    }

    // LAUDO DE VISTORIA (Nova página) — cláusulas finais definidas no formulário
    pdf.addPage();
    addHeaderAndFooter(pdf, false);
    y = 35;
    y = drawSectionHeader('LAUDO DE VISTORIA', y);
    y += 3;

    const sL = {
      fontSize: vistoria.styleLaudo?.fontSize || 9,
      textAlign: vistoria.styleLaudo?.textAlign || 'justify' as const,
      isBold: !!vistoria.styleLaudo?.isBold
    };

    pdf.setFontSize(sL.fontSize);
    pdf.setFont('helvetica', sL.isBold ? 'bold' : 'normal');
    pdf.setTextColor(0, 0, 0);

    // Detecta linhas de título/item (ex: "4.8. QUARTOS..." ou "1. IDENTIFICAÇÃO...")
    // para imprimi-las em negrito, destacando a estrutura do laudo.
    const headerLineRegex = /^\d+(\.\d+)*\.\s*[A-ZÀ-ÜÇ]/;
    const paragraphs = (vistoria.textoLaudo || '').split('\n');

    paragraphs.forEach((paragraph) => {
      if (paragraph.trim() === '') {
        y += sL.fontSize * 0.55;
        return;
      }

      const isHeaderLine = headerLineRegex.test(paragraph.trim());
      const lines = pdf.splitTextToSize(paragraph, 170);

      lines.forEach((line: string) => {
        y = checkPageBreak(y, 5);
        pdf.setFont('helvetica', isHeaderLine || sL.isBold ? 'bold' : 'normal');
        pdf.setFontSize(sL.fontSize);

        const xPos = sL.textAlign === 'center' ? 105 : sL.textAlign === 'right' ? 190 : 20;
        pdf.text(line, xPos, y, { align: sL.textAlign });
        y += sL.fontSize * 0.55;
      });
    });

    // LGPD E PROTEÇÃO DE DADOS (Nova página)
    pdf.addPage();
    addHeaderAndFooter(pdf, false);
    y = 35;
    y = drawSectionHeader('LGPD E PROTEÇÃO DE DADOS', y);
    y += 5;

    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);

    const lgpdParagraphs = [
      "A IMOBILIÁRIA OU CORRETOR,",
      "As partes declaram estar cientes e de acordo com o tratamento de seus dados pessoais, nos termos da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados – LGPD).",
      "§1º. Para os fins deste contrato de locação, a IMOBILIÁRIA atuará como CONTROLADORA dos dados pessoais, podendo tratá-los diretamente ou por meio de terceiros contratados, na qualidade de OPERADORES, exclusivamente para as seguintes finalidades: intermediação, administração e execução do contrato de locação; cobrança de valores; cumprimento de obrigações legais e regulatórias; comunicação entre as partes; elaboração de documentos, cadastros e registros necessários.",
      "§2º. O tratamento dos dados pessoais terá como fundamentos legais: o cumprimento de obrigação legal ou regulatória (art. 7º, II, LGPD); a execução do contrato de locação (art. 7º, V, LGPD); e, quando aplicável, o consentimento expresso do titular (art. 7º, I, LGPD).",
      "§3º. As partes comprometem-se a não divulgar, compartilhar ou utilizar os dados pessoais obtidos em razão deste contrato para finalidades diversas daquelas aqui previstas, salvo por determinação legal ou judicial.",
      "§4º. A IMOBILIÁRIA adotará medidas técnicas e administrativas adequadas para proteger os dados pessoais contra acessos não autorizados, destruição, perda, alteração ou qualquer forma de tratamento inadequado ou ilícito.",
      "§5º. Os dados pessoais serão armazenados pelo prazo necessário ao cumprimento das finalidades contratuais e legais, sendo posteriormente eliminados ou anonimizados, quando cabível."
    ];

    lgpdParagraphs.forEach((p) => {
      const splitP = pdf.splitTextToSize(p, 170);
      y = checkPageBreak(y, splitP.length * 4.5 + 4);
      pdf.text(splitP, 20, y);
      y += (splitP.length * 4.5) + 3;
    });

    // SEÇÃO ASSINATURAS
    y += 5;
    y = checkPageBreak(y, 110);
    y = drawSectionHeader('CLÁUSULA – DA VALIDADE E INTEGRIDADE DO INSTRUMENTO', y);
    y += 8;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    const validadeText = pdf.splitTextToSize("Permanecem válidas e inalteradas todas as demais cláusulas do contrato principal de locação e dos termos firmados entre as partes, que não conflitarem com o presente instrumento.", 170);
    pdf.text(validadeText, 20, y);
    y += (validadeText.length * 4.5) + 10;

    // Data alinhada à direita
    pdf.setFontSize(9.5);
    pdf.setFont('helvetica', 'normal');
    const dataCityStr = `${brandCity || 'Bela Vista de Goiás'}, ${formatDateHelper((vistoria as any).dataVistoria || vistoria.data)}.`;
    pdf.text(dataCityStr, 190, y, { align: 'right' });
    y += 25;

    // Linhas de assinatura (posições estruturadas com suporte a múltiplos locatários)
    y = checkPageBreak(y, 80);
    pdf.setLineWidth(0.3);
    pdf.setDrawColor(0, 0, 0);
    
    if (locatariosList.length === 1) {
      // Linha 1 - 1 LOCATÁRIO e LOCADOR lado a lado
      pdf.line(20, y, 80, y);
      pdf.line(110, y, 190, y);
      y += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      const locName = locatariosList[0]?.nome ? `LOCATÁRIO: ${locatariosList[0].nome.toUpperCase()}` : 'LOCATÁRIO';
      const splitLoc = pdf.splitTextToSize(locName, 65);
      pdf.text(splitLoc, 50, y, { align: 'center' });
      pdf.text('LOCADOR', 150, y, { align: 'center' });
      y += Math.max(splitLoc.length * 4.5, 5) + 15;
    } else {
      // Múltiplos locatários: gera linha para cada um em pares
      for (let i = 0; i < locatariosList.length; i += 2) {
        y = checkPageBreak(y, 35);
        const loc1 = locatariosList[i];
        const loc2 = locatariosList[i + 1];

        pdf.line(20, y, 80, y);
        if (loc2) {
          pdf.line(110, y, 190, y);
        }
        y += 5;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        
        const label1 = `LOCATÁRIO ${i + 1}: ${(loc1?.nome || '').toUpperCase()}`;
        const split1 = pdf.splitTextToSize(label1, 65);
        pdf.text(split1, 50, y, { align: 'center' });

        if (loc2) {
          const label2 = `LOCATÁRIO ${i + 2}: ${(loc2?.nome || '').toUpperCase()}`;
          const split2 = pdf.splitTextToSize(label2, 65);
          pdf.text(split2, 150, y, { align: 'center' });
        }
        y += Math.max(split1.length * 4.5, 5) + 15;
      }

      // Linha do LOCADOR
      y = checkPageBreak(y, 30);
      pdf.line(65, y, 145, y);
      y += 5;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text('LOCADOR', 105, y, { align: 'center' });
      y += 20;
    }

    // Linha AVALISTA centralizado
    y = checkPageBreak(y, 30);
    pdf.line(65, y, 145, y);
    y += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('AVALISTA', 105, y, { align: 'center' });
    y += 20;

    // Caixa TESTEMUNHAS
    y = checkPageBreak(y, 45);
    pdf.setDrawColor(0, 48, 102);
    pdf.roundedRect(20, y, 170, 35, 3, 3, 'S');
    y += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 48, 102);
    pdf.text('TESTEMUNHAS:', 25, y);
    pdf.setTextColor(0, 0, 0);
    y += 8;
    pdf.setFont('helvetica', 'normal');
    pdf.setDrawColor(180, 180, 180);
    pdf.line(25, y, 100, y);
    pdf.text('1-', 25, y + 4);
    y += 12;
    pdf.line(25, y, 100, y);
    pdf.text('2-', 25, y + 4);

    const primaryTenantName = locatariosList[0]?.nome || vistoria.locatario?.nome || 'Doc';
    const fileName = `Vistoria_${primaryTenantName.replace(/\s/g, '_')}.pdf`;
    
    // Output as Blob to open in new window
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);

    if (options?.forceDownload) {
      pdf.save(fileName);
      toast.success("PDF gerado e baixado com sucesso!", { id: toastId });
    } else {
      const newWindow = window.open(url, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        // If popup is blocked, fallback to direct download
        pdf.save(fileName);
        toast.success("PDF gerado e baixado com sucesso!", { id: toastId });
      } else {
        toast.success("PDF gerado com sucesso!", { id: toastId });
      }
    }
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    toast.error("Ocorreu um erro ao gerar o PDF.", { id: toastId });
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
              {/* Card de Tipo de Vistoria */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <Home className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h3 className="font-bold text-slate-900">TIPO DE VISTORIA</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipoVistoria('entrada')}
                    className={cn(
                      "py-3 rounded-xl text-sm font-black uppercase tracking-wide transition-all border-2",
                      tipoVistoria === 'entrada'
                        ? "bg-green-500 text-white border-green-500 shadow-sm"
                        : "bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100"
                    )}
                  >
                    Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoVistoria('saida')}
                    className={cn(
                      "py-3 rounded-xl text-sm font-black uppercase tracking-wide transition-all border-2",
                      tipoVistoria === 'saida'
                        ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                        : "bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100"
                    )}
                  >
                    Saída
                  </button>
                </div>

                {tipoVistoria === 'saida' && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                      Vistoria de Entrada Correspondente (opcional)
                    </label>
                    <select
                      value={vistoriaEntradaId || ''}
                      onChange={e => setVistoriaEntradaId(e.target.value || null)}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all"
                    >
                      <option value="">Nenhuma / não localizada</option>
                      {vistorias.filter(v => v.tipo !== 'saida' && v.imovel?.endereco).map(v => (
                        <option key={v.id} value={v.id}>
                          {v.imovel.endereco} — {v.locatario?.nome || 'Sem locatário'} ({v.data})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 ml-1">
                      Vincule a vistoria de entrada do mesmo imóvel para facilitar a comparação de danos.
                    </p>
                  </div>
                )}
              </div>

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
                  <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center">
                    <UserCheck className="w-4 h-4 text-teal-600" />
                  </div>
                  <h3 className="font-bold text-slate-900">Dados do Vistoriador</h3>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Nome do Vistoriador Responsável</label>
                  <input
                    type="text"
                    value={vistoriadorNome}
                    onChange={e => setVistoriadorNome(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Nome de quem está fazendo a vistoria"
                  />
                  <p className="text-[10px] text-slate-400 ml-1">
                    Já vem preenchido com o seu nome — mude aqui se outra pessoa da equipe estiver fazendo essa vistoria.
                  </p>
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
                  <div className="space-y-3 p-4 rounded-2xl bg-purple-50/50 border border-purple-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
                        <span className="text-purple-600 text-xs font-black">IA</span>
                      </div>
                      <label className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                        Gerar laudo automaticamente
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Envie aqui <strong>só as fotos que mostram os danos/problemas</strong> que você quer que a IA
                      destaque no laudo — não precisa ser o registro completo do imóvel. As fotos gerais de cada
                      cômodo (entrada, sala, cozinha, tudo certinho) você adiciona na próxima etapa, e todas elas
                      entram no PDF final normalmente.
                    </p>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                        Descrição livre (fale ou digite)
                      </label>
                      <button
                        type="button"
                        onClick={handleToggleGravacaoVoz}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                          isGravandoAudio
                            ? "bg-red-500 text-white animate-pulse"
                            : "bg-white border border-purple-200 text-purple-600 hover:bg-purple-50"
                        )}
                      >
                        <Mic className="w-3.5 h-3.5" />
                        {isGravandoAudio ? 'Ouvindo... toque para parar' : 'Falar em vez de digitar'}
                      </button>
                    </div>
                    <textarea
                      value={descricaoGeral}
                      onChange={e => setDescricaoGeral(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-white border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500/20 transition-all"
                      placeholder="Ex: parede da sala com um furo perto da janela, piso do quarto 2 riscado, torneira da cozinha pingando..."
                    />

                    <div
                      className="space-y-2 p-3 rounded-2xl border-2 border-dashed border-transparent hover:border-purple-200 transition-colors"
                      {...handleDropZoneEvents(processAndAttachFotosGerais)}
                    >
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                          Fotos de Destaque dos Danos ({fotosGerais.length}) — arraste e solte aqui
                        </label>
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-200 text-purple-600 rounded-lg text-xs font-bold cursor-pointer hover:bg-purple-50 transition-all">
                          <Upload className="w-3.5 h-3.5" />
                          Adicionar Fotos
                          <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUploadGeral} />
                        </label>
                      </div>
                      {fotosGerais.length > 0 && (
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                          {fotosGerais.map((foto, pIdx) => (
                            <div key={pIdx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200">
                              <img src={foto} alt={`Foto ${pIdx + 1}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => handleRemoveFotoGeral(pIdx)}
                                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleGerarLaudoComIA}
                      disabled={isGerandoLaudo}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      {isGerandoLaudo ? 'Gerando...' : 'Gerar Laudo com IA'}
                    </button>
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
                <div key={cIdx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
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
                  <div
                    className="pt-4 border-t border-slate-100 rounded-2xl transition-colors"
                    {...handleDropZoneEvents((files) => processAndAttachComodoPhotos(cIdx, files))}
                  >
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Fotos do Cômodo — arraste e solte aqui</p>
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
                      tipo: tipoVistoria,
                      vistoriaEntradaId,
                      vistoriadorNome,
                      descricaoGeral,
                      fotosGerais,
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

              <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 text-left space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <PenTool className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h4 className="font-bold text-slate-900">Assinatura Digital (CredSign)</h4>
                </div>
                <p className="text-xs text-slate-500">
                  Baixe o PDF e envie para assinatura pelo CredPago/CredSign. Depois de enviar, marque o status
                  abaixo e cole o link (se tiver) pra manter o controle de quais vistorias já foram assinadas.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    const tempVistoria: Vistoria = {
                      id: editingVistoria?.id || 'preview',
                      corretorId: user.uid,
                      corretorNome: user.displayName || profile?.displayName || 'Corretor',
                      companyId: profile?.companyId || 'default',
                      tipo: tipoVistoria,
                      vistoriaEntradaId,
                      vistoriadorNome,
                      descricaoGeral,
                      fotosGerais,
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
                    handleEnviarParaAssinatura(tempVistoria);
                  }}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <PenTool className="w-4 h-4" />
                  Baixar PDF e Abrir CredSign
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Status</label>
                    <select
                      value={statusAssinatura}
                      onChange={e => setStatusAssinatura(e.target.value as any)}
                      className="w-full mt-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-400 transition-colors"
                    >
                      <option value="nao_enviado">Não enviado</option>
                      <option value="enviado">Enviado p/ assinatura</option>
                      <option value="assinado">Assinado</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Link do CredSign (opcional)</label>
                    <input
                      type="text"
                      value={linkAssinatura}
                      onChange={e => setLinkAssinatura(e.target.value)}
                      placeholder="Cole o link aqui"
                      className="w-full mt-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-400 transition-colors"
                    />
                  </div>
                </div>
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