import { getFirebaseAdmin } from "../_firebaseAdmin.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Autenticação: exige um usuário logado (mesmo padrão usado no restante da API)
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Acesso não autorizado: Token não fornecido" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  const { adminAuthInstance } = getFirebaseAdmin();

  if (!adminAuthInstance) {
    return res.status(503).json({ error: "Serviço de autenticação do servidor indisponível" });
  }

  try {
    await adminAuthInstance.verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: "Acesso não autorizado: Token inválido" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "A geração de laudo por IA ainda não foi configurada. Peça ao administrador para definir ANTHROPIC_API_KEY nas variáveis de ambiente do projeto na Vercel."
    });
  }

  const {
    tipo,
    enderecoImovel,
    descricaoGeral,
    ressalvas,
    quantidadeFotos,
    textoLaudoAtual
  } = req.body || {};

  const tipoLabel = tipo === "saida" ? "SAÍDA (devolução do imóvel)" : "ENTRADA (recebimento do imóvel)";

  const ressalvasTexto = Array.isArray(ressalvas) && ressalvas.length > 0
    ? ressalvas.map((r: string) => `- ${r}`).join("\n")
    : "Nenhuma ressalva marcada nos itens dos cômodos.";

  const prompt = `Você é um assistente que redige laudos de vistoria imobiliária em português formal do Brasil, para uso em contrato de locação.

Gere o texto do "Laudo de Vistoria" de um imóvel, para uma vistoria de ${tipoLabel}.

Dados disponíveis:
- Endereço do imóvel: ${enderecoImovel || "não informado"}
- Observações livres do vistoriador (linguagem informal, pode ter erros de digitação): """${descricaoGeral || "(nenhuma observação livre registrada)"}"""
- Ressalvas marcadas item a item nos cômodos:
${ressalvasTexto}
- Quantidade de fotos anexadas como evidência: ${quantidadeFotos ?? 0}
${textoLaudoAtual ? `- Texto atual do laudo (pode ser usado como base/estilo, mas deve ser atualizado com as novas informações acima): """${textoLaudoAtual}"""` : ""}

Instruções:
1. Escreva em português formal, no estilo jurídico usado em laudos de vistoria de imóveis para locação.
2. Organize o texto por cláusulas numeradas (1, 2, 3...), como um laudo real.
3. Descreva de forma clara e objetiva o estado do imóvel com base nas observações e ressalvas fornecidas — não invente danos que não foram mencionados.
4. Se não houver nenhuma ressalva, declare que o imóvel foi vistoriado e encontra-se em bom estado de conservação.
5. Se for uma vistoria de SAÍDA, inclua uma cláusula final indicando que cabe à imobiliária/locador comparar este laudo com o laudo de entrada para apurar eventuais danos e responsabilidades.
6. Não invente dados cadastrais (nomes, CPF, valores) que não foram fornecidos.
7. Responda APENAS com o texto final do laudo, sem comentários, sem markdown, sem aspas envolvendo o texto.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error("Anthropic API error:", response.status, errBody);
      return res.status(502).json({ error: "Erro ao gerar o laudo com a IA. Tente novamente em instantes." });
    }

    const data = await response.json();
    const textoGerado = (data.content || [])
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n")
      .trim();

    if (!textoGerado) {
      return res.status(502).json({ error: "A IA não retornou nenhum texto. Tente novamente." });
    }

    return res.status(200).json({ textoLaudo: textoGerado });
  } catch (error) {
    console.error("Erro ao chamar a API da Anthropic:", error);
    return res.status(500).json({ error: "Erro interno ao gerar o laudo." });
  }
}
