import { jsPDF } from "jspdf";
import { brl, num, pct, descricaoCurta, aluguelSeAplica, type ImovelAvaliado } from "./calculos";

type Dados = {
  imovel: ImovelAvaliado;
  resultados: any;
  investimento: any;
  empresa?: { name?: string };
  corretor?: { nome?: string; creci?: string };
  data: Date;
};

// Remove caracteres fora do Latin-1 (a fonte padrão do jsPDF não tem).
const t = (s: any) =>
  String(s ?? "")
    .replace(/[–—−]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/²/g, "2")
    .replace(/[ºª]/g, (m) => (m === "º" ? "o" : "a"))
    .replace(/[^\x00-\xFF]/g, "");

export function gerarPdfAvaliacao({ imovel, resultados, investimento, empresa, corretor, data }: Dados) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 15;
  const L = W - M * 2;
  let y = M;

  const novaPagina = () => {
    pdf.addPage();
    y = M;
  };
  const garantir = (h: number) => {
    if (y + h > 282) novaPagina();
  };
  const titulo = (s: string) => {
    if (y > M + 5) y += 4;
    garantir(14);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(15, 23, 42);
    pdf.text(t(s), M, y);
    y += 2;
    pdf.setDrawColor(37, 99, 235);
    pdf.setLineWidth(0.6);
    pdf.line(M, y, M + 30, y);
    y += 6;
  };
  const sub = (s: string) => {
    garantir(9);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(30, 41, 59);
    pdf.text(t(s), M, y);
    y += 5;
  };
  const texto = (s: string, opt: { tam?: number; cor?: [number, number, number]; negrito?: boolean } = {}) => {
    if (!s) return;
    pdf.setFont("helvetica", opt.negrito ? "bold" : "normal");
    pdf.setFontSize(opt.tam ?? 9);
    pdf.setTextColor(...(opt.cor ?? [51, 65, 85]));
    const linhas = pdf.splitTextToSize(t(s), L);
    for (const l of linhas) {
      garantir(5);
      pdf.text(l, M, y);
      y += (opt.tam ?? 9) * 0.45;
    }
    y += 1.5;
  };
  const par = (rotulo: string, valor: string) => {
    garantir(6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(t(rotulo), M, y);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(15, 23, 42);
    pdf.text(t(valor), M + 70, y);
    y += 5;
  };
  const tabela = (cab: string[], linhas: string[][], larguras: number[]) => {
    const alt = 6;
    const desenharCab = () => {
      pdf.setFillColor(241, 245, 249);
      pdf.rect(M, y - 4, L, alt, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(51, 65, 85);
      let x = M + 1;
      cab.forEach((c, i) => {
        pdf.text(t(c), x, y);
        x += larguras[i];
      });
      y += alt;
    };
    garantir(alt * 2);
    desenharCab();
    pdf.setFont("helvetica", "normal");
    for (const linha of linhas) {
      if (y + alt > 282) {
        novaPagina();
        desenharCab();
        pdf.setFont("helvetica", "normal");
      }
      pdf.setFontSize(7.5);
      pdf.setTextColor(30, 41, 59);
      let x = M + 1;
      linha.forEach((c, i) => {
        const cel = pdf.splitTextToSize(t(c), larguras[i] - 2)[0] || "";
        pdf.text(cel, x, y);
        x += larguras[i];
      });
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.2);
      pdf.line(M, y + 2, M + L, y + 2);
      y += alt;
    }
    y += 3;
  };

  const comp = resultados?.comparaveis;
  const alug = resultados?.aluguel;
  const merc = resultados?.mercado;
  const bairro = resultados?.bairro;
  const loc = resultados?.localizacao;
  const sint = resultados?.sintese;

  // ---------- Página 1: capa e resumo ----------
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, W, 38, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("Estudo de Mercado do Imóvel", M, 16);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(t(descricaoCurta(imovel)), M, 24, { maxWidth: L });
  pdf.text(
    t(`${empresa?.name || ""}${corretor?.nome ? "  |  " + corretor.nome : ""}${corretor?.creci ? "  |  CRECI " + corretor.creci : ""}  |  ${data.toLocaleDateString("pt-BR")}`),
    M,
    32
  );
  y = 50;

  if (sint?.notaFinal != null) {
    pdf.setFillColor(239, 246, 255);
    pdf.roundedRect(M, y - 6, 45, 24, 3, 3, "F");
    pdf.setTextColor(37, 99, 235);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.text(String(sint.notaFinal), M + 6, y + 9);
    pdf.setFontSize(8);
    pdf.text("NOTA DE 0 A 100", M + 6, y + 15);
  }
  const xr = M + 55;
  pdf.setTextColor(15, 23, 42);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  if (comp?.valor) {
    pdf.text(t(`Valor provável: ${brl(comp.valor.provavel)}`), xr, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(t(`Faixa: ${brl(comp.valor.minimo)} a ${brl(comp.valor.maximo)}`), xr, y + 6);
    pdf.text(t(`Base: ${comp.estatisticas.quantidade} comparáveis | confiança ${comp.confianca}`), xr, y + 12);
    if (comp.diferencaPedidoPct != null)
      pdf.text(t(`Preço pedido ${brl(imovel.precoPedido)}: ${comp.diferencaPedidoPct >= 0 ? "+" : ""}${num(comp.diferencaPedidoPct, 1)}% vs valor provável`), xr, y + 18);
  } else {
    pdf.text("Valor: sem base suficiente de comparáveis", xr, y);
  }
  y += 30;

  if (sint) {
    titulo("Resumo");
    if (sint.argumento) texto(`Argumento principal: ${sint.argumento}`, { negrito: true, cor: [15, 23, 42] });
    sub("Pontos fortes");
    (sint.forcas || []).forEach((f: string) => texto(`- ${f}`));
    sub("Riscos");
    (sint.riscos || []).forEach((f: string) => texto(`- ${f}`));
    sub("Notas por frente");
    const rot: Record<string, string> = { valor: "Valor e comparáveis", renda: "Renda de aluguel", entorno: "Bairro e entorno", investimento: "Investimento", mercado: "Mercado" };
    tabela(
      ["Frente", "Peso", "Nota"],
      Object.entries(sint.notas || {}).map(([k, v]: any) => [rot[k] || k, `${v.peso}%`, v.nota == null ? "sem dado" : String(v.nota)]),
      [60, 30, 90]
    );
    Object.entries(sint.notas || {}).forEach(([k, v]: any) => v.justificativa && texto(`${rot[k] || k}: ${v.justificativa}`, { tam: 8 }));
  }

  sub("Dados do imóvel");
  par("Tipo / endereço", descricaoCurta(imovel));
  if (imovel.areaConstruida) par("Área construída", `${num(imovel.areaConstruida)} m²`);
  if (imovel.areaTerreno) par("Área do terreno", `${num(imovel.areaTerreno)} m²`);
  if (imovel.areaHa) par("Área total", `${num(imovel.areaHa, 2)} ha`);
  if (imovel.quartos != null) par("Quartos / suítes / vagas", `${imovel.quartos ?? "-"} / ${imovel.suites ?? "-"} / ${imovel.vagas ?? "-"}`);
  if (imovel.padrao) par("Padrão / conservação", `${imovel.padrao || "-"} / ${imovel.conservacao || "-"}`);

  // ---------- Comparáveis ----------
  novaPagina();
  titulo("Comparáveis de venda");
  if (comp?.itens?.length) {
    const u = comp.unidade === "ha" ? "ha" : "m²";
    tabela(
      ["Imóvel", "Bairro", `Área (${u})`, "Preço", `R$/${u}`, "Fonte"],
      comp.itens.map((c: any) => [c.titulo, c.bairro, num(c.area, u === "ha" ? 2 : 0), brl(c.preco), brl(c.precoUnidade), c.fonte]),
      [52, 32, 18, 27, 23, 28]
    );
    // gráfico simples de barras de preço por unidade
    const itens = comp.itens.slice(0, 14);
    const max = Math.max(...itens.map((c: any) => c.precoUnidade));
    const min = Math.min(...itens.map((c: any) => c.precoUnidade));
    const piso = Math.max(0, min - (max - min) * 0.5 - max * 0.02);
    const altura = (v: number) => 8 + ((v - piso) / (max - piso || 1)) * 37;
    garantir(70);
    sub(`Preço por ${u} de cada comparável (eixo começa em ${brl(piso)})`);
    const base = y + 50;
    const largura = L / itens.length;
    itens.forEach((c: any, i: number) => {
      const h = altura(c.precoUnidade);
      pdf.setFillColor(96, 165, 250);
      pdf.rect(M + i * largura + 1, base - h, largura - 2, h, "F");
      pdf.setFontSize(6);
      pdf.setTextColor(71, 85, 105);
      pdf.text(String(i + 1), M + i * largura + largura / 2 - 1, base + 4);
    });
    if (comp.estatisticas?.mediana) {
      const hm = altura(comp.estatisticas.mediana);
      pdf.setDrawColor(220, 38, 38);
      pdf.setLineWidth(0.4);
      pdf.line(M, base - hm, M + L, base - hm);
      pdf.setFontSize(7);
      pdf.setTextColor(220, 38, 38);
      pdf.text(t(`mediana ${brl(comp.estatisticas.mediana)}/${u}`), M + L - 45, base - hm - 1.5);
    }
    y = base + 10;
    sub("Cálculo");
    par(`Média R$/${u}`, brl(comp.estatisticas.media));
    par(`Mediana R$/${u}`, brl(comp.estatisticas.mediana));
    par("Fator de oferta", `${comp.fatorOferta.percentual}% - ${comp.fatorOferta.motivo || ""}`);
    (comp.ajustes || []).forEach((a: any) => par(`Ajuste: ${a.fator}`, `${a.percentual > 0 ? "+" : ""}${a.percentual}% - ${a.motivo}`));
    if (comp.valor) texto(comp.valor.calculo, { tam: 8 });
  } else {
    texto("Nenhum comparável válido foi encontrado.");
  }
  if (comp?.limitacoes) texto(`Limitações: ${comp.limitacoes}`, { tam: 8, cor: [180, 83, 9] });

  // ---------- Aluguel e investimento ----------
  novaPagina();
  titulo("Aluguel");
  if (!aluguelSeAplica(imovel.tipo)) texto("Não se aplica a este tipo de imóvel.");
  else if (alug?.itens?.length) {
    tabela(
      ["Imóvel", "Bairro", "Área", "Aluguel", "Cond.", "Fonte"],
      alug.itens.map((c: any) => [c.titulo, c.bairro, num(c.area), brl(c.aluguel), brl(c.condominio), c.fonte]),
      [55, 35, 15, 25, 22, 28]
    );
    if (alug.estimativa) {
      par("Aluguel estimado", `${brl(alug.estimativa.provavel)} (faixa ${brl(alug.estimativa.minimo)} a ${brl(alug.estimativa.maximo)})`);
      texto(alug.estimativa.calculo, { tam: 8 });
    }
    if (alug.limitacoes) texto(`Limitações: ${alug.limitacoes}`, { tam: 8, cor: [180, 83, 9] });
  } else texto("Nenhum anúncio de aluguel válido encontrado.");

  titulo("Investimento (simulação)");
  if (investimento) {
    const i = investimento;
    par("Preço considerado", brl(i.preco));
    par("ITBI", brl(i.itbi));
    par("Escritura e registro (estimativa)", brl(i.cartorio));
    par("Custo total de aquisição", brl(i.custoAquisicao));
    sub("Financiamento SAC");
    par("Entrada", brl(i.financiamento.entrada));
    par("Valor financiado", brl(i.financiamento.financiado));
    par("Taxa / prazo", `${num(i.financiamento.taxaAnualPct, 2)}% a.a. / ${i.financiamento.n} meses`);
    par("1ª parcela / última parcela", `${brl(i.financiamento.primeiraParcela)} / ${brl(i.financiamento.ultimaParcela)}`);
    par("Total de juros", brl(i.financiamento.totalJuros));
    if (i.renda) {
      sub("Renda");
      par("Rentabilidade bruta", pct(i.renda.brutaPct, 2) + " a.a.");
      par("Rentabilidade líquida", pct(i.renda.liquidaPct, 2) + " a.a.");
      if (i.renda.selicPct != null) par("Selic atual", pct(i.renda.selicPct, 2) + ` (${i.renda.comparacao})`);
    }
    if (i.revenda3a) {
      sub("Revenda em 3 anos");
      par("Valorização usada", `${pct(i.revenda3a.valorizacaoAnualPct, 2)} a.a. (${i.revenda3a.origem})`);
      par("Valor projetado", brl(i.revenda3a.valor3a));
    }
    texto("Taxa de juros, cartório e entrada são parâmetros da simulação e devem ser confirmados com o banco e o cartório.", { tam: 8, cor: [100, 116, 139] });
  } else texto("Sem preço base para simular.");

  // ---------- Entorno ----------
  novaPagina();
  titulo("Bairro e entorno");
  if (loc?.encontrado) {
    texto(`Localização encontrada (${loc.precisao}): ${loc.enderecoEncontrado}`, { tam: 8 });
    if (loc.entorno) {
      tabela(
        ["Categoria", "Até 500 m", "Até 1 km", "Até 2 km", "Mais próximo"],
        loc.entorno.map((c: any) => [c.rotulo, String(c.ate500m), String(c.ate1km), String(c.ate2km), c.maisProximos[0] ? `${c.maisProximos[0].nome} (${num(c.maisProximos[0].distanciaM)} m)` : "-"]),
        [45, 18, 18, 18, 81]
      );
      texto(loc.fonteEntorno, { tam: 7.5, cor: [100, 116, 139] });
    }
  } else texto("Endereço não localizado no mapa.");
  const blocoNoticias = (rot: string, lista: any[]) => {
    if (!lista?.length) return;
    sub(rot);
    lista.forEach((n) => texto(`- ${n.titulo}${n.data ? " (" + n.data + ")" : ""}: ${n.resumo || ""}`, { tam: 8.5 }));
  };
  blocoNoticias("Segurança", bairro?.seguranca);
  blocoNoticias("Infraestrutura e obras", bairro?.infraestrutura);
  blocoNoticias("Vetores de crescimento", bairro?.crescimento);
  blocoNoticias("Pontos de atenção", bairro?.negativos);
  if (bairro?.limitacoes) texto(`Limitações: ${bairro.limitacoes}`, { tam: 8, cor: [180, 83, 9] });

  // ---------- Mercado ----------
  titulo("Mercado");
  if (merc) {
    par("Classificação", `${merc.classificacao}${merc.motivoClassificacao ? " - " + merc.motivoClassificacao : ""}`);
    if (merc.estoque) par("Estoque de ofertas", `${num(merc.estoque.quantidade)} anúncios (${merc.estoque.portal})`);
    if (merc.fipezap) par(`FipeZap ${merc.fipezap.local}`, `venda ${pct(merc.fipezap.venda12m, 2)} em 12m (${merc.fipezap.periodo})`);
    if (merc.itbi) par("ITBI do município", pct(merc.itbi.aliquotaPct, 2));
    blocoNoticias("Notícias do mercado local", merc.noticias);
  }
  const ind = loc?.indicadores;
  if (ind?.selic) par("Selic meta", `${pct(ind.selic.valor, 2)} (${ind.selic.data}, Banco Central)`);
  if (ind?.ipca12m) par("IPCA 12 meses", `${pct(ind.ipca12m.valor, 2)} (${ind.ipca12m.data}, Banco Central)`);

  // ---------- Metodologia e fontes ----------
  novaPagina();
  titulo("Metodologia e fontes");
  texto(
    "Comparáveis e aluguéis foram levantados por busca na internet em portais imobiliários. Só entram itens com link de origem aberto na pesquisa; itens sem preço, sem área ou fora da curva (regra do intervalo interquartil) são descartados. O valor provável usa a mediana do preço por unidade, aplica o fator de oferta (diferença entre preço anunciado e preço fechado) e os ajustes listados. A faixa usa o 1º e o 3º quartil. Equipamentos próximos vêm do OpenStreetMap; Selic e IPCA da API oficial do Banco Central."
  );
  sub("Links");
  const links: { rot: string; url: string }[] = [];
  comp?.itens?.forEach((c: any, i: number) => links.push({ rot: `Comparável ${i + 1}`, url: c.url }));
  alug?.itens?.forEach((c: any, i: number) => links.push({ rot: `Aluguel ${i + 1}`, url: c.url }));
  if (merc?.itbi?.url) links.push({ rot: "ITBI", url: merc.itbi.url });
  if (merc?.fipezap?.url) links.push({ rot: "FipeZap", url: merc.fipezap.url });
  if (merc?.estoque?.url) links.push({ rot: "Estoque", url: merc.estoque.url });
  [...(merc?.noticias || []), ...(bairro?.seguranca || []), ...(bairro?.infraestrutura || []), ...(bairro?.crescimento || []), ...(bairro?.negativos || [])].forEach((n: any) =>
    links.push({ rot: "Notícia", url: n.url })
  );
  links.forEach((l) => {
    garantir(5);
    pdf.setFontSize(7);
    pdf.setTextColor(37, 99, 235);
    const s = t(`${l.rot}: ${l.url}`);
    pdf.textWithLink(pdf.splitTextToSize(s, L)[0], M, y, { url: l.url });
    y += 4;
  });
  y += 4;
  texto(
    "Estudo de mercado para apoio à negociação. Não é laudo de avaliação (NBR 14653) nem PTAM, e não é recomendação de investimento. Os dados de anúncios refletem preços pedidos na data da pesquisa.",
    { tam: 8, cor: [100, 116, 139] }
  );

  // numeração
  const total = pdf.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.setFontSize(7);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`${p}/${total}`, W - M, 292, { align: "right" });
  }

  const nomeBairro = (imovel.bairro || imovel.cidade || "imovel").normalize("NFD").replace(/[^\w]+/g, "-");
  pdf.save(`ESTUDO-${nomeBairro}-${data.toISOString().slice(0, 10)}.pdf`);
}
