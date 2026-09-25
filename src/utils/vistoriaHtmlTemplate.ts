import { Vistoria, LocatarioVistoria, CompanySettings } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Logo SVG embutido de alta fidelidade Fidélité
export const FIDELITE_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 70" width="190" height="52" fill="none">
  <!-- Fidēlitē -->
  <text x="50%" y="38" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="800" fill="#003F7F" letter-spacing="-0.5px">Fidēlitē</text>
  <!-- Macron acento vermelho sobre o primeiro 'e' -->
  <rect x="111" y="14" width="15" height="3.5" rx="1.5" fill="#D71920" />
  <!-- negócios imobiliários -->
  <text x="50%" y="54" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="8.5" font-weight="700" fill="#D71920" letter-spacing="2px">negócios imobiliários</text>
</svg>`;

export const generateVistoriaFullHTML = (
  vistoria: Vistoria,
  companySettings?: CompanySettings | null
): string => {
  const locatariosList: LocatarioVistoria[] = (vistoria.locatarios && vistoria.locatarios.length > 0)
    ? vistoria.locatarios
    : (vistoria.locatario ? [vistoria.locatario] : [{
        nome: '',
        cpf: '',
        rg: '',
        nacionalidade: 'BRASILEIRO(A)',
        dataNascimento: '',
        naturalidade: '',
        filiacao: '',
        endereco: '',
        cep: '',
        email: '',
        telefone: ''
      }]);

  const locadorToUse = vistoria.locador || {
    nome: companySettings?.name || 'FIDELITÉ NEGÓCIOS IMOBILIÁRIOS LTDA',
    cnpj: companySettings?.cnpj || '37.194.924/0001-86',
    endereco: companySettings?.address || 'AVENIDA SENADOR PEDRO LUDOVICO Nº 180, SALA 17, CENTRO, BELA VISTA DE GOIÁS, CEP: 75.240-000'
  };

  const companyName = companySettings?.name || vistoria.companyName || 'FIDELITÉ NEGÓCIOS IMOBILIÁRIOS';
  const companyPhone = companySettings?.phone || '(62) 99999-9999';
  const companyEmail = companySettings?.email || 'contato@fideliteimoveis.com.br';
  const companyWebsite = companySettings?.website || 'www.fideliteimoveis.com.br';
  const companyCreci = companySettings?.creci || 'CJ 31.000';
  const companyCity = vistoria.companyCity || companySettings?.city || 'Bela Vista de Goiás';
  const companyState = vistoria.companyState || companySettings?.state || 'GO';
  const companyAddress = companySettings?.address || locadorToUse.endereco || `${companyCity} - ${companyState}`;

  const formatDateHelper = (dateStr?: string) => {
    if (!dateStr) return format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    try {
      const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00:00');
      return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
  };

  const dataFormatada = formatDateHelper((vistoria as any).dataVistoria || vistoria.data);

  // Logo rendering
  const customLogoUrl = vistoria.companyLogo || companySettings?.logoUrl;
  const logoHtml = customLogoUrl 
    ? `<img src="${customLogoUrl}" alt="${companyName}" class="header-logo-img" />`
    : FIDELITE_LOGO_SVG;

  // Split photos into chunks of 3 for strict row integrity
  const renderComodoPhotos = (fotos: string[]) => {
    if (!fotos || fotos.length === 0) return '';
    const rows: string[][] = [];
    for (let i = 0; i < fotos.length; i += 3) {
      rows.push(fotos.slice(i, i + 3));
    }

    return `
      <div class="comodo-fotos-wrapper">
        <div class="fotos-title">REGISTRO FOTOGRÁFICO DO AMBIENTE:</div>
        ${rows.map(row => `
          <div class="foto-row">
            ${row.map(f => `
              <div class="foto-cell">
                <img src="${f}" alt="Foto Vistoria" class="foto-img" />
              </div>
            `).join('')}
            ${row.length === 1 ? `<div class="foto-cell-spacer"></div><div class="foto-cell-spacer"></div>` : ''}
            ${row.length === 2 ? `<div class="foto-cell-spacer"></div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  };

  // Cláusulas de texto do contrato (Página 1)
  const defaultContratoTexto = `O(A) LOCATÁRIO(A), acima qualificado(a), declara, para os devidos fins, que nesta data recebeu as chaves do imóvel locado, passando a ter a posse do referido bem.\n\nDeclara, ainda, que teve ciência das condições do imóvel, conforme laudo de vistoria elaborado pela imobiliária, o qual foi devidamente apresentado, acompanhado e conferido, concordando integralmente com seu estado de conservação no ato da entrega.\n\nO(A) LOCATÁRIO(A) assume, a partir desta data, total responsabilidade pela guarda, conservação e demais obrigações previstas no contrato de locação.`;
  const textoContratoRaw = vistoria.textoContrato || defaultContratoTexto;
  const contractParagraphs = textoContratoRaw.split('\n').filter(p => p.trim().length > 0);

  // Laudo / Declaração se houver
  const textoLaudoRaw = vistoria.textoLaudo;
  const laudoParagraphs = textoLaudoRaw ? textoLaudoRaw.split('\n').filter(p => p.trim().length > 0) : [];

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Vistoria - ${(locatariosList[0]?.nome || 'Fidélité').toUpperCase()}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 16mm 14mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #FFFFFF;
      color: #0F172A;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8.5pt;
      line-height: 1.35;
      width: 100%;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* Container do documento */
    .document-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      background: #FFFFFF;
      box-sizing: border-box;
      padding: 0;
    }

    /* Topo e Cabeçalho */
    .header-wrapper {
      text-align: center;
      margin-bottom: 8px;
    }
    .header-logo-container {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 6px;
    }
    .header-logo-img {
      max-height: 52px;
      max-width: 220px;
      object-fit: contain;
    }
    .header-title {
      font-size: 13pt;
      font-weight: 800;
      color: #003F7F;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin: 2px 0;
    }
    .header-subtitle {
      font-size: 8pt;
      font-weight: 700;
      color: #D71920;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .header-divider {
      height: 1.5px;
      background-color: #003F7F;
      width: 100%;
      margin-bottom: 10px;
    }

    /* Faixas de Seção - Idêntico à referência */
    .section-banner {
      display: flex;
      align-items: center;
      background-color: #F8FAFC;
      border-left: 4px solid #003F7F;
      padding: 3px 8px;
      margin-top: 10px;
      margin-bottom: 5px;
      break-inside: avoid;
      page-break-inside: avoid;
      break-after: avoid;
      page-break-after: avoid;
    }
    .section-title {
      font-size: 8pt;
      font-weight: 800;
      color: #003F7F;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    /* Protege o bloco LGPD para não deixar título órfão */
    .lgpd-section-wrapper {
      display: block;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      page-break-before: auto;
      margin-top: 10px;
    }

    /* Tabelas de Identificação */
    .table-info {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
      font-size: 8pt;
      break-inside: avoid;
      page-break-inside: avoid;
      table-layout: fixed;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .table-info td {
      padding: 3px 6px;
      border: 1px solid #E5E7EB;
      vertical-align: middle;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .table-info .label {
      font-weight: 700;
      color: #334155;
      background-color: #F1F5F9;
      width: 20%;
      white-space: nowrap;
    }
    .table-info .value {
      color: #0F172A;
      font-weight: 500;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    .table-info .nested-split {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }

    /* Cláusulas e Textos */
    .contract-text-box {
      margin-bottom: 8px;
      font-size: 8pt;
      text-align: justify;
      color: #1E293B;
      break-inside: avoid;
      page-break-inside: avoid;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .contract-p {
      margin: 0 0 5px 0;
      text-indent: 14px;
      line-height: 1.35;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* Ambientes e Itens */
    .comodo-block {
      margin-bottom: 10px;
      break-inside: auto;
      page-break-inside: auto;
    }
    .comodo-header {
      padding: 4px 2px;
      font-size: 8.5pt;
      font-weight: 800;
      color: #003F7F;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 1.5px solid #003F7F;
      margin-top: 8px;
      margin-bottom: 4px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .table-items {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
      font-size: 8pt;
      table-layout: fixed;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .table-items th {
      background-color: #E2E8F0;
      color: #1E293B;
      font-weight: 800;
      text-align: left;
      padding: 3px 6px;
      border: 1px solid #CBD5E1;
      text-transform: uppercase;
      font-size: 7.5pt;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .table-items td {
      padding: 3px 6px;
      border: 1px solid #E2E8F0;
      vertical-align: middle;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .table-items tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .table-items .item-name {
      font-weight: 600;
      color: #0F172A;
      width: 32%;
    }
    .table-items .item-status {
      width: 18%;
      text-align: center;
      font-weight: 800;
      font-size: 7.5pt;
      letter-spacing: 0.05em;
    }
    .status-ok {
      color: #16A34A;
      font-weight: 800;
      font-size: 7.5pt;
      letter-spacing: 0.05em;
      display: inline-block;
    }
    .status-ressalva {
      color: #D71920;
      background-color: #FEF2F2;
      border-radius: 2px;
      padding: 1px 4px;
      display: inline-block;
    }
    .table-items .item-detail {
      color: #475569;
      font-size: 7.5pt;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    /* Fotos com Rigor Absoluto */
    .comodo-fotos-wrapper {
      margin-top: 4px;
      margin-bottom: 8px;
    }
    .fotos-title {
      font-size: 7.5pt;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      margin-bottom: 4px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .foto-row {
      display: flex;
      flex-direction: row;
      gap: 6px;
      margin-bottom: 6px;
      width: 100%;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .foto-cell {
      flex: 1 1 0;
      width: calc(33.333% - 4px);
      border: 1px solid #CBD5E1;
      border-radius: 2px;
      background: #000;
      height: 48mm;
      max-height: 48mm;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .foto-cell-spacer {
      flex: 1 1 0;
      width: calc(33.333% - 4px);
      visibility: hidden;
      height: 48mm;
    }
    .foto-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    /* LGPD e Cláusulas Finais */
    .lgpd-box {
      margin-top: 10px;
      margin-bottom: 10px;
      font-size: 7.5pt;
      color: #334155;
      text-align: justify;
      break-inside: avoid;
      page-break-inside: avoid;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .lgpd-box p {
      margin: 0 0 4px 0;
      line-height: 1.3;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* Bloco de Assinaturas - Espaçado e Confortável */
    .signatures-block {
      margin-top: 26px;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .validade-text {
      font-size: 8pt;
      color: #1E293B;
      text-align: justify;
      margin-bottom: 8px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .data-local-row {
      text-align: right;
      font-size: 8.5pt;
      font-weight: 800;
      color: #000000;
      margin-top: 22px;
      margin-bottom: 48px;
    }
    .signatures-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 32px 24px;
      justify-content: space-around;
      margin-bottom: 36px;
    }
    .sig-col {
      flex: 1 1 calc(45% - 12px);
      max-width: 48%;
      min-width: 200px;
      text-align: center;
      padding-top: 28px;
    }
    .sig-line {
      border-top: 1.2px solid #000000;
      width: 90%;
      margin: 0 auto 6px auto;
    }
    .sig-label {
      font-size: 8pt;
      font-weight: 700;
      color: #0F172A;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .sig-sub {
      font-size: 7.5pt;
      color: #475569;
      line-height: 1.35;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* Rodapé Posicionado */
    .document-footer {
      margin-top: 50px;
      padding-top: 8px;
      padding-bottom: 6px;
      border-top: 1px solid #CBD5E1;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 7pt;
      color: #64748B;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Utilitários de Impressão */
    @media print {
      body {
        background: transparent !important;
      }
      .no-print {
        display: none !important;
      }
      .document-footer {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        background-color: #FFFFFF;
        padding-top: 6px;
        padding-bottom: 4px;
        border-top: 1px solid #CBD5E1;
        margin-top: 0;
      }
    }
  </style>
</head>
<body>
  <div class="document-container">
    
    <!-- CABEÇALHO -->
    <header class="header-wrapper">
      <div class="header-logo-container">
        ${logoHtml}
      </div>
      <div class="header-title">TERMO DE VISTORIA E ENTREGA DE CHAVES</div>
      <div class="header-subtitle">VISTORIA DE ENTRADA / ENTREGA DE CHAVES</div>
      <div class="header-divider"></div>
    </header>

    <!-- IDENTIFICAÇÃO DO(S) LOCATÁRIO(S) -->
    <div class="section-banner">
      <span class="section-title">${locatariosList.length > 1 ? 'DADOS DOS LOCATÁRIOS' : 'DADOS DO LOCATÁRIO'}</span>
    </div>

    ${locatariosList.map((loc, idx) => `
      <table class="table-info">
        <tr>
          <td class="label">${locatariosList.length > 1 ? `LOCATÁRIO ${idx + 1}:` : 'LOCATÁRIO:'}</td>
          <td class="value" colspan="3"><strong>${(loc.nome || 'NÃO INFORMADO').toUpperCase()}</strong></td>
        </tr>
        <tr>
          <td class="label">CPF:</td>
          <td class="value">${loc.cpf || '—'}</td>
          <td class="label">RG:</td>
          <td class="value">${loc.rg || '—'}</td>
        </tr>
        <tr>
          <td class="label">NACIONALIDADE:</td>
          <td class="value">${loc.nacionalidade || 'BRASILEIRO(A)'}</td>
          <td class="label">NATURALIDADE / NASC:</td>
          <td class="value">${loc.naturalidade || '—'} ${loc.dataNascimento ? `(${loc.dataNascimento})` : ''}</td>
        </tr>
        <tr>
          <td class="label">ENDEREÇO:</td>
          <td class="value" colspan="3">${loc.endereco || '—'} ${loc.cep ? ` - CEP: ${loc.cep}` : ''}</td>
        </tr>
        <tr>
          <td class="label">CONTATO:</td>
          <td class="value" colspan="3">${loc.telefone ? `Tel: ${loc.telefone}` : ''} ${loc.email ? ` | E-mail: ${loc.email}` : ''}</td>
        </tr>
      </table>
    `).join('')}

    <!-- IDENTIFICAÇÃO DO LOCADOR -->
    <div class="section-banner">
      <span class="section-title">DADOS DO LOCADOR</span>
    </div>
    <table class="table-info">
      <tr>
        <td class="label">LOCADOR:</td>
        <td class="value" colspan="3"><strong>${(locadorToUse.nome || companyName).toUpperCase()}</strong></td>
      </tr>
      <tr>
        <td class="label">CNPJ:</td>
        <td class="value">${locadorToUse.cnpj || companySettings?.cnpj || '—'}</td>
        <td class="label">CRECI:</td>
        <td class="value">${companyCreci}</td>
      </tr>
      <tr>
        <td class="label">ENDEREÇO:</td>
        <td class="value" colspan="3">${locadorToUse.endereco || companyAddress}</td>
      </tr>
      <tr>
        <td class="label">CONTATO:</td>
        <td class="value" colspan="3">${companyPhone ? `Tel: ${companyPhone}` : ''}${companyEmail ? ` | E-mail: ${companyEmail}` : ''}${companyWebsite ? ` | Site: ${companyWebsite}` : ''}</td>
      </tr>
    </table>

    <!-- IDENTIFICAÇÃO DO IMÓVEL -->
    <div class="section-banner">
      <span class="section-title">DADOS DO IMÓVEL</span>
    </div>
    <table class="table-info">
      <tr>
        <td class="label">ENDEREÇO DO IMÓVEL:</td>
        <td class="value" colspan="3"><strong>${(vistoria.imovel?.endereco || 'NÃO INFORMADO').toUpperCase()}</strong></td>
      </tr>
    </table>

    <!-- CLÁUSULAS: DECLARAÇÃO DE RECEBIMENTO DE CHAVES -->
    <div class="section-banner">
      <span class="section-title">DECLARAÇÃO DE RECEBIMENTO DE CHAVES</span>
    </div>
    <div class="contract-text-box">
      ${contractParagraphs.map((p, idx) => `
        <p class="contract-p"><strong>${idx + 1}.</strong> ${p}</p>
      `).join('')}
    </div>

    <!-- CONDIÇÕES DO IMÓVEL / AMBIENTES E ITENS -->
    <div class="section-banner">
      <span class="section-title">CONDIÇÕES DO IMÓVEL (ITENS VISTORIADOS)</span>
    </div>

    ${vistoria.comodos && vistoria.comodos.length > 0 ? vistoria.comodos.map((comodo) => `
      <div class="comodo-block">
        <div class="comodo-header">${comodo.nome.toUpperCase()}</div>
        
        <table class="table-items">
          <thead>
            <tr>
              <th style="width: 35%;">ITEM</th>
              <th style="width: 15%; text-align: center;">ESTADO</th>
              <th style="width: 50%;">RESSALVA / OBSERVAÇÃO</th>
            </tr>
          </thead>
          <tbody>
            ${comodo.itens && comodo.itens.length > 0 ? comodo.itens.map(item => `
              <tr>
                <td class="item-name">${item.nome}</td>
                <td class="item-status">
                  ${item.ok 
                    ? '<span class="status-ok">[ OK ]</span>' 
                    : '<span class="status-ressalva">[ RESSALVA ]</span>'
                  }
                </td>
                <td class="item-detail">
                  ${item.ok ? 'Em perfeito estado de conservação e funcionamento' : (item.ressalva || 'Ressalva apontada')}
                </td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="3" class="item-detail" style="text-align: center; color: #94A3B8;">Nenhum item listado para este ambiente.</td>
              </tr>
            `}
          </tbody>
        </table>

        <!-- FOTOS DO CÔMODO COM REGRA ABSOLUTA DE FILEIRAS INDIVISÍVEIS -->
        ${renderComodoPhotos(comodo.fotos)}
      </div>
    `).join('') : `
      <p style="font-size: 8pt; color: #64748B; font-style: italic; margin-bottom: 8px;">Nenhum ambiente cadastrado.</p>
    `}

    <!-- LAUDO DE VISTORIA (SE HOUVER) -->
    ${laudoParagraphs.length > 0 ? `
      <div class="section-banner">
        <span class="section-title">LAUDO E OBSERVAÇÕES FINAIS</span>
      </div>
      <div class="contract-text-box">
        ${laudoParagraphs.map((p, idx) => `
          <p class="contract-p"><strong>${idx + 1})</strong> ${p}</p>
        `).join('')}
      </div>
    ` : ''}

    <!-- LGPD E PROTEÇÃO DE DADOS (TÍTULO E TEXTO JUNTOS NA MESMA TELA/PÁGINA) -->
    <div class="lgpd-section-wrapper">
      <div class="section-banner">
        <span class="section-title">LGPD E PROTEÇÃO DE DADOS</span>
      </div>
      <div class="lgpd-box">
        <p>As partes declaram estar cientes e de acordo com o tratamento de seus dados pessoais, nos termos da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados – LGPD).</p>
        <p><strong>§1º.</strong> Para os fins deste instrumento, a IMOBILIÁRIA atuará como CONTROLADORA dos dados pessoais, podendo tratá-los diretamente ou por meio de terceiros contratados, na qualidade de OPERADORES, exclusivamente para as finalidades de intermediação, administração e execução do contrato de locação.</p>
        <p><strong>§2º.</strong> O tratamento dos dados pessoais terá como fundamentos legais o cumprimento de obrigação legal ou regulatória (art. 7º, II, LGPD) e a execução do contrato de locação (art. 7º, V, LGPD).</p>
        <p><strong>§3º.</strong> As partes comprometem-se a não divulgar, compartilhar ou utilizar os dados pessoais obtidos em razão deste instrumento para finalidades diversas das pactuadas, salvo ordem legal ou judicial.</p>
        <p><strong>§4º.</strong> A IMOBILIÁRIA adotará medidas técnicas e de segurança adequadas para proteger os dados pessoais contra acessos não autorizados ou formas inadequadas de tratamento.</p>
      </div>
    </div>

    <!-- CLÁUSULA DE VALIDADE, DATA E ASSINATURAS (BLOCO INDIVISÍVEL) -->
    <div class="signatures-block">
      <div class="section-banner">
        <span class="section-title">CLÁUSULA – DA VALIDADE E INTEGRIDADE DO INSTRUMENTO</span>
      </div>
      <div class="validade-text">
        Permanecem válidas e inalteradas todas as demais cláusulas do contrato principal de locação e dos termos firmados entre as partes, que não conflitarem com o presente instrumento.
      </div>

      <div class="data-local-row">
        ${companyCity} - ${companyState}, ${dataFormatada}.
      </div>

      <!-- ASSINATURAS PRINCIPAIS -->
      <div class="signatures-grid">
        ${locatariosList.map((loc, idx) => `
          <div class="sig-col">
            <div class="sig-line"></div>
            <div class="sig-label">${locatariosList.length > 1 ? `LOCATÁRIO ${idx + 1}` : 'LOCATÁRIO(A)'}</div>
            <div class="sig-sub">${(loc.nome || 'NÃO INFORMADO').toUpperCase()}</div>
            ${loc.cpf ? `<div class="sig-sub">CPF: ${loc.cpf}</div>` : ''}
          </div>
        `).join('')}

        <div class="sig-col">
          <div class="sig-line"></div>
          <div class="sig-label">LOCADOR / IMOBILIÁRIA</div>
          <div class="sig-sub">${(locadorToUse.nome || companyName).toUpperCase()}</div>
          ${locadorToUse.cnpj ? `<div class="sig-sub">CNPJ: ${locadorToUse.cnpj}</div>` : ''}
        </div>
      </div>
    </div>

    <!-- RODAPÉ DISCRETO -->
    <footer class="document-footer">
      <div style="width: 100%; text-align: center; font-size: 6.5pt; color: #64748B; line-height: 1.4;">
        <strong style="color: #003F7F;">${companyName.toUpperCase()} &nbsp;|&nbsp; CRECI: ${companyCreci}</strong><br />
        ${companyAddress} &nbsp;•&nbsp; ${companyPhone ? `Tel: ${companyPhone}` : ''}${companyEmail ? ` &nbsp;•&nbsp; ${companyEmail}` : ''}${companyWebsite ? ` &nbsp;•&nbsp; ${companyWebsite}` : ''}
      </div>
    </footer>

  </div>
</body>
</html>`;
};

// Dispara impressão do HTML com máxima fidelidade visual em janela ou iframe
export const printVistoriaHTML = (vistoria: Vistoria, companySettings?: CompanySettings | null) => {
  const html = generateVistoriaFullHTML(vistoria, companySettings);
  
  // Abre em janela para visualização e impressão nativa limpa
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Aguarda carregar para disparar a impressão
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  } else {
    // Fallback com iframe caso o popup seja bloqueado
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  }
};
// build-sync: 1790348971
