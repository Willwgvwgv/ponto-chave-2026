// Avaliação de imóvel — pesquisa com IA + busca web real.
// Cada "frente" é uma chamada separada, para o navegador rodar todas em paralelo
// e cada uma caber no tempo limite da função.
//
// Regra central: nenhum link, preço ou dado entra no resultado se não tiver vindo
// de uma página que a busca realmente abriu. Os cálculos (preço/m², faixa de valor,
// aluguel estimado) são feitos aqui no servidor, não pela IA.
import { autenticar, chamarIA, extrairJson, numero, quantil, media, urlVerificada, type FonteWeb } from "./_comum.js";

type Imovel = {
  tipo: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  areaConstruida?: number | null;
  areaTerreno?: number | null;
  areaHa?: number | null;
  quartos?: number | null;
  suites?: number | null;
  vagas?: number | null;
  padrao?: string;
  conservacao?: string;
  idade?: number | null;
  precoPedido?: number | null;
  linkAnuncio?: string;
  observacoes?: string;
};

const TIPOS: Record<string, string> = {
  apartamento: "apartamento",
  casa: "casa",
  lote: "lote urbano",
  lote_condominio: "lote em condomínio fechado",
  rural: "imóvel rural (chácara, sítio ou fazenda)",
  comercial: "imóvel comercial (sala, loja ou galpão)",
};

function unidadeDe(im: Imovel): { unidade: "m²" | "ha"; area: number | null; descricao: string } {
  if (im.tipo === "rural") return { unidade: "ha", area: numero(im.areaHa), descricao: "hectares de área total" };
  if (im.tipo === "lote" || im.tipo === "lote_condominio")
    return { unidade: "m²", area: numero(im.areaTerreno), descricao: "m² de terreno" };
  const ac = numero(im.areaConstruida);
  if (ac) return { unidade: "m²", area: ac, descricao: "m² de área construída (ou área útil, em apartamento)" };
  return { unidade: "m²", area: numero(im.areaTerreno), descricao: "m² de terreno" };
}

function descreverImovel(im: Imovel) {
  const u = unidadeDe(im);
  const linhas = [
    `Tipo: ${TIPOS[im.tipo] || im.tipo}`,
    `Endereço: ${[im.endereco, im.bairro, im.cidade, im.uf].filter(Boolean).join(", ") || "não informado"}`,
    im.areaConstruida ? `Área construída/útil: ${im.areaConstruida} m²` : null,
    im.areaTerreno ? `Área do terreno: ${im.areaTerreno} m²` : null,
    im.areaHa ? `Área total: ${im.areaHa} ha` : null,
    im.quartos != null ? `Quartos: ${im.quartos}` : null,
    im.suites != null ? `Suítes: ${im.suites}` : null,
    im.vagas != null ? `Vagas: ${im.vagas}` : null,
    im.padrao ? `Padrão de acabamento: ${im.padrao}` : null,
    im.conservacao ? `Conservação: ${im.conservacao}` : null,
    im.idade != null ? `Idade aproximada: ${im.idade} anos` : null,
    im.precoPedido ? `Preço pedido pelo proprietário: R$ ${im.precoPedido}` : null,
    im.linkAnuncio ? `Anúncio do próprio imóvel: ${im.linkAnuncio}` : null,
    im.observacoes ? `Observações do corretor: ${im.observacoes}` : null,
    `Unidade de comparação: ${u.unidade} (${u.descricao})`,
  ];
  return linhas.filter(Boolean).join("\n");
}

const REGRAS = `REGRAS OBRIGATÓRIAS
- Trabalhe só com o que você encontrou nas páginas da busca. Não use memória, não estime, não complete lacunas.
- Todo item precisa do campo "url" copiado exatamente da página de onde o dado saiu. Item sem página de origem não entra.
- Se um dado não aparece na página (área, preço, data), deixe null. Item sem preço ou sem área deve ser omitido.
- Não arredonde nem "melhore" números. Copie como estão no anúncio.
- Se encontrar pouca coisa, devolva pouca coisa e explique em "limitacoes". Isso é melhor que inventar.
- Escreva em português do Brasil, texto direto, sem adjetivos promocionais.
- Responda com o JSON entre <json> e </json>, sem nada depois.`;

function hoje() {
  return new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// ---------- Frente 1: comparáveis de venda ----------
async function frenteComparaveis(im: Imovel) {
  const u = unidadeDe(im);
  const prompt = `Você é um analista de mercado imobiliário no Brasil. Hoje é ${hoje()}.
Encontre imóveis à venda (ou vendidos) parecidos com o imóvel abaixo, na mesma região, para um estudo de preço.

IMÓVEL AVALIADO
${descreverImovel(im)}

COMO BUSCAR
- Portais: ZAP Imóveis, Viva Real, OLX, Imovelweb, Chaves na Mão, Mercado Livre Imóveis e sites de imobiliárias da cidade.
- Comece pelo mesmo bairro/loteamento; se tiver menos de 6, amplie para bairros vizinhos e diga isso em "limitacoes".
- Mesmo tipo de imóvel. Área entre 60% e 150% da área do imóvel avaliado, quando a área dele for conhecida.
- Objetivo: de 8 a 12 imóveis.
- A área de cada comparável deve estar na mesma unidade: ${u.unidade} (${u.descricao}). Se for rural e o anúncio estiver em alqueires goianos, converta (1 alqueire goiano = 4,84 ha) e diga em "obs".

DEPOIS DE LEVANTAR
- "fator_oferta_pct": desconto típico entre preço anunciado e preço fechado para esse tipo de imóvel e região, de 0 a 20. Use 10 se não houver base, e diga isso.
- "ajustes": diferenças do imóvel avaliado em relação à média dos comparáveis (padrão, conservação, vagas, esquina, infraestrutura etc.). Cada um com percentual entre -15 e 15 e motivo concreto. Lista vazia se não houver diferença clara.

${REGRAS}

FORMATO
<json>
{
  "comparaveis": [
    {"titulo": "", "bairro": "", "area": 0, "quartos": null, "vagas": null, "preco": 0, "situacao": "anunciado|vendido", "data": null, "url": "", "fonte": "nome do portal", "obs": ""}
  ],
  "fator_oferta_pct": 10,
  "fator_oferta_motivo": "",
  "ajustes": [{"fator": "", "percentual": 0, "motivo": ""}],
  "limitacoes": ""
}
</json>`;

  const { texto, fontes } = await chamarIA({ prompt, usarBusca: true, maxBuscas: 8, cidade: im.cidade, uf: im.uf });
  const bruto = extrairJson(texto);

  const descartados: { titulo: string; motivo: string }[] = [];
  let itens = (Array.isArray(bruto.comparaveis) ? bruto.comparaveis : [])
    .map((c: any) => {
      const url = urlVerificada(c.url, fontes);
      const area = numero(c.area);
      const preco = numero(c.preco);
      const titulo = String(c.titulo || c.bairro || "sem título");
      if (!url) {
        descartados.push({ titulo, motivo: "link não veio de uma página aberta na busca" });
        return null;
      }
      if (!area || area <= 0 || !preco || preco <= 0) {
        descartados.push({ titulo, motivo: "sem preço ou sem área" });
        return null;
      }
      return {
        titulo,
        bairro: c.bairro || "",
        area,
        quartos: numero(c.quartos),
        vagas: numero(c.vagas),
        preco,
        precoUnidade: preco / area,
        situacao: c.situacao === "vendido" ? "vendido" : "anunciado",
        data: c.data || null,
        url,
        fonte: c.fonte || "",
        obs: c.obs || "",
      };
    })
    .filter(Boolean) as any[];

  // remove duplicados (mesmo link + mesmo preço)
  const vistos = new Set<string>();
  itens = itens.filter((c) => {
    const k = `${c.url}|${c.preco}|${c.area}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  // remove valores fora da curva (regra do intervalo interquartil) quando há base.
  // A margem nunca é menor que 25% da mediana: com preços muito parecidos o
  // intervalo fica estreito demais e descartaria imóveis normais.
  if (itens.length >= 5) {
    const unit = itens.map((c) => c.precoUnidade);
    const q1 = quantil(unit, 0.25)!;
    const q3 = quantil(unit, 0.75)!;
    const margem = Math.max(1.5 * (q3 - q1), 0.25 * quantil(unit, 0.5)!);
    const lim = [q1 - margem, q3 + margem];
    itens = itens.filter((c) => {
      const ok = c.precoUnidade >= lim[0] && c.precoUnidade <= lim[1];
      if (!ok) descartados.push({ titulo: c.titulo, motivo: `preço por ${unidadeDe(im).unidade} fora da curva dos demais` });
      return ok;
    });
  }

  const unitarios = itens.map((c) => c.precoUnidade);
  const n = itens.length;
  const fator = Math.min(20, Math.max(0, numero(bruto.fator_oferta_pct) ?? 10));
  const ajustes = (Array.isArray(bruto.ajustes) ? bruto.ajustes : [])
    .map((a: any) => ({ fator: String(a.fator || ""), percentual: Math.min(15, Math.max(-15, numero(a.percentual) ?? 0)), motivo: String(a.motivo || "") }))
    .filter((a: any) => a.fator && a.percentual !== 0);
  const ajusteTotal = Math.min(25, Math.max(-25, ajustes.reduce((s: number, a: any) => s + a.percentual, 0)));

  const estat = {
    quantidade: n,
    media: media(unitarios),
    mediana: quantil(unitarios, 0.5),
    p25: quantil(unitarios, 0.25),
    p75: quantil(unitarios, 0.75),
  };

  let valor: any = null;
  const area = u.area;
  if (n >= 3 && area && estat.mediana) {
    const k = area * (1 - fator / 100) * (1 + ajusteTotal / 100);
    valor = {
      minimo: estat.p25! * k,
      provavel: estat.mediana * k,
      maximo: estat.p75! * k,
      calculo: `mediana de R$ ${estat.mediana.toFixed(2)}/${u.unidade} × ${area} ${u.unidade} − ${fator}% (oferta) ${ajusteTotal >= 0 ? "+" : "−"} ${Math.abs(ajusteTotal)}% (ajustes). Faixa usa o 1º e o 3º quartil.`,
    };
  }

  const confianca = n >= 8 ? "alta" : n >= 5 ? "média" : n >= 3 ? "baixa" : "insuficiente";
  const precoPedido = numero(im.precoPedido);
  const diferencaPedido = valor && precoPedido ? ((precoPedido - valor.provavel) / valor.provavel) * 100 : null;

  return {
    unidade: u.unidade,
    areaAvaliada: area,
    itens,
    descartados,
    estatisticas: estat,
    fatorOferta: { percentual: fator, motivo: bruto.fator_oferta_motivo || "" },
    ajustes,
    ajusteTotal,
    valor,
    confianca,
    diferencaPedidoPct: diferencaPedido,
    limitacoes: [bruto.limitacoes, !area ? "Área do imóvel não informada: não dá para calcular o valor, só o preço por unidade da região." : null, n < 3 ? "Menos de 3 comparáveis válidos: não há base para faixa de valor." : null]
      .filter(Boolean)
      .join(" "),
    fontes,
  };
}

// ---------- Frente 2: aluguel ----------
async function frenteAluguel(im: Imovel) {
  const u = unidadeDe(im);
  const prompt = `Você é um analista de locação no Brasil. Hoje é ${hoje()}.
Encontre imóveis PARA ALUGAR parecidos com o imóvel abaixo, na mesma região.

IMÓVEL AVALIADO
${descreverImovel(im)}

COMO BUSCAR
- Portais: ZAP Imóveis, Viva Real, OLX, Imovelweb, Chaves na Mão, QuintoAndar e imobiliárias da cidade.
- Mesmo tipo, mesmo bairro primeiro; amplie para vizinhos se necessário e diga em "limitacoes".
- Objetivo: de 6 a 10 imóveis. Área na unidade ${u.unidade}.
- "aluguel" é só o valor do aluguel mensal; condomínio e IPTU em campos separados quando o anúncio mostrar.

${REGRAS}

FORMATO
<json>
{
  "alugueis": [
    {"titulo": "", "bairro": "", "area": null, "quartos": null, "aluguel": 0, "condominio": null, "iptu": null, "url": "", "fonte": "", "obs": ""}
  ],
  "limitacoes": ""
}
</json>`;

  const { texto, fontes } = await chamarIA({ prompt, usarBusca: true, maxBuscas: 6, cidade: im.cidade, uf: im.uf });
  const bruto = extrairJson(texto);
  const descartados: { titulo: string; motivo: string }[] = [];
  const itens = (Array.isArray(bruto.alugueis) ? bruto.alugueis : [])
    .map((c: any) => {
      const url = urlVerificada(c.url, fontes);
      const aluguel = numero(c.aluguel);
      const titulo = String(c.titulo || c.bairro || "sem título");
      if (!url) {
        descartados.push({ titulo, motivo: "link não veio de uma página aberta na busca" });
        return null;
      }
      if (!aluguel || aluguel <= 0) {
        descartados.push({ titulo, motivo: "sem valor de aluguel" });
        return null;
      }
      const area = numero(c.area);
      return {
        titulo,
        bairro: c.bairro || "",
        area,
        quartos: numero(c.quartos),
        aluguel,
        aluguelUnidade: area ? aluguel / area : null,
        condominio: numero(c.condominio),
        iptu: numero(c.iptu),
        url,
        fonte: c.fonte || "",
        obs: c.obs || "",
      };
    })
    .filter(Boolean) as any[];

  const comArea = itens.filter((c) => c.aluguelUnidade);
  const area = u.area;
  let estimativa: any = null;
  if (area && comArea.length >= 3) {
    const un = comArea.map((c) => c.aluguelUnidade);
    estimativa = {
      minimo: quantil(un, 0.25)! * area,
      provavel: quantil(un, 0.5)! * area,
      maximo: quantil(un, 0.75)! * area,
      calculo: `mediana do aluguel por ${u.unidade} (${comArea.length} anúncios com área) × ${area} ${u.unidade}`,
    };
  } else if (itens.length >= 3) {
    const v = itens.map((c) => c.aluguel);
    estimativa = {
      minimo: quantil(v, 0.25),
      provavel: quantil(v, 0.5),
      maximo: quantil(v, 0.75),
      calculo: `mediana direta dos aluguéis (${itens.length} anúncios), sem ajuste por área`,
    };
  }

  return {
    unidade: u.unidade,
    itens,
    descartados,
    estimativa,
    confianca: itens.length >= 6 ? "média" : itens.length >= 3 ? "baixa" : "insuficiente",
    limitacoes: [bruto.limitacoes, itens.length < 3 ? "Menos de 3 anúncios de aluguel válidos: sem base para estimar." : null].filter(Boolean).join(" "),
    fontes,
  };
}

// ---------- Frente 3: mercado ----------
async function frenteMercado(im: Imovel) {
  const prompt = `Você é um analista de mercado imobiliário no Brasil. Hoje é ${hoje()}.
Levante a situação do mercado para o imóvel abaixo.

IMÓVEL AVALIADO
${descreverImovel(im)}

O QUE LEVANTAR
1. ITBI: alíquota vigente do município de ${im.cidade || "(cidade não informada)"}, de lei, site da prefeitura ou fonte confiável. Se não achar, null.
2. Índice FipeZap (venda e, se houver, locação) da cidade ou da capital mais próxima: variação em 12 meses e período de referência.
3. Estoque: quantos anúncios ativos de imóveis do mesmo tipo existem na cidade/bairro em um portal (o número que o portal mostra no topo da busca). Diga qual portal e qual filtro.
4. Notícias recentes (últimos 12 meses) sobre o mercado imobiliário local: lançamentos, loteamentos novos, financiamento, MCMV na cidade.
5. Classificação do mercado para esse tipo de imóvel: "comprador", "equilibrado", "vendedor" ou "sem base", com o motivo baseado no que encontrou.

${REGRAS}

FORMATO
<json>
{
  "itbi": {"aliquota_pct": null, "url": null, "obs": ""},
  "fipezap": {"local": "", "venda_12m_pct": null, "locacao_12m_pct": null, "periodo": "", "url": null},
  "estoque": {"quantidade": null, "portal": "", "filtro": "", "url": null},
  "noticias": [{"titulo": "", "data": null, "resumo": "", "url": ""}],
  "classificacao": "sem base",
  "motivo_classificacao": "",
  "limitacoes": ""
}
</json>`;

  const { texto, fontes } = await chamarIA({ prompt, usarBusca: true, maxBuscas: 6, cidade: im.cidade, uf: im.uf });
  const b = extrairJson(texto);

  const itbiUrl = urlVerificada(b.itbi?.url, fontes);
  const fipeUrl = urlVerificada(b.fipezap?.url, fontes);
  const estoqueUrl = urlVerificada(b.estoque?.url, fontes);
  const noticias = (Array.isArray(b.noticias) ? b.noticias : [])
    .map((n: any) => ({ ...n, url: urlVerificada(n.url, fontes) }))
    .filter((n: any) => n.url && n.titulo);

  return {
    itbi: itbiUrl ? { aliquotaPct: numero(b.itbi.aliquota_pct), url: itbiUrl, obs: b.itbi.obs || "" } : null,
    fipezap: fipeUrl
      ? { local: b.fipezap.local || "", venda12m: numero(b.fipezap.venda_12m_pct), locacao12m: numero(b.fipezap.locacao_12m_pct), periodo: b.fipezap.periodo || "", url: fipeUrl }
      : null,
    estoque: estoqueUrl ? { quantidade: numero(b.estoque.quantidade), portal: b.estoque.portal || "", filtro: b.estoque.filtro || "", url: estoqueUrl } : null,
    noticias,
    classificacao: ["comprador", "equilibrado", "vendedor"].includes(b.classificacao) ? b.classificacao : "sem base",
    motivoClassificacao: b.motivo_classificacao || "",
    limitacoes: b.limitacoes || "",
    fontes,
  };
}

// ---------- Frente 4: bairro (notícias e vetores de crescimento) ----------
async function frenteBairro(im: Imovel) {
  const prompt = `Você é um analista imobiliário no Brasil. Hoje é ${hoje()}.
Levante informações reais sobre o bairro/região do imóvel abaixo.

IMÓVEL AVALIADO
${descreverImovel(im)}

O QUE LEVANTAR (de notícias, prefeitura, órgãos públicos; últimos 24 meses)
1. Segurança: notícias sobre ocorrências no bairro ou entorno, ou dados públicos da SSP. Não tire conclusão sem fonte.
2. Infraestrutura e obras: asfalto, saneamento, duplicação de rodovia, novas escolas/UBS, transporte.
3. Vetores de crescimento: novos loteamentos, condomínios, indústrias, comércio grande chegando.
4. Pontos negativos concretos: alagamento, lixão, área de risco, obra parada, falta de água.
Se for lote ou rural, inclua situação de aprovação do loteamento ou acesso/estrada quando achar.

${REGRAS}

FORMATO
<json>
{
  "seguranca": [{"titulo": "", "data": null, "resumo": "", "url": ""}],
  "infraestrutura": [{"titulo": "", "data": null, "resumo": "", "url": ""}],
  "crescimento": [{"titulo": "", "data": null, "resumo": "", "url": ""}],
  "negativos": [{"titulo": "", "data": null, "resumo": "", "url": ""}],
  "limitacoes": ""
}
</json>`;

  const { texto, fontes } = await chamarIA({ prompt, usarBusca: true, maxBuscas: 6, cidade: im.cidade, uf: im.uf });
  const b = extrairJson(texto);
  const limpar = (lista: any) =>
    (Array.isArray(lista) ? lista : []).map((n: any) => ({ ...n, url: urlVerificada(n.url, fontes) })).filter((n: any) => n.url && n.titulo);
  return {
    seguranca: limpar(b.seguranca),
    infraestrutura: limpar(b.infraestrutura),
    crescimento: limpar(b.crescimento),
    negativos: limpar(b.negativos),
    limitacoes: b.limitacoes || "",
    fontes,
  };
}

// ---------- Síntese: notas, pontos fortes/fracos e anúncio ----------
function semFontes(obj: any) {
  if (!obj) return obj;
  const { fontes, ...resto } = obj as { fontes?: FonteWeb[] };
  return resto;
}

async function frenteSintese(im: Imovel, resultados: any) {
  const dados = {
    comparaveis: semFontes(resultados?.comparaveis),
    aluguel: semFontes(resultados?.aluguel),
    mercado: semFontes(resultados?.mercado),
    bairro: semFontes(resultados?.bairro),
    entornoMapa: resultados?.localizacao?.entorno || null,
    investimento: resultados?.investimento || null,
  };

  const prompt = `Você é um avaliador imobiliário no Brasil. Abaixo estão os dados JÁ LEVANTADOS sobre um imóvel.
Sua tarefa é só interpretar esses dados. Não acrescente nenhum fato novo.

IMÓVEL
${descreverImovel(im)}

DADOS LEVANTADOS (JSON)
${JSON.stringify(dados).slice(0, 60000)}

O QUE FAZER
1. Dê nota de 0 a 100 para cada frente, com justificativa de 1 a 2 frases citando números dos dados:
   - "valor": preço pedido x faixa de valor dos comparáveis (se não houver preço pedido, avalie a qualidade e consistência dos comparáveis). Confiança baixa ou insuficiente = nota no máximo 50.
   - "renda": rentabilidade do aluguel x Selic. Se não se aplica (lote/rural) ou sem dados, nota null.
   - "entorno": equipamentos próximos (mapa) e notícias do bairro.
   - "investimento": custo total de aquisição e potencial de valorização pelos dados.
   - "mercado": estoque, FipeZap e notícias.
   Sem dados suficientes numa frente = nota null e diga por quê.
2. "forcas" e "riscos": até 3 cada, cada um com o número ou fato que sustenta.
3. "argumento": uma frase que o corretor pode usar com o proprietário, baseada no dado mais forte (ex.: "o preço pedido está 14% acima da mediana dos comparáveis").
4. "anuncio": texto para portal, objetivo, sem emojis, sem adjetivos como maravilhoso, imperdível, sonho, oportunidade única. Só fatos do imóvel informados pelo corretor (metragem, cômodos, vagas, localização, infraestrutura do mapa). Não coloque preço. Título com até 60 caracteres. Versão curta de até 5 linhas para WhatsApp/Marketplace.

Responda com JSON entre <json> e </json>.
<json>
{
  "notas": {
    "valor": {"nota": null, "justificativa": ""},
    "renda": {"nota": null, "justificativa": ""},
    "entorno": {"nota": null, "justificativa": ""},
    "investimento": {"nota": null, "justificativa": ""},
    "mercado": {"nota": null, "justificativa": ""}
  },
  "forcas": [""],
  "riscos": [""],
  "argumento": "",
  "anuncio": {"titulo": "", "texto": "", "curto": ""}
}
</json>`;

  const { texto } = await chamarIA({ prompt, usarBusca: false, maxTokens: 3000 });
  const b = extrairJson(texto);

  const PESOS: Record<string, number> = { valor: 25, renda: 20, entorno: 20, investimento: 20, mercado: 15 };
  const notas: Record<string, { nota: number | null; justificativa: string; peso: number }> = {};
  let soma = 0;
  let pesos = 0;
  for (const k of Object.keys(PESOS)) {
    const v = numero(b.notas?.[k]?.nota);
    const nota = v === null ? null : Math.min(100, Math.max(0, Math.round(v)));
    notas[k] = { nota, justificativa: b.notas?.[k]?.justificativa || "", peso: PESOS[k] };
    if (nota !== null) {
      soma += nota * PESOS[k];
      pesos += PESOS[k];
    }
  }

  return {
    notas,
    notaFinal: pesos > 0 ? Math.round(soma / pesos) : null,
    pesoConsiderado: pesos,
    forcas: (b.forcas || []).filter(Boolean).slice(0, 3),
    riscos: (b.riscos || []).filter(Boolean).slice(0, 3),
    argumento: b.argumento || "",
    anuncio: { titulo: b.anuncio?.titulo || "", texto: b.anuncio?.texto || "", curto: b.anuncio?.curto || "" },
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const usuario = await autenticar(req);
  if (!usuario) return res.status(401).json({ error: "Acesso não autorizado" });

  const { frente, imovel, resultados } = req.body || {};
  if (!imovel || !imovel.tipo) return res.status(400).json({ error: "Dados do imóvel incompletos." });
  if (!imovel.cidade) return res.status(400).json({ error: "Informe a cidade do imóvel." });

  try {
    let dados: any;
    switch (frente) {
      case "comparaveis":
        dados = await frenteComparaveis(imovel);
        break;
      case "aluguel":
        dados = await frenteAluguel(imovel);
        break;
      case "mercado":
        dados = await frenteMercado(imovel);
        break;
      case "bairro":
        dados = await frenteBairro(imovel);
        break;
      case "sintese":
        dados = await frenteSintese(imovel, resultados);
        break;
      default:
        return res.status(400).json({ error: "Frente de análise inválida." });
    }
    return res.status(200).json({ frente, dados, geradoEm: new Date().toISOString() });
  } catch (e: any) {
    console.error(`[avaliacao/pesquisar:${frente}]`, e);
    return res.status(e?.status || 500).json({ error: e?.message || "Erro interno na avaliação." });
  }
}
