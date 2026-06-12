import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { db, collection, getDocs, query, where, orderBy, doc, addDoc, updateDoc, deleteDoc, getDoc, setDoc, limit } from "../firebase";
import { Sale, BrokerSplit, ComissoneUser, Comissao, RateioComissao, PagamentoCorretor, Despejo } from "../types";
import { toast } from "sonner";

// Lógica de arredondamento de duas casas decimais
export const round2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export const getContaPrincipal = async (companyId: string): Promise<string> => {
  const q = query(
    collection(db, 'bank_accounts'),
    where('companyId', '==', companyId),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? 'sem_conta' : snap.docs[0].id;
};

export const getCategoriaId = async (companyId: string, nome: string): Promise<string | null> => {
  const q = query(
    collection(db, 'financial_categories'),
    where('companyId', '==', companyId),
    where('name', '==', nome)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0].id;
};

export const getOrCreateCategoria = async (companyId: string, name: string, type: 'RECEITA' | 'DESPESA'): Promise<string> => {
  const q = query(
    collection(db, 'financial_categories'),
    where('companyId', '==', companyId),
    where('name', '==', name)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    return snap.docs[0].id;
  }
  
  const ref = collection(db, 'financial_categories');
  const docRef = await addDoc(ref, {
    companyId,
    name,
    type,
    color: type === 'RECEITA' ? '#0d9488' : '#e11d48',
    icon: 'Tag',
    createdAt: new Date().toISOString()
  });
  return docRef.id;
};

// Dados semente iniciais realistas para garantir que o Comissone funcione de primeira
const MOCK_BROKERS: ComissoneUser[] = [
  { id: "b1", agency_id: "default_agency", name: "Eduardo Santos", email: "eduardo@fidelite.com", role: "BROKER", cpf: "123.456.789-01", phone: "(11) 98765-4321", created_at: "2026-01-01" },
  { id: "b2", agency_id: "default_agency", name: "Marina Silva", email: "marina@fidelite.com", role: "MANAGER", cpf: "234.567.890-12", phone: "(11) 97654-3210", created_at: "2026-01-02" },
  { id: "b3", agency_id: "default_agency", name: "Rafael Costa", email: "rafael@fidelite.com", role: "BROKER", cpf: "345.678.901-23", phone: "(11) 96543-2109", created_at: "2026-01-03" },
  { id: "b4", agency_id: "default_agency", name: "Tatiane Rezende", email: "tatiane@fidelite.com", role: "ADMIN", cpf: "456.789.012-34", phone: "(11) 95432-1098", created_at: "2026-01-04" }
];

const MOCK_SALES_INITIAL: Sale[] = [
  {
    id: "sale-1",
    agency_id: "default_agency",
    sale_date: "2026-05-10",
    property_address: "Edifício Horizon Blue, Apto 1402 - Av. Atlântica",
    sale_value: 1200000,
    commission_percentage: 6,
    total_commission: 72000,
    client_name: "Alberto Roberto",
    status: "ACTIVE",
    created_at: "2026-05-10T14:30:00Z"
  },
  {
    id: "sale-2",
    agency_id: "default_agency",
    sale_date: "2026-05-24",
    property_address: "Condomínio Golden Hills, Lote 42 - Gleba B",
    sale_value: 450000,
    commission_percentage: 5,
    total_commission: 22500,
    client_name: "Cristiana Oliveira",
    status: "ACTIVE",
    created_at: "2026-05-24T10:15:00Z"
  }
];

const MOCK_SPLITS_INITIAL: BrokerSplit[] = [
  // Sale-1 (72000 total comissão)
  {
    id: "split-1-1",
    sale_id: "sale-1",
    agency_id: "default_agency",
    broker_id: "b1",
    broker_name: "Eduardo Santos",
    role: "VENDEDOR",
    percentage: 60,
    calculated_value: 43200,
    status: "PENDING",
    forecast_date: "2026-06-15",
    created_at: "2026-05-10T14:31:00Z"
  },
  {
    id: "split-1-2",
    sale_id: "sale-1",
    agency_id: "default_agency",
    broker_id: "b2",
    broker_name: "Marina Silva",
    role: "CAPTADOR",
    percentage: 30,
    calculated_value: 21600,
    status: "PAID",
    forecast_date: "2026-05-30",
    payment_date: "2026-05-30",
    payment_method: "PIX",
    notes: "Pago integral dentro do prazo",
    created_at: "2026-05-10T14:31:00Z"
  },
  {
    id: "split-1-3",
    sale_id: "sale-1",
    agency_id: "default_agency",
    broker_id: "b4",
    broker_name: "Tatiane Rezende",
    role: "GESTOR",
    percentage: 10,
    calculated_value: 7200,
    status: "PARTIAL",
    forecast_date: "2026-05-20",
    payment_date: "2026-05-20",
    payment_method: "TED",
    notes: "Recebido primeira parcela do faturamento",
    created_at: "2026-05-10T14:31:00Z"
  },
  // Sale-2 (22500 total comissão)
  {
    id: "split-2-1",
    sale_id: "sale-2",
    agency_id: "default_agency",
    broker_id: "b1",
    broker_name: "Eduardo Santos",
    role: "CAPTADOR",
    percentage: 50,
    calculated_value: 11250,
    status: "PENDING",
    forecast_date: "2026-06-10",
    created_at: "2026-05-24T10:16:00Z"
  },
  {
    id: "split-2-2",
    sale_id: "sale-2",
    agency_id: "default_agency",
    broker_id: "b3",
    broker_name: "Rafael Costa",
    role: "VENDEDOR",
    percentage: 50,
    calculated_value: 11250,
    status: "PENDING",
    forecast_date: "2026-06-12",
    created_at: "2026-05-24T10:16:00Z"
  }
];

// Dados semente iniciais realistas para comissões de locações
const MOCK_RENTALS_INITIAL: Comissao[] = [
  {
    id: "rental-1",
    companyId: "default_agency",
    imovel: "Edifício Horizon Blue, Apto 1402 - Av. Atlântica",
    inquilino: "Clarice Lispector",
    aluguelMensal: 3500,
    primeiroAluguel: 3500,
    porcentagemFidelite: 100,
    valorFidelite: 3500,
    valorRepasseCorretores: 2450,
    vencimento: "2026-06-10",
    mesReferencia: "2026-06",
    status: "pendente",
    jaPagoCorretores: false,
    rateio: [
      { corretorId: "b1", corretorNome: "Eduardo Santos", papel: "locacao", valor: 1715, porcentagem: 70 },
      { corretorId: "b2", corretorNome: "Marina Silva", papel: "captador", valor: 735, porcentagem: 30 }
    ],
    observacoes: "Contrato de locação firmado por 30 meses.",
    criadoPor: "admin",
    criadoPorNome: "Administrador",
    createdAt: "2026-05-25T14:00:00Z",
    updatedAt: "2026-05-25T14:00:00Z",
    pagamentosCorretores: []
  },
  {
    id: "rental-2",
    companyId: "default_agency",
    imovel: "Condomínio Golden Hills, Casa 15 - Quadra C",
    inquilino: "Machado de Assis",
    aluguelMensal: 5000,
    primeiroAluguel: 5000,
    porcentagemFidelite: 70,
    valorFidelite: 3500,
    valorRepasseCorretores: 2100,
    vencimento: "2026-05-15",
    mesReferencia: "2026-05",
    status: "pago",
    jaPagoCorretores: true,
    rateio: [
      { corretorId: "b3", corretorNome: "Rafael Costa", papel: "locacao", valor: 1260, porcentagem: 60 },
      { corretorId: "b2", corretorNome: "Marina Silva", papel: "captador", valor: 840, porcentagem: 40 }
    ],
    observacoes: "Locação via Processo de Locação nº 4022. Tudo pago.",
    criadoPor: "admin",
    criadoPorNome: "Administrador",
    createdAt: "2026-05-10T09:30:00Z",
    updatedAt: "2026-05-15T15:00:00Z",
    pagamentosCorretores: [
      {
        id: "pay-1",
        corretorId: "b3",
        corretorNome: "Rafael Costa",
        tipo: "pagamento",
        valor: 1260,
        data: "2026-05-15",
        observacao: "Pago via PIX",
        registradoPorUid: "admin",
        registradoPorNome: "Administrador",
        registradoEm: 1778943600000
      },
      {
        id: "pay-2",
        corretorId: "b2",
        corretorNome: "Marina Silva",
        tipo: "pagamento",
        valor: 840,
        data: "2026-05-15",
        observacao: "Pago via PIX",
        registradoPorUid: "admin",
        registradoPorNome: "Administrador",
        registradoEm: 1778943600000
      }
    ]
  }
];

// Carregar mocks do localStorage se existirem, ou usar iniciais
const getStoredData = () => {
  try {
    const sSales = localStorage.getItem("comissone_store_sales");
    const sSplits = localStorage.getItem("comissone_store_splits");
    const sTeam = localStorage.getItem("comissone_store_team");
    const sRentals = localStorage.getItem("comissone_store_rentals");
    
    return {
      sales: sSales ? JSON.parse(sSales) : MOCK_SALES_INITIAL,
      splits: sSplits ? JSON.parse(sSplits) : MOCK_SPLITS_INITIAL,
      team: sTeam ? JSON.parse(sTeam) : MOCK_BROKERS,
      rentals: sRentals ? JSON.parse(sRentals) : MOCK_RENTALS_INITIAL
    };
  } catch {
    return {
      sales: MOCK_SALES_INITIAL,
      splits: MOCK_SPLITS_INITIAL,
      team: MOCK_BROKERS,
      rentals: MOCK_RENTALS_INITIAL
    };
  }
};

const saveStoredData = (data: { sales?: Sale[]; splits?: BrokerSplit[]; team?: ComissoneUser[]; rentals?: Comissao[] }) => {
  try {
    const current = getStoredData();
    if (data.sales) {
      localStorage.setItem("comissone_store_sales", JSON.stringify(data.sales));
    }
    if (data.splits) {
      localStorage.setItem("comissone_store_splits", JSON.stringify(data.splits));
    }
    if (data.team) {
      localStorage.setItem("comissone_store_team", JSON.stringify(data.team));
    }
    if (data.rentals) {
      localStorage.setItem("comissone_store_rentals", JSON.stringify(data.rentals));
    }
  } catch (err) {
    console.error("Falha ao salvar no localStore de fallback Comissone", err);
  }
};

export function useSales(agencyId: string) {
  const safeAgencyId = agencyId || "default_agency";

  return useQuery({
    queryKey: ["sales", safeAgencyId],
    queryFn: async () => {
      try {
        // Query de vendas do Firestore
        const salesRef = collection(db, "sales");
        const salesQuery = query(
          salesRef,
          where("agency_id", "==", safeAgencyId)
        );
        const salesSnap = await getDocs(salesQuery);
        let salesList: Sale[] = salesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Sale));

        // Query de splits do Firestore
        const splitsRef = collection(db, "broker_splits");
        const splitsQuery = query(
          splitsRef,
          where("agency_id", "==", safeAgencyId)
        );
        const splitsSnap = await getDocs(splitsQuery);
        const splitsList: BrokerSplit[] = splitsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as BrokerSplit));

        // Join em memória para vendas e splits reais do Firestore
        return salesList.map(sale => ({
          ...sale,
          splits: splitsList.filter(s => s.sale_id === sale.id)
        })).sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());

      } catch (err) {
        console.warn("Erro ao ler do Firestore, carregando localStorage:", err);
        const fallback = getStoredData();
        const salesFiltered = fallback.sales.filter((s: any) => s.agency_id === safeAgencyId);
        const splitsFiltered = fallback.splits.filter((s: any) => s.agency_id === safeAgencyId);
        return salesFiltered.map((sale: any) => ({
          ...sale,
          splits: splitsFiltered.filter((s: any) => s.sale_id === sale.id)
        })).sort((a: any, b: any) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());
      }
    },
    staleTime: 5 * 1000, // 5 segundos para manter dados de vendas super atualizados
    gcTime: 30 * 1000, // 30 segundos de garbage collection
    retry: 1,
  });
}

export function useTeam(agencyId: string) {
  const safeAgencyId = agencyId || "default_agency";

  return useQuery({
    queryKey: ["team", safeAgencyId],
    queryFn: async () => {
      try {
        const teamRef = collection(db, "users");
        
        let teamSnap;
        try {
          // Query simples para robustez - buscar todos da empresa
          const teamQuery = query(
            teamRef,
            where("companyId", "==", safeAgencyId)
          );
          teamSnap = await getDocs(teamQuery);
        } catch (err) {
          console.warn("Erro ao buscar usuários do time:", err);
          const fallbackQuery = query(
            teamRef,
            where("companyId", "==", safeAgencyId)
          );
          teamSnap = await getDocs(fallbackQuery);
        }

        let usersList = teamSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }) as any);

        // Filtrar no cliente quem pode aparecer nos splits e comissões de forma permissiva e robusta
        const filteredUsers = usersList.filter(u => {
          const isBlocked = u.status === "blocked";
          const isNone = u.role === "none";
          if (isBlocked || isNone) return false;

          // Qualquer usuário ativo no sistema pode entrar no rateio de comissões, corretores, captador, sócios, etc.
          return true;
        });

        // Mapeia para o formato ComissoneUser
        const mappedUsers: ComissoneUser[] = filteredUsers.map(u => {
          let roleMapped: "ADMIN" | "BROKER" | "MANAGER" = "BROKER";
          const rLower = String(u.role || "").toLowerCase();
          if (rLower === "admin") {
            roleMapped = "ADMIN";
          } else if (rLower === "manager" || rLower === "gerente") {
            roleMapped = "MANAGER";
          }
          return {
            id: u.uid || u.id,
            agency_id: safeAgencyId,
            name: u.displayName || u.name || "Corretor Sem Nome",
            email: u.email || "",
            role: roleMapped,
            cpf: u.cpf,
            phone: u.phone,
            created_at: u.createdAt || u.created_at || new Date().toISOString(),
            permComissoes: u.permComissoes,
            perm_comissoes: u.perm_comissoes,
            permissions: u.permissions,
            isSocio: u.isSocio,
            cargoComissao: u.cargoComissao,
            permRateioLocacao: u.permRateioLocacao
          };
        });

        const fallback = getStoredData();
        const localTeam = fallback.team.filter(u => u.agency_id === safeAgencyId);

        // Mesclar sem duplicar por e-mail
        const mergedMap = new Map<string, ComissoneUser>();

        // 1. Inserir local/fallback
        localTeam.forEach(u => {
          if (u.email) {
            mergedMap.set(u.email.toLowerCase(), {
              ...u,
              role: (u.role === "ADMIN" || String(u.role).toLowerCase() === "admin") ? "ADMIN" : (u.role === "MANAGER" || String(u.role).toLowerCase() === "manager" ? "MANAGER" : "BROKER")
            });
          }
        });

        // 2. Inserir mapeados da coleção principal (sobrepõe fallback se duplicado por e-mail)
        mappedUsers.forEach(u => {
          if (u.email) {
            mergedMap.set(u.email.toLowerCase(), u);
          }
        });

        const finalTeam = Array.from(mergedMap.values());
        if (finalTeam.length === 0) {
          return localTeam;
        }
        return finalTeam;
      } catch (err) {
        console.warn("Erro ao buscar corretores no Firestore, usando fallback local:", err);
        const fallback = getStoredData();
        return fallback.team.filter(u => u.agency_id === safeAgencyId);
      }
    },
    staleTime: 15 * 1000, // 15 segundos para o time de corretores
    gcTime: 60 * 1000, // 1 minuto de GC para corretores
    retry: 1,
  });
}

// Funções de mutação
export function useCreateSaleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sale, splits }: { sale: Omit<Sale, "id">; splits: Omit<BrokerSplit, "id">[] }) => {
      const safeAgencyId = sale.agency_id || "default_agency";
      
      try {
        // Tenta salvar no Firebase Firestore
        const salesRef = collection(db, "sales");
        const docSale = await addDoc(salesRef, sale);
        const generatedSaleId = docSale.id;

        const splitsRef = collection(db, "broker_splits");
        for (const split of splits) {
          await addDoc(splitsRef, {
            ...split,
            sale_id: generatedSaleId
          });
        }

        // Funções auxiliares para buscar dados do financeiro
        const contaPrincipal = await getContaPrincipal(safeAgencyId);
        const catComissaoId = await getOrCreateCategoria(safeAgencyId, 'Comissão de Venda', 'RECEITA');

        // Proteção contra duplicatas
        const txsRef = collection(db, "financial_transactions");
        const checkDuplicate = async (saleId: string, instInfo?: string) => {
          let q;
          if (instInfo) {
            q = query(
              txsRef,
              where("companyId", "==", safeAgencyId),
              where("commissionRef", "==", saleId),
              where("origin", "==", "AUTOMATICO"),
              where("installmentInfo", "==", instInfo)
            );
          } else {
            q = query(
              txsRef,
              where("companyId", "==", safeAgencyId),
              where("commissionRef", "==", saleId),
              where("origin", "==", "AUTOMATICO")
            );
          }
          const snap = await getDocs(q);
          const hasRegularTx = snap.docs.some(docSnap => !(docSnap.data() as any).installmentInfo);
          return instInfo ? !snap.empty : hasRegularTx;
        };

        // Criar transação de receita de comissão total
        if (sale.status !== 'DRAFT' && sale.total_commission && sale.total_commission > 0) {
          const isDup = await checkDuplicate(generatedSaleId);
          if (!isDup) {
            const txId = `tx_auto_sale_${generatedSaleId}`;
            await setDoc(doc(db, "financial_transactions", txId), {
              companyId: safeAgencyId,
              accountId: contaPrincipal,
              date: sale.sale_date || new Date().toISOString().split('T')[0],
              description: `Comissão — ${sale.property_address || 'Comissão de Venda'}`,
              amount: Math.abs(sale.total_commission),
              type: 'RECEITA',
              categoryId: catComissaoId || undefined,
              categoryName: 'Comissão de Venda',
              status: 'PENDENTE',
              origin: 'AUTOMATICO',
              commissionRef: generatedSaleId,
              notes: `Cliente: ${sale.client_name} · Corretor(es): ${splits.map(s => s.broker_name).join(', ')}`,
              createdAt: new Date().toISOString()
            });
          }
        }

        // Criar transações de parcelamento (Entrada e parcelas individuais, se houver)
        if (sale.status !== 'DRAFT' && sale.is_installment) {
          // 1. Entrada
          if (sale.entrada_value && sale.entrada_value > 0) {
            const isDupEntrada = await checkDuplicate(generatedSaleId, "Entrada");
            if (!isDupEntrada) {
              const txEntradaId = `tx_auto_entry_${generatedSaleId}`;
              await setDoc(doc(db, "financial_transactions", txEntradaId), {
                companyId: safeAgencyId,
                accountId: contaPrincipal,
                date: sale.sale_date || new Date().toISOString().split('T')[0],
                description: `Entrada — Comissão — ${sale.property_address}`,
                amount: Math.abs(sale.entrada_value),
                type: 'RECEITA',
                categoryId: catComissaoId || undefined,
                categoryName: 'Comissão de Venda',
                status: 'PENDENTE',
                origin: 'AUTOMATICO',
                commissionRef: generatedSaleId,
                installmentInfo: 'Entrada',
                createdAt: new Date().toISOString()
              });
            }
          }

          // 2. Parcelas individuais de 1 a N
          const totalParcelas = sale.installment_count || 1;
          const valorParcela = sale.installment_value || 0;
          const firstDate = sale.first_installment_date || new Date().toISOString().split('T')[0];

          for (let i = 1; i <= totalParcelas; i++) {
            const instInfo = `${i}/${totalParcelas}`;
            const isDupParcela = await checkDuplicate(generatedSaleId, instInfo);
            if (!isDupParcela) {
              let dataCalculada = firstDate;
              try {
                const d = new Date(firstDate + "T12:00:00");
                d.setMonth(d.getMonth() + (i - 1));
                dataCalculada = d.toISOString().split("T")[0];
              } catch (e) {
                console.error(e);
              }

              const todayStr = new Date().toISOString().split("T")[0];
              const isFuture = dataCalculada > todayStr;
              const statusTx = isFuture ? 'AGENDADO' : 'PENDENTE';
              const txParcelaId = `tx_auto_inst_${generatedSaleId}_${i}`;

              await setDoc(doc(db, "financial_transactions", txParcelaId), {
                companyId: safeAgencyId,
                accountId: contaPrincipal,
                date: dataCalculada,
                description: `Parcela ${i}/${totalParcelas} — Comissão — ${sale.property_address}`,
                amount: Math.abs(valorParcela),
                type: 'RECEITA',
                categoryId: catComissaoId || undefined,
                categoryName: 'Comissão de Venda',
                status: statusTx,
                origin: 'AUTOMATICO',
                commissionRef: generatedSaleId,
                installmentInfo: instInfo,
                recurrenceGroupId: `parcelas_${generatedSaleId}`,
                createdAt: new Date().toISOString()
              });
            }
          }
        }

        return { saleId: generatedSaleId };
      } catch (err) {
        console.warn("Falha de gravação no Firestore, gravando localmente no rascunho de contingência:", err);
        const fallback = getStoredData();
        
        const generatedSaleId = "local-" + Math.random().toString(36).substring(2, 9);
        const newSale: Sale = { ...sale, id: generatedSaleId };
        const newSplits: BrokerSplit[] = splits.map((s, idx) => ({
          ...s,
          id: `local-split-${generatedSaleId}-${idx}`,
          sale_id: generatedSaleId
        }));

        fallback.sales.push(newSale);
        fallback.splits.push(...newSplits);
        
        saveStoredData({ sales: fallback.sales, splits: fallback.splits });
        return { saleId: generatedSaleId };
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sales", variables.sale.agency_id || "default_agency"] });
      toast.success("Venda e splits de comissão cadastradas com sucesso!");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao registrar a venda.");
    }
  });
}

export function useUpdateSaleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ saleId, sale, splits }: { saleId: string; sale: Partial<Sale>; splits: Omit<BrokerSplit, "id">[] }) => {
      const safeAgencyId = sale.agency_id || "default_agency";

      try {
        // 1. Atualizar a venda no Firestore
        const saleRef = doc(db, "sales", saleId);
        await updateDoc(saleRef, sale);

        // 2. Buscar e apagar os splits antigos correspondentes do saleId
        const splitsRef = collection(db, "broker_splits");
        const existingSplitsQuery = query(splitsRef, where("sale_id", "==", saleId));
        const existingSplitsSnap = await getDocs(existingSplitsQuery);
        for (const splitDoc of existingSplitsSnap.docs) {
          await deleteDoc(doc(db, "broker_splits", splitDoc.id));
        }

        // 3. Adicionar novos splits
        for (const split of splits) {
          await addDoc(splitsRef, {
            ...split,
            sale_id: saleId
          });
        }

        // 4. Apagar transações financeiras automáticas antigas vinculadas a essa venda
        const txsRef = collection(db, "financial_transactions");
        const existingTxsQuery = query(
          txsRef,
          where("companyId", "==", safeAgencyId),
          where("commissionRef", "==", saleId),
          where("origin", "==", "AUTOMATICO")
        );
        const existingTxsSnap = await getDocs(existingTxsQuery);
        for (const txDoc of existingTxsSnap.docs) {
          await deleteDoc(doc(db, "financial_transactions", txDoc.id));
        }

        // 5. Se não for RASCUNHO (status !== 'DRAFT'), recriar as transações financeiras automáticas
        if (sale.status !== 'DRAFT' && sale.total_commission && sale.total_commission > 0) {
          const contaPrincipal = await getContaPrincipal(safeAgencyId);
          const catComissaoId = await getOrCreateCategoria(safeAgencyId, 'Comissão de Venda', 'RECEITA');

          const txId = `tx_auto_sale_${saleId}`;
          await setDoc(doc(db, "financial_transactions", txId), {
            companyId: safeAgencyId,
            accountId: contaPrincipal,
            date: sale.sale_date || new Date().toISOString().split('T')[0],
            description: `Comissão — ${sale.property_address || 'Comissão de Venda'}`,
            amount: Math.abs(sale.total_commission),
            type: 'RECEITA',
            categoryId: catComissaoId || undefined,
            categoryName: 'Comissão de Venda',
            status: 'PENDENTE',
            origin: 'AUTOMATICO',
            commissionRef: saleId,
            notes: `Cliente: ${sale.client_name} · Corretor(es): ${splits.map(s => s.broker_name).join(', ')}`,
            createdAt: new Date().toISOString()
          });

          // Se for parcelado
          if (sale.is_installment) {
            // Entrada
            if (sale.entrada_value && sale.entrada_value > 0) {
              const txEntradaId = `tx_auto_entry_${saleId}`;
              await setDoc(doc(db, "financial_transactions", txEntradaId), {
                companyId: safeAgencyId,
                accountId: contaPrincipal,
                date: sale.sale_date || new Date().toISOString().split('T')[0],
                description: `Entrada — Comissão — ${sale.property_address}`,
                amount: Math.abs(sale.entrada_value),
                type: 'RECEITA',
                categoryId: catComissaoId || undefined,
                categoryName: 'Comissão de Venda',
                status: 'PENDENTE',
                origin: 'AUTOMATICO',
                commissionRef: saleId,
                installmentInfo: 'Entrada',
                createdAt: new Date().toISOString()
              });
            }

            // Parcelas individuais de 1 a N
            const totalParcelas = sale.installment_count || 1;
            const valorParcela = sale.installment_value || 0;
            const firstDate = sale.first_installment_date || new Date().toISOString().split('T')[0];

            for (let i = 1; i <= totalParcelas; i++) {
              const instInfo = `${i}/${totalParcelas}`;
              let dataCalculada = firstDate;
              try {
                const d = new Date(firstDate + "T12:00:00");
                d.setMonth(d.getMonth() + (i - 1));
                dataCalculada = d.toISOString().split("T")[0];
              } catch (e) {
                console.error(e);
              }

              const todayStr = new Date().toISOString().split("T")[0];
              const isFuture = dataCalculada > todayStr;
              const statusTx = isFuture ? 'AGENDADO' : 'PENDENTE';
              const txParcelaId = `tx_auto_inst_${saleId}_${i}`;

              await setDoc(doc(db, "financial_transactions", txParcelaId), {
                companyId: safeAgencyId,
                accountId: contaPrincipal,
                date: dataCalculada,
                description: `Parcela ${i}/${totalParcelas} — Comissão — ${sale.property_address}`,
                amount: Math.abs(valorParcela),
                type: 'RECEITA',
                categoryId: catComissaoId || undefined,
                categoryName: 'Comissão de Venda',
                status: statusTx,
                origin: 'AUTOMATICO',
                commissionRef: saleId,
                installmentInfo: instInfo,
                recurrenceGroupId: `parcelas_${saleId}`,
                createdAt: new Date().toISOString()
              });
            }
          }
        }

        return { saleId };
      } catch (err) {
        console.warn("Falha de gravação no Firestore para edição de venda, gravando localmente no rascunho de contingência:", err);
        const fallback = getStoredData();
        const index = fallback.sales.findIndex(s => s.id === saleId);
        const updatedSale = { ...sale, id: saleId } as Sale;
        if (index > -1) {
          fallback.sales[index] = updatedSale;
        } else {
          fallback.sales.push(updatedSale);
        }
        
        fallback.splits = fallback.splits.filter(s => s.sale_id !== saleId);
        const newSplits: BrokerSplit[] = splits.map((s, idx) => ({
          ...s,
          id: `local-split-${saleId}-${idx}`,
          sale_id: saleId
        }));
        fallback.splits.push(...newSplits);

        saveStoredData({ sales: fallback.sales, splits: fallback.splits });
        return { saleId };
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sales", variables.sale.agency_id || "default_agency"] });
      toast.success("Venda atualizada com sucesso!");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao atualizar a venda.");
    }
  });
}

export function useUpdateSplitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      splitId, 
      agencyId,
      updates,
      newSplitToCreate 
    }: { 
      splitId: string; 
      agencyId: string;
      updates: Partial<BrokerSplit>;
      newSplitToCreate?: Omit<BrokerSplit, "id"> | null;
    }) => {
      try {
        // Tenta alterar no Firestore
        await updateDoc(doc(db, "broker_splits", splitId), updates);

        // Se a atualização for para marcar como PAGO (PAID)
        if (updates.status === 'PAID') {
          try {
            const splitSnap = await getDoc(doc(db, "broker_splits", splitId));
            if (splitSnap.exists()) {
              const splitData = splitSnap.data();
              
              // Tenta carregar o endereço do imóvel da venda relacionada
              const saleSnap = await getDoc(doc(db, "sales", splitData.sale_id));
              const saleData = saleSnap.exists() ? saleSnap.data() : null;
              const address = saleData?.property_address || "Venda";

              // Registra a transação de despesa de comissão
              const txId = `tx_auto_payout_${splitId}`;
              const docRef = doc(db, "financial_transactions", txId);
              const docSnap = await getDoc(docRef);

              if (!docSnap.exists()) {
                const contaPrincipal = await getContaPrincipal(agencyId);
                const catRepasseId = await getOrCreateCategoria(agencyId, 'Repasse de Comissão', 'DESPESA');

                await setDoc(docRef, {
                  companyId: agencyId,
                  accountId: contaPrincipal,
                  date: splitData.payment_date || new Date().toISOString().split('T')[0],
                  description: `Repasse — ${splitData.broker_name || 'Corretor'} — ${address}`,
                  amount: Math.abs(splitData.calculated_value || 0),
                  type: 'DESPESA',
                  categoryId: catRepasseId,
                  categoryName: 'Repasse de Comissão',
                  status: 'PENDENTE',
                  origin: 'AUTOMATICO',
                  commissionRef: splitData.sale_id, // saleId
                  createdAt: new Date().toISOString()
                });
              }
            }
          } catch (e) {
            console.error("Erro na automação de fluxo de caixa para comissão paga:", e);
          }
        }

        if (newSplitToCreate) {
          const splitsRef = collection(db, "broker_splits");
          await addDoc(splitsRef, newSplitToCreate);
        }
      } catch (err) {
        console.warn("Operação local de contingência ao atualizar split:", err);
        const fallback = getStoredData();
        
        // Atualiza split local
        fallback.splits = fallback.splits.map(s => {
          if (s.id === splitId) {
            return { ...s, ...updates };
          }
          return s;
        });

        // Cria opcional
        if (newSplitToCreate) {
          fallback.splits.push({
            ...newSplitToCreate,
            id: "local-split-" + Math.random().toString(36).substring(2, 9)
          } as BrokerSplit);
        }

        saveStoredData({ splits: fallback.splits });
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sales", variables.agencyId] });
      toast.success("Parcelamento e pagamento processados com sucesso!");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao atualizar o split de comissão.");
    }
  });
}

export function useUpdateForecastMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ splitId, agencyId, forecastDate }: { splitId: string; agencyId: string; forecastDate: string }) => {
      try {
        await updateDoc(doc(db, "broker_splits", splitId), { forecast_date: forecastDate });
      } catch (err) {
        console.warn("Adiantamento local de previsão:", err);
        const fallback = getStoredData();
        fallback.splits = fallback.splits.map(s => {
          if (s.id === splitId) {
            return { ...s, forecast_date: forecastDate };
          }
          return s;
        });
        saveStoredData({ splits: fallback.splits });
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sales", variables.agencyId] });
      toast.success("Previsão de pagamento remarcada!");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao reagendar a previsão.");
    }
  });
}

export function useRentals(companyId: string) {
  const safeId = companyId || "default_agency";

  useEffect(() => {
    try {
      localStorage.removeItem("comissone_store_rentals");
    } catch (e) {
      console.warn("Erro ao limpar cache local de locações:", e);
    }
  }, []);

  return useQuery({
    queryKey: ["rentals", safeId],
    queryFn: async () => {
      // Se não estiver conectado à internet (modo offline real), carrega do localStorage
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const local = getStoredData();
        return local.rentals.filter((r: Comissao) => r.companyId === safeId)
          .sort((a: Comissao, b: Comissao) => b.createdAt?.localeCompare?.(a.createdAt) || 0);
      }

      try {
        const q = query(collection(db, "comissoes"), where("companyId", "==", safeId));
        const snap = await getDocs(q);
        const list: Comissao[] = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Comissao));
        // Ordena por data de criação / mais recente
        return list.sort((a,b) => b.createdAt?.localeCompare?.(a.createdAt) || 0);
      } catch (err: any) {
        console.error("Erro ao buscar do Firestore na query useRentals:", err);
        const isNetworkErr = err?.message?.toLowerCase?.().includes("network") || 
                             err?.message?.toLowerCase?.().includes("offline") ||
                             err?.message?.toLowerCase?.().includes("failed to fetch");

        if (isNetworkErr || (typeof navigator !== "undefined" && !navigator.onLine)) {
          const local = getStoredData();
          return local.rentals.filter((r: Comissao) => r.companyId === safeId)
            .sort((a: Comissao, b: Comissao) => b.createdAt?.localeCompare?.(a.createdAt) || 0);
        }
        throw err;
      }
    }
  });
}

export function useCreateRentalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rental: Omit<Comissao, "id"> & { id?: string; processId?: string }) => {
      const generatedId = rental.id || "rental-" + Math.random().toString(36).substring(2, 9);
      const docData = { ...rental, id: generatedId };
      const procId = rental.processId;
      delete (docData as any).processId;

      try {
        await setDoc(doc(db, "comissoes", generatedId), docData);
        if (procId) {
          await updateDoc(doc(db, "processes", procId), { 
            isCommissionLaunched: true, 
            commissionRefId: generatedId 
          });
        }
      } catch (err) {
        console.warn("Offline/local fallback para criação de comissão de locação:", err);
        const local = getStoredData();
        const updatedRentals = [{ id: generatedId, ...docData } as Comissao, ...local.rentals];
        saveStoredData({ rentals: updatedRentals });
      }
      return generatedId;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rentals", variables.companyId || "default_agency"] });
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      toast.success("Comissão de locação lançada com sucesso!");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao lançar comissão de locação.");
    }
  });
}

export function useUpdateRentalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rental: Comissao) => {
      try {
        const q = query(collection(db, "comissoes"), where("id", "==", rental.id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const updatePromises = snap.docs.map(d => updateDoc(doc(db, "comissoes", d.id), { ...rental }));
          await Promise.all(updatePromises);
        } else {
          await updateDoc(doc(db, "comissoes", rental.id), { ...rental });
        }
      } catch (err) {
        console.warn("Offline/local fallback para atualização de comissão de locação:", err);
        const local = getStoredData();
        const updatedRentals = local.rentals.map(r => r.id === rental.id ? rental : r);
        saveStoredData({ rentals: updatedRentals });
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rentals", variables.companyId || "default_agency"] });
      toast.success("Comissão de locação atualizada!");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao atualizar comissão.");
    }
  });
}

export function useDeleteRentalMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      try {
        const q = query(collection(db, "comissoes"), where("id", "==", id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const deletePromises = snap.docs.map(d => deleteDoc(doc(db, "comissoes", d.id)));
          await Promise.all(deletePromises);
        } else {
          await deleteDoc(doc(db, "comissoes", id));
        }
      } catch (err) {
        console.warn("Offline/local fallback para exclusão de comissão de locação:", err);
      }
      // Sempre remove do armazenamento local para garantir sincronização total
      const local = getStoredData();
      const updatedRentals = local.rentals.filter(r => r.id !== id);
      saveStoredData({ rentals: updatedRentals });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rentals", variables.companyId || "default_agency"] });
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      toast.success("Comissão de locação removida.");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao excluir comissão.");
    }
  });
}

export function useDeleteSaleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ saleId, companyId }: { saleId: string; companyId: string }) => {
      try {
        await deleteDoc(doc(db, "sales", saleId));

        const splitsRef = collection(db, "broker_splits");
        const existingSplitsQuery = query(splitsRef, where("sale_id", "==", saleId));
        const existingSplitsSnap = await getDocs(existingSplitsQuery);
        for (const splitDoc of existingSplitsSnap.docs) {
          await deleteDoc(doc(db, "broker_splits", splitDoc.id));
        }

        const txsRef = collection(db, "financial_transactions");
        const existingTxsQuery = query(
          txsRef,
          where("companyId", "==", companyId),
          where("commissionRef", "==", saleId),
          where("origin", "==", "AUTOMATICO")
        );
        const existingTxsSnap = await getDocs(existingTxsQuery);
        for (const txDoc of existingTxsSnap.docs) {
          await deleteDoc(doc(db, "financial_transactions", txDoc.id));
        }
      } catch (err) {
        console.warn("Offline/local fallback para exclusão de venda:", err);
        const local = getStoredData();
        const updatedSales = local.sales.filter((s: Sale) => s.id !== saleId);
        saveStoredData({ sales: updatedSales });
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sales", variables.companyId || "default_agency"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao excluir venda.");
    }
  });
}

export function useUpdateSaleNfMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ saleId, nfEmitida }: { saleId: string; nfEmitida: boolean }) => {
      try {
        await updateDoc(doc(db, "sales", saleId), { nf_emitida: nfEmitida });
        return { saleId };
      } catch (err) {
        console.warn("Falha ao atualizar status da NF no Firestore, atualizando localmente:", err);
        const local = getStoredData();
        const updatedSales = local.sales.map((s: Sale) =>
          s.id === saleId ? { ...s, nf_emitida: nfEmitida } : s
        );
        saveStoredData({ sales: updatedSales });
        return { saleId };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

export function useUpdateSaleStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ saleId, status }: { saleId: string; status: 'ACTIVE' | 'CANCELLED' | 'DRAFT' }) => {
      try {
        await updateDoc(doc(db, "sales", saleId), { status });
        return { saleId, status };
      } catch (err) {
        console.warn("Falha ao atualizar status da venda no Firestore, atualizando localmente:", err);
        const local = getStoredData();
        const updatedSales = local.sales.map((s: Sale) =>
          s.id === saleId ? { ...s, status } : s
        );
        saveStoredData({ sales: updatedSales });
        return { saleId, status };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

// ==========================================
// AÇÕES DE DESPEJO INTEGRATION
// ==========================================

const getStoredDespejos = (): Despejo[] => {
  try {
    const s = localStorage.getItem("comissone_store_despejos");
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
};

const saveStoredDespejos = (despejos: Despejo[]) => {
  try {
    localStorage.setItem("comissone_store_despejos", JSON.stringify(despejos));
  } catch (err) {
    console.error("Falha ao salvar despejos no localStore", err);
  }
};

export function useDespejos(companyId: string) {
  const safeId = companyId || "default_agency";

  return useQuery({
    queryKey: ["despejos", safeId],
    queryFn: async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const local = getStoredDespejos();
        return local.filter((d: Despejo) => d.companyId === safeId)
          .sort((a, b) => b.createdAt?.localeCompare?.(a.createdAt) || 0);
      }

      try {
        const q = query(collection(db, "despejos"), where("companyId", "==", safeId));
        const snap = await getDocs(q);
        const list: Despejo[] = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Despejo));
        
        // Save to local cache as sync
        const otherCompanyDespejos = getStoredDespejos().filter(d => d.companyId !== safeId);
        saveStoredDespejos([...otherCompanyDespejos, ...list]);

        return list.sort((a, b) => b.createdAt?.localeCompare?.(a.createdAt) || 0);
      } catch (err: any) {
        console.error("Erro ao buscar despejos do Firestore:", err);
        const local = getStoredDespejos();
        return local.filter((d: Despejo) => d.companyId === safeId)
          .sort((a, b) => b.createdAt?.localeCompare?.(a.createdAt) || 0);
      }
    }
  });
}

export function useCreateDespejoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (despejo: Omit<Despejo, "id"> & { id?: string }) => {
      const generatedId = despejo.id || "despejo-" + Math.random().toString(36).substring(2, 9);
      const docData = { ...despejo, id: generatedId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as Despejo;

      try {
        await setDoc(doc(db, "despejos", generatedId), docData);
      } catch (err) {
        console.warn("Offline fallback para criação de ação de despejo:", err);
      }

      // Always save locally to persist/contingency
      const local = getStoredDespejos();
      const updated = [docData, ...local.filter(d => d.id !== generatedId)];
      saveStoredDespejos(updated);

      return generatedId;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["despejos", variables.companyId || "default_agency"] });
      toast.success("Ação de despejo cadastrada com sucesso!");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao cadastrar ação de despejo.");
    }
  });
}

export function useUpdateDespejoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (despejo: Despejo) => {
      const docData = { ...despejo, updatedAt: new Date().toISOString() };
      try {
        await updateDoc(doc(db, "despejos", despejo.id), { ...docData });
      } catch (err) {
        console.warn("Offline fallback para atualização de ação de despejo:", err);
      }

      const local = getStoredDespejos();
      const updated = local.map(d => d.id === despejo.id ? docData : d);
      saveStoredDespejos(updated);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["despejos", variables.companyId || "default_agency"] });
      toast.success("Ação de despejo atualizada com sucesso!");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao atualizar ação de despejo.");
    }
  });
}

export function useDeleteDespejoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      try {
        await deleteDoc(doc(db, "despejos", id));
      } catch (err) {
        console.warn("Offline fallback para exclusão de ação de despejo:", err);
      }
      const local = getStoredDespejos();
      const updated = local.filter(d => d.id !== id);
      saveStoredDespejos(updated);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["despejos", variables.companyId || "default_agency"] });
      toast.success("Ação de despejo removida com sucesso.");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao excluir ação de despejo.");
    }
  });
}

export function useBrokerAdvances(agencyId: string) {
  const safeAgencyId = agencyId || "default_agency";

  return useQuery({
    queryKey: ["broker_advances", safeAgencyId],
    queryFn: async () => {
      try {
        const advRef = collection(db, "broker_advances");
        const q = query(advRef, where("agency_id", "==", safeAgencyId));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as any[];
      } catch (err) {
        console.warn("Erro ao buscar broker_advances:", err);
        return [];
      }
    },
    staleTime: 5 * 1000,
  });
}

export function useCreateBrokerAdvanceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agencyId,
      brokerId,
      brokerName,
      value,
      type,
      description,
      date
    }: {
      agencyId: string;
      brokerId: string;
      brokerName: string;
      value: number;
      type: "Adiantamento" | "Desconto" | "Acerto";
      description: string;
      date: string;
    }) => {
      // 1. Salvar na coleção broker_advances
      const advRef = collection(db, "broker_advances");
      const newDoc = {
        agency_id: agencyId,
        broker_id: brokerId,
        broker_name: brokerName,
        value,
        type,
        description,
        date,
        created_at: new Date().toISOString()
      };
      await addDoc(advRef, newDoc);

      // 2. Atualizar o campo "adiantamento" no perfil do usuário
      const userRef = doc(db, "users", brokerId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const currentAdiantamento = userData.adiantamento || 0;
        
        let diff = value;
        if (type === "Acerto") {
          diff = -value;
        }
        
        const newAdiantamento = Math.max(0, currentAdiantamento + diff);
        await updateDoc(userRef, { adiantamento: newAdiantamento });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["broker_advances", variables.agencyId] });
      queryClient.invalidateQueries({ queryKey: ["team", variables.agencyId] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao registrar operação financeira.");
    }
  });
}



