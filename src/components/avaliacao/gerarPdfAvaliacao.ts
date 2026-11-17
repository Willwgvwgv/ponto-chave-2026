// Relatório da avaliação para levar ao proprietário: até 2 páginas, com logo,
// corretor e só o que sustenta a conversa de preço. Gera uma página HTML e abre
// a impressão do navegador ("Salvar como PDF"), no mesmo padrão do Simulador.
import { brl, num, pct, descricaoCurta, aluguelSeAplica, type ImovelAvaliado } from "./calculos";

type Dados = {
  imovel: ImovelAvaliado;
  resultados: any;
  investimento: any;
  empresa?: { name?: string; logoUrl?: string; creci?: string; phone?: string; city?: string };
  corretor?: { nome?: string; creci?: string };
  data: Date;
};

const esc = (s: any) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const urlSegura = (u: any) => (typeof u === "string" && /^https?:\/\//i.test(u) ? esc(u) : "");

export function montarHtmlAvaliacao({ imovel, resultados, investimento, empresa, corretor, data }: Dados): string {
  const comp = resultados?.comparaveis;
  const alug = resultados?.aluguel;
  const merc = resultados?.mercado;
  const loc = resultados?.localizacao;
  const sint = resultados?.sintese;
  const u = comp?.unidade === "ha" ? "ha" : "m²";
  const azul = "#0f3a6b";

  const logo = empresa?.logoUrl
    ? `<img src="${urlSegura(empresa.logoUrl)}" alt="Logo" style="max-height:46px;max-width:180px;object-fit:contain" referrerpolicy="no-referrer" />`
    : `<div style="border:2px solid ${azul};color:${azul};font-weight:900;padding:6px 12px;border-radius:6px;letter-spacing:.05em">FIDELITÉ</div>`;

  const nomeCorretor = (corretor?.nome || "").trim();
  const creci = (corretor?.creci || "").trim();

  // ---------- números principais ----------
  const valor = comp?.valor;
  const dif = comp?.diferencaPedidoPct;
  const corDif = dif == null ? "#334155" : dif > 5 ? "#b91c1c" : dif < -5 ? "#047857" : "#334155";
  const textoDif = dif == null ? "" : `${dif >= 0 ? "+" : ""}${num(dif, 1)}% ${dif >= 0 ? "acima" : "abaixo"} do valor provável`;

  const caixa = (rotulo: string, valorTxt: string, sub = "") => `
    <div class="caixa"><div class="rot">${rotulo}</div><div class="val">${valorTxt}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;

  const caixas: string[] = [];
  caixas.push(caixa("Valor provável", valor ? brl(valor.provavel) : "sem base", valor ? `faixa ${brl(valor.minimo)} a ${brl(valor.maximo)}` : ""));
  if (imovel.precoPedido) caixas.push(caixa("Preço pedido", brl(imovel.precoPedido), `<span style="color:${corDif};font-weight:700">${textoDif}</span>`));
  caixas.push(caixa(`Mediana R$/${u}`, brl(comp?.estatisticas?.mediana), `${comp?.estatisticas?.quantidade ?? 0} imóveis comparados`));
  if (aluguelSeAplica(imovel.tipo) && alug?.estimativa)
    caixas.push(caixa("Aluguel estimado", brl(alug.estimativa.provavel), investimento?.renda ? `${pct(investimento.renda.liquidaPct, 1)} a.a. líquido` : ""));

  const lista = (itens: string[]) => (itens?.length ? `<ul>${itens.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="vazio">-</p>`);

  // ---------- comparáveis (até 10) ----------
  const itens = (comp?.itens || []).slice(0, 10);
  const linhasComp = itens
    .map(
      (c: any, i: number) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(c.titulo)}${c.bairro ? `<span class="cinza"> · ${esc(c.bairro)}</span>` : ""}</td>
        <td class="d">${num(c.area, u === "ha" ? 2 : 0)}</td>
        <td class="d">${brl(c.preco)}</td>
        <td class="d"><b>${brl(c.precoUnidade)}</b></td>
        <td style="white-space:nowrap">${urlSegura(c.url) ? `<a href="${urlSegura(c.url)}">${esc(c.fonte || "ver")}</a>` : esc(c.fonte)}</td>
      </tr>`
    )
    .join("");

  // ---------- entorno: só o que existe perto ----------
  const entorno = (loc?.entorno || [])
    .filter((c: any) => c.ate2km > 0)
    .map((c: any) => {
      const p = c.maisProximos?.[0];
      return `<tr><td>${esc(c.rotulo)}</td><td class="d">${c.ate1km}</td><td>${p ? `${esc(p.nome)} (${num(p.distanciaM)} m)` : "-"}</td></tr>`;
    })
    .join("");

  // ---------- mercado em poucas linhas ----------
  const mercado: string[] = [];
  if (merc?.classificacao && merc.classificacao !== "sem base")
    mercado.push(`Mercado <b>${esc(merc.classificacao)}</b>${merc.motivoClassificacao ? `: ${esc(merc.motivoClassificacao)}` : ""}`);
  if (merc?.estoque?.quantidade != null) mercado.push(`${num(merc.estoque.quantidade)} anúncios parecidos ativos (${esc(merc.estoque.portal)})`);
  if (merc?.fipezap?.venda12m != null) mercado.push(`FipeZap ${esc(merc.fipezap.local)}: ${pct(merc.fipezap.venda12m, 1)} em 12 meses`);
  const selic = loc?.indicadores?.selic?.valor;
  if (selic != null) mercado.push(`Selic ${pct(selic, 2)} (Banco Central)`);

  const enderecoTxt = [imovel.endereco, imovel.bairro, imovel.cidade && `${imovel.cidade}${imovel.uf ? "/" + imovel.uf : ""}`].filter(Boolean).join(", ");
  const caracteristicas = [
    imovel.areaConstruida && `${num(imovel.areaConstruida)} m² construídos`,
    imovel.areaTerreno && `terreno ${num(imovel.areaTerreno)} m²`,
    imovel.areaHa && `${num(imovel.areaHa, 2)} ha`,
    imovel.quartos != null && `${imovel.quartos} quartos`,
    imovel.suites && `${imovel.suites} suíte(s)`,
    imovel.vagas != null && `${imovel.vagas} vaga(s)`,
    imovel.padrao && `padrão ${imovel.padrao}`,
    imovel.conservacao && `conservação: ${imovel.conservacao}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Estudo de mercado - ${esc(imovel.bairro || imovel.cidade || "imóvel")}</title>
<style>
  @page { size: A4; margin: 14mm 14mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; font-size: 9.5pt; line-height: 1.45; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${azul}; padding-bottom: 8px; }
  header .dir { text-align: right; font-size: 8.5pt; color: #475569; }
  header .dir b { color: #0f172a; font-size: 10pt; }
  h1 { font-size: 15pt; color: ${azul}; margin: 14px 0 2px; }
  h2 { font-size: 10pt; color: ${azul}; text-transform: uppercase; letter-spacing: .04em; margin: 16px 0 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
  .end { color: #334155; margin: 0; }
  .carac { color: #64748b; font-size: 8.5pt; margin: 2px 0 0; }
  .caixas { display: grid; grid-template-columns: repeat(${caixas.length}, 1fr); gap: 8px; margin-top: 12px; }
  .caixa { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }
  .caixa:first-child { border-color: ${azul}; background: #f1f5fb; }
  .rot { font-size: 7.5pt; text-transform: uppercase; color: #64748b; letter-spacing: .04em; }
  .val { font-size: 14pt; font-weight: 800; margin-top: 2px; }
  .sub { font-size: 8pt; color: #475569; }
  .argumento { margin-top: 12px; padding: 8px 12px; border-left: 3px solid ${azul}; background: #f8fafc; font-size: 10pt; }
  .duas { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  ul { margin: 0; padding-left: 16px; } li { margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { text-align: left; font-size: 7.5pt; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #cbd5e1; padding: 4px 5px; }
  td { padding: 4px 5px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
  .d { text-align: right; white-space: nowrap; }
  .cinza { color: #94a3b8; }
  a { color: #1d4ed8; text-decoration: none; }
  .nota { font-size: 7.5pt; color: #64748b; margin-top: 4px; }
  .vazio { color: #94a3b8; }
  .quebra { break-before: page; }
  footer { margin-top: 18px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 7.5pt; color: #64748b; }
  .ass { margin-top: 30px; text-align: center; font-size: 9pt; }
  .ass .linha { width: 260px; margin: 0 auto 4px; border-top: 1px solid #0f172a; }
</style></head><body>

<header>
  ${logo}
  <div class="dir">
    ${nomeCorretor ? `<b>${esc(nomeCorretor)}</b><br>` : ""}
    ${creci ? `Corretor de imóveis · CRECI ${esc(creci)}<br>` : ""}
    ${esc(empresa?.name || "Fidelité Negócios Imobiliários")}${empresa?.phone ? ` · ${esc(empresa.phone)}` : ""}<br>
    ${data.toLocaleDateString("pt-BR")}
  </div>
</header>

<h1>Estudo de mercado do imóvel</h1>
<p class="end"><b>${esc(descricaoCurta(imovel).split(" - ")[0])}</b> · ${esc(enderecoTxt)}</p>
${caracteristicas ? `<p class="carac">${esc(caracteristicas)}</p>` : ""}

<div class="caixas">${caixas.join("")}</div>

${sint?.argumento ? `<div class="argumento">${esc(sint.argumento)}</div>` : ""}

${sint ? `<div class="duas">
  <div><h2>Pontos fortes</h2>${lista(sint.forcas)}</div>
  <div><h2>Pontos de atenção</h2>${lista(sint.riscos)}</div>
</div>` : ""}

${entorno ? `<h2>O que tem perto</h2>
<table><thead><tr><th>Categoria</th><th class="d">Até 1 km</th><th>Mais próximo</th></tr></thead><tbody>${entorno}</tbody></table>
<p class="nota">Distâncias em linha reta, pelo OpenStreetMap. Em cidades menores o mapa pode não ter todos os estabelecimentos.</p>` : ""}

${mercado.length ? `<h2>Mercado</h2><ul>${mercado.map((m) => `<li>${m}</li>`).join("")}</ul>` : ""}

${itens.length ? `<div class="quebra"></div>
<h2>Imóveis comparados</h2>
<table><thead><tr><th>#</th><th>Imóvel</th><th class="d">Área (${u})</th><th class="d">Preço</th><th class="d">R$/${u}</th><th>Fonte</th></tr></thead><tbody>${linhasComp}</tbody></table>
<p class="nota">Preços anunciados nos portais na data da pesquisa.${
    comp?.valor
      ? ` Valor provável = mediana do R$/${u} × área do imóvel, com desconto de ${comp.fatorOferta?.percentual ?? 0}% entre preço anunciado e preço fechado${comp.ajusteTotal ? ` e ajuste de ${comp.ajusteTotal > 0 ? "+" : ""}${comp.ajusteTotal}% pelas diferenças do imóvel` : ""}.`
      : ""
  }</p>` : ""}

<div class="ass"><div class="linha"></div>${esc(nomeCorretor || "Corretor responsável")}${creci ? ` · CRECI ${esc(creci)}` : ""}</div>

<footer>Estudo de mercado para apoio à negociação, feito com anúncios públicos e dados oficiais. Não é laudo de avaliação (NBR 14653) nem PTAM.</footer>

</body></html>`;
}

export function gerarPdfAvaliacao(dados: Dados) {
  const janela = window.open("", "_blank", "width=900,height=1100");
  if (!janela) throw new Error("O navegador bloqueou a janela do PDF. Permita pop-ups para o Ponto Chave.");
  janela.document.open();
  janela.document.write(montarHtmlAvaliacao(dados));
  janela.document.close();
  let feito = false;
  const imprimir = () => {
    if (feito) return;
    feito = true;
    janela.focus();
    janela.print();
  };
  // espera a logo carregar antes de abrir a impressão
  const img = janela.document.querySelector("img") as HTMLImageElement | null;
  if (img && !img.complete) {
    img.addEventListener("load", imprimir);
    img.addEventListener("error", imprimir);
    setTimeout(imprimir, 4000);
  } else {
    setTimeout(imprimir, 300);
  }
}
