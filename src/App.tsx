/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { useState, useMemo, useEffect, createContext, useContext, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from 'sonner';
import { 
  CheckCircle2, 
  Circle, 
  LayoutDashboard, 
  BarChart3, 
  Plus, 
  AlertCircle, 
  ExternalLink, 
  Upload, 
  FileText, 
  Send, 
  Copy,
  Database,
  X,
  Zap,
  Calendar as CalendarIcon,
  ChevronRight,
  Download,
  Filter,
  Clock,
  Repeat,
  Trash2,
  ChevronLeft,
  MoreVertical,
  LogOut,
  Users as UsersIcon,
  Shield,
  ShieldAlert,
  HelpCircle,
  BookOpen,
  User as UserIcon,
  Settings,
  Search,
  Building2,
  Mail,
  Camera,
  DollarSign,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  ClipboardList,
  Key,
  Home,
  Edit2,
  Check,
  Archive,
  History,
  MessageSquare,
  LayoutList,
  PlusCircle,
  Minimize2,
  Maximize2,
  Menu,
  Sliders,
  Calculator,
  Landmark,
  LayoutGrid,
  ClipboardCheck,
  Wallet
} from "lucide-react";
import { format, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { cn } from "./lib/utils";
const VistoriaView = lazy(() => import('./components/VistoriaView').then(m => ({ default: m.VistoriaView })));
const DespejoView = lazy(() => import('./components/DespejoView').then(m => ({ default: m.DespejoView })));
const ComissoesView = lazy(() => import('./components/ComissoesView').then(m => ({ default: m.ComissoesView })));
const SimuladorView = lazy(() => import('./components/SimuladorView').then(m => ({ default: m.SimuladorView })));
const FinanceiroView = lazy(() => import('./components/FinanceiroView').then(m => ({ default: m.FinanceiroView })));
const PontoView = lazy(() => import('./components/ponto/PontoView').then(m => ({ default: m.PontoView })));
import { ConfirmModal } from './components/ui/ConfirmModal';
import { Task, Priority, Tool, RecurrenceType, UserProfile, ProcessInstance, CompanySettings, ProcessTemplate, ProcessStep, KanbanColumn } from "./types";
import { 
  auth, 
  db, 
  loginWithGoogle, 
  loginWithEmail,
  registerWithEmail,
  updateProfile,
  logout, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  Timestamp,
  handleFirestoreError,
  OperationType,
  User,
  arrayUnion,
  isDemoMode
} from "./firebase";

import { getApp } from "firebase/app";
import { 
  getFirestore, 
  collection as rawCollection, 
  getDocs as rawGetDocs, 
  doc as rawDoc, 
  setDoc as rawSetDoc 
} from "firebase/firestore";

const handleOpenAttachment = (url: string, name: string) => {
  if (!url) return;
  
  if (url.startsWith('data:')) {
    try {
      const parts = url.split(',');
      const contentType = parts[0].split(':')[1].split(';')[0];
      const byteCharacters = atob(parts[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: contentType });
      const blobUrl = URL.createObjectURL(blob);
      
      const newWindow = window.open(blobUrl, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = name || 'arquivo';
        link.click();
      }
    } catch (error) {
      console.error("Error opening base64 attachment:", error);
      toast.error("Erro ao abrir o arquivo.");
    }
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

const formatCPF = (value: string) => {
  const clean = value.replace(/\D/g, "");
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
};

const isValidCPF = (cpf: string): boolean => {
  const clean = cpf.replace(/\D/g, "");
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;
  
  let sum = 0;
  let remainder;
  
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(clean.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.substring(9, 10))) return false;
  
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(clean.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.substring(10, 11))) return false;
  
  return true;
};

// --- Contexts ---

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  companySettings: CompanySettings | null;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true, isAdmin: false, companySettings: null });

const useAuth = () => useContext(AuthContext);

interface ConfirmContextType {
  confirm: (options: {
    title: string;
    message: string;
    confirmColor?: "red" | "blue" | "green";
    onConfirm: () => void;
  }) => void;
}

const ConfirmContext = createContext<ConfirmContextType>({
  confirm: () => {}
});

export const useConfirm = () => useContext(ConfirmContext);

// --- Error Boundary ---

class ErrorBoundary extends (React.Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        errorMessage = `Erro no Firestore (${parsed.operationType}): ${parsed.error}`;
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-[32px] shadow-xl max-w-md w-full text-center border border-red-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Ops! Algo deu errado</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-[#3B82F6] text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-95 transition-all"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Components ---

const LogoImage = ({ size = "h-12 w-12", url }: { size?: string, url?: string }) => {
  const [error, setError] = useState(false);

  // Se não houver URL ou houver erro, renderizamos um logo estilizado em CSS/SVG
  if (!url || error) {
    return (
      <div className={cn("relative flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl text-white shadow-lg overflow-hidden group", size)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent)] opacity-50" />
        <div className="relative z-10 flex items-center justify-center">
          <Key className="w-3/5 h-3/5 stroke-[2.5px] drop-shadow-md transform group-hover:rotate-12 transition-transform duration-500" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-sky-300 rounded-full blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    );
  }

  return (
    <img 
      src={url} 
      alt="Logo" 
      className={cn("object-contain relative z-10", size)}
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
    />
  );
};

const Login = () => {
  const { companySettings } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inviteRole, setInviteRole] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('active_invite_token');
    if (token) {
      const fetchInvite = async () => {
        try {
          const inviteRef = doc(db, "invites", token);
          const snap = await getDoc(inviteRef);
          if (snap.exists()) {
            const data = snap.data();
            const now = new Date();
            const expiresAt = data.expiresAt ? (data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)) : null;
            const isExpired = expiresAt ? now > expiresAt : false;
            
            if (data.status === 'pending' && !isExpired) {
              setInviteRole(data.role);
            } else if (isExpired) {
              setInviteError("Este link de convite já expirou (validade de 7 dias). Solicite um novo convite.");
              localStorage.removeItem('active_invite_token');
            } else {
              setInviteError("Este link de convite já foi utilizado ou é inválido.");
              localStorage.removeItem('active_invite_token');
            }
          } else {
            localStorage.removeItem('active_invite_token');
          }
        } catch (e) {
          console.error("Erro ao carregar convite na tela de login:", e);
        }
      };
      
      fetchInvite();
    }
  }, []);

  const isForcedDemo = localStorage.getItem("pc_force_demo_mode") === "true";

  const handleForceDemo = () => {
    localStorage.setItem("pc_force_demo_mode", "true");
    localStorage.setItem("pc_auth_user", JSON.stringify({
      uid: "williangyn10_uid",
      email: "williangyn10@gmail.com",
      displayName: "Willian Admin",
      photoURL: "https://ui-avatars.com/api/?name=Admin&background=random"
    }));
    window.location.reload();
  };

  const handleDeactivateDemo = () => {
    localStorage.removeItem("pc_force_demo_mode");
    localStorage.removeItem("pc_auth_user");
    window.location.reload();
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Google login error:", err);
      let errorMessage = "Falha ao entrar com Google. ";
      if (err.code === 'auth/unauthorized-domain') {
        errorMessage += `Domínio não autorizado no Firebase!\n\nPor favor, vá no Console do Firebase (Authentication -> Configurações -> Domínios Autorizados) e adicione o seguinte domínio:\n\n👉  ${window.location.hostname}`;
      } else if (err.code === 'auth/popup-blocked') {
        errorMessage += "O pop-up de login foi bloqueado pelo seu navegador. Por favor, permita pop-ups para este site ou abra o aplicativo diretamente em uma nova aba.";
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage += "O login com Google não está ativado no Firebase Console para o projeto. Ative-o em Authentication -> Sign-in method -> Google.";
      } else {
        errorMessage += `${err.message || String(err)} (${err.code || 'erro desconhecido'})`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isRegistering && !name)) {
      setError("Por favor, preencha todos os campos.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isRegistering) {
        await registerWithEmail(email, password);
        await updateProfile(auth.currentUser!, { displayName: name });
        // Profile creation is now handled by the onAuthStateChanged listener in App
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let errorMessage = "Erro de autenticação: ";
      if (err.code === 'auth/operation-not-allowed') {
        errorMessage += "O cadastro por E-mail não está ativado no Firebase. Por favor, ative 'E-mail/Senha' no Console do Firebase para o projeto gen-lang-client-0657849307.";
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMessage = "E-mail ou senha incorretos ou inexistentes.";
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = "Este e-mail já está em uso.";
      } else if (err.code === 'auth/weak-password') {
        errorMessage = "A senha deve ter pelo menos 6 caracteres.";
      } else {
        errorMessage += `${err.message || String(err)} (${err.code || 'erro desconhecido'})`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4 font-sans">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-[32px] border border-slate-100 shadow-2xl mb-6 relative group overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <LogoImage size="h-14 w-14" url={companySettings?.logoUrl} />
          </motion.div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{companySettings?.name || "Ponto Chave"}</h1>
          <p className="text-slate-500 mt-2">{companySettings?.subtitle || "Gestão e Processos"}</p>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white p-8 rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100"
        >
          {inviteRole && (
            <div className="mb-6 p-5 bg-blue-50 rounded-3xl text-blue-900 text-xs border border-blue-100/60 flex flex-col gap-1.5 text-left">
              <span className="font-extrabold flex items-center gap-1.5 text-blue-800">
                <Shield className="w-4 h-4 text-blue-600 shrink-0 animate-pulse" />
                Convite de Acesso Detectado
              </span>
              <p className="text-slate-600 leading-relaxed font-semibold">
                Você foi convidado para acessar como <strong className="text-blue-700 font-bold capitalize">{inviteRole}</strong> no sistema Ponto Chave da Fidelité Imobiliária.
              </p>
              <p className="text-slate-500 text-[10px]">
                Entre com sua conta Google abaixo para ativar sua conta e liberar seu acesso instantaneamente.
              </p>
            </div>
          )}

          {inviteError && (
            <div className="mb-6 p-4 bg-red-50 rounded-2xl text-red-900 text-xs border border-red-100/60 flex flex-col gap-1.5 text-left">
              <span className="font-bold flex items-center gap-1.5 text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                Problema com o Convite
              </span>
              <p className="text-slate-600 leading-relaxed font-semibold">
                {inviteError}
              </p>
            </div>
          )}

          {isForcedDemo && (
            <div className="mb-6 p-4 bg-amber-50 rounded-2xl text-amber-800 text-xs border border-amber-200/60 flex flex-col gap-2">
              <span className="font-bold flex items-center gap-1.5 text-amber-900">
                <Zap className="w-4 h-4 fill-amber-500 text-amber-500 shrink-0" />
                Modo Simulação Local (Offline) Ativo
              </span>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                O sistema está simulando autenticação e dados para fins de teste. Qualquer alteração será armazenada apenas no seu navegador.
              </p>
              <button
                type="button"
                onClick={handleDeactivateDemo}
                className="mt-1 font-extrabold text-blue-600 hover:text-blue-800 hover:underline text-left cursor-pointer transition-all uppercase tracking-wider text-[9px]"
              >
                Voltar para Firebase (Tempo Real)
              </button>
            </div>
          )}

          <div className="flex bg-slate-100 p-1 rounded-2xl mb-8">
            <button 
              onClick={() => { setIsRegistering(false); setError(null); }}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                !isRegistering ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <LogIn className="w-4 h-4" />
              Entrar
            </button>
            <button 
              onClick={() => { setIsRegistering(true); setError(null); }}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                isRegistering ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <UserPlus className="w-4 h-4" />
              Cadastrar
            </button>
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-2 text-center">
            {isRegistering ? "Crie sua conta" : "Bem-vindo de volta"}
          </h2>
          <p className="text-slate-500 text-sm text-center mb-8">
            {isRegistering ? "Comece a gerenciar suas atividades hoje." : "Acesse sua conta para gerenciar suas atividades."}
          </p>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 text-sm"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="font-medium whitespace-pre-line text-left block w-full">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isRegistering && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Nome Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-700 placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-700 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all text-slate-700 placeholder:text-slate-400"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#3B82F6] text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 mt-4 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                isRegistering ? "Criar Conta" : "Entrar"
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-4 text-slate-400 font-bold tracking-widest">Ou continue com</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-200 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
            Google
          </button>

          {!isForcedDemo && (
            <div className="mt-8 flex flex-col gap-4 p-5 bg-blue-50/50 rounded-3xl border border-blue-100/50 text-left">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5 justify-center">
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                  Ativou o Firebase?
                </p>
                <p className="text-[10px] text-slate-500 leading-relaxed text-center">
                  Você concluiu a configuração de Firebase! Lembre-se de habilitar os provedores de login (E-mail e Google) no console. Caso queira testar offline agora, clique no botão abaixo.
                </p>
              </div>
              <button
                onClick={handleForceDemo}
                type="button"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                Entrar no Modo Demo (Offline)
              </button>
            </div>
          )}

          <div className="mt-8 pt-8 border-t border-slate-50 text-center">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Sistema Interno de Gestão</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const UserManagement = ({ 
  allTasks, 
  allProcesses, 
  allTemplates, 
  onNavigate, 
  onSelectDate, 
  onSelectProcess 
}: { 
  allTasks: Task[], 
  allProcesses: ProcessInstance[], 
  allTemplates: ProcessTemplate[],
  onNavigate: (tab: any) => void,
  onSelectDate: (date: Date) => void,
  onSelectProcess: (id: string) => void
}) => {
  const { user, isAdmin, companySettings } = useAuth();
  const { confirm } = useConfirm();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addUserModalType, setAddUserModalType] = useState<'register' | 'invite'>('register');
  const [generatedInviteMessage, setGeneratedInviteMessage] = useState('');
  const [isInviteSuccess, setIsInviteSuccess] = useState(false);
  const [isRegisterSuccess, setIsRegisterSuccess] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "user">("user");
  const [newUserRoleInvite] = useState<"Colaborador" | "Corretor" | "Gestor">("Colaborador");
  const [inviteTokenGenerated] = useState("");
  const [inviteUrlGenerated] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, userId: string | null }>({ isOpen: false, userId: null });
  const [editingUserProfile, setEditingUserProfile] = useState<UserProfile | null>(null);
  const [subTab, setSubTab] = useState<'members' | 'rateio'>('members');

  useEffect(() => {
    if (!companySettings?.id) return;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const companyId = companySettings.id;
        const q = query(collection(db, "users"), where("companyId", "==", companyId));
        const snapshot = await getDocs(q);
        const usersData = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          const p = {
            ...data,
            uid: data.uid || docSnap.id,
          } as UserProfile;

          // Requirement 4: Set permRateioVendas and permRateioLocacao to false for "Iara Teles Dias" (Colaborador)
          if (p.displayName === "Iara Teles Dias" && (p.permRateioVendas !== false || p.permRateioLocacao !== false)) {
            p.permRateioVendas = false;
            p.permRateioLocacao = false;
            const currentPerms = p.permissions || [];
            p.permissions = currentPerms.filter(perm => perm !== "rateio_vendas" && perm !== "rateio_locacao");
            
            updateDoc(doc(db, "users", p.uid), {
              permRateioVendas: false,
              permRateioLocacao: false,
              permissions: p.permissions
            }).catch(err => console.error("Erro ao definir defaults para Iara Teles Dias:", err));
          }
          return p;
        }).filter(u => u.displayName || u.email);
        
        // Sort users: Admins first, then by name
        const sortedUsers = [...usersData].sort((a, b) => {
          if (a.role === "admin" && b.role !== "admin") return -1;
          if (a.role !== "admin" && b.role === "admin") return 1;
          return (a.displayName || "").localeCompare(b.displayName || "");
        });

        setUsers(sortedUsers);
        setLoading(false);
      } catch (error: any) {
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, "users");
      }
    };

    fetchUsers();
  }, [companySettings?.id]);

  const filteredUsers = users.filter(u => {
    const name = (u.displayName || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    const search = searchTerm.toLowerCase();
    return name.includes(search) || email.includes(search);
  });

  const togglePermission = async (userId: string, currentPermissions: string[] = [], permission: string) => {
    const newPermissions = currentPermissions.includes(permission)
       ? currentPermissions.filter(p => p !== permission)
       : [...currentPermissions, permission];
     
    const hasPerm = newPermissions.includes(permission);
    const updates: any = { permissions: newPermissions };

    if (permission === "comissoes") {
      updates.permComissoes = hasPerm;
      updates.perm_comissoes = hasPerm;
    } else if (permission === "financeiro") {
      updates.permFinanceiro = hasPerm;
      updates.perm_financeiro = hasPerm;
    } else if (permission === "vistorias") {
      updates.permVistorias = hasPerm;
      updates.perm_vistorias = hasPerm;
    } else if (permission === "processos") {
      updates.permProcessos = hasPerm;
      updates.perm_processos = hasPerm;
    }

    try {
      await updateDoc(doc(db, "users", userId), updates);
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, ...updates } : u));
      toast.success("Permissão atualizada com sucesso.");
    } catch (error) {
      toast.error("Erro ao atualizar permissão.");
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const deleteUser = (userId: string) => {
    if (userId === user?.uid) {
      toast.error("Você não pode excluir sua própria conta.");
      return;
    }
    setDeleteConfirm({ isOpen: false, userId }); 
    setDeleteConfirm({ isOpen: true, userId });
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserProfile) return;
    try {
      let docId = editingUserProfile.uid;
      
      // Se uid parece ser um pending_id, buscar pelo e-mail
      if (docId.startsWith("pending_") || !docId) {
        const q = query(collection(db, "users"), where("email", "==", editingUserProfile.email));
         const snap = await getDocs(q);
        if (!snap.empty) {
          docId = snap.docs[0].id;
        }
      }
      
      const userRef = doc(db, "users", docId);
      const permissions = editingUserProfile.permissions || [];
      const updates: Partial<UserProfile> = {
        displayName: editingUserProfile.displayName,
        email: editingUserProfile.email ? editingUserProfile.email.trim().toLowerCase() : "",
        role: editingUserProfile.role,
        cargoComissao: editingUserProfile.cargoComissao || null,
        permissions,
        permRateioLocacao: editingUserProfile.permRateioLocacao ?? true,
        permRateioVendas: editingUserProfile.permRateioVendas ?? true,
        permComissoes: permissions.includes("comissoes"),
        perm_comissoes: permissions.includes("comissoes"),
        permFinanceiro: permissions.includes("financeiro"),
        perm_financeiro: permissions.includes("financeiro"),
        permVistorias: permissions.includes("vistorias"),
        perm_vistorias: permissions.includes("vistorias"),
        permProcessos: permissions.includes("processos"),
        perm_processos: permissions.includes("processos"),
        permPonto: editingUserProfile.permPonto ?? true,
        perm_ponto: editingUserProfile.permPonto ?? true,
        jornadaDiariaMinutos: Number(editingUserProfile.jornadaDiariaMinutos) || 480
      };
      
      await updateDoc(userRef, updates);
      
      // update local list
      setUsers(prev => prev.map(u => u.uid === editingUserProfile.uid ? { ...u, ...updates } : u));
      toast.success("Membro atualizado com sucesso!");
      setEditingUserProfile(null);
    } catch (error) {
      toast.error("Erro ao atualizar dados do membro.");
      console.error("Erro ao atualizar membro:", error);
    }
  };

  const copyInviteText = (u: UserProfile) => {
    const text = `Olá ${u.displayName || 'Colaborador'}, seu acesso ao ${companySettings?.name || 'Ponto Chave'} já está liberado!\n\nPara acessar, utilize seu e-mail: ${u.email}\n\nLink do sistema: ${window.location.origin}\n\nBem-vindo(a) à equipe!`;
    navigator.clipboard.writeText(text);
    toast.success("Texto de convite copiado para o WhatsApp!");
  };

  const handleGenerateInviteLink = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const companyId = companySettings?.id || "default_agency";
      const link = `${window.location.origin}/?invite=${companyId}`;

      navigator.clipboard.writeText(link).then(() => {
        toast.success("Link de convite copiado! Qualquer pessoa com este link pode solicitar acesso à equipe.");
      }).catch(() => {
        toast.success(`Link de convite: ${link}`);
      });

      setIsAddUserOpen(false);
    } catch (error) {
      console.error("Erro ao gerar link:", error);
      toast.error("Erro ao gerar link de convite.");
    }
  };

  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserName) {
      toast.error("Preencha todos os campos.");
      return;
    }
    
    // Validação de email básica
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail.trim())) {
      toast.error("Email inválido.");
      return;
    }

    try {
      if (!companySettings?.id) {
        toast.error("Erro de configuração: Empresa não identificada.");
        return;
      }
      
      if (!user?.uid) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }
      
      const emailNormalizado = newUserEmail.trim().toLowerCase();
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", emailNormalizado));
      const existing = await getDocs(q);
      if (!existing.empty) {
        toast.error("Já existe um cadastro ou convite com este email.");
        return;
      }
      
      const tempId = `pending_${Date.now()}`;
      await setDoc(doc(db, "users", tempId), {
        uid: tempId,
        displayName: newUserName.trim(),
        email: emailNormalizado,
        role: newUserRole,
        companyId: companySettings.id,
        status: "active",
        isPending: false,
        createdAt: serverTimestamp(),
        invitedBy: user.uid,
        invitedByName: user.displayName || user.email || "Admin",
        invitedAt: serverTimestamp(),
      });

      const linkSistema = window.location.origin;
      const nomeEmpresa = companySettings?.name || 'Ponto Chave';
      const mensagem = `Olá ${newUserName.trim()}! 👋\n\n` +
        `Você foi convidado(a) para acessar o sistema *${nomeEmpresa}*.\n\n` +
        `📧 Use este email para entrar: ${emailNormalizado}\n` +
        `🔗 Link do sistema: ${linkSistema}\n\n` +
        `Basta clicar no link e fazer login com o email acima.\n\n` +
        `Qualquer dúvida, é só me chamar!`;

      setGeneratedInviteMessage(mensagem);

      if (addUserModalType === 'invite') {
        try {
          await navigator.clipboard.writeText(mensagem);
          toast.success("Mensagem de convite copiada!");
        } catch (clipErr) {
          console.warn("Clipboard falhou:", clipErr);
        }
        setIsInviteSuccess(true);
      } else {
        toast.success("Usuário cadastrado com sucesso!");
        setIsRegisterSuccess(true);
      }
    } catch (error) {
      toast.error("Erro ao cadastrar usuário.");
      console.error(error);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return (parts[0]?.charAt(0) || "").toUpperCase();
    return ((parts[0]?.charAt(0) || "") + (parts[parts.length - 1]?.charAt(0) || "")).toUpperCase();
  };

  const getUserRoleBadge = (u: UserProfile) => {
    if (u.status === "pending") {
      return { 
        label: "PENDENTE", 
        className: "bg-amber-50 text-amber-700 border border-amber-200" 
      };
    }
    if (u.role === "admin") {
      return { 
        label: "ADMIN", 
        className: "bg-purple-50 text-purple-700 border border-purple-200" 
      };
    }
    if (u.role === "corretor") {
      return { 
        label: "CORRETOR", 
        className: "bg-blue-50 text-blue-700 border border-blue-200" 
      };
    }
    if (u.role === "captador") {
      return { 
        label: "CAPTADOR", 
        className: "bg-teal-50 text-teal-700 border border-teal-200" 
      };
    }
    if (u.role === "user") {
      return { 
        label: "COLABORADOR", 
        className: "bg-slate-50 text-slate-500 border border-slate-200" 
      };
    }
    // Fallbacks para dados anteriores e cargoComissao
    const cargo = u.cargoComissao || "";
    if (cargo === "GESTOR") {
      return { 
        label: "GESTOR", 
        className: "bg-emerald-50 text-emerald-700 border border-emerald-200" 
      };
    }
    if (cargo === "CORRETOR" || cargo === "SOCIO") {
      return { 
        label: "CORRETOR", 
        className: "bg-blue-50 text-blue-700 border border-blue-200" 
      };
    }
    if (cargo === "CAPTADOR") {
      return { 
        label: "CAPTADOR", 
        className: "bg-teal-50 text-teal-700 border border-teal-200" 
      };
    }
    return { 
      label: "COLABORADOR", 
      className: "bg-slate-50 text-slate-500 border border-slate-200" 
    };
  };

  if (selectedUser) {
    return (
      <UserActivityView 
        userProfile={selectedUser} 
        tasks={allTasks} 
        processes={allProcesses} 
        templates={allTemplates} 
        onBack={() => setSelectedUser(null)}
        onNavigate={onNavigate}
        onSelectDate={onSelectDate}
        onSelectProcess={onSelectProcess}
      />
    );
  }

  return (
    <div className="bg-[#F8F9FA] rounded-2xl p-5 border border-slate-200/60 shadow-sm space-y-6 animate-fadeIn">
      {/* CABEÇALHO */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Gestão de Usuários</h2>
          <p className="text-xs text-slate-500 font-medium">Gerencie permissões e acessos</p>
        </div>
        
        {/* Only show actions and search filter if in members sub-tab view */}
        {(subTab === "members" || !isAdmin) && (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
            {/* Botão Cadastrar Manual (azul) */}
            <button 
              type="button"
              id="btn-register-manual"
              onClick={() => {
                setAddUserModalType('register');
                setIsInviteSuccess(false);
                setIsRegisterSuccess(false);
                setNewUserEmail('');
                setNewUserName('');
                setNewUserRole('user');
                setIsAddUserOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all w-full sm:w-auto cursor-pointer shadow-sm"
            >
              <UserPlus className="w-3.8 h-3.8" />
              Cadastrar Manual
            </button>

            {/* Botão Convidar por Link (outline) */}
            <button 
              type="button"
              id="btn-invite-link"
              onClick={() => {
                setAddUserModalType('invite');
                setIsInviteSuccess(false);
                setIsRegisterSuccess(false);
                setGeneratedInviteMessage('');
                setIsAddUserOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-blue-600 text-blue-600 hover:bg-blue-50/50 rounded-xl font-bold text-xs uppercase tracking-wider transition-all w-full sm:w-auto cursor-pointer"
            >
              <Send className="w-3.8 h-3.8" />
              Convidar por Link
            </button>

            {/* Campo de Busca */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                id="search-users-input"
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* NAVEGAÇÃO DE SUB-ABAS */}
      {isAdmin && (
        <div className="flex border-b border-slate-200 -mt-2">
          <button
            type="button"
            onClick={() => setSubTab('members')}
            className={`py-3 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              subTab === 'members'
                ? "border-blue-600 text-blue-700 font-extrabold"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Lista de Usuários
          </button>
          <button
            type="button"
            onClick={() => setSubTab('rateio')}
            className={`py-3 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              subTab === 'rateio'
                ? "border-blue-600 text-blue-700 font-extrabold"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Elegibilidade para Rateio
          </button>
        </div>
      )}

      {/* VIEW: LISTA DE USUÁRIOS */}
      {(subTab === "members" || !isAdmin) && (
        <div className="bg-white rounded-2xl border border-slate-205/60 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">USUÁRIO</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">E-MAIL</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">CARGO</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">COMISSÕES</th>
                  <th className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-xs text-slate-400">
                      Carregando usuários...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-xs text-slate-400">
                      Nenhum usuário cadastrado.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const badge = getUserRoleBadge(u);
                    const hasComissoes = u.permissions?.includes("comissoes");
                    return (
                      <tr key={u.uid} className="hover:bg-blue-50/40 transition-colors group/row">
                        {/* USUÁRIO */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="shrink-0 cursor-pointer" onClick={() => setSelectedUser(u)}>
                              <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center overflow-hidden border border-blue-100 hover:border-blue-400 transition-colors">
                                {u.photoURL ? (
                                  <img src={u.photoURL} alt={u.displayName || ""} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <span className="text-xs font-bold">{getInitials(u.displayName || u.email)}</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span 
                                onClick={() => setSelectedUser(u)}
                                className="font-bold text-slate-900 text-sm hover:text-blue-600 transition-colors cursor-pointer"
                              >
                                {u.displayName || "Usuário sem nome"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* E-MAIL */}
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-slate-500 font-medium font-mono">
                            {u.email}
                          </span>
                        </td>

                        {/* CARGO */}
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>

                        {/* COMISSÕES */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center">
                            <button
                              type="button"
                              id={`toggle-comm-${u.uid}`}
                              onClick={() => togglePermission(u.uid, u.permissions || [], "comissoes")}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                hasComissoes ? "bg-blue-600" : "bg-slate-200"
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-all ${
                                  hasComissoes ? "translate-x-4.5" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </div>
                        </td>

                        {/* AÇÕES */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {u.status === "pending" && (
                              <button 
                                id={`approve-btn-${u.uid}`}
                                onClick={() => {
                                  confirm({
                                    title: "Aprovar Cadastro?",
                                    message: `Aprovar o cadastro de ${u.displayName || u.email}?`,
                                    confirmColor: "green",
                                    onConfirm: async () => {
                                      try {
                                        await updateDoc(doc(db, "users", u.uid), {
                                          status: "active",
                                          isPending: false
                                        });
                                        setUsers(prev => prev.map(item => item.uid === u.uid ? { ...item, status: "active", isPending: false } : item));
                                        toast.success("Membro aprovado com sucesso! Agora você já pode configurar cargos nas comissões.");
                                      } catch (err) {
                                        console.error(err);
                                        toast.error("Erro ao aprovar membro.");
                                      }
                                    }
                                  });
                                }}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                                title="Aprovar Membro"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Aprovar
                              </button>
                            )}
                            
                            <button 
                              id={`edit-cargo-btn-${u.uid}`}
                              onClick={() => setEditingUserProfile({ ...u })}
                              className="p-1.5 bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                              title="Editar Cargo"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button 
                              id={`delete-user-btn-${u.uid}`}
                              onClick={() => deleteUser(u.uid)}
                              className="p-1.5 bg-slate-50 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                              title="Excluir Usuário"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: ELEGIBILIDADE PARA RATEIO */}
      {subTab === 'rateio' && isAdmin && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header informativo */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
              <UsersIcon className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Elegibilidade para Rateio</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-1 font-medium">
                Defina quais membros da equipe podem ser incluídos nos rateios de comissão de Vendas e Locações.
              </p>
            </div>
          </div>

          {/* Tabela de Elegibilidade */}
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/60 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipe</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cargo</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Permissões de Rateio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/70">
                  {users.map((usr) => {
                    const isEligibleVendas = usr.permRateioVendas !== false;
                    const isEligibleLocacao = usr.permRateioLocacao !== false;

                    const roleInfo = getUserRoleBadge(usr);

                    // Avatar color logic
                    let avatarBg = "bg-slate-100 text-slate-600";
                    const role = usr.role;
                    const cargo = usr.cargoComissao || "";
                    if (role === "admin") {
                      avatarBg = "bg-blue-100 text-blue-700";
                    } else if (role === "gestor" || cargo === "GESTOR") {
                      avatarBg = "bg-purple-100 text-purple-700";
                    } else if (role === "corretor" || role === "captador" || cargo === "CORRETOR" || cargo === "CAPTADOR") {
                      avatarBg = "bg-emerald-100 text-emerald-700";
                    }

                    return (
                      <tr key={usr.uid} className="hover:bg-blue-50/40 transition-colors">
                        {/* Membro */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full ${avatarBg} font-black text-xs flex items-center justify-center shrink-0`}>
                              {getInitials(usr.displayName || usr.email)}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">
                                {usr.displayName || "Usuário sem nome"}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium block font-mono">
                                {usr.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Cargo badge */}
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${roleInfo.className}`}>
                            {roleInfo.label}
                          </span>
                        </td>

                        {/* Toggles */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-8">
                            {/* Vendas Toggle */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Vendas</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  const newEligible = !isEligibleVendas;
                                  const userRef = doc(db, "users", usr.uid);
                                  const currentPerms = usr.permissions || [];
                                  const newPerms = newEligible
                                    ? [...currentPerms.filter(p => p !== "rateio_vendas"), "rateio_vendas"]
                                    : currentPerms.filter(p => p !== "rateio_vendas");
                                  try {
                                    await updateDoc(userRef, {
                                      permRateioVendas: newEligible,
                                      permissions: newPerms
                                    });
                                    setUsers(prev => prev.map(u => u.uid === usr.uid ? {
                                      ...u,
                                      permRateioVendas: newEligible,
                                      permissions: newPerms
                                    } : u));
                                    toast.success(`Elegibilidade de vendas atualizada para ${usr.displayName || usr.email}`);
                                  } catch (error) {
                                    toast.error("Erro ao atualizar elegibilidade.");
                                  }
                                }}
                                className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0 ${isEligibleVendas ? 'bg-emerald-500' : 'bg-slate-200'}`}
                              >
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isEligibleVendas ? 'translate-x-5' : ''}`} />
                              </button>
                            </div>

                            {/* Locações Toggle */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Locações</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  const newEligible = !isEligibleLocacao;
                                  const userRef = doc(db, "users", usr.uid);
                                  const currentPerms = usr.permissions || [];
                                  const newPerms = newEligible
                                    ? [...currentPerms.filter(p => p !== "rateio_locacao"), "rateio_locacao"]
                                    : currentPerms.filter(p => p !== "rateio_locacao");
                                  try {
                                    await updateDoc(userRef, {
                                      permRateioLocacao: newEligible,
                                      permissions: newPerms
                                    });
                                    setUsers(prev => prev.map(u => u.uid === usr.uid ? {
                                      ...u,
                                      permRateioLocacao: newEligible,
                                      permissions: newPerms
                                    } : u));
                                    toast.success(`Elegibilidade de locações atualizada para ${usr.displayName || usr.email}`);
                                  } catch (error) {
                                    toast.error("Erro ao atualizar elegibilidade.");
                                  }
                                }}
                                className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0 ${isEligibleLocacao ? 'bg-emerald-500' : 'bg-slate-200'}`}
                              >
                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isEligibleLocacao ? 'translate-x-5' : ''}`} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUSÃO */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setDeleteConfirm({ isOpen: false, userId: null })}
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 p-8 text-center"
          >
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Usuário?</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-8">
              Tem certeza que deseja excluir este usuário? Ele perderá o acesso ao sistema <span className="text-red-500 font-bold">imediatamente</span>.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={async () => {
                  if (deleteConfirm.userId) {
                    try {
                      await updateDoc(doc(db, "users", deleteConfirm.userId), { status: "blocked", role: "none" });
                      await deleteDoc(doc(db, "users", deleteConfirm.userId));
                      setUsers(prev => prev.filter(u => u.uid !== deleteConfirm.userId));
                      toast.success("Usuário removido com sucesso.");
                    } catch (error) {
                      toast.error("Erro ao excluir usuário.");
                      handleFirestoreError(error, OperationType.DELETE, `users/${deleteConfirm.userId}`);
                    }
                  }
                  setDeleteConfirm({ isOpen: false, userId: null });
                }}
                className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-red-500/25 hover:bg-red-650 transition-all cursor-pointer"
              >
                Confirmar Exclusão
              </button>
              <button 
                onClick={() => setDeleteConfirm({ isOpen: false, userId: null })}
                className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-slate-200 transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DO USUÁRIO */}
      <AnimatePresence>
        {editingUserProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setEditingUserProfile(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl border border-slate-100 text-left max-h-[90vh] flex flex-col overflow-hidden"
            >
              <form onSubmit={handleSaveUserEdit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                  <div className="flex justify-between items-center mb-5">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Configurar Membro</h3>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Ajuste o acesso corporativo</p>
                    </div>
                    <button type="button" onClick={() => setEditingUserProfile(null)} className="p-1.5 hover:bg-slate-100 rounded-full transition-all cursor-pointer">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                {/* Card 1 — Identificação */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 transition-all hover:border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <UserIcon className="w-4 h-4 text-blue-500" />
                    <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">Identificação</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Nome</label>
                      <input
                        type="text"
                        required
                        value={editingUserProfile.displayName || ""}
                        onChange={(e) => setEditingUserProfile({ ...editingUserProfile, displayName: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold text-slate-700"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">E-mail</label>
                      <input
                        type="email"
                        required
                        value={editingUserProfile.email || ""}
                        onChange={(e) => setEditingUserProfile({ ...editingUserProfile, email: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-semibold text-slate-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Card 2 — Nível de Acesso */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 transition-all hover:border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-purple-500" />
                    <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">Nível de Acesso</span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Nível de Acesso Principal</label>
                    <select
                      value={editingUserProfile.role}
                      onChange={(e) => setEditingUserProfile({ ...editingUserProfile, role: e.target.value as any })}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      <option value="admin">Administrador</option>
                      <option value="corretor">Corretor</option>
                      <option value="captador">Captador</option>
                      <option value="user">Colaborador</option>
                    </select>
                  </div>

                  {editingUserProfile.permissions?.includes("comissoes") && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Cargo nas Comissões</label>
                      <select
                        value={editingUserProfile.cargoComissao || ""}
                        onChange={(e) => setEditingUserProfile({ ...editingUserProfile, cargoComissao: e.target.value as any })}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700 cursor-pointer"
                      >
                        <option value="">Nenhum/Corretor</option>
                        <option value="CORRETOR">Corretor</option>
                        <option value="CAPTADOR">Captador</option>
                        <option value="GESTOR">Gestor</option>
                        <option value="SOCIO">Sócio</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Card 3 — Permissões de Módulos */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 transition-all hover:border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <LayoutGrid className="w-4 h-4 text-emerald-500" />
                    <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">Permissões de Módulos</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "comissoes", label: "Comissões", color: "text-emerald-500", icon: DollarSign },
                      { id: "vistorias", label: "Vistorias", color: "text-blue-500", icon: ClipboardCheck },
                      { id: "financeiro", label: "Financeiro", color: "text-amber-500", icon: Wallet },
                      { id: "processos", label: "Processos", color: "text-purple-500", icon: FileText }
                    ].map((perm) => {
                      const isAtivo = editingUserProfile.permissions?.includes(perm.id) || false;
                      const Icon = perm.icon;

                      return (
                        <div key={perm.id} className="flex items-center justify-between p-2 pb-2.5 pt-2.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Icon className={`w-3.5 h-3.5 ${perm.color} shrink-0`} />
                            <span className="text-[11px] font-bold text-slate-700 truncate">{perm.label}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const currentPerms = editingUserProfile.permissions || [];
                              const newPerms = currentPerms.includes(perm.id)
                                ? currentPerms.filter(p => p !== perm.id)
                                : [...currentPerms, perm.id];
                              setEditingUserProfile({ ...editingUserProfile, permissions: newPerms });
                            }}
                            className={`relative w-8 h-4.5 rounded-full transition-colors shrink-0 ${isAtivo ? 'bg-emerald-500' : 'bg-slate-200'}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${isAtivo ? 'translate-x-3.5' : ''}`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Card 4 — Ponto Eletrônico CLT */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 transition-all hover:border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">Ponto Eletrônico CLT</span>
                  </div>

                  <div className="flex items-center justify-between p-2 pb-2.5 pt-2.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all">
                    <span className="text-[11px] font-bold text-slate-700">Acesso ao Ponto Eletrônico</span>
                    <button
                      type="button"
                      onClick={() => setEditingUserProfile({ 
                        ...editingUserProfile, 
                        permPonto: editingUserProfile.permPonto === false ? true : false,
                        perm_ponto: editingUserProfile.permPonto === false ? true : false
                      })}
                      className={`relative w-8 h-4.5 rounded-full transition-colors shrink-0 ${editingUserProfile.permPonto !== false ? 'bg-emerald-500' : 'bg-slate-200'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${editingUserProfile.permPonto !== false ? 'translate-x-3.5' : ''}`} />
                    </button>
                  </div>

                  {(editingUserProfile.permPonto !== false) && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-350">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                        Jornada Diária (Minutos)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        value={editingUserProfile.jornadaDiariaMinutos ?? 480}
                        onChange={(e) => setEditingUserProfile({ 
                          ...editingUserProfile, 
                          jornadaDiariaMinutos: Number(e.target.value) || 480 
                        })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs font-bold text-slate-700 font-mono"
                      />
                      <span className="text-[8.5px] text-slate-400 font-semibold block leading-normal">
                        Padrão: 480 minutos (8 horas). Corresponde a {((editingUserProfile.jornadaDiariaMinutos ?? 480) / 60).toFixed(1)}h por dia.
                      </span>
                    </div>
                  )}
                </div>

                </div>

                <div className="grid grid-cols-2 gap-3 p-6 pt-4 border-t border-slate-100 shrink-0 bg-white">
                  <button
                    type="button"
                    onClick={() => setEditingUserProfile(null)}
                    className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold uppercase tracking-wider text-[10px] transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] transition cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CADASTRAR MANUAL E CONVIDAR POR LINK DE CONVITE MODAL */}
      <AnimatePresence>
        {isAddUserOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsAddUserOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-6">
                {isInviteSuccess ? (
                  <div className="text-center space-y-5 animate-fade-in">
                    <div className="mx-auto w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 scale-105">
                      <Send className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Convite Gerado!</h3>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Convidar por Link</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-2">
                      <div className="text-[9px] text-slate-400 uppercase tracking-widest font-extrabold">Mensagem Copiada</div>
                      {newUserEmail && (
                        <div className="text-xs font-semibold text-slate-700">E-mail: <span className="font-normal text-slate-600">{newUserEmail}</span></div>
                      )}
                      
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">URL do Convite</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            readOnly 
                            value={`${window.location.origin}/?invite=${companySettings?.id || 'company'}`}
                            className="bg-white border border-slate-200 text-[10px] px-3 py-2 rounded-xl flex-1 font-mono text-slate-600 focus:outline-none"
                          />
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(`${window.location.origin}/?invite=${companySettings?.id || 'company'}`);
                                toast.success("URL copiada!");
                              } catch (err) {
                                toast.error("Falha ao copiar.");
                              }
                            }}
                            className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider hover:bg-slate-800 transition shrink-0 cursor-pointer"
                          >
                            Copiar
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 py-1.5 text-left">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Mensagem Formatada</label>
                      <textarea 
                        readOnly
                        value={generatedInviteMessage}
                        className="w-full h-20 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 focus:outline-none resize-none leading-relaxed"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(generatedInviteMessage)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 py-3 bg-emerald-500 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-sm hover:bg-emerald-600 transition cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                      <button
                        onClick={() => setIsAddUserOpen(false)}
                        className="py-2 bg-slate-100 text-slate-600 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-200 transition cursor-pointer"
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                ) : isRegisterSuccess ? (
                  <div className="text-center space-y-5">
                    <div className="mx-auto w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 scale-105">
                      <Check className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Usuário Cadastrado!</h3>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Acesso Pré-Aprovado</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left space-y-2 text-xs">
                      <div className="text-[9px] text-slate-400 uppercase tracking-widest font-extrabold">Detalhes da conta</div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-400 font-medium">Nome</span>
                        <span className="font-bold text-slate-700">{newUserName}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-400 font-medium">E-mail</span>
                        <span className="font-bold text-slate-750">{newUserEmail}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">Acesso</span>
                        <span className="font-semibold px-2 py-0.5 rounded text-[9px] uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-150">
                          {newUserRole === "admin" ? "Administrador" : "Colaborador"}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] font-medium text-slate-500 leading-relaxed text-left bg-slate-50 border border-slate-100 p-3 rounded-xl">
                      💡 <strong>Como Entrar:</strong> Basta este usuário fazer login no sistema informando exatamente o e-mail registrado acima. Ele já está ativo e poderá acessar todo o painel imediatamente.
                    </p>

                    <button
                      onClick={() => setIsAddUserOpen(false)}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-blue-700 transition cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                ) : addUserModalType === 'register' ? (
                  <div>
                    <div className="flex justify-between items-center mb-5">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Cadastrar Manual</h3>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Crie o acesso diretamente</p>
                      </div>
                      <button onClick={() => setIsAddUserOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full transition-all cursor-pointer">
                        <X className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>

                    <form onSubmit={handleManualRegister} className="space-y-4 text-left">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Nome Completo</label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: João da Silva"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-semibold text-slate-700"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">E-mail Corporativo</label>
                        <input
                          type="email"
                          required
                          placeholder="exemplo@email.com"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-semibold text-slate-700"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Nível de Acesso</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value as "admin" | "user")}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-bold text-slate-750 cursor-pointer"
                        >
                          <option value="user">Colaborador</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 mt-3 bg-blue-605 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] hover:bg-blue-700 transition cursor-pointer"
                      >
                        Confirmar Cadastro
                      </button>
                    </form>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-5">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Convidar via Link</h3>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Envie um link de cadastro rápido</p>
                      </div>
                      <button onClick={() => setIsAddUserOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full transition-all cursor-pointer">
                        <X className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>

                    <div className="space-y-4 text-left">
                      <div className="bg-blue-50/50 border border-blue-100/60 rounded-xl p-3.5 space-y-1.5 text-xs text-slate-705">
                        <p className="font-bold text-slate-800">Como funciona?</p>
                        <p className="text-[11px] leading-relaxed text-slate-600">
                          Envie este link para um corretor ou colaborador. Ao acessá-lo, ele poderá fazer o próprio cadastro. Por segurança, sua conta entrará como <strong className="text-amber-700">Pendente</strong> até que você a aprove.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Link de Convite Único</label>
                        <input 
                          type="text"
                          readOnly
                          value={`${window.location.origin}/?invite=${companySettings?.id || 'company'}`}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-[10px] font-mono text-slate-600"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                      </div>

                      <div className="pt-2">
                        <button 
                          type="button"
                          onClick={() => handleGenerateInviteLink()}
                          className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] shadow-sm hover:bg-blue-700 transition cursor-pointer"
                        >
                          Copiar Link de Convite
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

const TODAY_ISO = format(new Date(), "yyyy-MM-dd");

const MANUALS_DATA: Record<string, {
  overview: string;
  tutorial: { title: string; detail: string }[];
  dicas: string[];
  faq: { question: string; answer: string }[];
}> = {
  imobia: {
    overview: "Sistema para gestão e repasses de aluguéis. Centraliza contratos, cobranças automáticas e repasses a proprietários.",
    tutorial: [
      { title: "Acesso em meu.imobia.app com e-mail e senha", detail: "Acesse portal oficial de login e informe as suas credenciais corporativas registradas no sistema." },
      { title: "Cadastrar imóvel em Imóveis → Novo imóvel", detail: "Acesse o painel do menu esquerdo de gestão e preencha a ficha cadastral obrigatória do novo imóvel." },
      { title: "Cadastrar locatário com CPF validado", detail: "Registre as informações de identificação do inquilino garantindo que o CPF esteja validado na Receita Federal." },
      { title: "Criar contrato com índice de reajuste IGPM ou IPCA", detail: "Elabore os parâmetros, vigência e associe qual índice oficial de atualização monetária será aplicado no aniversário contratual." },
      { title: "Configurar cobranças automáticas por e-mail e WhatsApp", detail: "Ative a automação do sistema para notificar antecipadamente faturas, lembretes de pendências e notificações gerais." },
      { title: "Processar repasse em Financeiro → Repasses", detail: "Consolide os recebimentos e autorize as transferências eletrônicas das participações dos locadores titulares." },
      { title: "Gerenciar manutenções pelo portal do inquilino", detail: "Receba, aprove, recuse e direcione chamados para equipes de assistência técnica diretamente no portal integrado." },
      { title: "Exportar relatórios mensais em PDF", detail: "Obtenha visões consolidadas e consolidados contábeis fechados em arquivos PDF de alta qualidade e rapidez." }
    ],
    dicas: [
      "Filtrar vencimentos diariamente para mitigar riscos de pendências financeiras prolongadas.",
      "Ativar portal integrado para 100% dos inquilinos para descentralizar a abertura de ordens de serviço.",
      "Configurar lembretes de revisão de termos e renovação com no mínimo 60 dias de antecedência.",
      "Enviar o extrato detalhado de repasse no exato dia em que o pagamento for efetivado."
    ],
    faq: [
      { question: "Como gerar boleto?", answer: "Em Financeiro → Cobranças, selecione o contrato pretendido e acione o botão e controle 'Gerar boleto'." },
      { question: "O proprietário pode acessar?", answer: "Sim, cadastre em Configurações → Usuários com o perfil específico de Proprietário." },
      { question: "Como funciona o reajuste?", answer: "O reajuste é automatizado, aplicando-se na data anual do contrato de acordo com o índice de indexação IPCA/IGP-M parametrizado." }
    ]
  },
  cresign: {
    overview: "Assinatura digital de contratos com validade jurídica ICP-Brasil. Sem impressão, sem deslocamento.",
    tutorial: [
      { title: "Criar novo envelope", detail: "Acesse o painel unificado e inicie um novo envelope de recolhimento de assinaturas para um grupo de documentos." },
      { title: "Upload do contrato em PDF", detail: "Faça o upload do documento final de contrato no formato PDF para garantir estabilidade visual no preenchimento." },
      { title: "Adicionar signatários com nome, e-mail e CPF", detail: "Informe detalhadamente os dados de todos os assinantes civis oficiais do termo respectivo." },
      { title: "Posicionar campos de assinatura no documento", detail: "Arrastar as tags visuais de assinar nos locais reservados no contrato." },
      { title: "Enviar e acompanhar status em tempo real", detail: "Dispare os avisos eletrônicos e rastreie de perto quem já efetuou as assinaturas solicitadas." }
    ],
    dicas: [
      "Configure lembretes automáticos periódicos para que os signatários pendentes concluam a rubrica do documento.",
      "Usar templates para os contratos e aditamentos mais comuns, poupando passos repetitivos.",
      "Baixar sempre o comprovante completo de auditoria digital com endereços IP e marcos digitais."
    ],
    faq: [
      { question: "Tem validade jurídica?", answer: "Sim, possui plena validade jurídica assegurada pela MP 2.200-2 e pela Lei Federal número 14.063/2020." },
      { question: "Signatário precisa de conta?", answer: "Não, os signatários conseguem assinar diretamente no link recebido sem necessidade de criar conta prévia." },
      { question: "Link expirou?", answer: "Basta reenviar o envelope pelo gerenciador, as assinaturas que já haviam sido colhidas anteriormente serão perfeitamente preservadas." }
    ]
  },
  adapta: {
    overview: "Agente de inteligência artificial que atende, qualifica leads e agenda visitas 24h pelo WhatsApp, site e Instagram.",
    tutorial: [
      { title: "Criar conta e preencher perfil da imobiliária", detail: "Inicie o cadastro no portal informando região e especializações comerciais focadas." },
      { title: "Montar base de conhecimento com imóveis e FAQ", detail: "Abasteça as perguntas recorrentes e o portfólio para treinar o repertório informacional da IA." },
      { title: "Conectar canais: WhatsApp, site e Instagram", detail: "Integre de forma unificada os canais oficiais apontando para o seu número de atendimento." },
      { title: "Configurar fluxo de qualificação de leads", detail: "Selecione as perguntas essenciais requeridas antes do direcionamento humano." },
      { title: "Definir regras de escalada para corretores humanos", detail: "Configure sob quais requisitos e acionamentos o lead quente será passado à equipe viva." }
    ],
    dicas: [
      "Revisar detalhadamente as interações ocorridas semanalmente para treinar e ajustar inconsistências.",
      "Configurar horários de escala comercial apenas para períodos em que haja corretores humanos em plantão ativo.",
      "Usar tags automáticas baseadas em termos de conversação para segmentar os interesses dos prospects."
    ],
    faq: [
      { question: "Fala português natural?", answer: "Sim, conta com processamento avançado de linguagem natural contextualizado no mercado e gírias brasileiras." },
      { question: "Limite de conversas?", answer: "Não possui limitações de atendimentos simultâneos diários no ecossistema integrado." },
      { question: "Mostra fotos de imóveis?", answer: "Sim, o agente é capaz de transmitir fotos e links das propriedades selecionadas direto nas caixas de chat." }
    ]
  },
  loft: {
    overview: "Seguros e fianças para contratos de aluguel. Substitui o fiador com análise de crédito instantânea.",
    tutorial: [
      { title: "Informar CPF do candidato em Nova análise", detail: "Digite os números do documento do candidato no formulário principal de consulta cadastral." },
      { title: "Escolher modalidade: seguro fiança ou título de capitalização", detail: "Aplique a melhor modalidade ideal para fechar o negócio com as devidas garantias desejadas." },
      { title: "Emitir apólice com dados do contrato", detail: "Vincule o cadastro aprovado às especificações do contrato de locação e finalize a apólice correspondente." },
      { title: "Acompanhar contratos ativos e renovações", detail: "Monitore os pagamentos de prêmios vigentes e as renovações anuais automáticas." }
    ],
    dicas: [
      "Oferecer sempre pelo menos 2 modalidades de garantia locatícia para facilitar a adesão do cliente final.",
      "Acionar a cobertura do seguro de forma totalmente descomplacada por via eletrônica direto em sinistros imprevistos.",
      "Acompanhar proativamente renovações recorrentes e contratos de prazos longos com 60 dias de prazo mínimo."
    ],
    faq: [
      { question: "Prazo da análise?", answer: "A maior parte das pesquisas de CPFs traz respostas cadastrais devolvidas instantaneamente." },
      { question: "Funciona para PJ?", answer: "Sim, a análise de pessoas jurídicas é plenamente viável com o envio dos documentos societários e balanços de praxe." },
      { question: "Como acionar em inadimplência?", answer: "No menu lateral, vá em Contratos → Acionar garantia e informe os fatos ocorridos." }
    ]
  },
  comissione: {
    overview: "Gestão de comissões de corretores com splits automáticos, metas e relatórios da equipe.",
    tutorial: [
      { title: "Cadastrar corretores com percentual padrão", detail: "Preencha a ficha cadastral do profissional e defina sua taxa padrão de repartição ou metas vigentes." },
      { title: "Configurar regras de split por tipo de negócio", detail: "Atribua regras específicas para retenção imobiliária, captações e splits sobre intermediações." },
      { title: "Registrar negócio com corretores envolvidos", detail: "Vincule as partes na comissão unificada imputando os valores brutos declarados na minuta." },
      { title: "Aprovar e liberar pagamento", detail: "Valide todos os percentuais descritos e autorize a liberação eletrônica dos splits de cada corretor." },
      { title: "Acompanhar ranking e relatórios", detail: "Analise o engajamento e as métricas mensais da equipe comercial de intermediação." }
    ],
    dicas: [
      "Usar o módulo de metas de forma gamificada para engajar as assessorias de vendas internas constantemente.",
      "Configurar alertas automáticos de vencimento e splits pendentes para acelerar conciliações financeiras."
    ],
    faq: [
      { question: "Faz split entre dois corretores?", answer: "Sim, é possível ratear livremente os valores de intermediação indicando a porcentagem exata aplicativa à cada profissional." },
      { question: "Corretor vê suas comissões?", answer: "Sim, corretores possuem login próprio com visualização exclusiva dos seus próprios ganhos apurados na plataforma." }
    ]
  },
  certidoes: {
    overview: "Emissão de certidões de imóveis digitais junto a cartórios de todo o Brasil com validade jurídica.",
    tutorial: [
      { title: "Buscar imóvel por matrícula ou endereço", detail: "Inicie localizando os termos exatos de registro público correspondentes ao imóvel almejado." },
      { title: "Selecionar tipo: matrícula atualizada, ônus ou inteiro teor", detail: "Confirme qual o documento e tipo oficial exigido pelo Cartório de Notas ou Banco financiador." },
      { title: "Pagar via Pix ou cartão", detail: "Efetue o pagamento correspondente de forma 100% digital e segura." },
      { title: "Acompanhar emissão em Minhas certidões", detail: "Consulte o andamento da emissão com os órgãos oficiais de registro competentes." },
      { title: "Baixar PDF com assinatura digital e QR Code", detail: "Faça o download do documento oficial autenticado que conta com validade civil federal garantida." }
    ],
    dicas: [
      "Solicitar certidões com pelo menos 10 dias de antecedência para amparar cronogramas apertados de repasse.",
      "Fique atento: as certidões de registro expedidas eletronicamente possuem validade jurídica legal de 30 dias."
    ],
    faq: [
      { question: "Tem validade igual à física?", answer: "Sim, possui idêntico valor legal, vindo as assinaturas providas da chancela ICP-Brasil." },
      { question: "Funciona em todo o Brasil?", answer: "A cobertura de cartórios interconectados é ampla, sendo ideal certificar previamente a cidade requerida." },
      { question: "Como validar?", answer: "Qualquer pessoa/entidade pode validar o documento lendo o QR Code do rodapé ou acessando o endereço ridigital.org.br/validar." }
    ]
  },
  canva: {
    overview: "Design de materiais de marketing, fichas de imóveis, posts e apresentações para clientes.",
    tutorial: [
      { title: "Criar design escolhendo formato: Stories, Post ou Flyer", detail: "Inicie o novo projeto selecting as dimensões recomendadas do post para redes ou mídias." },
      { title: "Pesquisar templates imobiliários na busca", detail: "Encontre centenas de criações excelentes digitando termos associados no buscador nativo." },
      { title: "Adicionar fotos do imóvel via Uploads", detail: "Faça o upload e arraste as imagens com facilidade sobre as molduras de visualização." },
      { title: "Configurar Brand Kit com logo, cores e fontes", detail: "Unifique todos os layouts rapidamente com seus elementos de propaganda oficiais da sua imobiliária." },
      { title: "Exportar em PNG para redes ou PDF para impressão", detail: "Termine baixando o arquivo final com excelente tratamento de imagem e qualidade fotográfica." }
    ],
    dicas: [
      "Use as ferramentas de remoção automática de fundos focado em ressaltar a beleza das fachadas.",
      "Construa e salve uma base reutilizável de ficha para que novas captações requeiram apenas edição textual rápida."
    ],
    faq: [
      { question: "Gratuito é suficiente?", answer: "Sim, a conta gratuita cobre o design de peças essenciais, recomendando-se o plano Pro para marcas corporativas complexas." },
      { question: "Posso criar contratos?", answer: "Sim, pode-se diagramar minutas estéticas e baixá-las em PDF, integrando sua rubrica ao Cresign em seguida." }
    ]
  },
  orulo: {
    overview: "Maior marketplace B2B de lançamentos imobiliários do Brasil. Conecta imobiliárias e incorporadoras.",
    tutorial: [
      { title: "Cadastrar imobiliária com CRECI", detail: "Realize o cadastro na plataforma de corretores inserindo informações de identificação técnica válidas." },
      { title: "Explorar portfólio filtrando por cidade e faixa de preço", detail: "Identifique as melhores oportunidades de incorporação que cabem nas especificações dos seus leads." },
      { title: "Solicitar acesso à tabela da incorporadora", detail: "Inscreva-se ou peça autorização para receber as planilhas oficiais atualizadas de vendas de unidades." },
      { title: "Compartilhar link do empreendimento com clientes via WhatsApp", detail: "Encaminhe ricas apresentações comerciais e perspectivas ilustradas de alta qualidade de forma direta." },
      { title: "Registrar reserva para garantir a unidade", detail: "Efetue formalmente e em poucos instantes a reserva do lote/apartamento almejado." }
    ],
    dicas: [
      "Assine lembretes de novas incorporações e de atualizações monetárias aplicadas por região.",
      "Gere materiais e kits promocionais criados pelas próprias construtoras para agilizar suas postagens nas mídias sociais."
    ],
    faq: [
      { question: "Acesso é pago?", answer: "Não, o acesso do corretor e imobiliárias parceiras para consulta é inteiramente grátis." },
      { question: "Tabela de preços atualizada?", answer: "Sim, as oscilações de preço e dados de estoque disponíveis são atualizadas em real-time." },
      { question: "Como funciona a comissão?", answer: "Os pagamentos de honorários de corretagem obedecem e seguem estritamente os termos de intermediação estipulados com a incorporadora." }
    ]
  }
};

const getManualDataForTool = (name: string, url: string) => {
  const n = name.toLowerCase();
  const u = url.toLowerCase();
  
  let key = "";
  if (n.includes("imobia") || u.includes("imobia")) {
    key = "imobia";
  } else if (n.includes("cresign") || u.includes("cresign")) {
    key = "cresign";
  } else if (n.includes("adapta") || u.includes("adapta")) {
    key = "adapta";
  } else if (n.includes("loft") || u.includes("loft") || (n.includes("credpago") && n.includes("alug"))) {
    key = "loft";
  } else if (n.includes("comissione") || n.includes("comissoes") || u.includes("comissone")) {
    key = "comissione";
  } else if (n.includes("certidõ") || u.includes("ridigital")) {
    key = "certidoes";
  } else if (n.includes("canva") || u.includes("canva")) {
    key = "canva";
  } else if (n.includes("orulo") || u.includes("orulo")) {
    key = "orulo";
  }
  
  if (key && MANUALS_DATA[key]) {
    return {
      ...MANUALS_DATA[key],
      name: name,
      url: url,
      isFallback: false
    };
  }
  
  return {
    name: name,
    url: url,
    isFallback: true,
    overview: `Manual de instruções para a ferramenta ${name}. Centralize processos, otimize rotinas e impulsione as conversões de sua imobiliária com esta integração de alta performance.`,
    tutorial: [
      { title: "Entrar na plataforma", detail: `Acesse o endereço eletrônico ${url} em seu navegador de preferência de forma segura.` },
      { title: "Autenticar na sua conta", detail: "Insira suas credenciais de acesso corporativas oficiais (e-mail institucional e senha padrão)." },
      { title: "Definir preferências iniciais", detail: "Configure o seu perfil profissional com registro do CRECI de sua imobiliária parceira." },
      { title: "Explorar os painéis", detail: "Navegue pelo painel de controle principal e consulte os relatórios de atividades internas." },
      { title: "Começar operações", detail: "Utilize todas as soluções de ponta projetadas para otimizar os fluxos de trabalho da sua equipe." }
    ],
    dicas: [
      "Mantenha o cadastro e as preferências de segurança atualizados frequentemente.",
      "Consulte os logs de atividades e os relatórios integrados para monitorar sua produtividade.",
      "Compartilhe as soluções integradas com toda a equipe para aumentar o alinhamento corporal.",
      "Configure lembretes diários para manter o engajamento e a fluidez das demandas comerciais."
    ],
    faq: [
      { question: "É seguro integrar no ecossistema?", answer: `Sim, todos os dados do serviço ${name} processados em nosso portal contam com criptografia avançada de ponta a ponta.` },
      { question: "Preciso de instalação local?", answer: "Não, todo o processamento e visualização é rodado diretamente via navegador de forma inteiramente em nuvem (SaaS)." },
      { question: "Como obter suporte avançado?", answer: "Você pode sanar suas dúvidas a qualquer instante entrando em contato direto com a equipe operacional interna." }
    ]
  };
};

function AppContent() {
  const { user, profile, isAdmin, companySettings } = useAuth();
  const [activeTab, setActiveTab] = useState<"dashboard" | "calendar" | "processes" | "process_config" | "users" | "profile" | "settings" | "contratos" | "vistorias" | "comissoes" | "simulador" | "financeiro" | "ponto">("dashboard");
  const [contractsSubTab, setContractsSubTab] = useState<"vistorias" | "despejos">("vistorias");
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth > 1024);
  const [viewingManualTool, setViewingManualTool] = useState<Tool | null>(null);
  const [activeManualTab, setActiveManualTab] = useState<"overview" | "tutorial" | "dicas" | "faq">("overview");
  const [expandedStepIndex, setExpandedStepIndex] = useState<number | null>(null);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);
  
  // Dinamicamente atualiza o título e favicon
  useEffect(() => {
    if (companySettings) {
      document.title = `${companySettings.name} - Gestão e Processos`;
      if (companySettings.logoUrl) {
        let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = companySettings.logoUrl;
      }
    }
  }, [companySettings]);

  // Listener global para alternar abas do sistema
  useEffect(() => {
    if (activeTab === "vistorias") {
      setContractsSubTab("vistorias");
      setActiveTab("contratos");
    }
  }, [activeTab]);

  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail as any);
      }
    };
    window.addEventListener("change-tab", handleTabChange);
    return () => window.removeEventListener("change-tab", handleTabChange);
  }, []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [processes, setProcesses] = useState<ProcessInstance[]>([]);
  const [processTemplates, setProcessTemplates] = useState<ProcessTemplate[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isToolsCollapsed, setIsToolsCollapsed] = useState(() => {
    return localStorage.getItem("isToolsCollapsed") === "true";
  });
  const [pendingCommissionData, setPendingCommissionData] = useState<{
    imovel?: string;
    inquilino?: string;
    aluguelMensal?: number;
    processId?: string;
  } | null>(null);
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isToolModalOpen, setIsToolModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completionModal, setCompletionModal] = useState<{ 
    isOpen: boolean; 
    taskId: string | null; 
    isUploading?: boolean; 
    attachments?: { name: string, url: string }[] 
  }>({ isOpen: false, taskId: null, attachments: [] });
  const [rescheduleDate, setRescheduleDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [showReschedule, setShowReschedule] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; taskId: string | null }>({ isOpen: false, taskId: null });
  
  // New Task Form
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>("medium");
  const [newTaskDate, setNewTaskDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [newTaskTime, setNewTaskTime] = useState("");
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<RecurrenceType>("none");
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState("");
  const [newTaskAttachments, setNewTaskAttachments] = useState<{ name: string, url: string }[]>([]);
  const [isTaskUploading, setIsTaskUploading] = useState(false);

  // New Tool Form
  const [newToolName, setNewToolName] = useState("");
  const [newToolDesc, setNewToolDesc] = useState("");
  const [newToolUrl, setNewToolUrl] = useState("");
  const [newToolNotes, setNewToolNotes] = useState("");
  const [viewingNotesTool, setViewingNotesTool] = useState<Tool | null>(null);
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [deleteToolModal, setDeleteToolModal] = useState<{ isOpen: boolean; toolId: string | null }>({ isOpen: false, toolId: null });
  const [dashboardFilter, setDashboardFilter] = useState<"all" | "today" | "completed" | "high" | "overdue">("today");
  const [adminTaskView, setAdminTaskView] = useState<"all" | "mine">("all");
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const isInitialLoad = React.useRef(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Timeout para garantir que o loading não dure para sempre se houver erro silencioso nas regras
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("Loading timeout reached. Forcing unlock.");
        setLoading(false);
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Som de Notificação
  const playNotificationSound = () => {
    try {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.volume = 0.5;
      audio.play().catch(e => console.warn("Auto-play bloqueado pelo navegador até interação do usuário."));
    } catch (err) {
      console.warn("Erro ao reproduzir som de notificação:", err);
    }
  };

  // Fetch Tasks
  useEffect(() => {
    if (!user || !profile) return;
    
    // Isolation: Only fetch company tasks.
    // Restriction: Non-admins only see THEIR tasks.
    // Optimization: Only fetch tasks from the last 60 days
    let q;
    const cid = profile.companyId || "company";
    
    if (isAdmin && adminTaskView === "all") {
      q = query(collection(db, "tasks"), where("companyId", "==", cid));
    } else {
      q = query(collection(db, "tasks"), where("companyId", "==", cid), where("uid", "==", user.uid));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      
      // Detectar novas tarefas para notificação sonora
      if (!isInitialLoad.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const newTask = change.doc.data() as Task;
            // Notificar se for para o usuário atual ou se for admin vendo tudo
            // E não notificar se foi o próprio usuário que criou (evitar notificar o admin que acabou de atribuir algo)
            const isCreatedByMe = newTask.authorId === user.uid || (!newTask.authorId && isAdmin); // Fallback se não tiver authorId mas for admin no dashboard
            
            if (newTask.uid === user.uid && !isCreatedByMe) {
              const isForMe = newTask.uid === user.uid;
              const assignedUser = allUsers.find(u => u.uid === newTask.uid);
              const userName = assignedUser?.displayName?.split(' ')[0] || "um colaborador";

              playNotificationSound();
              toast.info(`Nova tarefa: ${newTask.title}`, {
                description: isForMe 
                  ? "Uma nova atividade foi atribuída a você." 
                  : `Atividade atribuída a ${userName}.`,
                duration: Infinity,
                action: {
                  label: "Entendido",
                  onClick: () => console.log("Notificação lida"),
                },
              });
            }
          }
        });
      }

      setTasks(tasksData);
      setLoading(false);
      isInitialLoad.current = false;
    }, (error) => {
      console.error("Error fetching tasks:", error);
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, "tasks");
    });
    
    return () => unsubscribe();
  }, [user, profile]);

  // Fetch Tools
  useEffect(() => {
    if (!profile) return;
    const cid = profile.companyId || "company";

    const q = query(collection(db, "tools"), where("companyId", "==", cid));

    getDocs(q).then((snapshot) => {
      const toolsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tool));
      setTools(toolsData);
    }).catch((error) => {
      console.error("Erro ao buscar ferramentas:", error);
      handleFirestoreError(error, OperationType.LIST, "tools");
    });
  }, [profile]);

  // Fetch Processes
  useEffect(() => {
    if (!user) return;
    
    // Fetch users if admin for task assignment
    if (isAdmin && profile?.companyId) {
      const cid = profile.companyId;
      const usersQuery = query(collection(db, "users"), where("companyId", "==", cid));
      const uSub = onSnapshot(usersQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        setAllUsers(data);
      }, (error) => {
        console.error("Error fetching users list:", error);
      });
      return () => uSub();
    }
  }, [user, isAdmin, profile?.companyId]);

  // Fetch Processes
  useEffect(() => {
    if (!user || !profile) return;
    const cid = profile.companyId || "company";
    
    const q = query(collection(db, "processes"), where("companyId", "==", cid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const processesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcessInstance));
      setProcesses(processesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "processes");
    });
    return () => unsubscribe();
  }, [user, profile]);

  // Fetch Process Templates
  useEffect(() => {
    if (!user || !profile) return;

    const fetchTemplates = async () => {
      try {
        const snapshot = await getDocs(collection(db, "process_templates"));
        if (snapshot.empty && isAdmin) {
          const defaultTemplates = [
            {
              type: "locacao", title: "Locação", icon: "Chave", color: "text-blue-500",
              steps: [
                { label: "Documentação do Cliente", desc: "Coleta de RG, CPF, comprovante de renda e residência." },
                { label: "Verificação na Loft", desc: "Análise de crédito e perfil através da plataforma Loft." },
                { label: "Contrato de Locação", desc: "Elaboração e assinatura digital/física do contrato." },
                { label: "Vistoria", desc: "Realização do laudo de vistoria detalhado com fotos." },
                { label: "Transferências", desc: "Troca de titularidade de contas de água e energia." },
                { label: "Entrega de Chaves", desc: "Finalização do processo e entrega formal das chaves." }
              ], updatedAt: serverTimestamp()
            },
            {
              type: "captacao", title: "Captação para Venda", icon: "Busca", color: "text-amber-500",
              steps: [
                { label: "Visita ao Imóvel", desc: "Avaliação inicial e coleta de informações técnicas." },
                { label: "Documentação do Imóvel", desc: "Matrícula atualizada, IPTU e certidões negativas." },
                { label: "Fotos e Vídeos", desc: "Produção de material visual profissional para anúncio." },
                { label: "Análise de Mercado", desc: "Definição do valor de venda baseado em comparativos." },
                { label: "Autorização de Venda", desc: "Assinatura do documento de exclusividade ou opção." },
                { label: "Publicação", desc: "Cadastro nos portais e início da divulgação." }
              ], updatedAt: serverTimestamp()
            },
            {
              type: "venda", title: "Processo de Venda", icon: "Início", color: "text-green-500",
              steps: [
                { label: "Proposta e Negociação", desc: "Recebimento da oferta e ajuste de valores/prazos." },
                { label: "Sinal e Princípio de Pagamento", desc: "Reserva do imóvel e garantia do negócio." },
                { label: "Análise Jurídica", desc: "Verificação de certidões de compradores e vendedores." },
                { label: "Escritura ou Financiamento", desc: "Assinatura do contrato bancário ou escritura pública." },
                { label: "Registro em Cartório", desc: "Protocolo do título no Registro de Imóveis competente." },
                { label: "Posse e Chaves", desc: "Liberação dos recursos e entrega definitiva do imóvel." }
              ], updatedAt: serverTimestamp()
            }
          ];
          defaultTemplates.forEach(t => addDoc(collection(db, "process_templates"), t));
        } else {
          const templatesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProcessTemplate));
          setProcessTemplates(templatesData);
        }
      } catch (error: any) {
        handleFirestoreError(error, OperationType.LIST, "process_templates");
      }
    };

    fetchTemplates();
  }, [user, profile]);


  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (!task.completed) {
      setRescheduleDate(format(addDays(new Date(), 1), "yyyy-MM-dd"));
      setShowReschedule(false);
      setCompletionModal({ isOpen: true, taskId: id });
    } else {
      try {
        await updateDoc(doc(db, "tasks", id), { completed: false });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`);
      }
    }
  };

  const confirmCompletion = async (createNext: boolean) => {
    const taskId = completionModal.taskId;
    if (!taskId || !user) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      const updateData: any = { 
        completed: true,
        updatedAt: serverTimestamp()
      };
      
      if (completionModal.attachments && completionModal.attachments.length > 0) {
        updateData.attachments = completionModal.attachments;
        // Backward compatibility
        updateData.proofUrl = completionModal.attachments[0].url;
        updateData.proofName = completionModal.attachments[0].name;
      }

      await updateDoc(doc(db, "tasks", taskId), updateData);

      if (createNext) {
        const nextDate = addDays(parseISO(task.date), 1);
        const newTaskData = {
          uid: task.uid,
          title: task.title,
          description: task.description || "",
          completed: false,
          actionLabel: task.actionLabel,
          priority: task.priority,
          date: format(nextDate, "yyyy-MM-dd"),
          recurrence: task.recurrence,
          companyId: profile?.companyId || "company",
          createdAt: serverTimestamp(),
          authorId: user.uid,
        };
        await addDoc(collection(db, "tasks"), newTaskData);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "tasks");
    }

    setCompletionModal({ isOpen: false, taskId: null });
  };

  const handleRescheduleTask = async () => {
    const taskId = completionModal.taskId;
    if (!taskId || !user || !rescheduleDate) return;

    try {
      await updateDoc(doc(db, "tasks", taskId), {
        date: rescheduleDate,
        updatedAt: serverTimestamp()
      });
      setCompletionModal({ isOpen: false, taskId: null });
      toast.success("Tarefa reagendada com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const deleteTaskItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, "tasks", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${id}`);
    }
    setDeleteModal({ isOpen: false, taskId: null });
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !user || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const newTaskData: any = {
        uid: (isAdmin && newTaskAssignedTo) ? newTaskAssignedTo : user.uid,
        title: newTaskTitle,
        description: newTaskDescription,
        completed: false,
        actionLabel: "Ação Customizada",
        priority: newTaskPriority,
        date: newTaskDate,
        time: newTaskTime || null,
        recurrence: newTaskRecurrence,
        companyId: profile?.companyId || "company",
        createdAt: serverTimestamp(),
        authorId: user.uid,
      };

      if (newTaskAttachments.length > 0) {
        newTaskData.attachments = newTaskAttachments;
        // Backward compatibility
        newTaskData.proofUrl = newTaskAttachments[0].url;
        newTaskData.proofName = newTaskAttachments[0].name;
      }
      
      await addDoc(collection(db, "tasks"), newTaskData);
      
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("medium");
      setNewTaskRecurrence("none");
      setNewTaskAssignedTo("");
      setNewTaskAttachments([]);
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "tasks");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteToolItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, "tools", id));
      toast.success("Ferramenta removida.");
    } catch (error) {
      console.error("Error deleting tool:", error);
      handleFirestoreError(error, OperationType.DELETE, `tools/${id}`);
    }
    setDeleteToolModal({ isOpen: false, toolId: null });
  };

  const openEditToolModal = (tool: Tool) => {
    setNewToolName(tool.name);
    setNewToolDesc(tool.description || "");
    setNewToolUrl(tool.url);
    setNewToolNotes(tool.notes || "");
    setEditingToolId(tool.id);
    setIsToolModalOpen(true);
  };

  const addOrUpdateTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newToolName.trim() || !newToolUrl.trim()) {
      toast.error("Por favor, preencha o nome e a URL da ferramenta.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedUrl = newToolUrl.trim().startsWith("http") 
        ? newToolUrl.trim() 
        : `https://${newToolUrl.trim()}`;
      
      let iconUrl = "";
      try {
        const domain = new URL(formattedUrl).hostname;
        iconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      } catch (urlErr) {
        console.warn("Could not determine domain for favicon");
      }

      const toolData: any = {
        name: newToolName,
        description: newToolDesc,
        url: formattedUrl,
        icon: iconUrl,
        notes: newToolNotes,
        companyId: profile?.companyId || "company",
        uid: user?.uid,
        updatedAt: serverTimestamp()
      };

      if (editingToolId) {
        await updateDoc(doc(db, "tools", editingToolId), toolData);
        toast.success("Ferramenta atualizada com sucesso!");
      } else {
        toolData.createdAt = serverTimestamp();
        await addDoc(collection(db, "tools"), toolData);
        toast.success("Ferramenta adicionada com sucesso!");
      }
      
      setNewToolName("");
      setNewToolDesc("");
      setNewToolUrl("");
      setNewToolNotes("");
      setEditingToolId(null);
      setIsToolModalOpen(false);
    } catch (error) {
      console.error("Error saving tool:", error);
      toast.error("Erro ao salvar ferramenta.");
      handleFirestoreError(error, editingToolId ? OperationType.UPDATE : OperationType.CREATE, "tools");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTasksByUser = useMemo(() => {
    if (!user) return [];
    
    // Filtro base: se admin, pode ver tudo; se não, só as dele
    let baseTasks = tasks;
    
    // Se o modo "mine" estiver ativo, SEMPRE filtrar pelo UID do usuário atual,
    // independentemente de ser admin ou não. Isso resolve o caso do Admin
    // querendo ver apenas suas próprias tarefas no calendário.
    if (!isAdmin || adminTaskView === "mine") {
      return baseTasks.filter(t => t.uid === user.uid);
    }
    
    return baseTasks;
  }, [tasks, user, isAdmin, adminTaskView]);

  const overdueTasks = useMemo(() => filteredTasksByUser.filter(t => !t.completed && t.date < TODAY_ISO), [filteredTasksByUser]);
  const overdueProcesses = useMemo(() => processes.filter(p => p.status === 'active' && p.dueDate && p.dueDate < TODAY_ISO), [processes]);
  
  const tasksToday = useMemo(() => filteredTasksByUser.filter(t => t.date === TODAY_ISO), [filteredTasksByUser]);
  
  const dashboardScope = useMemo(() => {
    return filteredTasksByUser.filter(t => t.date === TODAY_ISO || (!t.completed && t.date < TODAY_ISO));
  }, [filteredTasksByUser]);

  const tasksForDisplay = useMemo(() => {
    let filtered = [...dashboardScope];
    if (dashboardFilter === "today") {
      filtered = filtered.filter(t => (t.date === TODAY_ISO && !t.completed) || (t.date < TODAY_ISO && !t.completed));
    } else if (dashboardFilter === "overdue") {
      filtered = filtered.filter(t => t.date < TODAY_ISO && !t.completed);
    } else if (dashboardFilter === "completed") {
      filtered = filtered.filter(t => t.completed && t.date === TODAY_ISO);
    } else if (dashboardFilter === "high") {
      filtered = filtered.filter(t => !t.completed && t.priority === "high");
    } else if (dashboardFilter === "all") {
      // Por padrão (Limpar Filtro), mostrar apenas o que não foi concluído
      // (Hoje pendente + Atrasadas pendentes)
      filtered = filtered.filter(t => !t.completed);
    }
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return filtered.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (priorityOrder[a.priority as string] ?? 1) - (priorityOrder[b.priority as string] ?? 1);
    });
  }, [dashboardScope, dashboardFilter]);

  const weekProgress = useMemo(() => {
    const todayDate = new Date();
    const startOfWeekStr = format(startOfWeek(todayDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const endOfWeekStr = format(endOfWeek(todayDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');

    const weekTasks = filteredTasksByUser.filter(t => {
      return t.date >= startOfWeekStr && t.date <= endOfWeekStr;
    });

    const completed = weekTasks.filter(t => t.completed).length;
    const total = weekTasks.length;
    return { completed, total };
  }, [filteredTasksByUser]);

  const todayCount = useMemo(() => tasksToday.filter(t => !t.completed).length, [tasksToday]);
  const overdueCountCurrent = useMemo(() => overdueTasks.length, [overdueTasks]);
  const completedCount = useMemo(() => tasksToday.filter(t => t.completed).length, [tasksToday]);
  const highPriorityCount = useMemo(() => dashboardScope.filter(t => !t.completed && t.priority === "high").length, [dashboardScope]);

  const today = format(new Date(), "dd 'de' MMMM", { locale: ptBR });

  const getActionIcon = (label: string) => {
    if (label.includes("WhatsApp")) return <Send className="w-3 h-3" />;
    if (label.includes("Upload") || label.includes("Scan")) return <Upload className="w-3 h-3" />;
    if (label.includes("Painel") || label.includes("Dashboard") || label.includes("Financeiro")) return <BarChart3 className="w-3 h-3" />;
    if (label.includes("Relatório")) return <FileText className="w-3 h-3" />;
    if (label.includes("Arquivo") || label.includes("Galeria")) return <Database className="w-3 h-3" />;
    return <Zap className="w-3 h-3" />;
  };

  const safeIcon = (icon: string | undefined) => {
    if (!icon) return null;
    // Se for URL local antiga que dava 404, retornar null para usar o ícone padrão
    if (icon.startsWith('/uploads/')) return null;
    return icon;
  };

  const navItems = useMemo(() => {
    const isUserAdmin = profile?.role === "admin";
    const permComissoes = isUserAdmin || profile?.permComissoes === true || profile?.perm_comissoes === true || profile?.permissions?.includes("comissoes");
    const permFinanceiro = isUserAdmin || profile?.permFinanceiro === true || profile?.perm_financeiro === true || profile?.permissions?.includes("financeiro");
    const permVistorias = isUserAdmin || profile?.permVistorias === true || profile?.perm_vistorias === true || profile?.permissions?.includes("vistorias");
    const permProcessos = isUserAdmin || profile?.permProcessos === true || profile?.perm_processos === true || profile?.permissions?.includes("processos");
    const permPonto = isUserAdmin || profile?.permPonto === true || profile?.perm_ponto === true || (profile?.role === "colaborador" && profile?.permPonto === undefined && profile?.perm_ponto === undefined) || profile?.permissions?.includes("ponto");

    const items: any[] = [
      { id: "dashboard" as const, label: "Painel", icon: LayoutDashboard },
      { id: "calendar" as const, label: "Calendário", icon: CalendarIcon },
    ];

    if (isUserAdmin || permVistorias) {
      items.push({ id: "contratos" as const, label: "Contratos", icon: FileText });
    }

    if (permComissoes) {
      items.push({ id: "comissoes" as const, label: "Comissões", icon: DollarSign });
    }

    if (isUserAdmin || permProcessos) {
      items.push({ id: "processes" as const, label: "Processos", icon: ClipboardList });
    }

    items.push({ id: "simulador" as const, label: "Simulador", icon: Calculator });

    if (permPonto) {
      items.push({ id: "ponto" as const, label: "Ponto", icon: Clock });
    }

    const hasSystemSection = isUserAdmin || permFinanceiro;
    if (hasSystemSection) {
      items.push({ type: "header", label: "SISTEMA" } as any);
      
      if (permFinanceiro) {
        items.push({ id: "financeiro" as const, label: "Financeiro & Conciliação", icon: Landmark });
      }

      if (isUserAdmin) {
        items.push({ id: "users" as const, label: "Config. Usuários", icon: UsersIcon });
        items.push({ id: "process_config" as const, label: "Config. Fluxos", icon: Settings });
        items.push({ id: "settings" as const, label: "Config. Empresa", icon: Sliders });
      }
    }

    return items;
  }, [isAdmin, profile, companySettings?.name]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
            Carregando {companySettings?.name || "Ponto Chave"}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F8FAFC] text-[#1E293B] font-sans flex overflow-hidden">
      {/* Sidebar Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Toggleable on all screens */}
      <aside className={cn(
        "fixed inset-y-0 left-0 bg-white border-r border-slate-200 z-50 w-64 transform transition-all duration-300 shrink-0 flex flex-col shadow-xl",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-slate-100 mb-2 shrink-0">
          <div 
            className="relative group cursor-pointer" 
            onClick={() => setActiveTab("dashboard")}
          >
            <div className="relative flex items-center gap-3.5">
              <LogoImage size="h-11 w-11 shadow-blue-100" url={companySettings?.logoUrl} />
              <div className="overflow-hidden">
                <h1 className="text-[13px] font-black tracking-tight text-slate-900 leading-none">
                  {companySettings?.name || "PONTO CHAVE"}
                </h1>
                <p className="text-[7px] uppercase tracking-[0.25em] font-black text-blue-500 mt-1.5 opacity-80">
                  {companySettings?.subtitle || "GESTÃO • PROCESSOS"}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item: any, idx) => {
            if (item.type === "header") {
              return (
                <div key={`header-${idx}`} className="px-4 pt-6 pb-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  {item.label}
                </div>
              );
            }
            const Icon = item.icon;
            return (
              <button 
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all group",
                  activeTab === item.id 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <Icon className={cn("w-4 h-4", activeTab === item.id ? "text-white" : "text-slate-400 group-hover:text-blue-500")} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3 text-[10px] font-black text-red-500 hover:text-red-600 uppercase tracking-widest hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(prev => !prev)}
              className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-all border border-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4">
              {!isSidebarOpen && (
                <div className="hidden xs:flex items-center gap-2 pr-4 border-r border-slate-100 mr-2 transition-all">
                  <LogoImage size="h-8 w-8" url={companySettings?.logoUrl} />
                  <span className="text-[11px] font-black tracking-tight text-slate-900 leading-none truncate max-w-[120px]">
                    {companySettings?.name || "PONTO CHAVE"}
                  </span>
                </div>
              )}
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none uppercase">
                  {navItems.find(n => n.id === activeTab)?.label || (activeTab === "profile" ? "Perfil" : activeTab)}
                </h2>
                <div className="flex items-center gap-1.5 mt-1.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Conectado • {profile?.role === 'admin' ? 'Administrador' : 'Colaborador'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {(overdueTasks.length > 0 || overdueProcesses.length > 0) && (
              <div 
                onClick={() => setActiveTab(overdueTasks.length > 0 ? "calendar" : "processes")}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-xl cursor-pointer hover:bg-red-100 transition-all"
              >
                <div className="w-6 h-6 bg-red-500 text-white rounded flex items-center justify-center shadow-lg shadow-red-100">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
                <span className="hidden sm:inline text-[9px] font-black text-red-600 uppercase tracking-widest">
                  {overdueTasks.length + overdueProcesses.length} Pendências
                </span>
              </div>
            )}
            <div className="w-px h-8 bg-slate-100 mx-1 hidden sm:block" />
            <div 
              onClick={() => setActiveTab("profile")}
              className="flex items-center gap-3 pl-2 cursor-pointer hover:bg-slate-50 p-2 rounded-2xl transition-all active:scale-95 group"
            >
               <div className="text-right hidden xs:block">
                  <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none group-hover:text-blue-600 transition-colors">{profile?.displayName?.split(' ')[0]}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Ver Perfil</p>
               </div>
               <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 p-1 group-hover:border-blue-200 transition-all">
                  <div className="w-full h-full rounded-lg bg-blue-500 overflow-hidden flex items-center justify-center text-white text-[10px] font-black shadow-inner shadow-blue-600/20">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      profile?.displayName?.charAt(0) || "U"
                    )}
                  </div>
               </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10 scroll-smooth custom-scrollbar">
          <div className="max-w-7xl mx-auto transition-all duration-500">
            <Toaster position="top-right" richColors />
            {isDemoMode && (
              <div id="demo-banner-box" className="mb-8 p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-[32px] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans select-none border border-blue-500/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                    <Zap className="w-6 h-6 fill-amber-300 text-amber-300 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm tracking-tight text-white uppercase tracking-wider flex items-center gap-1.5">
                      Ambientado em Banco Local (Offline)
                    </h3>
                    <p className="text-[11px] text-blue-100 mt-1 max-w-2xl leading-relaxed">
                      Como a configuração inicial do Firebase foi declinada, ativamos o <strong>Modo Local Inteligente</strong>. O sistema está 100% interativo, funcional e salvando alterações diretamente na memória do seu navegador!
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] bg-white/20 backdrop-blur px-3 px-4 py-2 rounded-xl border border-white/5 whitespace-nowrap">
                    CONECTADO AO MOCK DB
                  </span>
                </div>
              </div>
            )}
            {activeTab === "dashboard" ? (
          <div className="space-y-8">
            {/* Summary Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Checklist Hoje</h2>
                <div className="flex items-center gap-2 text-slate-400 mt-1">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{today}</span>
                </div>
                {isAdmin && (
                  <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 mt-3 w-fit shadow-inner">
                    <button 
                      onClick={() => setAdminTaskView("all")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                        adminTaskView === "all" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      <UsersIcon className="w-3 h-3" />
                      Equipe
                    </button>
                    <button 
                      onClick={() => setAdminTaskView("mine")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                        adminTaskView === "mine" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      <UserIcon className="w-3 h-3" />
                      Minhas
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="px-5 py-2 bg-slate-200/50 backdrop-blur-sm rounded-full flex items-center gap-3 border border-slate-200/50 shadow-inner">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    {tasksForDisplay.length === 0 ? "Progresso Semanal" : "Progresso"}
                  </div>
                  <div className="flex items-center gap-2" title={tasksForDisplay.length === 0 ? "Mostrando progresso da semana atual como fallback" : "Progresso de hoje"}>
                    <span className="text-base font-black text-slate-800 tracking-tighter">
                      {tasksForDisplay.length === 0 ? weekProgress.completed : completedCount}
                    </span>
                    <span className="text-slate-400 font-bold opacity-50">/</span>
                    <span className="text-base font-black text-slate-500 tracking-tighter">
                      {tasksForDisplay.length === 0 ? weekProgress.total : tasksForDisplay.length}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 px-8 py-3.5 bg-[#3B82F6] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/30 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <Plus className="w-5 h-5 stroke-[3px]" />
                  Nova Tarefa
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div 
                onClick={() => setDashboardFilter(dashboardFilter === "today" ? "all" : "today")}
                className={cn(
                "bg-white p-6 rounded-3xl border shadow-sm transition-all cursor-pointer hover:shadow-md",
                dashboardFilter === "today" ? "ring-2 ring-blue-500 border-transparent shadow-lg scale-[1.02]" : "border-slate-100"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
                    <CalendarIcon className="w-6 h-6" />
                  </div>
                  {dashboardFilter === "today" && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
                  )}
                </div>
                <div className="text-3xl font-bold text-slate-900">{todayCount}</div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Para Hoje</div>
              </div>

              <div 
                onClick={() => setDashboardFilter(dashboardFilter === "overdue" ? "all" : "overdue")}
                className={cn(
                "bg-white p-6 rounded-3xl border shadow-sm transition-all cursor-pointer hover:shadow-md",
                overdueCountCurrent > 0 ? "border-red-100 bg-red-50/20" : "border-slate-100",
                dashboardFilter === "overdue" && "ring-2 ring-red-500 border-transparent shadow-lg scale-[1.02]"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    overdueCountCurrent > 0 ? "bg-red-500 text-white shadow-lg shadow-red-200" : "bg-slate-100 text-slate-400"
                  )}>
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  {overdueCountCurrent > 0 && (
                    <span className="px-2 py-0.5 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest rounded-full animate-pulse">Atrasado</span>
                  )}
                </div>
                <div className={cn("text-3xl font-bold", overdueCountCurrent > 0 ? "text-red-600" : "text-slate-900")}>{overdueCountCurrent}</div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Em Atraso</div>
              </div>

              <div 
                onClick={() => setDashboardFilter(dashboardFilter === "completed" ? "all" : "completed")}
                className={cn(
                  "bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all cursor-pointer hover:shadow-md",
                  dashboardFilter === "completed" && "ring-2 ring-green-500 border-transparent shadow-lg scale-[1.02]"
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  {dashboardFilter === "completed" && (
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-ping"></div>
                  )}
                </div>
                <div className="text-3xl font-bold text-slate-900">{completedCount}</div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Concluídas Hoje</div>
              </div>

              <div 
                onClick={() => setDashboardFilter(dashboardFilter === "high" ? "all" : "high")}
                className={cn(
                  "bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all cursor-pointer hover:shadow-md",
                  dashboardFilter === "high" && "ring-2 ring-amber-500 border-transparent shadow-lg scale-[1.02]"
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6" />
                  </div>
                  {dashboardFilter === "high" && (
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></div>
                  )}
                </div>
                <div className="text-3xl font-bold text-slate-900">{highPriorityCount}</div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Críticas</div>
              </div>
            </div>

            {/* Tools Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <ExternalLink className="w-5 h-5 text-[#3B82F6]" />
                    Ferramentas & Acessos Rápidos
                  </h3>
                  <button 
                    onClick={() => {
                      const newState = !isToolsCollapsed;
                      setIsToolsCollapsed(newState);
                      localStorage.setItem("isToolsCollapsed", String(newState));
                    }}
                    className="p-1 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
                  >
                    {isToolsCollapsed ? "Mostrar" : "Minimizar"}
                  </button>
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => {
                      setEditingToolId(null);
                      setNewToolName("");
                      setNewToolDesc("");
                      setNewToolUrl("");
                      setNewToolNotes("");
                      setIsToolModalOpen(true);
                    }}
                    className="text-xs font-bold text-[#3B82F6] hover:underline uppercase tracking-widest"
                  >
                    + Adicionar Ferramenta
                  </button>
                )}
              </div>
              
              {!isToolsCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {tools.length === 0 ? (
                    <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
                      Nenhuma ferramenta cadastrada.
                    </div>
                  ) : tools.map((tool) => (
                    <a 
                      key={tool.id}
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-[#3B82F6] hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden p-1.5 group-hover:border-blue-100 transition-colors">
                              {safeIcon(tool.icon) ? (
                                <img 
                                  src={safeIcon(tool.icon)!} 
                                  alt={tool.name} 
                                  className="w-full h-full object-contain"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    const parent = (e.target as HTMLImageElement).parentElement;
                                    if (parent) parent.innerHTML = `<div class="text-blue-500 font-black text-lg">${tool.name.charAt(0).toUpperCase()}</div>`;
                                  }}
                                />
                              ) : (
                                <div className="text-blue-500 font-black text-lg">
                                  {tool.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="block font-bold text-slate-900 group-hover:text-[#3B82F6] transition-colors leading-tight">{tool.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px] block mt-0.5">{new URL(tool.url).hostname}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openEditToolModal(tool);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                  title="Editar"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDeleteToolModal({ isOpen: true, toolId: tool.id });
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  title="Remover"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-[#3B82F6] transition-all" />
                          </div>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{tool.description}</p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-[#3B82F6] transition-colors">
                            <span>Acessar Ferramenta</span>
                            <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setViewingManualTool(tool);
                              setActiveManualTab("overview");
                              setExpandedStepIndex(null);
                              setExpandedFaqIndex(null);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-[#3B82F6] rounded-xl transition-all normal-case font-bold text-[10px] tracking-normal cursor-pointer"
                            title="📖 Ver Manual do Usuário"
                          >
                            <span>📖 Ver Manual</span>
                          </button>
                        </div>
                        {tool.notes ? (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setViewingNotesTool(tool);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-all normal-case font-bold text-[10px] tracking-normal cursor-pointer"
                            title="Ver notas de configuração e passo a passo"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                            <span>Anotações</span>
                          </button>
                        ) : null}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Task List */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-slate-700">
                    {dashboardFilter === "today" ? "Checklist para Hoje" :
                     dashboardFilter === "overdue" ? "Atividades em Atraso" :
                     dashboardFilter === "completed" ? "Atividades Concluídas" :
                     dashboardFilter === "high" ? "Atividades Críticas" :
                     "Todas as Atividades"}
                  </h3>
                  {dashboardFilter !== "all" && (
                    <button 
                      onClick={() => setDashboardFilter("all")}
                      className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[9px] font-black uppercase rounded hover:bg-slate-300 transition-colors"
                    >
                      Limpar Filtro
                    </button>
                  )}
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status</div>
              </div>
              <div className="divide-y divide-slate-100">
                {dashboardFilter === "today" && !tasksForDisplay.some(t => t.date === TODAY_ISO) && tasksForDisplay.some(t => t.date < TODAY_ISO) && (
                  <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-center gap-2.5 text-amber-800 text-xs font-semibold animate-fadeIn">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                    <span>Tarefas pendentes de dias anteriores</span>
                  </div>
                )}
                {tasksForDisplay.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <LayoutDashboard className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p className="font-semibold">Nenhuma tarefa pendente ou para hoje.</p>
                    <p className="text-xs mt-1">Clique em "Nova Tarefa" para começar.</p>
                  </div>
                ) : tasksForDisplay.map((task) => (
                  <div 
                    key={task.id}
                    className={cn(
                      "group flex items-center justify-between p-6 hover:bg-slate-50/80 transition-all cursor-pointer",
                      task.completed && "opacity-60"
                    )}
                    onClick={() => toggleTask(task.id)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                        task.completed 
                          ? "bg-[#3B82F6] border-[#3B82F6] text-white" 
                          : "border-slate-300 group-hover:border-[#3B82F6]"
                      )}>
                        {task.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4 text-transparent" />}
                      </div>
                      <div className="flex-1">
                        <div className={cn(
                          "font-semibold text-slate-800 transition-all",
                          task.completed && "line-through text-slate-400"
                        )}>
                          {task.title}
                          {task.date < TODAY_ISO && !task.completed && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black bg-red-100 text-red-700 border border-red-200 uppercase tracking-widest leading-none">
                              ATRASADO
                            </span>
                          )}
                          {isAdmin && task.uid !== user?.uid && (
                            <span className="ml-2 text-[10px] text-blue-600 font-bold uppercase py-0.5 px-2 bg-blue-50 rounded-full">
                              Para: {allUsers.find(u => u.uid === task.uid)?.displayName || 'Colaborador'}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className={cn(
                            "text-xs text-slate-500 mt-1 leading-relaxed",
                            task.completed && "line-through opacity-50"
                          )}>
                            {task.description}
                          </p>
                        )}
                        {task.proofUrl && (
                          <div className="mt-2 flex items-center gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAttachment(task.proofUrl!, task.proofName || "Comprovação");
                              }}
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-all"
                            >
                              <FileText className="w-3 h-3" />
                              Ver Comprovação
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                            task.priority === "high" ? "bg-red-100 text-red-600" :
                            task.priority === "medium" ? "bg-blue-100 text-blue-600" :
                            "bg-slate-100 text-slate-600"
                          )}>
                            {task.priority === "high" ? "Alta" : task.priority === "medium" ? "Média" : "Baixa"}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            {getActionIcon(task.actionLabel || "")}
                            {task.actionLabel || "Ação"}
                          </span>
                        </div>
                        {((task.proofUrl && !task.attachments) || (task.attachments && task.attachments.length > 0)) && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {task.attachments ? task.attachments.map((att, aIdx) => (
                              <button 
                                key={aIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAttachment(att.url, att.name);
                                }}
                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-white text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold hover:bg-slate-50 hover:border-blue-200 transition-all shadow-sm"
                              >
                                <FileText className="w-3 h-3 text-blue-500" />
                                {att.name}
                              </button>
                            )) : (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAttachment(task.proofUrl!, task.proofName || "Ver Comprovação");
                                }}
                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition-all"
                              >
                                <FileText className="w-3 h-3" />
                                {task.proofName || "Ver Comprovação"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteModal({ isOpen: true, taskId: task.id });
                        }}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#3B82F6] transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === "calendar" ? (
          <CalendarView 
            selectedDate={selectedDate} 
            setSelectedDate={setSelectedDate} 
            tasks={filteredTasksByUser}
            onAddTask={() => setIsModalOpen(true)}
            onToggleTask={toggleTask}
            isAdmin={isAdmin}
            allUsers={allUsers}
            currentUser={user}
            adminTaskView={adminTaskView}
            setAdminTaskView={setAdminTaskView}
          />
        ) : activeTab === "processes" ? (
          <ProcessesView 
            processes={processes} 
            user={user} 
            templates={processTemplates} 
            onNavigate={setActiveTab} 
            allUsers={allUsers} 
            isAdmin={isAdmin}
            activeInstanceId={activeInstanceId}
            setActiveInstanceId={setActiveInstanceId}
            companySettings={companySettings}
            onLaunchCommission={(data) => {
              setPendingCommissionData(data);
              setActiveTab("comissoes");
            }}
          />
        ) : activeTab === "process_config" ? (
          <ProcessConfigView templates={processTemplates} />
        ) : activeTab === "users" ? (
          <UserManagement 
            allTasks={tasks} 
            allProcesses={processes} 
            allTemplates={processTemplates} 
            onNavigate={setActiveTab} 
            onSelectDate={setSelectedDate} 
            onSelectProcess={setActiveInstanceId} 
          />
        ) : activeTab === "financeiro" ? (
          <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Carregando financeiro...</div>}>
            <FinanceiroView isAdmin={isAdmin} user={user} profile={profile} companySettings={companySettings} />
          </Suspense>
        ) : activeTab === "contratos" ? (
          <div className="space-y-6">
            {/* Sub-tabs header/selector */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => setContractsSubTab("vistorias")}
                className={cn(
                  "py-3 px-5 text-[11px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer",
                  contractsSubTab === "vistorias"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-slate-450 hover:text-slate-700"
                )}
              >
                Laudos de Vistoria
              </button>
              <button
                onClick={() => setContractsSubTab("despejos")}
                className={cn(
                  "py-3 px-5 text-[11px] font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer",
                  contractsSubTab === "despejos"
                    ? "border-indigo-600 text-indigo-700"
                    : "border-transparent text-slate-450 hover:text-slate-700"
                )}
              >
                Ações de Despejo (CredPago)
              </button>
            </div>

            {/* Sub-tab view renderer */}
            {contractsSubTab === "vistorias" ? (
              <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Carregando vistorias...</div>}>
                <VistoriaView isAdmin={isAdmin} user={user} profile={profile} companySettings={companySettings} />
              </Suspense>
            ) : (
              <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400 font-bold uppercase tracking-widest text-[10px]">Carregando ações de despejo...</div>}>
                <DespejoView isAdmin={isAdmin} user={user} profile={profile} companySettings={companySettings} />
              </Suspense>
            )}
          </div>
        ) : activeTab === "vistorias" ? (
          <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Carregando vistorias...</div>}>
            <VistoriaView isAdmin={isAdmin} user={user} profile={profile} companySettings={companySettings} />
          </Suspense>
        ) : activeTab === "comissoes" ? (
          <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Carregando comissões...</div>}>
            <ComissoesView 
              isAdmin={isAdmin} 
              user={user} 
              profile={profile} 
              initialData={pendingCommissionData}
              onClearInitialData={() => setPendingCommissionData(null)}
              companySettings={companySettings}
            />
          </Suspense>
        ) : activeTab === "simulador" ? (
          <Suspense fallback={<div className="flex items-center justify-center h-64 text-gray-400">Carregando simulador...</div>}>
            <SimuladorView 
              companySettings={companySettings} 
              currentUser={{ displayName: user?.displayName || undefined, email: user?.email || undefined }} 
            />
          </Suspense>
        ) : activeTab === "ponto" ? (
          <Suspense fallback={<div className="flex items-center justify-center h-64 text-slate-400">Carregando ponto eletrônico...</div>}>
            <PontoView 
              isAdmin={isAdmin}
              user={user}
              profile={profile}
              companySettings={companySettings}
            />
          </Suspense>
        ) : activeTab === "profile" ? (
          <ProfileView 
            profile={profile} 
            user={user} 
            onOpenSettings={() => setActiveTab("settings")} 
            onNavigate={setActiveTab} 
            tasks={tasks}
          />
        ) : (
          <SettingsView companySettings={companySettings} isAdmin={isAdmin} onNavigate={setActiveTab} />
        )}
          </div>
        </main>
      </div>

    {/* Modals (Task, Tool, Completion, Delete) - Simplified for brevity in this rewrite, same logic as before but using Firestore */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center p-8 border-b border-slate-100 shrink-0">
                <h3 className="text-xl font-bold text-slate-900">Nova Atividade</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <form onSubmit={addTask} className="p-8 pt-0 space-y-6 overflow-y-auto custom-scrollbar flex-1 mt-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Título</label>
                  <input autoFocus type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="O que precisa ser feito?" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Instruções Detalhadas</label>
                  <textarea value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} placeholder="Ex: Acessar sistema X..." rows={3} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all resize-none" />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Anexos e Documentos (Opcional)</label>
                  
                  {newTaskAttachments.length > 0 && (
                    <div className="space-y-2">
                      {newTaskAttachments.map((file, fIdx) => (
                        <div key={fIdx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl group">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                            <span className="text-xs font-bold text-slate-700 truncate">{file.name}</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              const newAtts = [...newTaskAttachments];
                              newAtts.splice(fIdx, 1);
                              setNewTaskAttachments(newAtts);
                            }}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button 
                    type="button"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      input.accept = 'image/*,application/pdf,.doc,.docx';
                      input.onchange = async (e: any) => {
                        const files = Array.from(e.target.files as FileList);
                        if (files.length === 0) return;

                        setIsTaskUploading(true);
                        
                        const newAttachments = [...newTaskAttachments];
                        
                        for (const file of files) {
                          if (file.size > 1024 * 1024) {
                            toast.error(`Arquivo ${file.name} é muito grande (>1MB).`);
                            continue;
                          }

                          try {
                            const base64 = await new Promise<string>((resolve, reject) => {
                              const reader = new FileReader();
                              reader.onload = () => resolve(reader.result as string);
                              reader.onerror = reject;
                              reader.readAsDataURL(file);
                            });
                            newAttachments.push({ name: file.name, url: base64 });
                          } catch (err) {
                            toast.error(`Erro ao processar ${file.name}`);
                          }
                        }

                        setNewTaskAttachments(newAttachments);
                        setIsTaskUploading(false);
                      };
                      input.click();
                    }}
                    className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                  >
                    {isTaskUploading ? (
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-5 h-5 group-hover:text-blue-500 transition-colors" />
                        <span className="text-[10px] font-bold uppercase text-center">Clique para anexar arquivos</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Data</label>
                    <input type="date" value={newTaskDate} onChange={(e) => setNewTaskDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Prioridade</label>
                    <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value as Priority)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all">
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                    </select>
                  </div>
                </div>

                {isAdmin && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Atribuir a</label>
                    <select 
                      value={newTaskAssignedTo || user?.uid} 
                      onChange={(e) => setNewTaskAssignedTo(e.target.value)} 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all font-medium"
                    >
                      <option value={user?.uid}>Mim mesmo (Admin)</option>
                      {allUsers.filter(u => u.uid !== user?.uid).map(u => (
                        <option key={u.uid} value={u.uid}>{u.displayName || u.email} {u.role === 'admin' ? '(Admin)' : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-4 bg-[#3B82F6] text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                >
                  {isSubmitting ? "Adicionando..." : "Adicionar Tarefa"}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isToolModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsToolModalOpen(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-8 border-b border-slate-100 shrink-0">
                <h3 className="text-xl font-bold text-slate-900">{editingToolId ? "Editar Ferramenta" : "Nova Ferramenta"}</h3>
                <button onClick={() => setIsToolModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <form onSubmit={addOrUpdateTool} className="p-8 pt-0 space-y-6 overflow-y-auto custom-scrollbar flex-1 mt-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Nome da Ferramenta</label>
                  <input autoFocus type="text" value={newToolName} onChange={(e) => setNewToolName(e.target.value)} placeholder="Ex: CRM Imobiliário" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Descrição Curta</label>
                  <input type="text" value={newToolDesc} onChange={(e) => setNewToolDesc(e.target.value)} placeholder="Para que serve esta ferramenta?" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">URL / Link</label>
                  <div className="relative">
                    <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="text" value={newToolUrl} onChange={(e) => setNewToolUrl(e.target.value)} placeholder="https://exemplo.com" className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 ml-1 italic">O logo será buscado automaticamente a partir deste link.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Notas / Passo a Passo de Configuração</label>
                  <textarea 
                    value={newToolNotes} 
                    onChange={(e) => setNewToolNotes(e.target.value)} 
                    placeholder="Cole aqui tutoriais, senhas de teste, passo a passo, links úteis ou qualquer instrução de como configurar e acessar esta ferramenta..." 
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all text-sm resize-none custom-scrollbar" 
                  />
                  <p className="text-[10px] text-slate-400 mt-2 ml-1 italic">Dica: Estas notas ficarão visíveis para toda a equipe configurando a ferramenta.</p>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-[#3B82F6] text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                  {isSubmitting ? "Salvando..." : (editingToolId ? "Atualizar Ferramenta" : "Salvar Ferramenta")}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {deleteToolModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteToolModal({ isOpen: false, toolId: null })} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Ferramenta?</h3>
              <p className="text-slate-500 mb-8 text-sm">Esta ação não pode ser desfeita. A ferramenta será removida permanentemente do painel.</p>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setDeleteToolModal({ isOpen: false, toolId: null })}
                  className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => deleteToolModal.toolId && deleteToolItem(deleteToolModal.toolId)}
                  className="py-4 bg-red-500 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-red-200 hover:bg-red-600 transition-all font-black"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {viewingNotesTool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setViewingNotesTool(null)} 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-start p-8 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden p-2 shrink-0">
                    {safeIcon(viewingNotesTool.icon) ? (
                      <img 
                        src={safeIcon(viewingNotesTool.icon)!} 
                        alt={viewingNotesTool.name} 
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent) parent.innerHTML = `<div class="text-[#3B82F6] font-black text-xl">${viewingNotesTool.name.charAt(0).toUpperCase()}</div>`;
                        }}
                      />
                    ) : (
                      <div className="text-[#3B82F6] font-black text-xl">
                        {viewingNotesTool.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-black text-slate-950 leading-tight truncate">{viewingNotesTool.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{viewingNotesTool.description || "Sem descrição curta."}</p>
                  </div>
                </div>
                <button onClick={() => setViewingNotesTool(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors shrink-0">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-8 pt-0 overflow-y-auto custom-scrollbar flex-1 mt-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Como configurar / Notas de acesso
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(viewingNotesTool.notes || "");
                        toast.success("Anotações copiadas para a área de transferência!");
                      }}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors font-semibold"
                    >
                      <ClipboardList className="w-4 h-4" />
                      <span>Copiar Notas</span>
                    </button>
                  </div>
                  <div className="bg-slate-50 hover:bg-slate-50/80 border border-slate-150 rounded-2xl p-6 text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-wrap max-h-[40vh] overflow-y-auto custom-scrollbar select-text shadow-inner break-words break-all">
                    {viewingNotesTool.notes}
                  </div>
                </div>

                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-0.5">Link da Ferramenta</span>
                    <span className="block text-xs text-blue-800 font-mono truncate">{viewingNotesTool.url}</span>
                  </div>
                  <a 
                    href={viewingNotesTool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-md shadow-blue-500/10 hover:scale-[1.02] active:scale-95"
                  >
                    <span>Acessar</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {isAdmin && (
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                  <button
                    onClick={() => {
                      const tool = viewingNotesTool;
                      setViewingNotesTool(null);
                      openEditToolModal(tool);
                    }}
                    className="px-5 py-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                  >
                    Editar Anotações
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {viewingManualTool && (() => {
          const manualData = getManualDataForTool(viewingManualTool.name, viewingManualTool.url);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={() => setViewingManualTool(null)} 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }} 
                className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-800"
              >
                {/* Header */}
                <div className="flex justify-between items-start p-6 md:p-8 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-150 flex items-center justify-center overflow-hidden p-2 shrink-0">
                      {safeIcon(viewingManualTool.icon) ? (
                        <img 
                          src={safeIcon(viewingManualTool.icon)!} 
                          alt={viewingManualTool.name} 
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) parent.innerHTML = `<div class="text-[#3B82F6] font-black text-xl">${viewingManualTool.name.charAt(0).toUpperCase()}</div>`;
                          }}
                        />
                      ) : (
                        <div className="text-[#3B82F6] font-black text-xl">
                          {viewingManualTool.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-slate-950 leading-tight truncate">{viewingManualTool.name}</h3>
                        <span className="text-[9px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Manual</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{new URL(viewingManualTool.url).hostname}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setViewingManualTool(null)} 
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors shrink-0 cursor-pointer"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-slate-100 bg-slate-50/50 p-2 gap-1 shrink-0">
                  {(["overview", "tutorial", "dicas", "faq"] as const).map((tab) => {
                    const label = tab === "overview" ? "Visão Geral" :
                                  tab === "tutorial" ? "Tutorial" :
                                  tab === "dicas" ? "Dicas" : "FAQ & Dúvidas";
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveManualTab(tab)}
                        className={cn(
                          "flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer text-center",
                          activeManualTab === tab
                            ? "bg-white text-blue-600 shadow-sm border border-slate-155 font-extrabold"
                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Content Area */}
                <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                  {activeManualTab === "overview" && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="space-y-4"
                    >
                      <div className="bg-blue-50/30 border border-blue-100 p-6 rounded-2xl">
                        <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">Sobre a Ferramenta</h4>
                        <p className="text-sm text-slate-700 leading-relaxed font-semibold">
                          {manualData.overview}
                        </p>
                      </div>
                      <div className="border border-slate-150 p-5 rounded-2xl flex items-start gap-3.5 bg-slate-50/30">
                        <HelpCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Como usar este manual</h5>
                          <p className="text-xs text-slate-500 leading-relaxed">
                            Navegue pelas abas acima para conferir o <strong>passo a passo detalhado</strong> de configuração, <strong>boas práticas</strong> operacionais recomendadas para sua equipe e respostas para as <strong>dúvidas mais frequentes</strong> do sistema.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeManualTab === "tutorial" && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="space-y-3"
                    >
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Passo a Passo de Configuração (Clique para Expandir)</span>
                      <div className="divide-y divide-slate-100 bg-white border border-slate-150 rounded-2xl overflow-hidden shadow-sm">
                        {manualData.tutorial.map((step, idx) => {
                          const isExpanded = expandedStepIndex === idx;
                          return (
                            <div key={idx} className="transition-all">
                              <button
                                onClick={() => setExpandedStepIndex(isExpanded ? null : idx)}
                                className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50/50 transition-colors focus:outline-none focus:ring-0"
                              >
                                <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-4">
                                  <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border transition-all shrink-0",
                                    isExpanded 
                                      ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20" 
                                      : "bg-slate-50 text-slate-500 border-slate-200"
                                  )}>
                                    {idx + 1}
                                  </div>
                                  <span className={cn(
                                    "text-xs md:text-sm font-bold text-slate-700 transition-colors leading-snug",
                                    isExpanded && "text-blue-600"
                                  )}>
                                    {step.title}
                                  </span>
                                </div>
                                <ChevronRight className={cn(
                                  "w-4 h-4 text-slate-400 transition-transform shrink-0",
                                  isExpanded && "rotate-90 text-blue-600"
                                )} />
                              </button>
                              
                              <AnimatePresence initial={false}>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="overflow-hidden bg-slate-50/40"
                                  >
                                    <div className="px-6 pb-4 pt-1 text-xs text-slate-500 leading-relaxed border-t border-slate-100/50 mt-1 font-medium pl-14">
                                      {step.detail}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {activeManualTab === "dicas" && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="space-y-3"
                    >
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Recomendações e Boas Práticas da Imobiliária</span>
                      <div className="grid grid-cols-1 gap-3">
                        {manualData.dicas.map((tip, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-start gap-3.5 bg-emerald-50/20 hover:bg-emerald-50/40 border border-emerald-100/40 rounded-2xl p-4 transition-all"
                          >
                            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                              0{idx + 1}
                            </div>
                            <p className="text-xs text-slate-600 font-bold leading-relaxed">
                              {tip}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {activeManualTab === "faq" && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="space-y-3"
                    >
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 font-sans">FAQ & Dúvidas Frequentes (Clique na Pergunta)</span>
                      <div className="space-y-2.5">
                        {manualData.faq.map((item, idx) => {
                          const isExpanded = expandedFaqIndex === idx;
                          return (
                            <div 
                              key={idx} 
                              className="border border-slate-150 rounded-2xl bg-slate-50/30 hover:bg-slate-50/60 transition-all overflow-hidden"
                            >
                              <button
                                onClick={() => setExpandedFaqIndex(isExpanded ? null : idx)}
                                className="w-full flex items-center justify-between p-4 text-left font-bold text-xs md:text-sm text-slate-700 focus:outline-none"
                              >
                                <span className="pr-4 leading-tight">{item.question}</span>
                                <span className={cn(
                                  "text-lg leading-none text-slate-400 font-normal transition-transform shrink-0",
                                  isExpanded && "rotate-45 text-blue-600"
                                )}>
                                  +
                                </span>
                              </button>
                              
                              <AnimatePresence initial={false}>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="overflow-hidden bg-white"
                                  >
                                    <p className="px-4 pb-4 text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3 font-medium">
                                      {item.answer}
                                    </p>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4 shrink-0">
                  <div className="flex-1 min-w-0">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Link de Redirecionamento</span>
                    <a 
                      href={viewingManualTool.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="block text-xs text-[#3B82F6] hover:underline font-mono truncate"
                    >
                      {viewingManualTool.url}
                    </a>
                  </div>
                  <a 
                    href={viewingManualTool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-5 py-3 bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-md shadow-blue-500/10 hover:scale-[1.02] active:scale-95 text-center leading-none"
                  >
                    <span>Acessar Ferramenta</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Completion Modal */}
      <AnimatePresence>
        {completionModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setCompletionModal({ isOpen: false, taskId: null })} 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden p-8 text-center flex flex-col items-center"
            >
              {/* Close Button */}
              <button 
                onClick={() => setCompletionModal({ isOpen: false, taskId: null })}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors"
                title="Cancelar"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>

              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6"><CheckCircle2 className="w-8 h-8" /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Tarefa Concluída!</h3>
              
              <div className="w-full mb-6">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1 text-left">Anexos e Documentos (Opcional)</label>
                
                {completionModal.attachments && completionModal.attachments.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {completionModal.attachments.map((file, fIdx) => (
                      <div key={fIdx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="text-[10px] font-bold text-slate-700 truncate">{file.name}</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            const newAtts = [...(completionModal.attachments || [])];
                            newAtts.splice(fIdx, 1);
                            setCompletionModal({ ...completionModal, attachments: newAtts });
                          }}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button 
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = 'image/*,application/pdf,.doc,.docx';
                    input.onchange = async (e: any) => {
                      const files = Array.from(e.target.files as FileList);
                      if (files.length === 0) return;

                      setCompletionModal(prev => ({ ...prev, isUploading: true }));
                      
                      const newAttachments = [...(completionModal.attachments || [])];
                      
                      for (const file of files) {
                        if (file.size > 1024 * 1024) {
                          toast.error(`Arquivo ${file.name} é muito grande (>1MB).`);
                          continue;
                        }

                        try {
                          const base64 = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                          });
                          newAttachments.push({ name: file.name, url: base64 });
                        } catch (err) {
                          toast.error(`Erro ao processar ${file.name}`);
                        }
                      }

                      setCompletionModal(prev => ({ ...prev, attachments: newAttachments, isUploading: false }));
                      toast.success("Arquivos anexados!");
                    };
                    input.click();
                  }}
                  className="w-full h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-400 hover:bg-blue-50/30 transition-all border-spacing-4"
                >
                  {completionModal.isUploading ? (
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 opacity-60" />
                      <span className="text-[10px] font-black uppercase tracking-wider">Anexar Comprovação</span>
                    </>
                  )}
                </button>
              </div>

              <div className="w-full h-px bg-slate-100 mb-6" />

              <p className="text-slate-500 mb-6 text-sm leading-tight">Deseja replicar esta tarefa para amanhã automaticamente?</p>
              
              <div className="grid grid-cols-2 gap-3 w-full mb-3">
                <button 
                  onClick={() => confirmCompletion(false)} 
                  className="py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  Só Concluir
                </button>
                <button 
                  onClick={() => confirmCompletion(true)} 
                  className="py-3.5 bg-[#3B82F6] text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Concluir e Replicar
                </button>
              </div>

              <div className="w-full h-0.5 bg-slate-50 mb-3" />

              {!showReschedule ? (
                <button 
                  onClick={() => setShowReschedule(true)}
                  className="w-full py-3.5 border-2 border-dashed border-slate-200 text-slate-500 rounded-2xl font-bold text-[11px] uppercase tracking-widest hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 mb-4"
                >
                  <CalendarIcon className="w-4 h-4" />
                  Reagendar para outro dia
                </button>
              ) : (
                <div className="w-full space-y-3 mb-6 bg-slate-50 p-4 rounded-[24px] border border-slate-100">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nova Data</span>
                    <button onClick={() => setShowReschedule(false)} className="text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors uppercase tracking-widest">Cancelar</button>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="date" 
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    <button 
                      onClick={handleRescheduleTask}
                      className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              )}

              <button 
                onClick={() => setCompletionModal({ isOpen: false, taskId: null })}
                className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-[0.2em] py-2"
              >
                Cancelar Ação
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteModal({ isOpen: false, taskId: null })} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden p-8 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 className="w-8 h-8" /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Tarefa?</h3>
              <p className="text-slate-500 mb-8">Esta ação não pode ser desfeita.</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setDeleteModal({ isOpen: false, taskId: null })} className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all">Cancelar</button>
                <button onClick={() => deleteModal.taskId && deleteTaskItem(deleteModal.taskId)} className="py-3 bg-red-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-500/25 hover:scale-[1.02] active:scale-95 transition-all">Excluir</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-Views ---

const CalendarView = ({ selectedDate, setSelectedDate, tasks, onAddTask, onToggleTask, isAdmin, allUsers, currentUser, adminTaskView, setAdminTaskView }: any) => {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const tasksForSelectedDate = tasks.filter((t: any) => t.date === format(selectedDate, "yyyy-MM-dd"));

  return (
    <div className="space-y-6">
      {/* Calendar Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Calendário de Atividades</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Visualize e planeje sua agenda</p>
          {isAdmin && (
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 mt-3 w-fit shadow-inner">
              <button 
                onClick={() => setAdminTaskView("all")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                  adminTaskView === "all" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <UsersIcon className="w-3 h-3" />
                Equipe
              </button>
              <button 
                onClick={() => setAdminTaskView("mine")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                  adminTaskView === "mine" ? "bg-white text-blue-600 shadow-sm border border-slate-200/50" : "text-slate-400 hover:text-slate-600"
                )}
              >
                <UserIcon className="w-3 h-3" />
                Minhas
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={onAddTask}
            className="flex items-center gap-2 px-8 py-3.5 bg-[#3B82F6] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/30 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5 stroke-[3px]" />
            Nova Tarefa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold text-slate-900 capitalize">{format(selectedDate, "MMMM yyyy", { locale: ptBR })}</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedDate(addDays(selectedDate, -30))} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
            <button onClick={() => setSelectedDate(new Date())} className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#3B82F6] hover:bg-blue-50 rounded-xl transition-all">Hoje</button>
            <button onClick={() => setSelectedDate(addDays(selectedDate, 30))} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-4">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => (
            <div key={day} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest py-2">{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, idx) => {
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
            const dayTasks = tasks.filter((t: any) => t.date === format(day, "yyyy-MM-dd"));
            
            return (
              <div 
                key={idx}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "aspect-square p-2 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-between relative",
                  isSelected ? "bg-[#3B82F6] border-[#3B82F6] text-white shadow-lg shadow-blue-500/20" : 
                  isCurrentMonth ? "bg-white border-slate-100 hover:border-blue-200" : "bg-slate-50 border-transparent opacity-30",
                  isToday(day) && !isSelected && "border-blue-400"
                )}
              >
                <span className="text-sm font-bold">{format(day, "d")}</span>
                <div className="flex gap-1 flex-wrap justify-center">
                  {dayTasks.slice(0, 3).map((t: any, i: number) => (
                    <div key={i} className={cn("w-1.5 h-1.5 rounded-full", t.completed ? "bg-green-400" : "bg-amber-400")} />
                  ))}
                  {dayTasks.length > 3 && <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-slate-800">Tarefas do Dia</h4>
            <button onClick={onAddTask} className="p-2 bg-blue-50 text-[#3B82F6] rounded-xl hover:bg-blue-100 transition-all"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="space-y-4">
            {tasksForSelectedDate.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm">Nenhuma tarefa agendada.</p>
            ) : tasksForSelectedDate.map((task: any) => (
              <div key={task.id} onClick={() => onToggleTask(task.id)} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer">
                <div className={cn("w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center", task.completed ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300")}>
                  {task.completed && <CheckCircle2 className="w-3 h-3" />}
                </div>
                <div>
                  <p className={cn("text-sm font-semibold text-slate-700", task.completed && "line-through text-slate-400")}>{task.title}</p>
                  {isAdmin && task.uid !== currentUser?.uid && (
                    <p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest mt-0.5">
                      Para: {allUsers.find((u: any) => u.uid === task.uid)?.displayName || 'Colaborador'}
                    </p>
                  )}
                  {task.description && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{task.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

// ReportsView removed as requested

const ICON_MAP: Record<string, any> = {
  "Chave": Key,
  "Busca": Search,
  "Início": Home,
  "Lista": ClipboardList,
  "Prédio": Building2,
  "Usuários": UsersIcon,
  "Documento": FileText,
  "Rápido": Zap,
  "Concluído": CheckCircle2,
  "Configurações": Settings,
  "Relatório": BarChart3,
  "Engrenagem": Sliders
};

const ProcessesView = ({ 
  processes, 
  user, 
  templates, 
  onNavigate, 
  allUsers, 
  isAdmin,
  activeInstanceId,
  setActiveInstanceId,
  companySettings,
  onLaunchCommission
}: { 
  processes: ProcessInstance[], 
  user: User | null, 
  templates: ProcessTemplate[], 
  onNavigate: (tab: any) => void, 
  allUsers: UserProfile[], 
  isAdmin: boolean,
  activeInstanceId: string | null,
  setActiveInstanceId: (id: string | null) => void,
  companySettings: CompanySettings | null,
  onLaunchCommission?: (data: any) => void
}) => {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [isMaximized, setIsMaximized] = useState(false);
  const [highlightedColumnId, setHighlightedColumnId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newProcessTitle, setNewProcessTitle] = useState("");
  const [newProcessType, setNewProcessType] = useState<string>("");
  const [newProcessDueDate, setNewProcessDueDate] = useState("");
  const [newProcessAssignedTo, setNewProcessAssignedTo] = useState("");
  const [newProcessTenantName, setNewProcessTenantName] = useState("");
  const [newProcessPropertyAddress, setNewProcessPropertyAddress] = useState("");
  const [newProcessRentAmount, setNewProcessRentAmount] = useState(0);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "completed" | "archived">("active");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"checklist" | "history" | "notes">("checklist");
  const [suggestionModal, setSuggestionModal] = useState<{
    isOpen: boolean;
    instance: ProcessInstance | null;
    nextStepLabel: string;
    suggestedDate: string;
  }>({ isOpen: false, instance: null, nextStepLabel: "", suggestedDate: format(addDays(new Date(), 2), "yyyy-MM-dd") });
  const [stepProofModal, setStepProofModal] = useState<{ 
    isOpen: boolean; 
    instance: ProcessInstance | null; 
    stepLabel: string; 
    isUploading?: boolean; 
    attachments: { name: string, url: string }[] 
  }>({ isOpen: false, instance: null, stepLabel: "", attachments: [] });
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [columnEditing, setColumnEditing] = useState<string | null>(null);
  const [columnEditValue, setColumnEditValue] = useState("");
  const [deleteProcessModal, setDeleteProcessModal] = useState<{ isOpen: boolean; processId: string | null }>({ isOpen: false, processId: null });

  const kanbanColumns = useMemo(() => [
    { id: "prospeccao", label: "Prospecção", color: "bg-blue-500" },
    { id: "visita", label: "Visita", color: "bg-amber-500" },
    { id: "proposta", label: "Proposta", color: "bg-purple-500" },
    { id: "contrato", label: "Contrato", color: "bg-indigo-500" },
    { id: "concluido", label: "Concluído", color: "bg-green-500" }
  ], []);

  const updateColumnName = async (colId: string) => {
    if (!isAdmin || !columnEditValue.trim()) return;
    try {
      const updatedColumns = kanbanColumns.map(col => 
        col.id === colId ? { ...col, label: columnEditValue } : col
      );
      await updateDoc(doc(db, "settings", "company"), {
        kanbanColumns: updatedColumns,
        updatedAt: serverTimestamp()
      });
      setColumnEditing(null);
      toast.success("Coluna renomeada!");
    } catch (err) {
      toast.error("Erro ao renomear coluna.");
    }
  };

  useEffect(() => {
    if (templates.length > 0 && !newProcessType) {
      setNewProcessType(templates[0].type);
    }
  }, [templates]);

  const addProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProcessTitle.trim() || !user || !newProcessType || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "processes"), {
        uid: (isAdmin && newProcessAssignedTo) ? newProcessAssignedTo : user.uid,
        title: newProcessTitle,
        type: newProcessType,
        status: "active",
        kanbanStatus: "prospeccao",
        completedSteps: [],
        stepHistory: [],
        notes: "",
        companyId: profile?.companyId || "company",
        dueDate: newProcessDueDate || null,
        tenantName: newProcessType === "locacao" ? newProcessTenantName : "",
        propertyAddress: newProcessType === "locacao" ? newProcessPropertyAddress : "",
        rentAmount: newProcessType === "locacao" ? newProcessRentAmount : 0,
        isCommissionLaunched: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewProcessTitle("");
      setNewProcessDueDate("");
      setNewProcessAssignedTo("");
      setNewProcessTenantName("");
      setNewProcessPropertyAddress("");
      setNewProcessRentAmount(0);
      setIsModalOpen(false);
      setActiveInstanceId(docRef.id);
      toast.success("Processo criado com sucesso!");
    } catch (error) {
      toast.error("Erro ao criar processo.");
      handleFirestoreError(error, OperationType.WRITE, "processes");
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickCreate = async (type: string) => {
    if (!user || isSubmitting) return;
    const template = templates.find(t => t.type === type);
    if (!template) return;
    
    setIsSubmitting(true);
    const title = `${template.title}: Novo Cliente - ${format(new Date(), "dd/MM")}`;
    try {
      const docRef = await addDoc(collection(db, "processes"), {
        uid: user.uid,
        title: title,
        type: type,
        status: "active",
        kanbanStatus: "todo",
        completedSteps: [],
        stepHistory: [],
        notes: "",
        companyId: profile?.companyId || "company",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setActiveInstanceId(docRef.id);
      toast.success("Processo criado rapidamente!");
    } catch (error) {
      toast.error("Erro ao criar processo.");
      handleFirestoreError(error, OperationType.WRITE, "processes");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateProcessTitle = async () => {
    if (!activeInstanceId || !editingTitleValue.trim()) return;
    try {
      await updateDoc(doc(db, "processes", activeInstanceId), {
        title: editingTitleValue,
        updatedAt: serverTimestamp()
      });
      setIsEditingTitle(false);
      toast.success("Título atualizado!");
    } catch (error) {
      toast.error("Erro ao atualizar título.");
      handleFirestoreError(error, OperationType.UPDATE, `processes/${activeInstanceId}`);
    }
  };

  const toggleStep = async (instance: ProcessInstance, stepLabel: string) => {
    const isCompleted = instance.completedSteps.includes(stepLabel);
    const newSteps = isCompleted 
      ? instance.completedSteps.filter(s => s !== stepLabel)
      : [...instance.completedSteps, stepLabel];

    const template = templates.find(t => t.type === instance.type);
    if (!template) return;
    
    const isFullyCompleted = newSteps.length === template.steps.length;

    // Update history
    const historyEntry = { label: stepLabel, completedAt: new Date() };
    const newHistory = isCompleted 
      ? (instance.stepHistory || []).filter(h => h.label !== stepLabel)
      : [...(instance.stepHistory || []), historyEntry];

    try {
      const updateData: any = {
        completedSteps: newSteps,
        stepHistory: newHistory,
        status: isFullyCompleted ? "completed" : "active",
        kanbanStatus: isFullyCompleted ? (kanbanColumns[kanbanColumns.length - 1]?.id || "concluido") : (newSteps.length > 0 ? (kanbanColumns[1]?.id || "visita") : instance.kanbanStatus || (kanbanColumns[0]?.id || "prospeccao")),
        updatedAt: serverTimestamp(),
        completedAt: isFullyCompleted ? serverTimestamp() : null
      };

      if (stepProofModal.attachments && stepProofModal.attachments.length > 0) {
        const currentAttachments = instance.stepAttachments || {};
        updateData.stepAttachments = {
          ...currentAttachments,
          [stepProofModal.stepLabel]: stepProofModal.attachments
        };
        
        // Mantemos retrocompatibilidade salvando o primeiro como proofUrl se existir
        if (stepProofModal.attachments[0]) {
          const currentProofs = instance.stepProofs || {};
          updateData.stepProofs = {
            ...currentProofs,
            [stepProofModal.stepLabel]: stepProofModal.attachments[0].url
          };
        }
      }

      await updateDoc(doc(db, "processes", instance.id), updateData);
      
      if (isFullyCompleted && !isCompleted) {
        toast.success("Processo 100% concluído! Parabéns!");
      } else if (!isCompleted && !isFullyCompleted) {
        // Find next step suggestion
        const currentIndex = template.steps.findIndex(s => s.label === stepLabel);
        const nextStep = template.steps[currentIndex + 1];
        if (nextStep) {
          setSuggestionModal({
            isOpen: true,
            instance: instance,
            nextStepLabel: nextStep.label,
            suggestedDate: format(addDays(new Date(), 2), "yyyy-MM-dd")
          });
        }
        toast.info("Etapa concluída!");
      } else {
        toast.info(isCompleted ? "Etapa desmarcada" : "Etapa concluída!");
      }
    } catch (error) {
      toast.error("Erro ao atualizar etapa.");
      handleFirestoreError(error, OperationType.UPDATE, `processes/${instance.id}`);
    }
  };

  const deleteProcess = (id: string) => {
    setDeleteProcessModal({ isOpen: true, processId: id });
  };

  const confirmDeleteProcess = async () => {
    const id = deleteProcessModal.processId;
    if (!id) return;
    
    try {
      await deleteDoc(doc(db, "processes", id));
      if (activeInstanceId === id) setActiveInstanceId(null);
      toast.success("Processo excluído com sucesso.");
    } catch (error) {
      toast.error("Erro ao excluir processo.");
      handleFirestoreError(error, OperationType.DELETE, `processes/${id}`);
    } finally {
      setDeleteProcessModal({ isOpen: false, processId: null });
    }
  };

  const archiveProcess = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "archived" ? "active" : "archived";
    try {
      await updateDoc(doc(db, "processes", id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(newStatus === "archived" ? "Processo arquivado." : "Processo reativado.");
    } catch (error) {
      toast.error("Erro ao alterar status do processo.");
      handleFirestoreError(error, OperationType.UPDATE, `processes/${id}`);
    }
  };

  const saveNotes = async () => {
    if (!activeInstanceId) return;
    try {
      await updateDoc(doc(db, "processes", activeInstanceId), {
        notes: notesValue,
        updatedAt: serverTimestamp()
      });
      setIsEditingNotes(false);
      toast.success("Notas salvas!");
    } catch (error) {
      toast.error("Erro ao salvar notas.");
      handleFirestoreError(error, OperationType.UPDATE, `processes/${activeInstanceId}`);
    }
  };

  const filteredProcesses = useMemo(() => {
    return processes
      .filter(p => {
        if (viewMode === "kanban") {
          return p.status !== "archived";
        }
        return p.status === statusFilter;
      })
      .filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
  }, [processes, statusFilter, searchTerm, viewMode]);

  const activeInstance = processes.find(p => p.id === activeInstanceId);
  const template = activeInstance ? templates.find(t => t.type === activeInstance.type) : null;

  useEffect(() => {
    if (activeInstance) {
      setEditingTitleValue(activeInstance.title);
      setNotesValue(activeInstance.notes || "");
    }
  }, [activeInstanceId, activeInstance]);

  const imprimirRelatorio = () => {
    const printArea = document.getElementById('print-area');
    if (!printArea) {
      toast.error('Erro ao preparar relatório para impressão.');
      return;
    }
    
    // Abrir nova janela
    const novaJanela = window.open('', '_blank', 'width=900,height=1200');
    if (!novaJanela) {
      toast.error('Bloqueador de pop-ups está impedindo a impressão. Permita pop-ups para este site.');
      return;
    }
    
    // Capturar estilos do documento atual (Tailwind compilado)
    const stylesheets = Array.from(document.styleSheets)
      .map(sheet => {
        try {
          return Array.from(sheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n');
        } catch {
          // Estilos cross-origin podem dar erro, ignorar
          return '';
        }
      })
      .join('\n');
    
    // Capturar tags <link rel="stylesheet"> (caso Tailwind esteja via CDN)
    const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(link => link.outerHTML)
      .join('\n');
    
    const tituloRelatorio = (printArea.querySelector('h1')?.textContent || 'Relatório').replace(/[^a-zA-Z0-9-_ ]/g, '');
    
    novaJanela.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>${tituloRelatorio}</title>
        ${linkTags}
        <style>
          ${stylesheets}
          
          /* Reset e estilos específicos para impressão */
          @page {
            size: A4;
            margin: 15mm;
          }
          
          body {
            margin: 0;
            padding: 24px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #0F172A;
            background: white;
          }
          
          /* Garantir que cores impressas saem bem */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Esconder elementos que não devem aparecer no PDF (se houver) */
          .no-print {
            display: none !important;
          }
          
          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        ${printArea.innerHTML}
      </body>
      </html>
    `);
    
    novaJanela.document.close();
    
    let hasPrinted = false;
    const triggerPrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      setTimeout(() => {
        novaJanela.focus();
        novaJanela.print();
        
        // Fechar janela após impressão (ou cancelamento)
        novaJanela.onafterprint = () => {
          novaJanela.close();
        };
      }, 250);
    };

    novaJanela.onload = triggerPrint;
    // Fallback caso onload não dispare por restrições ou carregamento imediato
    setTimeout(triggerPrint, 500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Gestão de Processos</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Acompanhe o monitoramento individual</p>
        </div>
        <div className="flex items-center gap-3">
          {viewMode === "kanban" && (
            <button 
              onClick={() => setIsMaximized(!isMaximized)}
              className={cn(
                "p-3 rounded-2xl border transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-widest",
                isMaximized ? "bg-blue-50 border-blue-200 text-blue-600" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
              title={isMaximized ? "Sair da Visão Ampla" : "Visão Ampla"}
            >
              <div className="flex gap-0.5">
                <div className="w-1.5 h-3 bg-current rounded-full" />
                <div className="w-1.5 h-3 bg-current rounded-full" />
                <div className="w-1.5 h-3 bg-current rounded-full" />
              </div>
              {isMaximized ? "Reduzir" : "Ampla"}
            </button>
          )}
          <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200 shadow-inner">
            <button 
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 rounded-xl transition-all",
                viewMode === "list" ? "bg-white text-blue-600 shadow-md" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <LayoutList className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode("kanban")}
              className={cn(
                "p-2 rounded-xl transition-all",
                viewMode === "kanban" ? "bg-white text-blue-600 shadow-md" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <LayoutDashboard className="w-5 h-5 rotate-90" />
            </button>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#3B82F6] text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" />
            Novo Processo
          </button>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div className={cn(
          "overflow-x-auto pb-6 custom-scrollbar transition-all duration-500",
          isMaximized 
            ? "fixed inset-0 z-50 bg-[#F1F5F9] p-6 md:p-10 overflow-y-auto" 
            : "h-[calc(100vh-280px)] -mx-4 px-4"
        )}>
          {isMaximized && (
            <div className="max-w-[1800px] mx-auto flex items-center justify-between mb-8 pb-6 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <ClipboardList className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Gestão de Processos</h2>
                    <div className="flex items-center gap-2 mt-1.5 focus-within:ring-2 ring-blue-500">
                      <span className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-full text-[9px] font-black text-blue-600 uppercase tracking-widest">
                        <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                        Modo Amplo Ativo
                      </span>
                      <span className="text-[10px] font-medium text-slate-400 italic">Visualização otimizada para monitoramento em tempo real</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsMaximized(false)}
                  className="group flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-600 hover:text-red-600 hover:border-red-100 hover:bg-red-50 transition-all duration-300 font-bold text-xs uppercase tracking-widest"
                >
                  <Minimize2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Reduzir
                </button>
              </div>
            </div>
          )}
          
          <div className={cn(
            "flex gap-6 h-full min-w-max",
            isMaximized && "max-w-[1800px] mx-auto h-[calc(100vh-180px)]"
          )}>
            {kanbanColumns.map((column, colIdx) => {
              const columnProcesses = filteredProcesses.filter(p => {
                let effectiveStatus = p.kanbanStatus || "prospeccao";
                if (effectiveStatus === "todo") effectiveStatus = "prospeccao";
                else if (effectiveStatus === "in_progress") effectiveStatus = "visita";
                else if (effectiveStatus === "waiting") effectiveStatus = "proposta";
                else if (effectiveStatus === "done") effectiveStatus = "concluido";
                return effectiveStatus === column.id;
              });

              return (
                <motion.div 
                  key={column.id} 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const procId = e.dataTransfer.getData("procId");
                    if (!procId) return;
                    setHighlightedColumnId(column.id);
                    setTimeout(() => setHighlightedColumnId(null), 500);
                    try {
                      const proc = filteredProcesses.find(p => p.id === procId);
                      let fromStatus = proc?.kanbanStatus || "prospeccao";
                      if (fromStatus === "todo") fromStatus = "prospeccao";
                      else if (fromStatus === "in_progress") fromStatus = "visita";
                      else if (fromStatus === "waiting") fromStatus = "proposta";
                      else if (fromStatus === "done") fromStatus = "concluido";
                      const fromLabel = kanbanColumns.find(c => c.id === fromStatus)?.label || "Início";
                      
                      const isLast = colIdx === kanbanColumns.length - 1;
                      await updateDoc(doc(db, "processes", procId), {
                        kanbanStatus: column.id,
                        status: isLast ? "completed" : "active",
                        updatedAt: serverTimestamp(),
                        kanbanHistory: arrayUnion({
                          from: fromLabel,
                          to: column.label,
                          timestamp: new Date().toISOString(),
                          userId: user?.uid,
                          userName: profile?.displayName || user?.displayName || "Sistema"
                        })
                      });
                      toast.success(`Movido para ${column.label}`);
                    } catch (err) {
                      toast.error("Erro ao mover card.");
                    }
                  }}
                  className={cn(
                    "w-72 flex flex-col h-full rounded-[32px] border p-4 shadow-sm",
                    isMaximized && "w-80 shadow-md border-slate-300"
                  )}
                  animate={{ 
                    backgroundColor: highlightedColumnId === column.id 
                      ? "#f0fdf4" 
                      : (isMaximized ? "#ffffff" : "rgba(241, 245, 249, 0.3)"),
                    borderColor: highlightedColumnId === column.id
                      ? "#10b981"
                      : (isMaximized ? "#cbd5e1" : "#e2e8f0")
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  <div className="flex items-center justify-between mb-4 px-1 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2 flex-1 group/header">
                      <div className={cn("w-3 h-3 rounded-full shadow-sm ring-2 ring-white transition-transform group-hover:scale-125", column.color)} />
                      {columnEditing === column.id ? (
                        <input 
                          autoFocus
                          value={columnEditValue}
                          onChange={(e) => setColumnEditValue(e.target.value)}
                          onBlur={() => updateColumnName(column.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updateColumnName(column.id);
                            if (e.key === 'Escape') setColumnEditing(null);
                          }}
                          className="bg-white border border-blue-200 rounded px-2 py-0.5 text-xs font-black text-slate-800 focus:outline-none w-full"
                        />
                      ) : (
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => {
                          if (isAdmin) {
                            setColumnEditing(column.id);
                            setColumnEditValue(column.label);
                          }
                        }}>
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{column.label}</h3>
                          {isAdmin && <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover/header:opacity-100 transition-opacity" />}
                        </div>
                      )}
                    </div>
                    <span className="px-2 py-1 bg-white border border-slate-100 rounded-lg text-[10px] font-bold text-slate-500 shadow-sm">
                      {columnProcesses.length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                    <AnimatePresence mode="popLayout">
                      {columnProcesses.map((proc) => {
                        const procTemplate = templates.find(t => t.type === proc.type);
                        if (!procTemplate) return null;
                        const Icon = ICON_MAP[procTemplate.icon] || ClipboardList;
                        const progress = Math.round((proc.completedSteps.length / procTemplate.steps.length) * 100);

                        return (
                          <motion.div 
                            layout
                            key={proc.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("procId", proc.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onClick={() => {
                              setActiveInstanceId(proc.id);
                              if (isMaximized) setIsMaximized(false);
                              setViewMode("list");
                            }}
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 50, scale: 0.95 }}
                            whileDrag={{ scale: 1.05, boxShadow: "0 10px 30px rgba(0,0,0,0.2)", zIndex: 50 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className="bg-slate-50 p-3 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md hover:bg-white hover:border-blue-200 transition-all cursor-grab active:cursor-grabbing group active:scale-95"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shadow-sm", (procTemplate.color || "text-blue-500").replace('text-', 'bg-').replace('500', '100'))}>
                                <Icon className={cn("w-3.5 h-3.5", procTemplate.color)} />
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    let currentStatusId = proc.kanbanStatus || "prospeccao";
                                    if (currentStatusId === "todo") currentStatusId = "prospeccao";
                                    else if (currentStatusId === "in_progress") currentStatusId = "visita";
                                    else if (currentStatusId === "waiting") currentStatusId = "proposta";
                                    else if (currentStatusId === "done") currentStatusId = "concluido";

                                    const currentIndex = kanbanColumns.findIndex(c => c.id === currentStatusId);
                                    const nextCol = kanbanColumns[(currentIndex + 1) % kanbanColumns.length];
                                    const fromLabel = kanbanColumns[currentIndex]?.label || "Início";
                                    const isLast = (currentIndex + 1) === kanbanColumns.length;

                                    setHighlightedColumnId(nextCol.id);
                                    setTimeout(() => setHighlightedColumnId(null), 500);

                                    updateDoc(doc(db, "processes", proc.id), { 
                                      kanbanStatus: nextCol.id,
                                      status: isLast ? "completed" : "active",
                                      updatedAt: serverTimestamp(),
                                      kanbanHistory: arrayUnion({
                                        from: fromLabel,
                                        to: nextCol.label,
                                        timestamp: new Date().toISOString(),
                                        userId: user?.uid,
                                        userName: profile?.displayName || user?.displayName || "Sistema"
                                      })
                                    });
                                    toast.info(`Movido para ${nextCol.label}`);
                                  }}
                                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            
                            <h4 className="font-bold text-slate-900 text-[11px] mb-1.5 line-clamp-2 leading-tight">{proc.title}</h4>
                            
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-wider">
                                <span className="text-slate-500">{procTemplate.title}</span>
                                <span className="text-blue-700">{progress}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-600 transition-all duration-500 shadow-[0_0_8px_rgba(37,99,235,0.4)]" 
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              
                              <div className="flex items-center justify-between pt-0.5">
                                <div className="flex -space-x-1">
                                  <div className="w-4.5 h-4.5 rounded-full bg-blue-100 border border-white flex items-center justify-center text-[8px] font-bold text-blue-600" title={proc.uid ? allUsers.find(u => u.uid === proc.uid)?.displayName || "Sistema" : user?.displayName}>
                                    {proc.uid ? (allUsers.find(u => u.uid === proc.uid)?.displayName || "U")?.charAt(0) : user?.displayName?.charAt(0)}
                                  </div>
                                </div>
                                {proc.dueDate && (
                                  <div className={cn(
                                    "flex items-center gap-0.5 text-[8px] font-bold",
                                    proc.dueDate < TODAY_ISO ? "text-red-500" : "text-slate-400"
                                  )}>
                                    <Clock className="w-2.5 h-2.5" />
                                    {format(parseISO(proc.dueDate), "dd MMM", { locale: ptBR })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {columnProcesses.length === 0 && (
                      <div className="py-8 border-2 border-dashed border-slate-300 bg-slate-100/50 rounded-2xl flex flex-col items-center justify-center text-slate-500">
                        <PlusCircle className="w-6 h-6 mb-1.5 opacity-40" />
                        <p className="text-[9px] font-black uppercase tracking-widest">Aguardando...</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: List of Instances */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-white p-4 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Filtros</h3>
              {profile?.role === 'admin' && (
                <button 
                  onClick={() => onNavigate("process_config")}
                  className="text-[10px] font-bold text-blue-500 hover:underline uppercase tracking-widest flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  Configurar
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text"
                placeholder="Buscar processo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200/50">
              {(["active", "completed", "archived"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                    statusFilter === status 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {status === "active" ? "Ativos" : status === "completed" ? "Concluídos" : "Arquivados"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1 custom-scrollbar">
            {filteredProcesses.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400 text-sm">
                {searchTerm ? "Nenhum resultado encontrado." : "Nenhum processo nesta categoria."}
              </div>
            ) : filteredProcesses.map((proc) => {
              const procTemplate = templates.find(t => t.type === proc.type);
              if (!procTemplate) return null;
              const Icon = ICON_MAP[procTemplate.icon] || ClipboardList;
              const progress = Math.round((proc.completedSteps.length / procTemplate.steps.length) * 100);

              return (
                <div 
                  key={proc.id}
                  onClick={() => setActiveInstanceId(proc.id)}
                  className={cn(
                    "group p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden",
                    activeInstanceId === proc.id 
                      ? "bg-white border-blue-400 shadow-lg ring-1 ring-blue-100" 
                      : "bg-white border-slate-200 hover:border-blue-200 shadow-sm"
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", (procTemplate.color || "text-blue-500").replace('text-', 'bg-').replace('500', '100'))}>
                        <Icon className={cn("w-4 h-4", procTemplate.color)} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm truncate max-w-[120px]">{proc.title}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{procTemplate.title}</p>
                      </div>
                    </div>
                    {proc.dueDate && proc.dueDate < TODAY_ISO && proc.status === 'active' && (
                      <div className="p-1 bg-red-100 text-red-600 rounded-full animate-pulse" title="Atrasado">
                        <AlertCircle className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-400">Progresso</span>
                      <span className="text-blue-600">{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-500" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[9px] text-slate-400 font-medium">
                        Atualizado {proc.updatedAt?.toDate ? format(proc.updatedAt.toDate(), "dd/MM") : 'Agora'}
                      </div>
                      {proc.dueDate && (
                        <div className={cn(
                          "text-[9px] font-bold",
                          (proc.dueDate < TODAY_ISO && proc.status === 'active') ? "text-red-500" : "text-slate-400"
                        )}>
                          Prazo: {format(parseISO(proc.dueDate), "dd/MM")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content: Steps for Active Instance */}
        <div className="lg:col-span-3">
          {activeInstance && template ? (
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-slate-100")}>
                    {React.createElement(ICON_MAP[template.icon] || ClipboardList, { className: cn("w-7 h-7", template.color) })}
                  </div>
                  <div>
                    {isEditingTitle ? (
                      <div className="flex items-center gap-2">
                        <input 
                          type="text"
                          value={editingTitleValue}
                          onChange={(e) => setEditingTitleValue(e.target.value)}
                          className="text-2xl font-bold text-slate-900 bg-white border border-blue-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updateProcessTitle();
                            if (e.key === 'Escape') setIsEditingTitle(false);
                          }}
                        />
                        <button onClick={updateProcessTitle} className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setIsEditingTitle(false)} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/title">
                        <h3 className="text-2xl font-bold text-slate-900">{activeInstance.title}</h3>
                        <button 
                          onClick={() => setIsEditingTitle(true)}
                          className="opacity-0 group-hover/title:opacity-100 p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <p className="text-sm font-medium text-slate-500">
                      {template.title} • {activeInstance.completedSteps.length} de {template.steps.length} etapas concluídas
                      <span className="block text-[10px] font-bold uppercase mt-1">
                        <span className="text-slate-400">Iniciado em: {activeInstance.createdAt?.toDate ? format(activeInstance.createdAt.toDate(), "dd/MM/yyyy 'às' HH:mm") : format(new Date(), "dd/MM/yyyy")}</span>
                        <span className="ml-3 group/date relative inline-flex items-center gap-1">
                          <span className={cn(
                            "px-2 py-0.5 rounded cursor-pointer hover:bg-slate-200 transition-colors",
                            (activeInstance.dueDate && activeInstance.dueDate < TODAY_ISO && activeInstance.status === 'active') ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-600"
                          )}>
                            Prazo: {activeInstance.dueDate ? format(parseISO(activeInstance.dueDate), "dd/MM/yyyy") : "Não definido"}
                            {(activeInstance.dueDate && activeInstance.dueDate < TODAY_ISO && activeInstance.status === 'active') && " (ATRASADO)"}
                          </span>
                          <input 
                            type="date"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            value={activeInstance.dueDate || ""}
                            onChange={async (e) => {
                              try {
                                await updateDoc(doc(db, "processes", activeInstance.id), {
                                  dueDate: e.target.value || null,
                                  updatedAt: serverTimestamp()
                                });
                                toast.success("Prazo atualizado!");
                              } catch (err) {
                                toast.error("Erro ao atualizar prazo.");
                              }
                            }}
                          />
                        </span>
                        {activeInstance.status === 'completed' && activeInstance.completedAt && (
                          <span className="text-green-600 ml-2">
                            • Concluído em: {activeInstance.completedAt.toDate ? format(activeInstance.completedAt.toDate(), "dd/MM/yyyy 'às' HH:mm") : 'Recentemente'}
                          </span>
                        )}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</div>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        activeInstance.status === 'completed' ? "bg-green-500" : activeInstance.status === 'archived' ? "bg-slate-400" : "bg-blue-500 animate-pulse"
                      )} />
                      <span className="text-xs font-bold text-slate-700">
                        {activeInstance.status === 'completed' ? "Concluído" : activeInstance.status === 'archived' ? "Arquivado" : "Em Andamento"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeInstance.type === "locacao" && !activeInstance.isCommissionLaunched && (
                      <button 
                        onClick={() => onLaunchCommission?.({
                          imovel: activeInstance.propertyAddress || activeInstance.title,
                          inquilino: activeInstance.tenantName || "",
                          aluguelMensal: activeInstance.rentAmount || 0,
                          processId: activeInstance.id
                        })}
                        className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-2xl border border-indigo-100 transition-all flex items-center gap-2"
                        title="Lançar Comissão"
                      >
                        <DollarSign className="w-5 h-5" />
                        <span className="text-[10px] font-bold uppercase hidden sm:inline">Lançar Comissão</span>
                      </button>
                    )}
                    {activeInstance.isCommissionLaunched && (
                       <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                          Comissão Lançada
                       </div>
                    )}
                    <button 
                      onClick={() => setIsReportModalOpen(true)}
                      className="p-3 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-2xl border border-slate-100 transition-all flex items-center gap-2"
                      title="Gerar Relatório de Execução"
                    >
                      <Download className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase hidden sm:inline">Relatório</span>
                    </button>
                    <button 
                      onClick={() => archiveProcess(activeInstance.id, activeInstance.status)}
                      className="p-3 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-2xl border border-slate-100 transition-all"
                      title={activeInstance.status === 'archived' ? "Reativar" : "Arquivar"}
                    >
                      <Archive className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => deleteProcess(activeInstance.id)}
                      className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl border border-slate-100 transition-all"
                      title="Excluir Processo"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex border-b border-slate-100 bg-white">
                {[
                  { id: "checklist", label: "Checklist", icon: ClipboardList },
                  { id: "history", label: "Histórico", icon: History },
                  { id: "notes", label: "Notas", icon: MessageSquare },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-8 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all",
                      activeSubTab === tab.id 
                        ? "border-blue-500 text-blue-600 bg-blue-50/30" 
                        : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-8">
                {activeSubTab === "checklist" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {template.steps.map((step, sIdx) => {
                      const isDone = activeInstance.completedSteps.includes(step.label);
                      const attachments = activeInstance.stepAttachments?.[step.label] || [];
                      return (
                        <div 
                          key={sIdx} 
                          onClick={() => {
                            setStepProofModal({ 
                              isOpen: true, 
                              instance: activeInstance, 
                              stepLabel: step.label,
                              attachments: attachments
                            });
                          }}
                          className={cn(
                            "group relative flex gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                            isDone ? "bg-green-50/30 border-green-100 shadow-sm" : "bg-white border-slate-100 hover:border-slate-200"
                          )}
                        >
                          <div 
                            onClick={(e) => {
                              if (isDone) {
                                e.stopPropagation();
                                toggleStep(activeInstance, step.label);
                              }
                            }}
                            className={cn(
                              "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all z-10",
                              isDone ? "bg-green-500 border-green-500 text-white shadow-lg shadow-green-200" : "border-slate-200 group-hover:border-blue-400"
                            )}>
                            {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4 text-transparent" />}
                          </div>
                          <div className="space-y-1 flex-1">
                            <h4 className={cn("font-bold text-sm transition-all", isDone ? "text-green-700" : "text-slate-800")}>{step.label}</h4>
                            <p className="text-xs text-slate-500 leading-relaxed font-medium">{step.desc}</p>
                            
                            {attachments.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {attachments.map((att, aIdx) => (
                                  <button 
                                    key={aIdx}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenAttachment(att.url, att.name);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-xl text-[10px] font-bold hover:bg-slate-50 hover:border-blue-200 transition-all shadow-sm"
                                  >
                                    <FileText className="w-3 h-3 text-blue-500" />
                                    {att.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeSubTab === "history" && (
                  <div className="max-w-xl space-y-10 transition-all duration-300">
                    {/* Linha do Tempo de Etapas Kanban */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 px-2">
                        <LayoutDashboard className="w-4 h-4 text-slate-400" />
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Trajetória no Kanban</h4>
                      </div>
                      {(!activeInstance.kanbanHistory || activeInstance.kanbanHistory.length === 0) ? (
                        <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                          <p className="text-xs text-slate-400 italic">Nenhuma movimentação de colunas registrada ainda.</p>
                        </div>
                      ) : (
                        <div className="relative space-y-8 before:absolute before:left-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 ml-1">
                          {[...activeInstance.kanbanHistory].reverse().map((entry, idx) => (
                            <div key={idx} className="relative pl-12 group/history">
                              <div className="absolute left-0 top-0.5 w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center z-10 shadow-sm group-hover/history:border-blue-300 transition-all">
                                <ChevronRight className="w-5 h-5 text-blue-500" />
                              </div>
                              <div className="pt-0.5">
                                <p className="text-sm font-bold text-slate-800 leading-tight">
                                  Movido de <span className="text-slate-400 line-through decoration-slate-200">{entry.from}</span> para <span className="text-blue-600">{entry.to}</span>
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 px-1.5 py-0.5 rounded">
                                    <Clock className="w-2.5 h-2.5" />
                                    {format(new Date(entry.timestamp), "dd/MM/yyyy 'às' HH:mm")}
                                  </div>
                                  <span className="text-[9px] text-slate-300 font-bold">•</span>
                                  <div className="flex items-center gap-1 text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                                    <UserIcon className="w-2.5 h-2.5" />
                                    {entry.userName}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="h-px bg-slate-100 mx-2" />

                    {/* Linha do Tempo de Checklist */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 px-2">
                        <CheckCircle2 className="w-4 h-4 text-slate-400" />
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Execução de Atividades</h4>
                      </div>
                      {(!activeInstance.stepHistory || activeInstance.stepHistory.length === 0) ? (
                        <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                          <p className="text-xs text-slate-400 italic">Nenhuma atividade do checklist concluída ainda.</p>
                        </div>
                      ) : (
                        <div className="relative space-y-8 before:absolute before:left-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 ml-1">
                          {[...activeInstance.stepHistory].reverse().map((entry, idx) => (
                            <div key={idx} className="relative pl-12 group/step">
                              <div className="absolute left-0 top-0.5 w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center z-10 shadow-sm group-hover/step:border-green-300 transition-all">
                                <Check className="w-5 h-5 text-green-600" />
                              </div>
                              <div className="pt-0.5">
                                <p className="text-sm font-bold text-slate-800 leading-tight">{entry.label}</p>
                                <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 px-1.5 py-0.5 rounded mt-2 w-fit">
                                  <Clock className="w-2.5 h-2.5" />
                                  Concluído em {entry.completedAt.toDate ? format(entry.completedAt.toDate(), "dd/MM/yyyy 'às' HH:mm") : format(new Date(entry.completedAt), "dd/MM/yyyy 'às' HH:mm")}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeSubTab === "notes" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Notas do Processo</h4>
                      {!isEditingNotes && (
                        <button 
                          onClick={() => setIsEditingNotes(true)}
                          className="text-xs font-bold text-blue-500 hover:underline"
                        >
                          Editar Notas
                        </button>
                      )}
                    </div>
                    
                    {isEditingNotes ? (
                      <div className="space-y-4">
                        <textarea 
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          placeholder="Adicione observações importantes sobre este processo..."
                          rows={10}
                          className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 leading-relaxed resize-none"
                        />
                        <div className="flex gap-3">
                          <button 
                            onClick={saveNotes}
                            className="px-6 py-3 bg-blue-500 text-white rounded-2xl font-bold text-xs hover:bg-blue-600 transition-all"
                          >
                            Salvar Notas
                          </button>
                          <button 
                            onClick={() => setIsEditingNotes(false)}
                            className="px-6 py-3 bg-slate-100 text-slate-500 rounded-2xl font-bold text-xs hover:bg-slate-200 transition-all"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 min-h-[200px]">
                        {activeInstance.notes ? (
                          <div className="text-slate-700 whitespace-pre-wrap leading-relaxed break-words break-all">
                            {activeInstance.notes}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                            <p className="text-sm">Nenhuma nota adicionada.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-[40px] border border-dashed border-slate-200 text-center p-12">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6">
                <ClipboardList className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Selecione ou Crie um Processo</h3>
              <p className="text-slate-500 max-w-xs mb-8">Escolha um processo na lista ao lado ou use os atalhos abaixo para começar agora.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => quickCreate(t.type)}
                    className="flex flex-col items-center gap-3 p-6 rounded-3xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-blue-200 hover:shadow-md transition-all group"
                  >
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-sm group-hover:scale-110 transition-transform")}>
                      {React.createElement(ICON_MAP[t.icon] || ClipboardList, { className: cn("w-6 h-6", t.color) })}
                    </div>
                    <span className="text-xs font-bold text-slate-700">{t.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )}

      {/* Next Step Suggestion Modal */}
      <AnimatePresence>
        {suggestionModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSuggestionModal({ ...suggestionModal, isOpen: false })} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar p-8 text-center">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6"><Clock className="w-8 h-8" /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Próxima Etapa</h3>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                Etapa concluída! Deseja agendar um prazo para a próxima tarefa: <strong className="text-slate-900">{suggestionModal.nextStepLabel}</strong>?
              </p>
              
              <div className="space-y-4 text-left mb-8">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Previsão</label>
                  <input 
                    type="date" 
                    value={suggestionModal.suggestedDate}
                    onChange={(e) => setSuggestionModal({ ...suggestionModal, suggestedDate: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setSuggestionModal({ ...suggestionModal, isOpen: false })} 
                  className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  Pular
                </button>
                <button 
                  onClick={async () => {
                    if (suggestionModal.instance) {
                      try {
                        await updateDoc(doc(db, "processes", suggestionModal.instance.id), {
                          dueDate: suggestionModal.suggestedDate,
                          updatedAt: serverTimestamp()
                        });
                        toast.success("Prazo agendado para a próxima etapa!");
                      } catch (err) {
                        toast.error("Erro ao agendar prazo.");
                      }
                    }
                    setSuggestionModal({ ...suggestionModal, isOpen: false });
                  }} 
                  className="py-3 bg-[#3B82F6] text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Agendar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Process Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="text-2xl font-bold text-slate-900">Novo Processo</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={addProcess} className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Nome do Processo</label>
                  <input 
                    autoFocus
                    required
                    type="text"
                    value={newProcessTitle}
                    onChange={(e) => setNewProcessTitle(e.target.value)}
                    placeholder="Ex: Locação Casa Maria Nadir"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Tipo de Operação</label>
                  <div className="grid grid-cols-1 gap-3">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setNewProcessType(t.type)}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-2xl border transition-all text-left",
                          newProcessType === t.type 
                            ? "bg-blue-50 border-blue-200 ring-1 ring-blue-100" 
                            : "bg-white border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", 
                          newProcessType === t.type ? "bg-white shadow-sm" : "bg-slate-50")}>
                          {React.createElement(ICON_MAP[t.icon] || ClipboardList, { 
                            className: cn("w-5 h-5", newProcessType === t.type ? t.color : "text-slate-400") 
                          })}
                        </div>
                        <div>
                          <p className={cn("font-bold text-sm", newProcessType === t.type ? "text-blue-900" : "text-slate-700")}>
                            {t.title}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {t.steps.length} etapas no checklist
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                {newProcessType === "locacao" && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-6 pt-2"
                  >
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Nome do Inquilino</label>
                      <input 
                        type="text"
                        value={newProcessTenantName}
                        onChange={(e) => setNewProcessTenantName(e.target.value)}
                        placeholder="Nome completo do futuro inquilino"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Endereço do Imóvel</label>
                      <input 
                        type="text"
                        value={newProcessPropertyAddress}
                        onChange={(e) => setNewProcessPropertyAddress(e.target.value)}
                        placeholder="Rua, Número, Bairro"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Valor do Aluguel (R$)</label>
                      <input 
                        type="number"
                        value={newProcessRentAmount}
                        onChange={(e) => setNewProcessRentAmount(Number(e.target.value))}
                        placeholder="0,00"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                      />
                    </div>
                  </motion.div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Prazo para Conclusão (Opcional)</label>
                  <input 
                    type="date"
                    value={newProcessDueDate}
                    onChange={(e) => setNewProcessDueDate(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                  />
                </div>
                {isAdmin && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Atribuir a</label>
                    <select 
                      value={newProcessAssignedTo || user?.uid} 
                      onChange={(e) => setNewProcessAssignedTo(e.target.value)} 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                    >
                      <option value={user?.uid}>Mim mesmo (Admin)</option>
                      {allUsers.filter(u => u.uid !== user?.uid).map(u => (
                        <option key={u.uid} value={u.uid}>{u.displayName || u.email} {u.role === 'admin' ? '(Admin)' : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-5 bg-[#3B82F6] text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "Criando..." : "Criar Processo"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Step Proof Modal */}
      <AnimatePresence>
        {stepProofModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setStepProofModal({ ...stepProofModal, isOpen: false })} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar p-8 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6"><CheckCircle2 className="w-8 h-8" /></div>
              <h3 className="text-xl font-bold text-slate-900 mb-2 truncate max-w-full px-4">{stepProofModal.stepLabel}</h3>
              <p className="text-slate-500 mb-6 text-sm">Etapa concluída! Deseja anexar um comprovante ou foto desta atividade?</p>
              
              <div className="w-full space-y-4 mb-8 text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Anexos e Documentos / Contratos</label>
                
                {stepProofModal.attachments && stepProofModal.attachments.length > 0 && (
                  <div className="space-y-2">
                    {stepProofModal.attachments.map((file, fIdx) => (
                      <div key={fIdx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-700 truncate">{file.name}</span>
                        </div>
                        <button 
                          onClick={() => {
                            const newAtts = [...stepProofModal.attachments];
                            newAtts.splice(fIdx, 1);
                            setStepProofModal({ ...stepProofModal, attachments: newAtts });
                          }}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button 
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.multiple = true;
                    input.accept = 'image/*,application/pdf,.doc,.docx';
                    input.onchange = async (e: any) => {
                      const files = Array.from(e.target.files as FileList);
                      if (files.length === 0) return;

                      setStepProofModal(prev => ({ ...prev, isUploading: true }));
                      
                      const newAttachments = [...(stepProofModal.attachments || [])];
                      
                      for (const file of files) {
                        if (file.size > 1024 * 1024) { // Increased to 1MB for contracts, but warning remains
                          toast.error(`Arquivo ${file.name} é muito grande (>1MB).`);
                          continue;
                        }

                        try {
                          const base64 = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                          });
                          newAttachments.push({ name: file.name, url: base64 });
                        } catch (err) {
                          toast.error(`Erro ao processar ${file.name}`);
                        }
                      }

                      setStepProofModal(prev => ({ ...prev, attachments: newAttachments, isUploading: false }));
                      toast.success("Arquivos anexados!");
                    };
                    input.click();
                  }}
                  className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
                >
                  {stepProofModal.isUploading ? (
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 group-hover:text-blue-500 transition-colors" />
                      <span className="text-[10px] font-bold uppercase">Anexar Contrato / Documento</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full shrink-0">
                <button onClick={() => setStepProofModal({ ...stepProofModal, isOpen: false })} className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all">Cancelar</button>
                <button 
                  onClick={() => {
                    if (stepProofModal.instance) {
                      toggleStep(stepProofModal.instance, stepProofModal.stepLabel);
                      setStepProofModal({ ...stepProofModal, isOpen: false, instance: null, stepLabel: "" });
                    }
                  }} 
                  className="py-3 bg-[#3B82F6] text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Finalizar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Process Report Modal */}
      <AnimatePresence>
        {isReportModalOpen && activeInstance && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsReportModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 30 }} 
              className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0 h-24">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">Relatório de Execução</h3>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-0.5">{activeInstance.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={imprimirRelatorio}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Imprimir / PDF
                  </button>
                  <button onClick={() => setIsReportModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-12 print:p-0 space-y-12">
                <div id="print-area" className="p-8 space-y-12">
                  <header className="flex justify-between items-start border-b border-slate-200 pb-8">
                    <div>
                      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{activeInstance.title}</h1>
                      <div className="mt-5 flex flex-wrap items-center gap-6">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo</span>
                          <span className="text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                            {activeInstance.type === 'locacao' ? 'Locação' : activeInstance.type.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</span>
                          <span className={cn(
                            "text-xs font-bold px-2.5 py-1 rounded-lg border",
                            activeInstance.status === 'completed' 
                              ? "bg-green-50 text-green-700 border-green-200" 
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          )}>
                            {activeInstance.status === 'completed' ? "Concluído" : "Em Andamento"}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Progresso</span>
                          <span className="text-xs font-bold text-slate-800 bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-lg">
                            {Math.round((activeInstance.completedSteps.length / (template?.steps.length || 1)) * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-3">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data do Relatório</p>
                        <span className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg inline-block">
                          {format(new Date(), "dd/MM/yyyy HH:mm")}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-end">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Gerado por</span>
                        <span className="text-xs font-bold text-slate-700 mt-0.5">{user?.displayName || user?.email}</span>
                      </div>
                    </div>
                  </header>

                  <section className="space-y-6">
                    <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider border-l-4 border-blue-500 pl-4 text-left">Checklist de Execução</h2>
                    <div className="grid grid-cols-1 gap-4">
                      {template?.steps.map((step, idx) => {
                        const isDone = activeInstance.completedSteps.includes(step.label);
                        const attachments = activeInstance.stepAttachments?.[step.label] || [];
                        return (
                          <div key={idx} className={cn(
                            "flex items-start gap-6 p-6 rounded-[24px] border transition-all text-left shadow-sm",
                            isDone 
                              ? "bg-white border-slate-200" 
                              : "bg-slate-50/40 border-slate-100 opacity-60 print:opacity-100"
                          )}>
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 mt-0.5 transition-all",
                              isDone 
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" 
                                : "border-slate-200 bg-white text-transparent"
                            )}>
                              {isDone && <Check className="w-4 h-4 stroke-[3]" />}
                            </div>
                            <div className="flex-1">
                              <h3 className={cn("font-bold tracking-tight text-base transition-colors", isDone ? "text-slate-900" : "text-slate-700")}>{step.label}</h3>
                              <p className="text-sm text-slate-500 mt-1 leading-relaxed font-normal">{step.desc}</p>
                              {isDone && attachments.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-3">
                                  {attachments.map((att, aIdx) => (
                                    <div key={aIdx} className="flex items-center gap-2">
                                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[11px] font-bold border border-blue-100">
                                        <FileText className="w-4 h-4" />
                                        {att.name}
                                      </div>
                                      <button 
                                        onClick={() => handleOpenAttachment(att.url, att.name)}
                                        className="text-[11px] text-blue-500 underline font-bold print:hidden"
                                      >
                                        Visualizar
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {activeInstance.notes && (
                    <section className="space-y-6">
                      <h2 className="text-base font-bold text-slate-900 uppercase tracking-wider border-l-4 border-blue-500 pl-4 text-left">Observações e Notas</h2>
                      <div className="p-8 bg-slate-50 border border-slate-150 rounded-[28px] text-slate-700 text-sm leading-relaxed font-normal text-left shadow-inner whitespace-pre-wrap break-words break-all">
                        {activeInstance.notes}
                      </div>
                    </section>
                  )}
                  
                  <footer className="pt-16 mt-16 border-t border-slate-150 grid grid-cols-2 gap-12 text-center text-slate-400">
                    <div className="space-y-3">
                      <div className="border-b border-slate-200 h-10 w-full max-w-xs mx-auto"></div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Assinatura do Responsável</p>
                    </div>
                    <div className="space-y-3">
                      <div className="border-b border-slate-200 h-10 w-full max-w-xs mx-auto"></div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Assinatura da Supervisão</p>
                    </div>
                  </footer>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Process Confirmation Modal */}
      <AnimatePresence>
        {deleteProcessModal.isOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setDeleteProcessModal({ isOpen: false, processId: null })} 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Excluir Processo?</h3>
              <p className="text-slate-500 mb-8 text-sm">Esta ação removerá permanentemente o processo, incluindo todo o histórico e checklist. Não poderá ser desfeita.</p>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setDeleteProcessModal({ isOpen: false, processId: null })}
                  className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all font-black"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDeleteProcess}
                  className="py-4 bg-red-500 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-red-200 hover:bg-red-600 transition-all font-black"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProcessConfigView = ({ templates }: { templates: ProcessTemplate[] }) => {
  const [editingTemplate, setEditingTemplate] = useState<ProcessTemplate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editIcon, setEditIcon] = useState("ClipboardList");
  const [editColor, setEditColor] = useState("text-blue-500");
  const [editSteps, setEditSteps] = useState<ProcessStep[]>([]);
  const [editType, setEditType] = useState("");

  const openEdit = (template: ProcessTemplate) => {
    setEditingTemplate(template);
    setEditTitle(template.title);
    setEditIcon(template.icon);
    setEditColor(template.color);
    setEditSteps([...template.steps]);
    setIsModalOpen(true);
  };

  const openNew = () => {
    setEditTitle("");
    setEditIcon("ClipboardList");
    setEditColor("text-blue-500");
    setEditSteps([{ label: "Primeira Etapa", desc: "Descrição da etapa" }]);
    setEditType("");
    setIsNewModalOpen(true);
  };

  const saveTemplate = async () => {
    if (!editingTemplate) return;
    try {
      await updateDoc(doc(db, "process_templates", editingTemplate.id), {
        title: editTitle,
        icon: editIcon,
        color: editColor,
        steps: editSteps,
        updatedAt: serverTimestamp()
      });
      setIsModalOpen(false);
      toast.success("Template de processo atualizado!");
    } catch (error) {
      toast.error("Erro ao atualizar template.");
      handleFirestoreError(error, OperationType.UPDATE, `process_templates/${editingTemplate.id}`);
    }
  };

  const createTemplate = async () => {
    if (!editTitle.trim() || !editType.trim()) {
      toast.error("Preencha o título e o identificador (tipo).");
      return;
    }
    try {
      await addDoc(collection(db, "process_templates"), {
        title: editTitle,
        type: editType.toLowerCase().replace(/\s+/g, "_"),
        icon: editIcon,
        color: editColor,
        steps: editSteps,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsNewModalOpen(false);
      toast.success("Novo template criado com sucesso!");
    } catch (error) {
      toast.error("Erro ao criar template.");
      handleFirestoreError(error, OperationType.CREATE, "process_templates");
    }
  };

  const deleteTemplate = (id: string) => {
    toast("Tem certeza que deseja excluir este template?", {
      action: {
        label: "Excluir",
        onClick: async () => {
          try {
            await deleteDoc(doc(db, "process_templates", id));
            toast.success("Template excluído!");
          } catch (error) {
            toast.error("Erro ao excluir template.");
            handleFirestoreError(error, OperationType.DELETE, `process_templates/${id}`);
          }
        }
      }
    });
  };

  const addStep = () => {
    setEditSteps([...editSteps, { label: "Nova Etapa", desc: "Descrição da etapa" }]);
  };

  const removeStep = (index: number) => {
    setEditSteps(editSteps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof ProcessStep, value: string) => {
    const newSteps = [...editSteps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setEditSteps(newSteps);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Configurar Processos</h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Personalize as etapas e detalhes</p>
        </div>
        <button 
          onClick={openNew}
          className="flex items-center gap-2 px-6 py-3 bg-[#3B82F6] text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          Novo Tipo de Operação
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {templates.map((t) => (
          <div key={t.id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-6">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm border border-slate-50 bg-white")}>
                {React.createElement(ICON_MAP[t.icon] || ClipboardList, { className: cn("w-7 h-7", t.color) })}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => openEdit(t)}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => deleteTemplate(t.id)}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{t.title}</h3>
            <p className="text-sm text-slate-500 mb-6">{t.steps.length} etapas configuradas</p>
            <div className="space-y-2">
              {t.steps.slice(0, 3).map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-1 h-1 rounded-full bg-slate-300" />
                  <span className="truncate">{step.label}</span>
                </div>
              ))}
              {t.steps.length > 3 && (
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest pt-1">+{t.steps.length - 3} outras etapas</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="text-2xl font-bold text-slate-900">Editar Template: {editTitle}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto space-y-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Título do Template</label>
                    <input 
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Ícone</label>
                    <select 
                      value={editIcon}
                      onChange={(e) => setEditIcon(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    >
                      {Object.keys(ICON_MAP).filter(k => !["Key", "Search", "Home", "ClipboardList", "Building2", "Users", "FileText", "Zap", "CheckCircle2"].includes(k)).map(iconName => (
                        <option key={iconName} value={iconName}>{iconName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Etapas do Checklist</label>
                    <button 
                      onClick={addStep}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs hover:bg-blue-100 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Etapa
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {editSteps.map((step, index) => (
                      <div key={index} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4 relative group">
                        <button 
                          onClick={() => removeStep(index)}
                          className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="grid grid-cols-1 gap-4">
                          <input 
                            type="text"
                            value={step.label}
                            onChange={(e) => updateStep(index, "label", e.target.value)}
                            placeholder="Nome da etapa"
                            className="w-full px-4 py-2 bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm"
                          />
                          <textarea 
                            value={step.desc}
                            onChange={(e) => updateStep(index, "desc", e.target.value)}
                            placeholder="Descrição detalhada"
                            rows={2}
                            className="w-full px-4 py-2 bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs text-slate-600 resize-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 shrink-0">
                <button 
                  onClick={saveTemplate}
                  className="w-full py-5 bg-[#3B82F6] text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Salvar Alterações
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isNewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="text-2xl font-bold text-slate-900">Novo Tipo de Operação</h3>
                <button onClick={() => setIsNewModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Título da Operação</label>
                    <input 
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Ex: Aluguel de Temporada"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Identificador (Tipo)</label>
                    <input 
                      type="text"
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      placeholder="Ex: aluguel_temporada"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Ícone</label>
                    <select 
                      value={editIcon}
                      onChange={(e) => setEditIcon(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    >
                      {Object.keys(ICON_MAP).filter(k => !["Key", "Search", "Home", "ClipboardList", "Building2", "Users", "FileText", "Zap", "CheckCircle2"].includes(k)).map(iconName => (
                        <option key={iconName} value={iconName}>{iconName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Cor</label>
                    <select 
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    >
                      <option value="text-blue-500">Azul</option>
                      <option value="text-green-500">Verde</option>
                      <option value="text-amber-500">Amarelo</option>
                      <option value="text-red-500">Vermelho</option>
                      <option value="text-purple-500">Roxo</option>
                      <option value="text-pink-500">Rosa</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Etapas do Checklist</label>
                    <button 
                      onClick={addStep}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs hover:bg-blue-100 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Etapa
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {editSteps.map((step, index) => (
                      <div key={index} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4 relative group">
                        <button 
                          onClick={() => removeStep(index)}
                          className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="grid grid-cols-1 gap-4">
                          <input 
                            type="text"
                            value={step.label}
                            onChange={(e) => updateStep(index, "label", e.target.value)}
                            placeholder="Nome da etapa"
                            className="w-full px-4 py-2 bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold text-sm"
                          />
                          <textarea 
                            value={step.desc}
                            onChange={(e) => updateStep(index, "desc", e.target.value)}
                            placeholder="Descrição detalhada"
                            rows={2}
                            className="w-full px-4 py-2 bg-white border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs text-slate-600 resize-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50/50 shrink-0">
                <button 
                  onClick={createTemplate}
                  className="w-full py-5 bg-[#3B82F6] text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Criar Template
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar.events';
declare const google: any;

const ProfileView = ({ profile, user, onOpenSettings, onNavigate, tasks }: { profile: UserProfile | null, user: User | null, onOpenSettings: () => void, onNavigate: (tab: any) => void, tasks: Task[] }) => {
  const { confirm } = useConfirm();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(profile?.displayName || "");

  const updateDisplayName = async () => {
    if (!user?.uid || !newName.trim()) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        displayName: newName.trim()
      });
      toast.success("Nome atualizado com sucesso!");
      setIsEditingName(false);
    } catch (error) {
      toast.error("Erro ao atualizar nome.");
      console.error(error);
    }
  };

  const handleGCalSync = async () => {
    const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast.error("VITE_GOOGLE_CLIENT_ID não encontrado. Verifique as configurações.");
      return;
    }

    if (typeof (window as any).google === 'undefined') {
      toast.error("O serviço do Google está carregando ou foi bloqueado. Verifique se há extensões bloqueando scripts e recarregue a página.");
      return;
    }

    setIsSyncing(true);
    try {
      const gcalToken: string = await new Promise((resolve, reject) => {
        try {
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: GCAL_SCOPES,
            callback: (response: any) => {
              if (response.error) {
                reject(new Error(response.error_description || response.error));
                return;
              }
              resolve(response.access_token);
            },
            error_callback: (err: any) => {
              reject(err);
            }
          });
          client.requestAccessToken();
        } catch (err) {
          reject(err);
        }
      });

      if (!gcalToken) {
        throw new Error("Token não recebido");
      }

      // Filter tasks for this user and not completed yet, or upcoming
      const userTasks = tasks.filter(t => t.uid === user?.uid && !t.completed);
      
      if (userTasks.length === 0) {
        toast.info("Você não tem tarefas pendentes para sincronizar.");
        setIsSyncing(false);
        return;
      }

      toast.loading("Sincronizando tarefas...", { id: "gcal-sync" });

      let count = 0;
      for (const task of userTasks) {
        const event = {
          'summary': `📍 Tarefa: ${task.title}`,
          'description': task.description || 'Sincronizado via Sistema de Operações Ponto Chave',
          'start': { 'date': task.date },
          'end': { 'date': task.date },
          'reminders': { 'useDefault': true }
        };

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${gcalToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(event)
        });

        if (response.ok) count++;
      }

      toast.success(`${count} tarefas sincronizadas! Verifique seu Google Agenda.`, { id: "gcal-sync" });

      // Update sync timestamp in Firestore
      if (user?.uid) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          await updateDoc(userDocRef, {
            gcalLastSync: new Date().toISOString()
          });
        } catch (dbErr) {
          console.error("Error updating sync timestamp:", dbErr);
        }
      }
    } catch (err: any) {
      console.error("GCal Sync Error:", err);
      const isPopupBlocked = err.message?.includes('popup_closed_by_user') || err.error === 'popup_closed_by_user';
      if (isPopupBlocked) {
        toast.error("O login do Google foi fechado. Tente novamente e autorize o acesso.", { id: "gcal-sync" });
      } else {
        toast.error("Erro ao sincronizar. Verifique se permitiu popups e autorizou o acesso.", { id: "gcal-sync" });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-400" />
        <div className="px-8 pb-8">
          <div className="relative -mt-16 mb-6">
            <div className="w-32 h-32 rounded-[32px] bg-white p-2 shadow-xl">
              <div className="w-full h-full rounded-[24px] bg-slate-100 border border-slate-100 overflow-hidden cursor-pointer" onClick={() => onNavigate("settings")}>
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <UserIcon className="w-12 h-12" />
                  </div>
                )}
              </div>
            </div>
            <div className="absolute bottom-2 right-2 w-8 h-8 bg-green-500 border-4 border-white rounded-full" />
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 group">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">{profile?.displayName || user?.displayName}</h2>
                  <button 
                    onClick={() => {
                      setNewName(profile?.displayName || "");
                      setIsEditingName(true);
                    }}
                    className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{profile?.email}</p>
              </div>
              {profile?.role === 'admin' && (
                <button 
                  onClick={onOpenSettings}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all"
                >
                  <Settings className="w-4 h-4" />
                  Configurações
                </button>
              )}
            </div>

            {/* Name Edit Modal */}
            <AnimatePresence>
              {isEditingName && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    onClick={() => setIsEditingName(false)}
                  />
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative bg-white w-full max-w-sm rounded-[40px] shadow-2xl p-8 border border-slate-100"
                  >
                    <h3 className="text-xl font-black text-slate-900 mb-6 tracking-tight">Editar Nome</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Nome de Exibição</label>
                        <input 
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                          autoFocus
                        />
                      </div>
                      
                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={() => setIsEditingName(false)}
                          className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={updateDisplayName}
                          className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cargo</p>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#3B82F6]" />
                  <span className="font-bold text-slate-700">{profile?.role === 'admin' ? 'Administrador' : 'Colaborador'}</span>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="font-bold text-slate-700">Ativo</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Permissões de Acesso</h4>
              <div className="flex flex-wrap gap-2">
                {profile?.role === 'admin' ? (
                  <span className="px-3 py-1.5 bg-purple-50 text-purple-600 border border-purple-100 rounded-xl text-[10px] font-bold uppercase tracking-widest">Acesso Administrativo Total</span>
                ) : (
                  <>
                    <span className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl text-[10px] font-bold uppercase tracking-widest">Acesso Colaborador</span>
                    {profile?.permissions?.includes("comissoes") && (
                      <span className="px-3 py-1.5 bg-green-50 text-green-600 border border-green-100 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <DollarSign className="w-3 h-3" />
                        Comissões
                      </span>
                    )}
                    {(!profile?.permissions || profile.permissions.length === 0) && (
                      <span className="px-3 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-widest italic">Nenhuma permissão especial</span>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Integrações</h4>
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <CalendarIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h5 className="text-sm font-bold text-slate-900">Google Agenda</h5>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">Sincronize suas tarefas e receba notificações no seu calendário pessoal.</p>
                    
                    {profile?.gcalLastSync && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">
                          Sincronizado {format(parseISO(profile.gcalLastSync), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                    
                    {!((import.meta as any).env.VITE_GOOGLE_CLIENT_ID) ? (
                      <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-[9px] text-amber-700 leading-tight">
                          Para ativar, configure o <span className="font-bold">VITE_GOOGLE_CLIENT_ID</span> no painel de configurações da plataforma.
                        </p>
                      </div>
                    ) : (
                      <button 
                        onClick={handleGCalSync}
                        disabled={isSyncing}
                        className={cn(
                          "mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50",
                          isSyncing && "animate-pulse"
                        )}
                      >
                        {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Informações da Conta</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">ID do Usuário</span>
                  <span className="text-sm font-mono text-slate-400">{user?.uid}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Membro desde</span>
                  <span className="text-sm text-slate-900">
                    {profile?.createdAt?.toDate ? format(profile.createdAt.toDate(), "dd/MM/yyyy") : "Recente"}
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 text-red-600 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-red-100 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const UserActivityView = ({ 
  userProfile, 
  tasks, 
  processes, 
  templates, 
  onBack,
  onNavigate,
  onSelectDate,
  onSelectProcess
}: { 
  userProfile: UserProfile, 
  tasks: Task[], 
  processes: ProcessInstance[], 
  templates: ProcessTemplate[],
  onBack: () => void,
  onNavigate: (tab: any) => void,
  onSelectDate: (date: Date) => void,
  onSelectProcess: (id: string) => void
}) => {
  const [activeTab, setActiveTab] = useState<"tasks" | "processes">("tasks");

  const userTasks = tasks.filter(t => t.uid === userProfile.uid).sort((a, b) => b.date.localeCompare(a.date));
  const userProcesses = processes.filter(p => p.uid === userProfile.uid).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 shadow-sm transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden">
              {userProfile.photoURL ? (
                <img src={userProfile.photoURL} alt={userProfile.displayName || ""} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <UserIcon className="w-6 h-6" />
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">{userProfile.displayName}</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{userProfile.email}</p>
            </div>
          </div>
        </div>
        <div className="flex p-1 bg-slate-100 rounded-xl">
          <button 
            onClick={() => setActiveTab("tasks")}
            className={cn(
              "px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
              activeTab === "tasks" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
            )}
          >
            Tarefas
          </button>
          <button 
            onClick={() => setActiveTab("processes")}
            className={cn(
              "px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
              activeTab === "processes" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
            )}
          >
            Processos
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        <div className="p-8">
          {activeTab === "tasks" ? (
            <div className="space-y-4">
              {userTasks.length === 0 ? (
                <div className="text-center py-20">
                  <LayoutDashboard className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400">Nenhuma tarefa registrada para este usuário.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {userTasks.map((task) => (
                    <div key={task.id} className="py-4 flex items-center justify-between group/task cursor-pointer hover:bg-slate-50 rounded-xl px-4 transition-all" onClick={() => { onNavigate("calendar"); onSelectDate(parseISO(task.date)); }}>
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 mt-1 shrink-0",
                          task.completed ? "bg-blue-500 border-blue-500 text-white flex items-center justify-center" : "border-slate-200"
                        )}>
                          {task.completed && <Check className="w-3 h-3" />}
                        </div>
                        <div>
                          <p className={cn("font-bold text-slate-800", task.completed && "line-through text-slate-400")}>{task.title}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                              {format(parseISO(task.date), "dd/MM/yyyy")}
                            </span>
                            <span className={cn(
                              "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                              task.priority === 'high' ? "bg-red-100 text-red-600" : task.priority === 'medium' ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-600"
                            )}>
                              {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {userProcesses.length === 0 ? (
                <div className="text-center py-20">
                  <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400">Nenhum processo iniciado por este usuário.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userProcesses.map((proc) => {
                    const template = templates.find(t => t.type === proc.type);
                    if (!template) return null;
                    const Icon = ICON_MAP[template.icon] || ClipboardList;
                    const progress = Math.round((proc.completedSteps.length / template.steps.length) * 100);
                    
                    return (
                      <div 
                        key={proc.id} 
                        onClick={() => { onNavigate("processes"); onSelectProcess(proc.id); }}
                        className="p-6 bg-white rounded-3xl border border-slate-100 hover:border-blue-200 transition-all cursor-pointer hover:shadow-md"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm font-bold", template.color)}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">{proc.title}</h4>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{template.title} • {progress}%</p>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="flex justify-between items-center mt-4">
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg",
                            proc.status === 'completed' ? "bg-green-100 text-green-600" : proc.status === 'archived' ? "bg-slate-200 text-slate-600" : "bg-blue-100 text-blue-600"
                          )}>
                            {proc.status === 'completed' ? "Concluído" : proc.status === 'archived' ? "Arquivado" : "Ativo"}
                          </span>
                          <span className="text-[9px] text-slate-400 font-medium">
                            Última atualização: {proc.updatedAt?.toDate ? format(proc.updatedAt.toDate(), "dd/MM/yy") : 'Agora'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SettingsView = ({ companySettings, isAdmin, onNavigate }: { companySettings: CompanySettings | null, isAdmin: boolean, onNavigate: (tab: any) => void }) => {
  const [name, setName] = useState(companySettings?.name || "");
  const [subtitle, setSubtitle] = useState(companySettings?.subtitle || "");
  const [logoUrl, setLogoUrl] = useState(companySettings?.logoUrl || "");
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>(companySettings?.kanbanColumns || [
    { id: "todo", label: "Novo", color: "bg-blue-500" },
    { id: "in_progress", label: "Em Andamento", color: "bg-amber-500" },
    { id: "waiting", label: "Aguardando Cliente", color: "bg-purple-500" },
    { id: "done", label: "Finalizado", color: "bg-green-500" }
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const { confirm } = useConfirm();
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [syncCollectionProgress, setSyncCollectionProgress] = useState<{
    [key: string]: { status: "pending" | "syncing" | "done" | "error"; count: number };
  }>({
    users: { status: "pending", count: 0 },
    sales: { status: "pending", count: 0 },
    broker_splits: { status: "pending", count: 0 },
    comissoes: { status: "pending", count: 0 },
    companies: { status: "pending", count: 0 },
  });

  const handleSyncFromProduction = async () => {
    if (!isAdmin) return;
    setSyncStatus("syncing");
    setSyncMessage("Conectando ao Firebase e inicializando instâncias do Firestore...");
    
    const resetProgress = {
      users: { status: "pending" as const, count: 0 },
      sales: { status: "pending" as const, count: 0 },
      broker_splits: { status: "pending" as const, count: 0 },
      comissoes: { status: "pending" as const, count: 0 },
      companies: { status: "pending" as const, count: 0 },
    };
    setSyncCollectionProgress(resetProgress);

    try {
      const appInstance = getApp();
      const prodDbInstance = getFirestore(appInstance, "ai-studio-75e4efee-79fe-4917-aaa8-4778a3596864");
      const sandboxDbInstance = getFirestore(appInstance, "ai-studio-44ae2ba8-8a58-4205-8f05-6b2cdd615644");
      
      const collectionsToSync = ["users", "sales", "broker_splits", "comissoes", "companies"];
      let totalCopied = 0;

      for (const colName of collectionsToSync) {
        setSyncMessage(`Sincronizando registros da coleção: "${colName}"...`);
        setSyncCollectionProgress(prev => ({
          ...prev,
          [colName]: { ...prev[colName], status: "syncing" }
        }));

        try {
          const prodColRef = rawCollection(prodDbInstance, colName);
          const snapshot = await rawGetDocs(prodColRef);
          
          let count = 0;
          for (const rawDocSnap of snapshot.docs) {
            const docId = rawDocSnap.id;
            const docData = rawDocSnap.data();

            const sandboxDocRef = rawDoc(sandboxDbInstance, colName, docId);
            await rawSetDoc(sandboxDocRef, docData, { merge: true });
            
            count++;
            totalCopied++;
            
            setSyncCollectionProgress(prev => ({
              ...prev,
              [colName]: { ...prev[colName], count }
            }));
          }

          setSyncCollectionProgress(prev => ({
            ...prev,
            [colName]: { status: "done", count }
          }));

        } catch (colErr: any) {
          console.error(`Erro ao sincronizar partição ${colName}:`, colErr);
          setSyncCollectionProgress(prev => ({
            ...prev,
            [colName]: { ...prev[colName], status: "error" }
          }));
          throw new Error(`Falha na coleção "${colName}": ${colErr?.message || colErr}`);
        }
      }

      setSyncStatus("success");
      setSyncMessage(`Sincronização concluída com sucesso! Total de ${totalCopied} registros copiados de produção para o sandbox.`);
      toast.success("Dados de produção sincronizados com o sandbox!");

      setTimeout(() => {
        window.location.reload();
      }, 2500);

    } catch (err: any) {
      console.error("Erro na sincronização:", err);
      setSyncStatus("error");
      setSyncMessage(err.message || "Erro desconhecido ao ler dados do banco de produção.");
      toast.error("Erro na sincronização.");
    }
  };

  useEffect(() => {
    if (companySettings) {
      setName(companySettings.name);
      setSubtitle(companySettings.subtitle);
      setLogoUrl(companySettings.logoUrl || "");
      if (companySettings.kanbanColumns) {
        setKanbanColumns(companySettings.kanbanColumns);
      }
    }
  }, [companySettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      if (companySettings?.id) {
        await setDoc(doc(db, "companies", companySettings.id), {
          name,
          subtitle,
          logoUrl,
          kanbanColumns: kanbanColumns,
          updatedAt: serverTimestamp()
        }, { merge: true });
        toast.success("Configurações salvas com sucesso!");
      }
    } catch (error) {
      toast.error("Erro ao salvar configurações.");
      handleFirestoreError(error, OperationType.UPDATE, `companies/${companySettings?.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("O arquivo é muito grande. Para logos, use arquivos menores que 2MB.");
      return;
    }

    setIsUploading(true);
    
    try {
      // Usar FileReader para converter para Base64 (persistente)
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoUrl(base64String);
        setIsUploading(false);
        toast.success("Logo carregada! Clique em 'Salvar Alterações' para confirmar.");
      };
      reader.onerror = () => {
        setIsUploading(false);
        toast.error("Erro ao ler o arquivo.");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao processar a imagem.");
      setIsUploading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-12 text-center">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900">Acesso Restrito</h3>
        <p className="text-slate-500">Apenas administradores podem configurar a conta da empresa.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Configurações da Conta</h2>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1">Identidade da sua empresa</p>
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
        <form onSubmit={handleSave} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Nome da Empresa</label>
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Fidelité Imobiliária"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Subtítulo / Slogan</label>
              <input 
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Ex: Checklist Diário"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Logo da Empresa</label>
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="relative group">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-48 h-32 rounded-[32px] bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-inner group-hover:border-blue-200 transition-all cursor-pointer"
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo Preview" className="w-full h-full object-contain p-4" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <Building2 className="w-8 h-8 text-slate-400" />
                      <span className="text-[10px] font-bold uppercase">Sem Logo</span>
                    </div>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                >
                  <Upload className="w-5 h-5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>
              
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">URL da Imagem (Opcional)</label>
                  <input 
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://exemplo.com/logo.png"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-sm"
                  />
                </div>
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                  <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                    <span className="font-bold flex items-center gap-1 mb-1">
                      <Zap className="w-3 h-3" /> DICA DE FORMATO
                    </span>
                    Para melhores resultados, use uma imagem **PNG transparente** ou **SVG** com proporção quadrada ou retangular horizontal. Tamanho máximo: 5MB.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Etapas do Kanban</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">Configure o fluxo dos seus processos</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  const colors = ["bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-green-500", "bg-pink-500", "bg-indigo-500", "bg-orange-500"];
                  const nextColor = colors[kanbanColumns.length % colors.length];
                  setKanbanColumns([...kanbanColumns, { id: `col_${Date.now()}`, label: "Nova Etapa", color: nextColor }]);
                }}
                className="p-2 px-3 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar Etapa
              </button>
            </div>

            <div className="space-y-3">
              {kanbanColumns.map((col, idx) => (
                <div key={col.id} className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 group">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0", col.color)}>
                    {idx + 1}
                  </div>
                  <input 
                    type="text"
                    value={col.label}
                    onChange={(e) => {
                      const newCols = [...kanbanColumns];
                      newCols[idx].label = e.target.value;
                      setKanbanColumns(newCols);
                    }}
                    placeholder="Nome da etapa..."
                    className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-slate-700 text-sm placeholder:text-slate-300"
                  />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      type="button"
                      onClick={() => {
                        const colors = ["bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-green-500", "bg-pink-500", "bg-indigo-500", "bg-orange-500"];
                        const nextColor = colors[(colors.indexOf(col.color) + 1) % colors.length];
                        const newCols = [...kanbanColumns];
                        newCols[idx].color = nextColor;
                        setKanbanColumns(newCols);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-500 hover:bg-white rounded-lg transition-all"
                      title="Mudar Cor"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        if (kanbanColumns.length > 1) {
                          setKanbanColumns(kanbanColumns.filter((_, i) => i !== idx));
                        } else {
                          toast.error("Mínimo de uma etapa exigido.");
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                      title="Excluir Etapa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest px-2">
              Dica: A primeira etapa é onde novos processos landam. A última etapa marca como "Concluído".
            </p>
          </div>

          <button 
            type="submit"
            disabled={isSaving}
            className="w-full py-5 bg-[#3B82F6] text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
          >
            {isSaving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </form>
      </div>

      {/* FERRAMENTA DE SINCRONIZAÇÃO DE DADOS DE PRODUÇÃO PARA SANDBOX */}
      {isAdmin && (
        <div className="bg-slate-950 text-white rounded-[40px] border border-slate-800 shadow-xl overflow-hidden p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                Sincronizador de Produção para Sandbox
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[9px] font-bold uppercase tracking-wider animate-pulse">
                  Admin Tool
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-1">
                Importe os dados reais do banco de dados de produção do Firestore (<code className="text-blue-300 font-mono">ai-studio-75e4efee...</code>) diretamente para este sandbox ativo. Isso copiará com segurança as coleções selecionadas.
              </p>
            </div>
          </div>

          <div className="space-y-3 bg-slate-900/40 p-5 rounded-3xl border border-slate-900 text-xs">
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2">Coleções a serem copiadas:</h4>
            
            <div className="space-y-2">
              {[
                { key: "users", label: "Colaboradores (users)" },
                { key: "sales", label: "Vendas Registradas (sales)" },
                { key: "broker_splits", label: "Divisões/Splits de Corretores (broker_splits)" },
                { key: "comissoes", label: "Comissões e Lançamentos (comissoes)" },
                { key: "companies", label: "Dados de Agências/Parceiros (companies)" }
              ].map(item => {
                const prog = syncCollectionProgress[item.key] || { status: "pending", count: 0 };
                return (
                  <div key={item.key} className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/40">
                    <span className="font-semibold text-slate-300">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full font-bold">
                        {prog.count} regs
                      </span>
                      {prog.status === "pending" && (
                        <span className="w-2.5 h-2.5 bg-slate-600 rounded-full" title="Pendente" />
                      )}
                      {prog.status === "syncing" && (
                        <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      )}
                      {prog.status === "done" && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      {prog.status === "error" && (
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {syncStatus !== "idle" && (
            <div className={`p-4 rounded-2xl border text-xs leading-relaxed ${
              syncStatus === "syncing" ? "bg-blue-950/40 border-blue-900/40 text-blue-300" :
              syncStatus === "success" ? "bg-emerald-950/40 border-emerald-900/40 text-emerald-300" :
              "bg-red-950/40 border-red-900/40 text-red-300"
            }`}>
              <p className="font-bold mb-1">Status do Processo:</p>
              <p className="font-medium">{syncMessage}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              confirm({
                title: "Confirmar Sincronização de Produção?",
                message: "Esta ação fará o pull dos dados das coleções de Produção e inserirá no Sandbox Atual, mesclando de forma segura sem deletar outros registros exclusivos. Deseja prosseguir?",
                confirmColor: "blue",
                onConfirm: handleSyncFromProduction
              });
            }}
            disabled={syncStatus === "syncing"}
            className="w-full py-4.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:scale-100"
          >
            <Zap className="w-4.5 h-4.5 shrink-0" />
            {syncStatus === "syncing" ? "Sincronizando Banco de Produção..." : "Puxar Coleções de Produção"}
          </button>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Atalhos de Gestão</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={() => onNavigate("users")}
            className="flex items-center gap-4 p-6 bg-white rounded-3xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
              <UsersIcon className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900">Gerenciar Usuários</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Contas e Permissões</p>
            </div>
          </button>
          <button 
            onClick={() => onNavigate("processes")}
            className="flex items-center gap-4 p-6 bg-white rounded-3xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900">Configurar Processos</p>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Checklists e Etapas</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};



export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 4000);
    return () => clearTimeout(safetyTimer);
  }, []);

  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [naoAutorizadoEmail, setNaoAutorizadoEmail] = useState<string | null>(null);
  const [aguardandoAprovacaoEmail, setAguardandoAprovacaoEmail] = useState<string | null>(null);
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

  const confirm = React.useCallback((options: {
    title: string;
    message: string;
    confirmColor?: "red" | "blue" | "green";
    onConfirm: () => void;
  }) => {
    setConfirmState({
      open: true,
      title: options.title,
      message: options.message,
      confirmColor: options.confirmColor || "red",
      onConfirm: () => {
        options.onConfirm();
        setConfirmState(prev => ({ ...prev, open: false }));
      }
    });
  }, []);

  // Captura de convite via URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const invite = params.get('invite');
      const token = params.get('token');
      const company = params.get('company');
      const role = params.get('role');
      
      if (invite) {
        localStorage.setItem('active_invite_company', invite);
        localStorage.setItem('active_invite_token', invite);
        
        // Limpa os parâmetros da URL para manter a barra de navegação limpa
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        toast.info("Processando seu convite de acesso...");
      } else if (token) {
        localStorage.setItem('active_invite_token', token);
        if (company) localStorage.setItem('active_invite_company', company);
        if (role) localStorage.setItem('active_invite_role', role);
        
        // Limpa os parâmetros da URL para manter a barra de navegação limpa
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        toast.info("Processando seu convite de acesso...");
      }
    } catch (e) {
      console.error("Erro ao processar URL de convite:", e);
    }
  }, []);

  // Fetch Company Settings based on profile
  useEffect(() => {
    if (!profile?.companyId) {
      setCompanySettings(null);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, "companies", profile.companyId), (snapshot) => {
      if (snapshot.exists()) {
        setCompanySettings({ id: snapshot.id, ...snapshot.data() } as CompanySettings);
      } else {
        // Fallback or default for new company
        setCompanySettings({
          id: profile.companyId,
          name: "Fidelité Imobiliária",
          subtitle: "Gestão e Processos",
          updatedAt: new Date()
        });

        // Seed desabilitado — dados criados manualmente
      }
    }, (error) => {
      console.error("Error fetching company settings:", error);
    });
    return () => unsubscribe();
  }, [profile?.companyId]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let loadingTimeout: NodeJS.Timeout | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (authenticatedUser) => {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      loadingTimeout = setTimeout(() => {
        setLoading(false);
      }, 5000);
      if (authenticatedUser) {
        setUser(authenticatedUser);
        
        // Use a real-time listener for the user profile
        const userDocRef = doc(db, "users", authenticatedUser.uid);
        
        if (unsubscribeProfile) unsubscribeProfile();
        
        unsubscribeProfile = onSnapshot(userDocRef, async (snapshot) => {
          if (!snapshot.exists()) {
            // PROTEÇÃO ANTI-BLOQUEIO: admin master sempre tem perfil criado se não existir.
            // Isso garante que o dono do sistema nunca fica trancado fora.
            const ADMIN_MASTER_EMAIL = "williangyn10@gmail.com";
            if (authenticatedUser.email === ADMIN_MASTER_EMAIL) {
              const adminProfile: UserProfile = {
                uid: authenticatedUser.uid,
                displayName: authenticatedUser.displayName || authenticatedUser.email?.split('@')[0] || "Administrador",
                email: authenticatedUser.email,
                photoURL: authenticatedUser.photoURL || `https://ui-avatars.com/api/?name=Admin&background=random`,
                role: "admin",
                companyId: "company",
                status: "active",
                createdAt: serverTimestamp(),
              };
              
              try {
                await setDoc(userDocRef, adminProfile, { merge: true });
                console.log("Perfil de admin master criado/restaurado.");
              } catch (err) {
                console.error("Erro ao criar perfil de admin master:", err);
              }
              return; // continua aguardando o snapshot atualizar com os dados criados
            }

            const TEAM_EMAILS_WHITELIST = [
              "fideliteimobiliaria@gmail.com",
              "fideliteiara@gmail.com", 
              "marcos.drania@gmail.com",
              "reginaldo.carvalho@gmail.com",
              "iararamostelescunhadi@gmail.com"
            ];

            if (authenticatedUser.email && TEAM_EMAILS_WHITELIST.includes(authenticatedUser.email)) {
              const teamProfile: UserProfile = {
                uid: authenticatedUser.uid,
                displayName: authenticatedUser.displayName || authenticatedUser.email.split('@')[0] || "Equipe",
                email: authenticatedUser.email,
                photoURL: authenticatedUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(authenticatedUser.displayName || authenticatedUser.email || "E")}&background=random`,
                role: "user",
                companyId: "company",
                status: "active",
                isPending: false,
                createdAt: serverTimestamp(),
              };

              try {
                await setDoc(userDocRef, teamProfile, { merge: true });
                console.log("Perfil de membro da equipe criado automaticamente:", authenticatedUser.email);
              } catch (err) {
                console.error("Erro ao criar perfil de equipe automático:", err);
              }
              return;
            }
            
            // CASO NORMAL: usuário sem perfil.
            // 1. Verificar primeiro se há um de token de convite ativo por link no localStorage
            const inviteToken = localStorage.getItem('active_invite_token');
            const inviteCompany = localStorage.getItem('active_invite_company');

            if (inviteCompany || inviteToken) {
              try {
                const companyIdToUse = inviteCompany || inviteToken;
                
                // Sempre registrar com status "pending" e isPending como true, para o administrador aprovar e escolher cargo!
                const pendingProfile: UserProfile = {
                  uid: authenticatedUser.uid,
                  displayName: authenticatedUser.displayName || authenticatedUser.email?.split('@')[0] || "Usuário",
                  email: authenticatedUser.email,
                  photoURL: authenticatedUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(authenticatedUser.displayName || authenticatedUser.email || "U")}&background=random`,
                  role: "user", // cargo inicial padrão, será alterado pelo administrador ao aprovar
                  companyId: companyIdToUse || "company",
                  status: "pending",
                  isPending: true,
                  createdAt: serverTimestamp(),
                };

                // Gravar o perfil como pendente
                await setDoc(userDocRef, pendingProfile, { merge: true });

                // Limpar localStorage
                localStorage.removeItem('active_invite_token');
                localStorage.removeItem('active_invite_company');
                localStorage.removeItem('active_invite_role');

                console.log("Perfil pendente criado com sucesso usando link de convite.");
                setProfile(null);
                setLoading(false);
                setAguardandoAprovacaoEmail(authenticatedUser.email || null);
                await auth.signOut();
                return;
              } catch (inviteErr) {
                console.error("Erro ao registrar usuário pendente:", inviteErr);
              }
            }

            // CASO NORMAL SECUNDÁRIO: procurar registro pré-aprovado (criado pelo admin) com o email do usuário.
            try {
              const usersRef = collection(db, "users");
              const q = query(
                usersRef,
                where("email", "==", authenticatedUser.email)
              );
              const querySnapshot = await getDocs(q);
              
              // Localizar o registro pendente que começa com "pending_" ou que não possui o UID atual
              const pendingDoc = querySnapshot.docs.find(doc => doc.id.startsWith("pending_") || doc.id !== authenticatedUser.uid);
              
              if (pendingDoc) {
                // ENCONTROU CONVITE PENDENTE: ativar o usuário usando os dados do convite.
                const pendingData = pendingDoc.data();
                
                // Validar dados mínimos do convite
                if (!pendingData.companyId || !pendingData.role) {
                  console.error("Convite pendente sem dados obrigatórios:", pendingData);
                  setProfile(null);
                  setLoading(false);
                  await auth.signOut();
                  toast.error("Convite inválido. Entre em contato com o administrador.");
                  return;
                }
                
                const activatedProfile: UserProfile = {
                  uid: authenticatedUser.uid,
                  displayName: pendingData.displayName || authenticatedUser.displayName || authenticatedUser.email?.split('@')[0] || "Usuário",
                  email: authenticatedUser.email,
                  photoURL: authenticatedUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(pendingData.displayName || authenticatedUser.email || "U")}&background=random`,
                  role: pendingData.role,
                  companyId: pendingData.companyId,
                  status: pendingData.status || "active",
                  isPending: pendingData.isPending || false,
                  createdAt: serverTimestamp(),
                };
                
                try {
                  // Criar o perfil ativo no UID do usuário autenticado
                  await setDoc(userDocRef, activatedProfile, { merge: true });
                  // Remover o registro pendente antigo (que estava em outro documentID)
                  await deleteDoc(doc(db, "users", pendingDoc.id));
                  console.log("Convite ativado para:", authenticatedUser.email);
                } catch (err) {
                  console.error("Erro ao ativar convite:", err);
                  setProfile(null);
                  setLoading(false);
                  await auth.signOut();
                  toast.error("Erro ao ativar sua conta. Tente novamente em alguns minutos.");
                  return;
                }
              } else {
                // NÃO ENCONTROU CONVITE: usuário não autorizado.
                console.warn("Tentativa de acesso sem convite válido:", authenticatedUser.email);
                setProfile(null);
                setLoading(false);
                
                // Mostrar tela de não autorizado (state controla isso) e deslogar
                setNaoAutorizadoEmail(authenticatedUser.email || null);
                await auth.signOut();
                return;
              }
            } catch (err) {
              console.error("Erro ao verificar convite pendente:", err);
              setProfile(null);
              setLoading(false);
              await auth.signOut();
              toast.error("Erro ao verificar autorização. Tente novamente.");
              return;
            }
          } else {
            const data = snapshot.data() as UserProfile;
            
            if (data.status === "blocked") {
              setProfile(null);
              auth.signOut();
              toast.error("Sua conta está bloqueada. Entre em contato com o administrador.");
              return;
            }
            
            // NOVO: tratar usuários pendentes (que ainda não foram ativados)
            if ((data as any).isPending === true || (data as any).status === "pending") {
              setProfile(null);
              setLoading(false);
              setAguardandoAprovacaoEmail(authenticatedUser.email || null);
              await auth.signOut();
              return;
            }
            
            if (!data.companyId) {
              // Migration for old profiles without companyId
              const cid = (data.email === "williangyn10@gmail.com" ? "company" : `comp_${authenticatedUser.uid.substring(0, 8)}`);
              updateDoc(userDocRef, { companyId: cid })
                .then(() => console.log("Profile migrated with companyId"))
                .catch(e => console.error("Profile migration error:", e));
              setProfile({ ...data, companyId: cid });
            } else {
              setProfile(data);
            }
          }
          setLoading(false);
        }, (error: any) => {
          console.error("Profile listener error:", error);
          if (error?.message?.includes("Quota exceeded") || error?.code === "resource-exhausted") {
            setQuotaExceeded(true);
          } else {
            setProfile(null);
            if (auth.currentUser) auth.signOut();
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setProfile(null);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (loadingTimeout) clearTimeout(loadingTimeout);
    };
  }, []);

  if (naoAutorizadoEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4 text-center">
        <div className="max-w-md w-full bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100">
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Acesso não autorizado</h2>
          <p className="text-slate-600 mb-2 leading-relaxed text-sm">
            A conta <strong>{naoAutorizadoEmail}</strong> não está autorizada a acessar o sistema.
          </p>
          <p className="text-slate-500 mb-8 leading-relaxed text-sm">
            Para obter acesso, solicite um convite ao administrador da sua empresa.
          </p>
          <button
            onClick={() => {
              setNaoAutorizadoEmail(null);
              window.location.reload();
            }}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-all cursor-pointer"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  if (aguardandoAprovacaoEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4 text-center">
        <div className="max-w-md w-full bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100">
          <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Aguardando aprovação</h2>
          <p className="text-slate-600 mb-2 leading-relaxed text-sm">
            A conta <strong>{aguardandoAprovacaoEmail}</strong> está cadastrada mas aguardando aprovação do administrador.
          </p>
          <p className="text-slate-500 mb-8 leading-relaxed text-sm">
            Entre em contato com o administrador da sua empresa para liberar o acesso.
          </p>
          <button
            onClick={() => {
              setAguardandoAprovacaoEmail(null);
              window.location.reload();
            }}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-all cursor-pointer"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  if (quotaExceeded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4 text-center">
        <div className="max-w-md w-full bg-white p-10 rounded-[40px] shadow-2xl border border-amber-50">
          <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Limite de Uso Excedido</h2>
          <p className="text-slate-500 mb-8 leading-relaxed">
            O limite diário de visualizações de dados do Firebase foi atingido (Quota exceeded). 
            O acesso será restabelecido automaticamente pelo Google em breve ou no próximo dia.
          </p>
          <div className="flex flex-col gap-3">
             <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-amber-500 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg hover:bg-amber-600 transition-all"
            >
              Tentar Novamente
            </button>
            <button 
              onClick={() => auth.signOut().then(() => window.location.reload())}
              className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
            Iniciando {companySettings?.name || "Ponto Chave"}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin: profile?.role === "admin", companySettings }}>
      <ConfirmContext.Provider value={{ confirm }}>
        <ErrorBoundary>
          {!user ? (
            <Login />
          ) : profile ? (
            <AppContent />
          ) : (
            <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4 text-center">
              <div className="max-w-md w-full bg-white p-10 rounded-[40px] shadow-2xl border border-red-50">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">Acesso Não Autorizado</h2>
                <p className="text-slate-500 mb-8 leading-relaxed">
                  Sua conta não possui permissão para acessar este sistema ou seu acesso foi revogado.
                  Entre em contato com o administrador.
                </p>
                <button 
                  onClick={() => auth.signOut()}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg hover:bg-slate-800 transition-all"
                >
                  Voltar para o Login
                </button>
              </div>
            </div>
          )}
        </ErrorBoundary>

        <ConfirmModal
          isOpen={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          confirmColor={confirmState.confirmColor}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
        />
      </ConfirmContext.Provider>
    </AuthContext.Provider>
  );
}
