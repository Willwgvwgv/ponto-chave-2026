import React, { useState, useMemo } from "react";
import { 
  Clock, 
  Calendar, 
  FileText, 
  Settings, 
  AlertTriangle,
  ClipboardList
} from "lucide-react";
import { UserProfile, CompanySettings } from "../../types";
import { BaterPonto } from "./BaterPonto";
import { MeuEspelho } from "./MeuEspelho";
import { GestaoPonto } from "./GestaoPonto";
import { AjustesPonto } from "./AjustesPonto";
import { useAjustesPendentes } from "../../hooks/useQueries";

interface PontoViewProps {
  isAdmin: boolean;
  user: any;
  profile: UserProfile | null;
  companySettings: CompanySettings | null;
}

export const PontoView: React.FC<PontoViewProps> = ({ isAdmin, user, profile, companySettings }) => {
  const isUserAdmin = isAdmin || profile?.role === "admin";
  const agencyId = profile?.companyId || "default_agency";

  // Check retroactive default permission for "colaborador" when undefined
  const hasPontoPermission = useMemo(() => {
    if (profile?.permPonto === false || profile?.perm_ponto === false) return false;
    if (isUserAdmin) return true;
    if (profile?.permPonto === true || profile?.perm_ponto === true) return true;
    
    // If undefined and role is colaborador or user, treat as true
    if (profile?.role === "colaborador" || profile?.role === "user") return true;
    
    // Treat as false otherwise to prevent unrestricted access
    return false;
  }, [isUserAdmin, profile]);

  // Fetch pending adjustments count for the badge
  const { data: adjustments = [] } = useAjustesPendentes(agencyId);
  const pendingCount = useMemo(() => {
    return adjustments.filter(a => a.status === "pendente").length;
  }, [adjustments]);

  // Tab State
  const [activeSubTab, setActiveSubTab] = useState<"bater" | "espelho" | "gestao" | "ajustes">(
    hasPontoPermission ? "bater" : (isUserAdmin ? "gestao" : "bater")
  );

  if (!hasPontoPermission && !isUserAdmin) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-white rounded-2xl border border-slate-100 p-8 shadow-sm text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Acesso Restrito</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Você não possui permissão de acesso ao Ponto Eletrônico CLT. Solicite a liberação ao administrador do sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/10 py-6 max-w-7xl mx-auto space-y-6 px-4">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            Ponto Eletrônico CLT
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Controle de jornada de trabalho, banco de horas e solicitações de ajuste.</p>
        </div>
      </div>

      {/* Navegação Sub-Abas */}
      <div className="flex overflow-x-auto border-b border-slate-200">
        <div className="flex gap-2">
          {hasPontoPermission && (
            <>
              {/* Bater Ponto */}
              <button
                id="subtab-ponto-bater"
                onClick={() => setActiveSubTab("bater")}
                className={`py-2 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 -mb-px hover:text-indigo-600 ${
                  activeSubTab === "bater" 
                    ? "border-indigo-600 text-indigo-600 font-semibold" 
                    : "border-transparent text-slate-450"
                }`}
              >
                <Clock className="w-4 h-4" />
                Registrar Ponto
              </button>

              {/* Meu Espelho */}
              <button
                id="subtab-ponto-espelho"
                onClick={() => setActiveSubTab("espelho")}
                className={`py-2 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 -mb-px hover:text-indigo-600 ${
                  activeSubTab === "espelho" 
                    ? "border-indigo-600 text-indigo-600 font-semibold" 
                    : "border-transparent text-slate-455"
                }`}
              >
                <Calendar className="w-4 h-4" />
                Meu Espelho
              </button>
            </>
          )}

          {isUserAdmin && (
            <>
              {/* Gestão de Ponto */}
              <button
                id="subtab-ponto-gestao"
                onClick={() => setActiveSubTab("gestao")}
                className={`py-2 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 -mb-px hover:text-indigo-600 ${
                  activeSubTab === "gestao" 
                    ? "border-indigo-600 text-indigo-600 font-semibold" 
                    : "border-transparent text-slate-460"
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                Gestão de Ponto
              </button>

              {/* Ajustes com Badge */}
              <button
                id="subtab-ponto-ajustes"
                onClick={() => setActiveSubTab("ajustes")}
                className={`py-2 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 -mb-px hover:text-indigo-600 relative ${
                  activeSubTab === "ajustes" 
                    ? "border-indigo-600 text-indigo-600 font-semibold" 
                    : "border-transparent text-slate-465"
                }`}
              >
                <Settings className="w-4 h-4" />
                Ajustes
                {pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center bg-rose-500 text-white text-[10px] font-bold h-4 min-w-4 px-1 rounded-full text-center">
                    {pendingCount}
                  </span>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Renderização das Sub-Abas */}
      <div className="pt-2">
        {activeSubTab === "bater" && hasPontoPermission && (
          <BaterPonto profile={profile} />
        )}
        {activeSubTab === "espelho" && hasPontoPermission && (
          <MeuEspelho profile={profile} companySettings={companySettings} />
        )}
        {activeSubTab === "gestao" && isUserAdmin && (
          <GestaoPonto profile={profile} companySettings={companySettings} />
        )}
        {activeSubTab === "ajustes" && isUserAdmin && (
          <AjustesPonto profile={profile} />
        )}
      </div>

    </div>
  );
};
