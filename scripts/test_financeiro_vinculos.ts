// Testa as regras dos vínculos automáticos do financeiro (funções puras).
// Rodar: npx tsx scripts/test_financeiro_vinculos.ts
import { planejarVenda, planejarLocacao, idVinculo } from "../src/lib/financeiro/vinculos";

let falhas = 0;
const ok = (cond: boolean, msg: string) => { console.log(`${cond ? "ok  " : "FALHA"} ${msg}`); if (!cond) falhas++; };
const soma = (l: { amount: number }[]) => Math.round(l.reduce((s, x) => s + x.amount, 0) * 100) / 100;

const venda: any = { id: "v1", sale_date: "2027-02-10", property_address: "Lote 5", client_name: "Cliente A", status: "ACTIVE",
  sale_value: 300000, commission_percentage: 5, total_commission: 15000 };
const splits: any[] = [
  { id: "s1", broker_id: "b1", broker_name: "Marcos", calculated_value: 4500, status: "PENDING", forecast_date: "2027-02-20" },
  { id: "s2", broker_id: "b2", broker_name: "Maely", calculated_value: 1500, status: "PAID", payment_date: "2027-02-15", forecast_date: "2027-02-20" },
];
const hoje = "2027-02-12";

let l = planejarVenda(venda, splits, hoje);
ok(l.filter(x => x.type === "RECEITA").length === 1 && soma(l.filter(x => x.type === "RECEITA")) === 15000, "venda à vista: 1 honorário de 15.000");
ok(l.filter(x => x.type === "DESPESA").length === 2, "uma comissão a pagar por corretor");
ok(l.find(x => x.pessoa === "Maely")!.status === "PENDENTE" && l.find(x => x.pessoa === "Marcos")!.status === "AGENDADO", "corretor pago = PENDENTE, não pago = AGENDADO");
ok(new Set(l.map(x => x.id)).size === l.length, "IDs únicos");
ok(JSON.stringify(planejarVenda(venda, splits, hoje).map(x => x.id)) === JSON.stringify(l.map(x => x.id)), "rodar de novo gera os mesmos IDs (não duplica)");

const parcelada = { ...venda, is_installment: true, entrada_value: 3000, installment_count: 4, installment_value: 3000, first_installment_date: "2027-01-31" };
l = planejarVenda(parcelada, [], hoje);
ok(soma(l) === 15000 && l.length === 5, "parcelada: entrada + 4 parcelas = 15.000, sem somar o total de novo");
ok(l.map(x => x.date).join(",") === "2027-02-10,2027-01-31,2027-02-28,2027-03-31,2027-04-30", "parcelas mensais respeitam fim de mês");

ok(planejarVenda({ ...venda, status: "CANCELLED" }, splits, hoje).length === 0, "venda cancelada não gera lançamento");
ok(planejarVenda({ ...venda, sale_date: "2026-12-31" }, splits, hoje).length === 0, "venda de 2026 fica fora do financeiro novo");

const loc: any = { id: "c1", companyId: "x", imovel: "Casa 1", inquilino: "Inq", mesReferencia: "2027-01", vencimento: "2027-01-10",
  primeiroAluguel: 1000, clientePagou: true, dataRecebimento: "2027-01-08", contaBancariaRecebimento: "conta1",
  rateio: [{ corretorId: "b1", corretorNome: "Marcos", papel: "locacao", valor: 300 }],
  pagamentosCorretores: [{ id: "p1", corretorId: "b1", corretorNome: "Marcos", tipo: "pagamento", valor: 196, data: "2027-01-09" }] };
l = planejarLocacao(loc, hoje);
ok(l.find(x => x.type === "RECEITA")!.amount === 1000 && l.find(x => x.type === "RECEITA")!.accountId === "conta1", "locação: 1º aluguel na conta de recebimento");
ok(l.find(x => x.chave === "repasse-p1")!.amount === 196, "repasse pago vira saída");
ok(l.find(x => x.chave === "a-pagar-b1")!.amount === 104, "saldo a repassar = 104");
l = planejarLocacao({ ...loc, pagamentosCorretores: [] }, hoje);
ok(!l.some(x => x.chave === "repasse-p1") && l.find(x => x.chave === "a-pagar-b1")!.amount === 300, "repasse excluído some do plano e o a pagar volta a 300");
ok(planejarLocacao({ ...loc, mesReferencia: "2026-12" }, hoje).length === 0, "locação de 2026 fica fora");
ok(idVinculo("venda", "a/b c", "x") === "fin_venda_a_b_c_x", "ID limpo para o Firestore");

console.log(falhas ? `\n${falhas} falha(s)` : "\nTudo certo");
process.exit(falhas ? 1 : 0);
