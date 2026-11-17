// Dados objetivos do entorno, sem IA:
// - Localização do endereço (OpenStreetMap / Nominatim)
// - Equipamentos próximos com distância real (OpenStreetMap / Overpass)
// - Selic e IPCA 12 meses oficiais (Banco Central / SGS)
import { autenticar } from "./_comum.js";

const UA = "PontoChave-Fidelite/1.0 (avaliacao de imoveis; contato: fideliteimobi.com.br)";

type Ponto = { nome: string; distanciaM: number; lat: number; lon: number };

const CATEGORIAS: { id: string; rotulo: string; testar: (t: any) => boolean }[] = [
  { id: "escolas", rotulo: "Escolas e creches", testar: (t) => /^(school|kindergarten|college|university)$/.test(t.amenity || "") },
  { id: "saude", rotulo: "Saúde (hospital, posto, clínica)", testar: (t) => /^(hospital|clinic|doctors)$/.test(t.amenity || "") },
  { id: "farmacias", rotulo: "Farmácias", testar: (t) => t.amenity === "pharmacy" },
  { id: "mercados", rotulo: "Mercados e padarias", testar: (t) => /^(supermarket|convenience|bakery|butcher|greengrocer)$/.test(t.shop || "") || t.amenity === "marketplace" },
  { id: "bancos", rotulo: "Bancos e lotéricas", testar: (t) => t.amenity === "bank" || t.shop === "lottery" },
  { id: "seguranca", rotulo: "Polícia", testar: (t) => t.amenity === "police" },
  { id: "onibus", rotulo: "Pontos de ônibus", testar: (t) => t.highway === "bus_stop" },
  { id: "lazer", rotulo: "Praças, parques e quadras", testar: (t) => /^(park|playground|sports_centre|pitch)$/.test(t.leisure || "") },
];

function distancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

async function comTempo<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), ms))]);
}

async function geocodificar(consulta: string) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=br&q=" +
    encodeURIComponent(consulta);
  const r = await comTempo(fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" } }), 15000);
  if (!r.ok) return null;
  const lista = await r.json();
  return Array.isArray(lista) && lista.length > 0 ? lista[0] : null;
}

async function buscarPontos(lat: number, lon: number) {
  const q = `[out:json][timeout:25];
(
  nwr(around:2000,${lat},${lon})[amenity~"^(school|kindergarten|college|university|hospital|clinic|doctors|pharmacy|bank|police|marketplace)$"];
  nwr(around:2000,${lat},${lon})[shop~"^(supermarket|convenience|bakery|butcher|greengrocer|lottery)$"];
  node(around:1000,${lat},${lon})[highway=bus_stop];
  nwr(around:2000,${lat},${lon})[leisure~"^(park|playground|sports_centre|pitch)$"];
);
out center tags;`;
  const r = await comTempo(
    fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(q),
    }),
    30000
  );
  if (!r.ok) throw new Error(`Overpass ${r.status}`);
  const data = await r.json();
  const elementos: any[] = data.elements || [];

  return CATEGORIAS.map((cat) => {
    const pontos: Ponto[] = elementos
      .filter((e) => e.tags && cat.testar(e.tags))
      .map((e) => {
        const plat = e.lat ?? e.center?.lat;
        const plon = e.lon ?? e.center?.lon;
        return {
          nome: e.tags.name || e.tags["name:pt"] || "(sem nome no mapa)",
          distanciaM: distancia(lat, lon, plat, plon),
          lat: plat,
          lon: plon,
        };
      })
      .filter((p) => Number.isFinite(p.distanciaM))
      .sort((a, b) => a.distanciaM - b.distanciaM);
    return {
      id: cat.id,
      rotulo: cat.rotulo,
      ate500m: pontos.filter((p) => p.distanciaM <= 500).length,
      ate1km: pontos.filter((p) => p.distanciaM <= 1000).length,
      ate2km: pontos.length,
      maisProximos: pontos.slice(0, 3),
    };
  });
}

async function serieBCB(codigo: number) {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/1?formato=json`;
  const r = await comTempo(fetch(url, { headers: { "User-Agent": UA } }), 10000);
  if (!r.ok) return null;
  const d = await r.json();
  const ult = Array.isArray(d) ? d[d.length - 1] : null;
  if (!ult) return null;
  return { valor: Number(String(ult.valor).replace(",", ".")), data: ult.data, fonte: `Banco Central (SGS ${codigo})` };
}

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });
  const usuario = await autenticar(req);
  if (!usuario) return res.status(401).json({ error: "Acesso não autorizado" });

  const { endereco, bairro, cidade, uf } = req.body || {};
  if (!endereco && !cidade) return res.status(400).json({ error: "Informe o endereço ou a cidade." });

  const tentativas: { consulta: string; precisao: string }[] = [];
  if (endereco) tentativas.push({ consulta: [endereco, bairro, cidade, uf].filter(Boolean).join(", "), precisao: "endereço" });
  if (bairro && cidade) tentativas.push({ consulta: [bairro, cidade, uf].filter(Boolean).join(", "), precisao: "bairro" });
  if (cidade) tentativas.push({ consulta: [cidade, uf].filter(Boolean).join(", "), precisao: "cidade" });

  const [selic, ipca] = await Promise.all([serieBCB(432).catch(() => null), serieBCB(13522).catch(() => null)]);

  let local: any = null;
  let precisao = "";
  for (const t of tentativas) {
    try {
      local = await geocodificar(t.consulta);
    } catch {
      local = null;
    }
    if (local) {
      precisao = t.precisao;
      break;
    }
  }

  if (!local) {
    return res.status(200).json({
      encontrado: false,
      aviso: "Não foi possível localizar o endereço no mapa. Confira a grafia ou informe bairro e cidade.",
      indicadores: { selic, ipca12m: ipca },
    });
  }

  const lat = Number(local.lat);
  const lon = Number(local.lon);
  let entorno: any[] | null = null;
  let avisoEntorno: string | null = null;
  try {
    entorno = await buscarPontos(lat, lon);
  } catch (e) {
    console.error("[avaliacao/localizar] overpass", e);
    avisoEntorno = "O serviço de mapa (OpenStreetMap) não respondeu. Tente novamente em alguns minutos.";
  }

  return res.status(200).json({
    encontrado: true,
    lat,
    lon,
    enderecoEncontrado: local.display_name,
    precisao,
    entorno,
    avisoEntorno,
    fonteEntorno:
      "OpenStreetMap (raio de 2 km; pontos de ônibus em 1 km). Em cidades menores o mapa pode estar incompleto: ausência no mapa não significa ausência na rua.",
    indicadores: { selic, ipca12m: ipca },
  });
}
