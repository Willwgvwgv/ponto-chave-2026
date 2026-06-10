import React, { useState, useEffect } from "react";
import { 
  motion, 
  AnimatePresence 
} from "motion/react";
import { 
  DollarSign, 
  Activity,
  Award,
  TrendingUp,
  Briefcase
} from "lucide-react";
import { UserProfile, Sale, BrokerSplit, Comissao, CompanySettings } from "../types";
import { 
  useSales, 
  useTeam, 
  useCreateSaleMutation, 
  useUpdateSaleMutation,
  useUpdateSplitMutation, 
  useUpdateForecastMutation,
  useRentals,
  useCreateRentalMutation,
  useUpdateRentalMutation,
  useDeleteRentalMutation,
  useUpdateSaleNfMutation,
  useDeleteSaleMutation,
  useUpdateSaleStatusMutation
} from "../hooks/useQueries";
import { CommissionDashboard } from "./commissions/CommissionDashboard";
import { SalesList } from "./commissions/SalesList";
import { SaleForm } from "./commissions/SaleForm";
import { SaleDetail } from "./commissions/SaleDetail";
import { RentalCommissions } from "./commissions/RentalCommissions";
import { toast } from "sonner";

interface ComissoesViewProps {
  isAdmin: boolean;
  user: any;
  profile: UserProfile;
  companySettings: CompanySettings | null;
  initialData?: {
    imovel?: string;
    inquilino?: string;
    aluguelMensal?: number;
    processId?: string;
  } | null;
  onClearInitialData?: () => void;
}

export const ComissoesView: React.FC<ComissoesViewProps> = ({
  isAdmin,
  user,
  profile,
  companySettings,
  initialData,
  onClearInitialData
}) => {
  const agencyId = profile?.companyId || "default_agency";

  // Seletor de Tipo de Comissão Principal
  const [commissionType, setCommissionType] = useState<"venda" | "locacao">("venda");

  // SUB-ABAS DE VENDAS
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "sales" | "create" | "detail">("dashboard");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);

  // QUERIES DE VENDAS E EQUIVALENTES
  const { data: sales = [], isLoading: isLoadingSales, error: errorSales } = useSales(agencyId);
  const { data: team = [], isLoading: isLoadingTeam } = useTeam(agencyId);

  useEffect(() => {
    console.log('Team carregado:', team.length, team.map(u => u.name));
  }, [team]);

  // QUERIES DE LOCAÇÕES
  const { data: rentals = [], isLoading: isLoadingRentals } = useRentals(agencyId);

  // MUTAÇÕES
  const createSaleMutation = useCreateSaleMutation();
  const updateSaleMutation = useUpdateSaleMutation();
  const updateSplitMutation = useUpdateSplitMutation();
  const updateForecastMutation = useUpdateForecastMutation();
  const updateSaleNfMutation = useUpdateSaleNfMutation();

  const createRentalMutation = useCreateRentalMutation();
  const updateRentalMutation = useUpdateRentalMutation();
  const deleteRentalMutation = useDeleteRentalMutation();
  const deleteSaleMutation = useDeleteSaleMutation();
  const updateSaleStatusMutation = useUpdateSaleStatusMutation();

  const handleUpdateSaleStatus = (saleId: string, status: "ACTIVE" | "CANCELLED" | "DRAFT") => {
    updateSaleStatusMutation.mutate({ saleId, status }, {
      onSuccess: () => {
        if (status === "CANCELLED") {
          toast.success("Venda cancelada com sucesso!");
        } else if (status === "ACTIVE") {
          toast.success("Venda reativada com sucesso!");
        } else {
          toast.success("Status de venda atualizado.");
        }
      },
      onError: () => {
        toast.error("Erro ao alterar o status da venda.");
      }
    });
  };

  // Se detectarmos dados de processo de locação sendo passados como 'Lançar Comissão'
  useEffect(() => {
    if (initialData?.imovel) {
      setCommissionType("locacao");
      // O próprio RentalCommissions cuidará do formulário através das props reativas
    }
  }, [initialData]);

  // Se uma venda selecionada for atualizada na query, atualiza a referência local mantendo reatividade no detalhe
  const currentSelectedSaleReal = selectedSale 
    ? sales.find(s => s.id === selectedSale.id) || selectedSale 
    : null;

  // Extrair todos os splits para passar para o Dashboard
  const allSplits = React.useMemo(() => {
    return sales.flatMap(s => s.splits || []);
  }, [sales]);

  // Ações do fluxo de Vendas
  const handleSaveSale = (saleData: Omit<Sale, "id">, splitsData: Omit<BrokerSplit, "id">[]) => {
    createSaleMutation.mutate(
      { sale: saleData, splits: splitsData },
      {
        onSuccess: () => {
          setActiveSubTab("sales");
        }
      }
    );
  };

  const handleUpdateSale = (saleId: string, saleData: Partial<Sale>, splitsData: Omit<BrokerSplit, "id">[]) => {
    updateSaleMutation.mutate(
      { saleId, sale: saleData, splits: splitsData },
      {
        onSuccess: () => {
          setEditingSale(null);
          setSelectedSale(null);
          setActiveSubTab("sales");
        }
      }
    );
  };

  const handlePublishSale = (saleId: string) => {
    const saleObj = sales.find(s => s.id === saleId);
    if (!saleObj) return;
    
    const splits = saleObj.splits || [];
    const sumPercentage = splits.reduce((acc, s) => acc + (s.percentage || 0), 0);
    const hasEmptyBroker = splits.some(s => !s.broker_id);
    const hasZeroPercentage = splits.some(s => s.percentage <= 0);
    
    if (splits.length === 0) {
      toast.error("Adicione pelo menos um split de corretor.");
      return;
    }
    if (hasEmptyBroker) {
      toast.error("Selecione o corretor em todos os splits antes de publicar.");
      return;
    }
    if (hasZeroPercentage) {
      toast.error("Percentual do split não pode ser zero.");
      return;
    }
    
    const totalPercentage = parseFloat(sumPercentage.toFixed(2));
    if (totalPercentage !== 100) {
      toast.error(`A soma dos splits é ${totalPercentage}%. Ela deve somar exatamente 100% para ser publicada.`);
      return;
    }

    const updatedSale: Partial<Sale> = {
      ...saleObj,
      status: "ACTIVE"
    };
    delete (updatedSale as any).id;
    delete (updatedSale as any).splits;

    const splitsData = splits.map(s => {
      const { id, ...cleanSplit } = s;
      return cleanSplit;
    });

    updateSaleMutation.mutate(
      { saleId, sale: updatedSale, splits: splitsData },
      {
        onSuccess: () => {
          toast.success("Venda publicada com sucesso!");
        }
      }
    );
  };

  const handleUpdateSaleNf = (saleId: string, nfEmitida: boolean) => {
    updateSaleNfMutation.mutate({ saleId, nfEmitida });
  };

  const handleUpdateForecast = (splitId: string, forecastDate: string) => {
    updateForecastMutation.mutate({
      splitId,
      agencyId,
      forecastDate
    });
  };

  const handleRegisterPayment = (
    splitId: string,
    paidValue: number,
    isPartial: boolean,
    remainingValue: number,
    newForecastDate: string,
    paymentMethod: "PIX" | "TED" | "CHEQUE",
    notes: string,
    receiptData: string | null
  ) => {
    const today = new Date().toISOString().split("T")[0];
    const currentSplitObj = allSplits.find(s => s.id === splitId);

    if (!currentSplitObj) return;

    if (isPartial) {
      // 1. Atualizações do split atual: marca status parciais, calculated_value vira o valor pago, registra históricos
      const updates: Partial<BrokerSplit> = {
        status: "PARTIAL",
        calculated_value: paidValue,
        payment_date: today,
        payment_method: paymentMethod,
        notes: notes || "Pagamento parcial registrado",
        receipt_data: receiptData
      };

      // 2. Criação do novo split de saldo restante: mesmo compromisso, valor restante, nova previsão, parcela seguinte
      const nextInstallmentNum = (currentSplitObj.installment_number || 1) + 1;
      const newSplitToCreate: Omit<BrokerSplit, "id"> = {
        sale_id: currentSplitObj.sale_id,
        agency_id: agencyId,
        broker_id: currentSplitObj.broker_id,
        broker_name: currentSplitObj.broker_name,
        role: currentSplitObj.role,
        percentage: currentSplitObj.percentage,
        calculated_value: remainingValue,
        status: "PENDING",
        forecast_date: newForecastDate,
        installment_number: nextInstallmentNum,
        created_at: new Date().toISOString()
      };

      updateSplitMutation.mutate({
        splitId,
        agencyId,
        updates,
        newSplitToCreate
      });

    } else {
      // Pagamento integral
      const updates: Partial<BrokerSplit> = {
        status: "PAID",
        payment_date: today,
        payment_method: paymentMethod,
        notes,
        receipt_data: receiptData
      };

      updateSplitMutation.mutate({
        splitId,
        agencyId,
        updates
      });
    }
  };

  // Ações do fluxo de Locações
  const handleCreateRental = (rentalData: Omit<Comissao, "id"> & { id?: string; processId?: string }) => {
    createRentalMutation.mutate(rentalData);
  };

  const handleUpdateRental = (rentalData: Comissao) => {
    updateRentalMutation.mutate(rentalData);
  };

  const handleDeleteRental = (id: string) => {
    deleteRentalMutation.mutate({ id, companyId: agencyId });
  };

  const handleDeleteSale = (saleId: string) => {
    deleteSaleMutation.mutate({ saleId, companyId: agencyId });
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans text-slate-800">
      
      {/* Banner / Header Branding Módulo */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-[20px] flex items-center justify-center text-white shadow-lg shadow-blue-500/10 shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase">Comissão & Repasses</h1>
            </div>
          </div>
        </div>

        {/* Menu Tipo de Comissão */}
        <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 self-start lg:self-auto shadow-inner border border-slate-200">
          <button 
            onClick={() => { setCommissionType("venda"); setSelectedSale(null); setActiveSubTab("dashboard"); }}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
              commissionType === "venda"
                ? "bg-white text-blue-600 shadow-sm font-black border border-slate-200/50"
                : "text-slate-500 hover:text-slate-800 font-bold"
            }`}
          >
            Comissão de Venda
          </button>
          <button 
            onClick={() => { setCommissionType("locacao"); setSelectedSale(null); }}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
              commissionType === "locacao"
                ? "bg-white text-emerald-600 shadow-sm font-black border border-slate-200/50"
                : "text-slate-500 hover:text-slate-800 font-bold"
            }`}
          >
            Comissão de Locação
          </button>
        </div>
      </div>

      {/* RENDER POR TIPO DE COMISSÃO */}
      {commissionType === "venda" ? (
        /* SESSÃO DE VENDAS (COMISSONE STANDARD) */
        <div className="space-y-6">
          {/* Sub-menu local para vendas */}
          {activeSubTab !== "detail" && (
            <div className="bg-slate-50 p-1 rounded-2xl flex items-center gap-1 w-fit shadow-sm border border-slate-100">
              <button
                onClick={() => setActiveSubTab("dashboard")}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                  activeSubTab === "dashboard" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                Dashboard Vendas
              </button>
              <button
                onClick={() => setActiveSubTab("sales")}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                  activeSubTab === "sales" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                Vendas
              </button>
              <button
                onClick={() => setActiveSubTab("create")}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                  activeSubTab === "create" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                Lançar Nova Venda
              </button>
            </div>
          )}

          {/* Loader */}
          {(isLoadingSales || isLoadingTeam) ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-black uppercase tracking-widest animate-pulse">Sincronizando repasses...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSubTab === "detail" ? "detail" : activeSubTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="focus:outline-none"
              >
                {activeSubTab === "dashboard" && (
                  <CommissionDashboard 
                    sales={sales} 
                    splits={allSplits} 
                    onOpenCreateForm={() => setActiveSubTab("create")}
                  />
                )}

                {activeSubTab === "sales" && (
                  <SalesList
                    sales={sales}
                    team={team}
                    companySettings={companySettings}
                    onSelectSale={(sale) => {
                      setSelectedSale(sale);
                      setActiveSubTab("detail");
                    }}
                    onOpenCreateForm={() => setActiveSubTab("create")}
                  />
                )}

                {activeSubTab === "create" && (
                  <SaleForm
                    agencyId={agencyId}
                    team={team}
                    onSave={handleSaveSale}
                    onCancel={() => {
                      if (editingSale) {
                        setEditingSale(null);
                        setActiveSubTab("detail");
                      } else {
                        setActiveSubTab("dashboard");
                      }
                    }}
                    editingSale={editingSale}
                    onUpdate={handleUpdateSale}
                  />
                )}

                {activeSubTab === "detail" && currentSelectedSaleReal && (
                  <SaleDetail 
                    sale={currentSelectedSaleReal}
                    onGoBack={() => {
                      setSelectedSale(null);
                      setActiveSubTab("sales");
                    }}
                    onUpdateForecast={handleUpdateForecast}
                    onRegisterPayment={handleRegisterPayment}
                    onToggleNfEmitida={(nfEmitida) => handleUpdateSaleNf(currentSelectedSaleReal.id, nfEmitida)}
                    team={team}
                    onEditSale={(sale) => {
                      setEditingSale(sale);
                      setActiveSubTab("create");
                    }}
                    onPublishSale={handlePublishSale}
                    onDeleteSale={handleDeleteSale}
                    onUpdateStatus={handleUpdateSaleStatus}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      ) : (
        /* SESSÃO DE LOCAÇÕES */
        <div>
          {(isLoadingRentals || isLoadingTeam) ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-emerald-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-400 font-black uppercase tracking-widest animate-pulse">Sincronizando comissões de locação...</p>
            </div>
          ) : (
            <RentalCommissions
              rentals={rentals}
              team={team}
              userProfile={profile}
              initialData={initialData}
              onClearInitialData={onClearInitialData}
              onCreateRental={handleCreateRental}
              onUpdateRental={handleUpdateRental}
              onDeleteRental={handleDeleteRental}
            />
          )}
        </div>
      )}

    </div>
  );
};
