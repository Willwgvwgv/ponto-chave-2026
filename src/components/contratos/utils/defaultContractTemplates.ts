import { ContractBlock, ContractStyleSettings, ContratoModelo } from "../types/contractTypes";

export const DEFAULT_STYLE_SETTINGS: ContractStyleSettings = {
  fontFamily: "Inter",
  fontSizePt: 11,
  lineSpacing: 1.35,
  paragraphSpacingPx: 12,
  marginType: "padrao", // 25mm
  primaryColor: "#1e3a8a", // navy blue
  accentColor: "#3b82f6",
  showWatermark: false,
  watermarkText: "MINUTA",
  showHeader: true,
  showFooter: true,
  showPageNumbers: true,
  showSignatureLines: true,
  clauseNumberingStyle: "ordinal" // "CLÁUSULA 1ª", "CLÁUSULA 2ª"
};

export const RESIDENTIAL_CAUCAO_BLOCKS: ContractBlock[] = [
  {
    id: "block-title",
    type: "title",
    content: "CONTRATO DE LOCAÇÃO DE IMÓVEL URBANO RESIDENCIAL",
    isLocked: true
  },
  {
    id: "block-subtitle",
    type: "subtitle",
    content: "COM GARANTIA DE CAUÇÃO EM DINHEIRO (LEI FEDERAL Nº 8.245/1991)",
    isLocked: true
  },
  {
    id: "block-parties-locador",
    type: "parties",
    clauseTitle: "IDENTIFICAÇÃO DAS PARTES CONTRATANTES",
    sectionCategory: "Identificação das partes",
    content: `<p><strong>LOCADOR(A):</strong> {{qualificacao_completa_locador}}, doravante denominado(a) simplesmente <strong>LOCADOR</strong>.</p>
<p class="mt-2"><strong>LOCATÁRIO(A):</strong> {{qualificacao_completa_locatario}}, doravante denominado(a) simplesmente <strong>LOCATÁRIO</strong>.</p>
<p class="mt-2"><strong>ADMINISTRADORA:</strong> <strong>{{nome_imobiliaria}}</strong>, inscrita no CNPJ sob o nº {{cnpj_imobiliaria}}, registro no CRECI sob o nº {{creci_imobiliaria}}, com sede profissional à {{endereco_imobiliaria}}, na qualidade de intermediadora e administradora do imóvel.</p>`
  },
  {
    id: "block-parties-imovel",
    type: "paragraph",
    clauseTitle: "DO IMÓVEL LOCADO",
    sectionCategory: "Identificação do imóvel",
    content: `<p>As partes acima qualificadas têm, entre si, justo e contratado o presente instrumento particular de locação residencial do seguinte imóvel:</p>
<p class="mt-2 pl-4 border-l-2 border-slate-300 italic"><strong>Imóvel:</strong> {{tipo_imovel}}, situado à <strong>{{endereco_imovel}}</strong>, com direito a {{vagas_garagem}}, registrado no {{cartorio_imovel}} sob a matrícula nº {{matricula_imovel}}.</p>`
  },
  {
    id: "clause-1",
    type: "clause",
    clauseNumber: 1,
    clauseTitle: "DO OBJETO E DA DESTINAÇÃO",
    sectionCategory: "Objeto da locação",
    content: `<p>O presente contrato tem por objeto a locação do imóvel descrito no preâmbulo deste instrumento, destinando-se <strong>exclusivamente para fins residenciais do LOCATÁRIO e de seus familiares</strong>, sendo terminantemente vedada a alteração de sua destinação, a cessão, a sublocação total ou parcial, o empréstimo ou a transferência deste contrato, sob qualquer pretexto, sem o prévio e expresso consentimento por escrito do <strong>LOCADOR</strong>.</p>`
  },
  {
    id: "clause-2",
    type: "clause",
    clauseNumber: 2,
    clauseTitle: "DO PRAZO CONTRATUAL",
    sectionCategory: "Prazo contratual",
    content: `<p>O prazo de vigência desta locação é de <strong>{{prazo_meses}}</strong>, com termo inicial em <strong>{{data_inicio}}</strong> e termo final em <strong>{{data_fim}}</strong>, data em que o <strong>LOCATÁRIO</strong> se obriga a restituir o imóvel completamente desocupado, limpo e em perfeito estado de conservação, independentemente de qualquer aviso, notificação judicial ou extrajudicial.</p>
<p class="mt-2 text-justify"><strong>Parágrafo Único:</strong> Findo o prazo estipulado, se o LOCATÁRIO permanecer no imóvel por mais de trinta dias sem oposição do LOCADOR, presumir-se-á prorrogada a locação por tempo indeterminado, mantidas todas as demais cláusulas e condições contratuais, na forma do art. 46, §1º da Lei nº 8.245/91.</p>`
  },
  {
    id: "clause-3",
    type: "clause",
    clauseNumber: 3,
    clauseTitle: "DO VALOR DO ALUGUEL E DA FORMA DE PAGAMENTO",
    sectionCategory: "Aluguel e condições de pagamento",
    content: `<p>O valor mensal do aluguel livremente convencionado é de <strong>{{valor_aluguel}} ({{valor_aluguel_extenso}})</strong>, a ser pago pontualmente até o dia <strong>{{dia_vencimento}} de cada mês subsequente ao vencido</strong>, através de boleto bancário emitido pela Administradora, transferência bancária ou via chave PIX indicada: <strong>{{pix_locador}}</strong>.</p>
<p class="mt-2 text-justify"><strong>Parágrafo Primeiro:</strong> O não pagamento do aluguel e encargos até a data de vencimento importará na incidência de <strong>multa moratória de {{multa_atraso}}</strong> sobre o valor do débito em aberto, acrescido de <strong>juros moratórios de {{juros_mora}}</strong> e correção monetária pelo {{indice_reajuste}} até a data da efetiva quitação.</p>
<p class="mt-2 text-justify"><strong>Parágrafo Segundo:</strong> Em caso de cobrança judicial ou extrajudicial mediante intervenção de advogado, o LOCATÁRIO arcará ainda com honorários advocatícios à razão de 20% (vinte por cento) sobre o montante devido, além das custas e despesas processuais cabíveis.</p>`
  },
  {
    id: "clause-4",
    type: "clause",
    clauseNumber: 4,
    clauseTitle: "DO REAJUSTE ANUAL DO ALUGUEL",
    sectionCategory: "Reajustes e encargos",
    content: `<p>O valor do aluguel estipulado será <strong>reajustado anualmente a cada 12 (doze) meses de vigência</strong> contratual, tendo como indexador a variação positiva acumulada do <strong>{{indice_reajuste}}</strong> divulgado pelo órgão oficial competente, ou por outro índice governamental que legalmente venha a substituí-lo em caso de extinção.</p>
<p class="mt-2 text-justify"><strong>Parágrafo Único:</strong> Caso a variação do índice no período seja negativa, o valor do aluguel permanecerá inalterado, não havendo redução no patamar vigente.</p>`
  },
  {
    id: "clause-5",
    type: "clause",
    clauseNumber: 5,
    clauseTitle: "DOS ENCARGOS, TRIBUTOS E DESPESAS ORDINÁRIAS",
    sectionCategory: "Reajustes e encargos",
    content: `<p>Além do aluguel mensal, correrão por conta exclusiva do <strong>LOCATÁRIO</strong>, a partir da entrega das chaves e até a efetiva desocupação e vistoria final:</p>
<ul class="list-disc pl-6 space-y-1 mt-2 text-justify">
  <li>Todas as taxas e quotas de condomínio ordinárias incidentes sobre o imóvel;</li>
  <li>O Imposto Predial e Territorial Urbano (IPTU) e taxas municipais correlatas do exercício;</li>
  <li>Consumo integral de energia elétrica, água, esgoto, gás canalizado e serviços de internet/telefonia privativos;</li>
  <li>Prêmio do seguro contra incêndio e destruição do imóvel, a ser contratado compulsoriamente anualmente.</li>
</ul>`
  },
  {
    id: "clause-6",
    type: "clause",
    clauseNumber: 6,
    clauseTitle: "DA GARANTIA LOCATÍCIA (CAUÇÃO EM DINHEIRO)",
    sectionCategory: "Garantia locatícia",
    content: `<p>Para garantia fiel e integral de todas as obrigações assumidas neste instrumento, o <strong>LOCATÁRIO entrega, neste ato, a título de caução em dinheiro, o valor de {{valor_garantia}}</strong>, correspondente a 03 (três) meses de aluguel, conforme faculta o art. 37, inciso I, e art. 38, §2º da Lei Federal nº 8.245/91.</p>
<p class="mt-2 text-justify"><strong>Parágrafo Primeiro:</strong> A referida quantia será depositada em caderneta de poupança vinculada e aberta especificamente para este fim, revertendo a favor do LOCATÁRIO os rendimentos e juros bancários decorrentes do período.</p>
<p class="mt-2 text-justify"><strong>Parágrafo Segundo:</strong> A caução somente será restituída ao LOCATÁRIO após a entrega formal das chaves, cumprimento do laudo de vistoria final de desocupação e comprovação de quitação total de todos os aluguéis, IPTU, condomínio e faturas de serviços públicos.</p>`
  },
  {
    id: "clause-7",
    type: "clause",
    clauseNumber: 7,
    clauseTitle: "DAS OBRIGAÇÕES DO LOCADOR",
    sectionCategory: "Obrigações do locador",
    content: `<p>O <strong>LOCADOR</strong> obriga-se a:</p>
<ul class="list-disc pl-6 space-y-1 mt-2 text-justify">
  <li>Entregar o imóvel ao LOCATÁRIO em estado de servir ao uso a que se destina;</li>
  <li>Garantir ao LOCATÁRIO o uso pacífico e manso do imóvel locado durante o prazo do contrato;</li>
  <li>Responder pelos vícios, defeitos ou avarias estruturais anteriores à locação;</li>
  <li>Arcar com as despesas extraordinárias de condomínio (obras de reforma de estrutura, pintura externa do edifício, instalação de equipamentos de segurança patrimonial e fundo de reserva extraordinário), conforme art. 22 da Lei do Inquilinato.</li>
</ul>`
  },
  {
    id: "clause-8",
    type: "clause",
    clauseNumber: 8,
    clauseTitle: "DAS OBRIGAÇÕES DO LOCATÁRIO",
    sectionCategory: "Obrigações do locatário",
    content: `<p>O <strong>LOCATÁRIO</strong> obriga-se a:</p>
<ul class="list-disc pl-6 space-y-1 mt-2 text-justify">
  <li>Pagar pontualmente o aluguel e os encargos da locação nos prazos e condições pactuados;</li>
  <li>Servir-se do imóvel exclusivamente para o fim ajustado, zelando pelo bem como se fosse seu;</li>
  <li>Levar imediatamente ao conhecimento do LOCADOR o surgimento de qualquer dano, infiltração ou perturbação de terceiros;</li>
  <li>Não modificar a fachada, a estrutura ou a planta do imóvel sem prévio consentimento expresso por escrito do LOCADOR;</li>
  <li>Cumprir estritamente a convenção de condomínio, o regulamento interno e as normas de boa vizinhança.</li>
</ul>`
  },
  {
    id: "clause-9",
    type: "clause",
    clauseNumber: 9,
    clauseTitle: "DA VISTORIA DO IMÓVEL",
    sectionCategory: "Vistoria",
    content: `<p>O imóvel objeto da locação será entregue conforme descrito minuciosamente no <strong>Termo e Laudo de Vistoria de Entrada</strong>, elaborado pela Administradora, que passa a integrar este contrato para todos os efeitos de direito.</p>
<p class="mt-2 text-justify"><strong>Parágrafo Único:</strong> Ao término da locação, será realizada uma Vistoria de Saída para constatar se o imóvel está sendo devolvido nas mesmíssimas condições em que foi recebido, devendo o LOCATÁRIO proceder, às suas expensas, às manutenções, consertos e à pintura geral (com a mesma marca e tonalidade de tinta original) caso verificadas divergências.</p>`
  },
  {
    id: "clause-10",
    type: "clause",
    clauseNumber: 10,
    clauseTitle: "DA RESCISÃO ANTECIPADA E DA MULTA COMPENSATÓRIA",
    sectionCategory: "Rescisão e multas",
    content: `<p>A parte que infringir qualquer das cláusulas deste contrato incorrerá na <strong>multa rescisória compensatória equivalente a {{multa_rescisoria}}</strong>, calculada proporcionalmente ao tempo restante do contrato, na forma do art. 4º da Lei nº 8.245/91 e do art. 413 do Código Civil.</p>
<p class="mt-2 text-justify"><strong>Parágrafo Único:</strong> O LOCATÁRIO ficará dispensado do pagamento da multa rescisória caso a devolução do imóvel decorra de transferência de seu local de prestação de serviços por determinação de seu empregador público ou privado, mediante notificação por escrito com antecedência mínima de 30 (trinta) dias acompanhada do devido comprovante.</p>`
  },
  {
    id: "clause-11",
    type: "clause",
    clauseNumber: 11,
    clauseTitle: "DAS DISPOSIÇÕES GERAIS E COMUNICAÇÕES",
    sectionCategory: "Disposições gerais",
    content: `<p>A tolerância do LOCADOR relativamente a atrasos no pagamento ou ao descumprimento de qualquer obrigação constituirá mera liberalidade, não implicando novação, renúncia de direito ou alteração das condições pactuadas.</p>
<p class="mt-2 text-justify"><strong>Parágrafo Único:</strong> As partes expressamente reconhecem e concordam que notificações, avisos e comunicações oficiais pertinentes ao presente contrato poderão ser realizados validamente por correio eletrônico (e-mail) nos endereços informados no preâmbulo, ou por aplicativo de mensagens instantâneas (WhatsApp) vinculado aos telefones declarados.</p>`
  },
  {
    id: "clause-12",
    type: "clause",
    clauseNumber: 12,
    clauseTitle: "DO FORO DE ELEIÇÃO",
    sectionCategory: "Disposições gerais",
    content: `<p>Para dirimir quaisquer controvérsias ou litígios oriundos da interpretação ou execução do presente contrato, as partes elegem o foro da <strong>{{cidade_foro}}</strong>, com expressa renúncia a qualquer outro, por mais privilegiado que seja.</p>`
  },
  {
    id: "block-signatures",
    type: "signatures",
    clauseTitle: "ASSINATURAS E TESTEMUNHAS",
    sectionCategory: "Assinaturas e testemunhas",
    content: `<p class="text-center font-medium my-4">E, por estarem assim justos e contratados, firmam o presente instrumento em formato digital com valor probante e plena validade jurídica (art. 10, §2º da MP 2.200-2/2001 e Lei Federal nº 14.063/2020), na presença das 02 (duas) testemunhas instrumentárias abaixo qualificadas.</p>
<p class="text-center italic text-slate-600 mb-8">{{data_atual_extenso}}</p>`
  }
];

export const COMMERCIAL_TEMPLATE_BLOCKS: ContractBlock[] = [
  {
    id: "block-title",
    type: "title",
    content: "CONTRATO DE LOCAÇÃO DE IMÓVEL NÃO RESIDENCIAL (COMERCIAL)",
    isLocked: true
  },
  {
    id: "block-subtitle",
    type: "subtitle",
    content: "REGIDO PELA LEI DO INQUILINATO (LEI Nº 8.245/1991)",
    isLocked: true
  },
  {
    id: "block-parties-locador",
    type: "parties",
    clauseTitle: "IDENTIFICAÇÃO DAS PARTES",
    sectionCategory: "Identificação das partes",
    content: `<p><strong>LOCADOR(A):</strong> {{qualificacao_completa_locador}}.</p>
<p class="mt-2"><strong>LOCATÁRIO(A):</strong> {{qualificacao_completa_locatario}}.</p>
<p class="mt-2"><strong>ADMINISTRADORA:</strong> <strong>{{nome_imobiliaria}}</strong>, CNPJ {{cnpj_imobiliaria}}, CRECI {{creci_imobiliaria}}.</p>`
  },
  {
    id: "clause-1",
    type: "clause",
    clauseNumber: 1,
    clauseTitle: "DO OBJETO E DO RAMO DE ATIVIDADE",
    sectionCategory: "Objeto da locação",
    content: `<p>O imóvel situado à <strong>{{endereco_imovel}}</strong> é locado para a finalidade <strong>estritamente comercial</strong>. O LOCATÁRIO declara expressamente que é de sua exclusiva responsabilidade a obtenção de todos os alvarás municipais, sanitários, ambientais e licenças de funcionamento perante o Corpo de Bombeiros e órgãos competentes.</p>`
  },
  {
    id: "clause-2",
    type: "clause",
    clauseNumber: 2,
    clauseTitle: "DO PRAZO E DA VIGÊNCIA",
    sectionCategory: "Prazo contratual",
    content: `<p>O prazo de vigência desta locação não residencial é de <strong>{{prazo_meses}}</strong>, iniciando-se em <strong>{{data_inicio}}</strong> e findando em <strong>{{data_fim}}</strong>, quando o imóvel deverá ser devolvido inteiramente livre de pessoas e bens.</p>`
  },
  {
    id: "clause-3",
    type: "clause",
    clauseNumber: 3,
    clauseTitle: "DO ALUGUEL E REAJUSTE",
    sectionCategory: "Aluguel e condições de pagamento",
    content: `<p>O aluguel mensal é de <strong>{{valor_aluguel}} ({{valor_aluguel_extenso}})</strong>, vencível no dia <strong>{{dia_vencimento}}</strong>, sendo reajustado anualmente com base na variação do <strong>{{indice_reajuste}}</strong>.</p>`
  },
  {
    id: "clause-4",
    type: "clause",
    clauseNumber: 4,
    clauseTitle: "DAS BENFEITORIAS E REFORMAS",
    sectionCategory: "Obrigações do locatário",
    content: `<p>Quaisquer benfeitorias úteis, necessárias ou voluptuárias dependerão de prévia autorização escrita do LOCADOR e passarão a integrar o imóvel, sem direito a retenção ou qualquer indenização ao final do contrato.</p>`
  },
  {
    id: "clause-5",
    type: "clause",
    clauseNumber: 5,
    clauseTitle: "DA GARANTIA LOCATÍCIA",
    sectionCategory: "Garantia locatícia",
    content: `<p>{{modalidade_garantia}}</p>`
  },
  {
    id: "clause-6",
    type: "clause",
    clauseNumber: 6,
    clauseTitle: "DO FORO",
    sectionCategory: "Disposições gerais",
    content: `<p>Eleito o foro da <strong>{{cidade_foro}}</strong> para qualquer ação judicial referente a este contrato.</p>`
  },
  {
    id: "block-signatures",
    type: "signatures",
    clauseTitle: "ASSINATURAS",
    sectionCategory: "Assinaturas e testemunhas",
    content: `<p class="text-center italic text-slate-600 my-6">{{data_atual_extenso}}</p>`
  }
];

export const FIADOR_TEMPLATE_BLOCKS: ContractBlock[] = [
  ...RESIDENTIAL_CAUCAO_BLOCKS.map(block => {
    if (block.id === "block-subtitle") {
      return { ...block, content: "COM GARANTIA DE FIADOR SOLIDÁRIO (LEI FEDERAL Nº 8.245/1991)" };
    }
    if (block.id === "block-parties-locador") {
      return {
        ...block,
        content: block.content + `\n<p class="mt-2"><strong>FIADOR(A):</strong> <strong>{{nome_fiador}}</strong>, portador(a) do CPF nº {{cpf_fiador}}, residente à {{endereco_fiador}}, conjuntamente com seu cônjuge {{conjuge_fiador}}.</p>`
      };
    }
    if (block.id === "clause-6") {
      return {
        ...block,
        clauseTitle: "DA FIANÇA E SOLIDARIEDADE",
        sectionCategory: "Garantia locatícia",
        content: `<p>Assina também o presente contrato, na qualidade de <strong>FIADOR(A) E PRINCIPAL PAGADOR(A)</strong>, {{nome_fiador}}, qualificado(a) no preâmbulo, obrigando-se solidariamente com o LOCATÁRIO pelo exato e pontual cumprimento de todas as obrigações e cláusulas deste contrato.</p>
<p class="mt-2 text-justify"><strong>Parágrafo Primeiro:</strong> O FIADOR expressamente renuncia aos benefícios dos artigos 827, 835, 837 e 838 do Código Civil Brasileiro, reconhecendo que sua obrigação persistirá válida e eficaz até a efetiva entrega das chaves e quitação integral do laudo de vistoria final, mesmo em caso de prorrogação da locação por prazo indeterminado (Súmula 214 do STJ e art. 39 da Lei 8.245/91).</p>`
      };
    }
    return block;
  })
];

export const CREDPAGO_TEMPLATE_BLOCKS: ContractBlock[] = [
  ...RESIDENTIAL_CAUCAO_BLOCKS.map(block => {
    if (block.id === "block-subtitle") {
      return { ...block, content: "COM FIANÇA DIGITAL CREDPAGO / SEGURO FIANÇA" };
    }
    if (block.id === "clause-6") {
      return {
        ...block,
        clauseTitle: "DA GARANTIA LOCATÍCIA (CREDPAGO / SEGURO FIANÇA)",
        sectionCategory: "Garantia locatícia",
        content: `<p>A locação objeto deste contrato está afiançada pela <strong>garantia locatícia digital CredPago</strong>, sob adesão formalizada pelo LOCATÁRIO e aprovada previamente perante a plataforma.</p>
<p class="mt-2 text-justify"><strong>Parágrafo Único:</strong> Em caso de inadimplência do aluguel ou encargos contratuais, a Administradora ou o LOCADOR acionará a CredPago para o pagamento das indenizações devidas, permanecendo o LOCATÁRIO responsável pelo ressarcimento integral das quantias cobertas pela fiança.</p>`
      };
    }
    return block;
  })
];


// Compra e venda com intermediação imobiliária e financiamento bancário.
// Usa os campos do sistema: Locador = VENDEDOR, Locatário = COMPRADOR.
export const VENDA_FINANCIAMENTO_BLOCKS: ContractBlock[] = [
  {
    id: "block-title",
    type: "title",
    content: "INSTRUMENTO PARTICULAR DE COMPRA E VENDA DE IMÓVEL",
    isLocked: true
  },
  {
    id: "block-subtitle",
    type: "subtitle",
    content: "COM INTERMEDIAÇÃO IMOBILIÁRIA E PAGAMENTO MEDIANTE FINANCIAMENTO BANCÁRIO",
    isLocked: true
  },
  {
    id: "block-parties-venda",
    type: "parties",
    clauseTitle: "IDENTIFICAÇÃO DAS PARTES",
    sectionCategory: "Identificação das partes",
    content: `<p><strong>VENDEDOR(A):</strong> {{qualificacao_completa_locador}}, doravante denominado(a) simplesmente <strong>VENDEDOR</strong>.</p>
<p class="mt-2"><strong>COMPRADOR(A):</strong> {{qualificacao_completa_locatario}}, doravante denominado(a) simplesmente <strong>COMPRADOR</strong>.</p>
<p class="mt-2"><strong>INTERMEDIÁRIA (IMOBILIÁRIA):</strong> <strong>{{nome_imobiliaria}}</strong>, inscrita no CNPJ sob o nº {{cnpj_imobiliaria}}, registro no CRECI sob o nº {{creci_imobiliaria}}, estabelecida à {{endereco_imobiliaria}}.</p>`
  },
  {
    id: "block-preambulo-venda",
    type: "paragraph",
    sectionCategory: "Identificação das partes",
    content: `<p>As partes acima qualificadas têm, entre si, justo e contratado o presente instrumento, que se regerá pelas cláusulas e condições seguintes:</p>`
  },
  {
    id: "clause-1",
    type: "clause",
    clauseTitle: "DO OBJETO",
    sectionCategory: "Objeto",
    content: `<p><strong>1.1.</strong> O VENDEDOR é legítimo possuidor e proprietário do imóvel situado à <strong>{{endereco_imovel}}</strong>, registrado no {{cartorio_imovel}}, Comarca de {{cidade_imovel}}/{{estado_imovel}}, sob a matrícula nº <strong>{{matricula_imovel}}</strong>.</p>
<p><strong>1.2.</strong> O imóvel encontra-se atualmente ______________________________________________ (livre e desembaraçado de quaisquer ônus, ou com saldo devedor de financiamento junto a ____________________, contrato nº ____________).</p>`
  },
  {
    id: "clause-2",
    type: "clause",
    clauseTitle: "DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO",
    sectionCategory: "Preço e pagamento",
    content: `<p>O preço total ajustado para a presente venda é de <strong>{{valor_venda}} ({{valor_venda_extenso}})</strong>, que será pago da seguinte forma:</p>
<p><strong>a) Sinal / Princípio de Pagamento:</strong> {{valor_sinal}} ({{valor_sinal_extenso}}), pago diretamente pelo COMPRADOR ao VENDEDOR nesta data, servindo o presente instrumento como recibo.</p>
<p><strong>b) Recursos do Financiamento:</strong> {{valor_financiado}} ({{valor_financiado_extenso}}), que serão liberados pela instituição financeira <strong>{{banco_financiamento}}</strong> em favor do VENDEDOR após a aprovação de crédito, a assinatura do contrato de financiamento habitacional e o respectivo registro no Cartório de Registro de Imóveis.</p>`
  },
  {
    id: "clause-3",
    type: "clause",
    clauseTitle: "DO PRAZO PARA O FINANCIAMENTO",
    sectionCategory: "Financiamento",
    content: `<p><strong>3.1.</strong> O COMPRADOR compromete-se a apresentar toda a documentação necessária à instituição financeira no prazo de {{prazo_documentacao}} dias úteis a contar desta data, para a efetivação da análise de crédito e emissão do contrato de financiamento.</p>
<p><strong>3.2.</strong> Caso o financiamento seja negado pela instituição financeira por motivo não atribuível ao VENDEDOR ou à INTERMEDIÁRIA, este contrato poderá ser rescindido de pleno direito, com a devolução dos valores pagos pelo COMPRADOR, deduzidos os custos operacionais e a comissão de intermediação previamente acordados.</p>`
  },
  {
    id: "clause-4",
    type: "clause",
    clauseTitle: "DA POSSE E DAS DESPESAS",
    sectionCategory: "Posse e despesas",
    content: `<p><strong>4.1.</strong> A posse do imóvel será entregue ao COMPRADOR ______________________________________ (ex.: após a liberação dos recursos pela instituição financeira e quitação total do preço), estando o imóvel livre de pessoas e coisas.</p>
<p><strong>4.2.</strong> Tributos (IPTU), taxas condominiais e contas de consumo (água e energia elétrica) referentes ao período anterior à entrega das chaves são de responsabilidade do VENDEDOR. Os posteriores são de responsabilidade do COMPRADOR.</p>`
  },
  {
    id: "clause-5",
    type: "clause",
    clauseTitle: "DA INTERMEDIAÇÃO E DA COMISSÃO",
    sectionCategory: "Intermediação",
    content: `<p><strong>5.1.</strong> Pela intermediação imobiliária prestada pela {{nome_imobiliaria}}, será devida comissão de {{comissao_percentual}} sobre o valor total da venda, totalizando <strong>{{valor_comissao}} ({{valor_comissao_extenso}})</strong>, a ser paga pelo <strong>{{comissao_paga_por}}</strong> no ato do recebimento do sinal ou da liberação do financiamento.</p>`
  },
  {
    id: "clause-6",
    type: "clause",
    clauseTitle: "DO FORO",
    sectionCategory: "Disposições gerais",
    content: `<p><strong>6.1.</strong> As partes elegem o foro da <strong>{{cidade_foro}}</strong> para dirimir quaisquer dúvidas ou litígios decorrentes deste instrumento, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>`
  },
  {
    id: "block-assinaturas-venda",
    type: "paragraph",
    clauseTitle: "ASSINATURAS",
    sectionCategory: "Assinaturas e testemunhas",
    content: `<p style="text-align:center">E, por estarem justos e contratados, assinam o presente em 3 (três) vias de igual teor e forma.</p>
<p style="text-align:center"><em>{{data_atual_extenso}}</em></p>
<p><br></p>
<p style="text-align:center">_______________________________________________<br><strong>{{nome_locador}}</strong><br>VENDEDOR(A)</p>
<p><br></p>
<p style="text-align:center">_______________________________________________<br><strong>{{nome_locatario}}</strong><br>COMPRADOR(A)</p>
<p><br></p>
<p style="text-align:center">_______________________________________________<br><strong>{{nome_imobiliaria}}</strong><br>INTERMEDIÁRIA — CRECI {{creci_imobiliaria}}</p>
<p><br></p>
<p>Testemunhas:</p>
<p>1. _________________________________ CPF: ____________________</p>
<p>2. _________________________________ CPF: ____________________</p>`
  }
];

// Locação residencial no modelo usado pela imobiliária (cláusulas por seção:
// destinação, prazo, vistoria, preferência, comunicação, valores, reajuste,
// benfeitorias, garantia, devolução, prorrogação e foro). Muda só a garantia.
function locacaoModeloImobiliaria(subtitulo: string, garantia: string): ContractBlock[] {
  return [
    {
      id: "block-title",
      type: "title",
      content: "CONTRATO DE LOCAÇÃO DE IMÓVEL RESIDENCIAL",
      isLocked: true
    },
    {
      id: "block-subtitle",
      type: "subtitle",
      content: subtitulo,
      isLocked: true
    },
    {
      id: "block-parties-locacao",
      type: "parties",
      clauseTitle: "IDENTIFICAÇÃO DAS PARTES",
      sectionCategory: "Identificação das partes",
      content: `<p><strong>LOCADOR(A):</strong> {{qualificacao_completa_locador}}, doravante denominado(a) simplesmente <strong>LOCADOR</strong>.</p>
<p class="mt-2"><strong>LOCATÁRIO(A):</strong> {{qualificacao_completa_locatario}}, doravante denominado(a) simplesmente <strong>LOCATÁRIO</strong>.</p>
<p class="mt-2"><strong>ADMINISTRADORA:</strong> <strong>{{nome_imobiliaria}}</strong>, inscrita no CNPJ sob o nº {{cnpj_imobiliaria}}, CRECI {{creci_imobiliaria}}, com sede à {{endereco_imobiliaria}}.</p>`
    },
    {
      id: "block-imovel-locacao",
      type: "paragraph",
      clauseTitle: "DO IMÓVEL",
      sectionCategory: "Identificação do imóvel",
      content: `<p>As partes acima qualificadas têm, entre si, justo e contratado o presente instrumento particular de locação do imóvel {{tipo_imovel}} situado à <strong>{{endereco_imovel}}</strong>, que se regerá pelas cláusulas e condições seguintes.</p>`
    },
    {
      id: "clause-1",
      type: "clause",
      clauseNumber: 1,
      clauseTitle: "DA DESTINAÇÃO",
      sectionCategory: "Objeto da locação",
      content: `<p><strong>1.1.</strong> A finalidade do imóvel é exclusivamente residencial, sendo proibido ao LOCATÁRIO sublocá-lo ou dar qualquer outra finalidade ao mesmo.</p>`
    },
    {
      id: "clause-2",
      type: "clause",
      clauseNumber: 2,
      clauseTitle: "DO PRAZO",
      sectionCategory: "Prazo contratual",
      content: `<p><strong>2.1.</strong> A locação terá duração de <strong>{{prazo_meses}}</strong>, com início em <strong>{{data_inicio}}</strong> e término previsto para <strong>{{data_fim}}</strong>.</p>
<p><strong>2.2.</strong> O contrato poderá ser rescindido sem cobrança de multa a partir de <strong>{{data_aniversario_contrato}}</strong>, desde que haja aviso prévio, por escrito, com 60 (sessenta) dias de antecedência.</p>
<p><strong>2.3.</strong> Antes dessa data, a parte que rescindir o contrato pagará à outra multa pecuniária correspondente a 1,5 (um e meio) aluguel vigente.</p>`
    },
    {
      id: "clause-3",
      type: "clause",
      clauseNumber: 3,
      clauseTitle: "DA VISTORIA DA LOCAÇÃO",
      sectionCategory: "Vistoria",
      content: `<p><strong>3.1.</strong> O imóvel entregue na data da assinatura deste contrato, pelo LOCADOR ao LOCATÁRIO, possui as características contidas no auto de vistoria anexo, que desde já aceitam expressamente.</p>
<p><strong>3.2.</strong> O imóvel será entregue nas condições descritas no auto de vistoria, ou seja, com instalações elétricas e hidráulicas em perfeito funcionamento, assim como os demais itens descritos no termo de vistoria, devendo o LOCATÁRIO mantê-lo dessa forma. Fica também acordado que o imóvel será devolvido nas mesmas condições previstas no auto de vistoria e, no ato da entrega das chaves, com todos os tributos e despesas pagos.</p>`
    },
    {
      id: "clause-4",
      type: "clause",
      clauseNumber: 4,
      clauseTitle: "DO DIREITO DE PREFERÊNCIA E DAS VISTORIAS ESPORÁDICAS",
      sectionCategory: "Vistoria",
      content: `<p><strong>4.1.</strong> Caso o LOCADOR manifeste vontade de vender o imóvel objeto do presente, deverá propor por escrito ao LOCATÁRIO, que se obrigará a emitir resposta em 30 (trinta) dias a partir da comunicação inicial.</p>
<p><strong>4.2.</strong> Não se manifestando o LOCATÁRIO no prazo estipulado no item anterior, permitirá desde logo ao LOCADOR vistoriar o imóvel com possíveis pretendentes.</p>
<p><strong>4.3.</strong> O LOCATÁRIO, juntamente com o LOCADOR, declara que a vistoria será feita no ato da entrega das chaves, confirmando suas reais condições. A vistoria inicial será anexada e servirá como base comparativa na vistoria final, que ocorrerá no momento da entrega do imóvel, quando serão identificados possíveis danos e/ou alterações no imóvel.</p>
<p><strong>4.4.</strong> O LOCATÁRIO permitirá ao LOCADOR realizar vistorias no imóvel em dia e hora a serem combinados, podendo este averiguar o funcionamento de todas as instalações e acessórios. Constatado algum vício que possa afetar a estrutura física do imóvel, ficará o LOCATÁRIO obrigado a realizar o conserto no prazo de 30 (trinta) dias. Não ocorrendo o conserto, o LOCADOR poderá rescindir o contrato, sem prejuízo dos valores previstos neste instrumento.</p>`
    },
    {
      id: "clause-5",
      type: "clause",
      clauseNumber: 5,
      clauseTitle: "DA INFORMAÇÃO ENTRE OS CONTRATANTES",
      sectionCategory: "Disposições gerais",
      content: `<p><strong>5.1.</strong> As partes ficam desde já acordadas a se comunicarem somente por escrito, por e-mail ou por qualquer meio admitido em Direito. Na ausência de qualquer das partes, as mesmas se comprometem a deixar nomeados procuradores responsáveis para tal fim.</p>`
    },
    {
      id: "clause-6",
      type: "clause",
      clauseNumber: 6,
      clauseTitle: "DO VENCIMENTO E DO VALOR DA LOCAÇÃO",
      sectionCategory: "Aluguel e condições de pagamento",
      content: `<p><strong>6.1.</strong> Fica acordado entre LOCADOR e LOCATÁRIO que o valor da locação será mensal e deverá ser pago via boleto bancário, nas seguintes condições:</p>
<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:10pt">
  <tr>
    <th style="border:1px solid #cbd5e1;padding:6px;background:#f1f5f9;text-align:center">Valor do aluguel</th>
    <th style="border:1px solid #cbd5e1;padding:6px;background:#f1f5f9;text-align:center">Vencimento</th>
    <th style="border:1px solid #cbd5e1;padding:6px;background:#f1f5f9;text-align:center">Seguro incêndio</th>
  </tr>
  <tr>
    <td style="border:1px solid #cbd5e1;padding:6px;text-align:center"><strong>{{valor_aluguel}}</strong><br>({{valor_aluguel_extenso}})</td>
    <td style="border:1px solid #cbd5e1;padding:6px;text-align:center">Todo dia {{dia_vencimento}}</td>
    <td style="border:1px solid #cbd5e1;padding:6px;text-align:center">{{seguro_incendio}}</td>
  </tr>
</table>
<p><strong>6.2.</strong> Além do aluguel mensal, incumbirão ao LOCATÁRIO as despesas provenientes de sua utilização, bem como seguro incêndio, IPTU e consumos de água e energia, que serão pagos diretamente às empresas concessionárias dos referidos serviços. O LOCATÁRIO obriga-se a efetuar pontualmente o pagamento dessas despesas e a encaminhar ao LOCADOR os respectivos comprovantes no mesmo dia do pagamento.</p>
<p><strong>6.3.</strong> Os encargos da locação são de inteira responsabilidade do LOCATÁRIO, que se obriga a pagá-los em seus respectivos vencimentos, devendo comprová-los ao LOCADOR sempre que solicitado e, em especial, no encerramento do contrato.</p>
<p><strong>6.4.</strong> Fica ao LOCATÁRIO a responsabilidade de zelar pela conservação e limpeza do imóvel, efetuando as reformas necessárias para sua manutenção, cujos gastos correrão por sua conta. O LOCATÁRIO está obrigado a devolver o imóvel em perfeitas condições de limpeza, conservação e pintura quando findo ou rescindido este contrato, conforme o termo de vistoria anexo.</p>
<p><strong>6.5.</strong> Em caso de cobrança judicial ou extrajudicial dos valores decorrentes deste contrato, o LOCATÁRIO será responsável pelo pagamento dos honorários advocatícios, fixados em até 20% (vinte por cento) sobre o valor total do débito, além das custas judiciais, extrajudiciais e demais encargos legais incidentes.</p>
<p><strong>6.6.</strong> Não efetuando o pagamento do aluguel até a data estipulada, o LOCATÁRIO fica obrigado a pagar multa de {{multa_atraso}} sobre o valor do aluguel, bem como juros de mora de {{juros_mora}}.</p>
<p><strong>6.7.</strong> O LOCADOR ou seu procurador fica obrigado a emitir recibo da quantia paga, discriminando todos os valores de juros ou outras despesas, desde que o LOCATÁRIO apresente os comprovantes de todas as despesas do imóvel devidamente quitadas.</p>
<p><strong>6.8.</strong> Faculta-se ao LOCADOR ou a seu procurador cobrar do LOCATÁRIO os aluguéis, tributos e despesas vencidos oriundos deste contrato, utilizando-se de todos os meios legais admitidos.</p>`
    },
    {
      id: "clause-7",
      type: "clause",
      clauseNumber: 7,
      clauseTitle: "DOS REAJUSTES DO ALUGUEL",
      sectionCategory: "Reajustes e encargos",
      content: `<p><strong>7.1.</strong> O valor da locação será reajustado anualmente. O próximo reajuste será aplicado em <strong>{{data_aniversario_contrato}}</strong>, de acordo com a variação acumulada do <strong>{{indice_reajuste}}</strong>. Na ausência desse índice, será adotado outro legalmente previsto, conforme prévia convenção das partes.</p>`
    },
    {
      id: "clause-8",
      type: "clause",
      clauseNumber: 8,
      clauseTitle: "DAS BENFEITORIAS E CONSTRUÇÕES",
      sectionCategory: "Obrigações do locatário",
      content: `<p><strong>8.1.</strong> O LOCATÁRIO não poderá realizar obras que alterem ou modifiquem a estrutura do imóvel locado sem prévia autorização por escrito do LOCADOR. Caso este consinta na realização das obras, elas ficarão desde logo incorporadas ao imóvel, sem que assista ao LOCATÁRIO qualquer indenização pelas obras ou direito de retenção por benfeitorias.</p>
<p><strong>8.2.</strong> As benfeitorias removíveis poderão ser retiradas, desde que não desfigurem o imóvel locado.</p>`
    },
    {
      id: "clause-9",
      type: "clause",
      clauseNumber: 9,
      clauseTitle: "DA GARANTIA LOCATÍCIA",
      sectionCategory: "Garantia locatícia",
      content: garantia
    },
    {
      id: "clause-10",
      type: "clause",
      clauseNumber: 10,
      clauseTitle: "DA DEVOLUÇÃO DO IMÓVEL FINDO O PRAZO DA LOCAÇÃO",
      sectionCategory: "Vistoria",
      content: `<p><strong>10.1.</strong> O LOCATÁRIO restituirá o imóvel locado nas mesmas condições em que o recebeu, pintado com a mesma tinta e na cor descrita no auto de vistoria, com as instalações elétricas, hidráulicas e acessórios em perfeitas condições de funcionamento, salvo as deteriorações decorrentes do uso normal e habitual do imóvel.</p>
<p><strong>10.2.</strong> Caso o LOCATÁRIO não realize os serviços necessários ao término do contrato, serão feitos 3 (três) orçamentos e será acatado o de menor valor. O LOCATÁRIO fará o pagamento do valor estabelecido e a imobiliária se responsabilizará pela execução dos serviços.</p>
<p><strong>10.3.</strong> Os autos de vistoria inicial e final farão parte deste contrato e conterão a assinatura dos contratantes e de duas testemunhas.</p>`
    },
    {
      id: "clause-11",
      type: "clause",
      clauseNumber: 11,
      clauseTitle: "DA PRORROGAÇÃO DO CONTRATO",
      sectionCategory: "Prazo contratual",
      content: `<p><strong>11.1.</strong> Ultrapassada a data prevista, tornando-se o contrato por tempo indeterminado, o LOCADOR poderá rescindi-lo a qualquer tempo, mediante notificação por escrito ao LOCATÁRIO, que deverá desocupar o imóvel no prazo de 30 (trinta) dias a contar do recebimento da notificação.</p>
<p><strong>11.2.</strong> Ocorrendo a prorrogação, LOCATÁRIO e LOCADOR ficarão obrigados por todo o teor deste contrato. Havendo continuidade, fica o LOCATÁRIO obrigado a se apresentar às concessionárias de água e energia e renovar junto a elas os prazos de suas obrigações.</p>`
    },
    {
      id: "clause-12",
      type: "clause",
      clauseNumber: 12,
      clauseTitle: "DO FORO",
      sectionCategory: "Disposições gerais",
      content: `<p><strong>12.1.</strong> Fica eleito o foro da <strong>{{cidade_foro}}</strong> para dirimir eventuais controvérsias oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.</p>`
    },
    {
      id: "block-signatures",
      type: "signatures",
      clauseTitle: "ASSINATURAS E TESTEMUNHAS",
      sectionCategory: "Assinaturas e testemunhas",
      content: `<p class="text-center font-medium my-4">E, por estarem assim justas e contratadas, as partes assinam o presente instrumento particular em duas vias de igual teor, na presença de duas testemunhas.</p>
<p class="text-center italic text-slate-600 mb-8">{{data_atual_extenso}}</p>`
    }
  ];
}

export const LOCACAO_LOCARMAIS_BLOCKS: ContractBlock[] = locacaoModeloImobiliaria(
  "COM GARANTIA LOCATÍCIA LOCARMAIS",
  `<p><strong>9.1.</strong> O LOCATÁRIO realizou a contratação da <strong>LOCARMAIS</strong>, LOCAR MAIS SERVIÇOS DE COBRANÇA LTDA, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº 35.045.603/0001-94, com sede na Cidade e Comarca de Maringá, Estado do Paraná, na Avenida Pioneiro Alício Arantes Campolina, nº 2527, Jardim Canadá, CEP 87.083-020, a qual se compromete a efetuar o pagamento de eventuais débitos relativos ao aluguel e demais encargos da presente locação que venham a ser inadimplidos pelo LOCATÁRIO, conforme condições e limitações constantes nos Termos e Condições Gerais dos Serviços LOCARMAIS, que integram o presente contrato como <strong>ANEXO I</strong>.</p>
<p><strong>9.2.</strong> As partes declaram expressamente que estão cientes de todas as condições e limitações relativas à fiança prestada pela LOCARMAIS, notadamente quanto (a) ao valor máximo de sua responsabilidade, (b) às limitações de sua responsabilidade, (c) ao prazo de sua vigência, (d) às condições para sua renovação e (e) às hipóteses de sua exoneração.</p>
<p><strong>9.3.</strong> O LOCATÁRIO declara, ainda, estar ciente de que, em caso de exoneração da LOCARMAIS da condição de fiadora, caberá a ele promover, no prazo máximo de 30 (trinta) dias, a substituição da garantia locatícia, sob pena de infração contratual e ajuizamento da competente ação de despejo.</p>
<p><strong>Nota — ANEXO I:</strong> é o termo firmado entre a LOCARMAIS e o LOCATÁRIO, impresso no acesso restrito da imobiliária e extraído do processo eletrônico de análise do LOCATÁRIO após a LOCARMAIS aprovar o cadastro e o inquilino aceitar os Termos e Condições Gerais.</p>`
);

export const LOCACAO_LOFT_BLOCKS: ContractBlock[] = locacaoModeloImobiliaria(
  "COM GARANTIA LOCATÍCIA LOFT (FIANÇA CREDPAGO)",
  `<p><strong>9.1.</strong> O LOCATÁRIO realizou a contratação da garantia locatícia <strong>LOFT FIANÇA (CredPago)</strong>, ______________________________________________, inscrita no CNPJ/MF sob o nº ______________________, a qual se compromete a efetuar o pagamento de eventuais débitos relativos ao aluguel e demais encargos da presente locação que venham a ser inadimplidos pelo LOCATÁRIO, conforme condições e limitações constantes nos Termos e Condições Gerais da garantia Loft, que integram o presente contrato como <strong>ANEXO I</strong>.</p>
<p><strong>9.2.</strong> As partes declaram expressamente que estão cientes de todas as condições e limitações relativas à garantia prestada pela LOFT, notadamente quanto (a) ao valor máximo de sua responsabilidade, (b) às limitações de sua responsabilidade, (c) ao prazo de sua vigência, (d) às condições para sua renovação e (e) às hipóteses de sua exoneração.</p>
<p><strong>9.3.</strong> O LOCATÁRIO declara, ainda, estar ciente de que, em caso de cancelamento ou exoneração da garantia LOFT, caberá a ele promover, no prazo máximo de 30 (trinta) dias, a substituição da garantia locatícia, sob pena de infração contratual e ajuizamento da competente ação de despejo.</p>
<p><strong>Nota — ANEXO I:</strong> é o termo firmado entre a LOFT e o LOCATÁRIO, emitido na plataforma da Loft após a aprovação do cadastro e o aceite dos Termos e Condições Gerais pelo inquilino.</p>`
);

export const INITIAL_PREDEFINED_TEMPLATES: ContratoModelo[] = [
  {
    id: "modelo-padrao-caucao",
    companyId: "global",
    nome: "Locação Residencial Padrão (Caução 3 Meses)",
    descricao: "Modelo completo com 14 seções jurídicas, de acordo com a Lei 8.245/91 e caução em poupança vinculada.",
    tipoLocacao: "residencial",
    isPadrao: true,
    categoria: "Residencial",
    blocks: RESIDENTIAL_CAUCAO_BLOCKS,
    styleSettings: DEFAULT_STYLE_SETTINGS,
    criadoPorUid: "system",
    criadoPorNome: "Ponto Chave",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "modelo-residencial-fiador",
    companyId: "global",
    nome: "Locação Residencial com Fiador Solidário",
    descricao: "Contrato com cláusula de fiança solidária, renúncia expressa ao benefício de ordem e cônjuge anuente.",
    tipoLocacao: "residencial",
    isPadrao: false,
    categoria: "Residencial",
    blocks: FIADOR_TEMPLATE_BLOCKS,
    styleSettings: DEFAULT_STYLE_SETTINGS,
    criadoPorUid: "system",
    criadoPorNome: "Ponto Chave",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "modelo-credpago-seguro",
    companyId: "global",
    nome: "Locação Residencial com CredPago / Fiança Digital",
    descricao: "Ideal para contratações ágeis com fiança CredPago ou seguro de garantia locatícia.",
    tipoLocacao: "residencial",
    isPadrao: false,
    categoria: "Garantia Digital",
    blocks: CREDPAGO_TEMPLATE_BLOCKS,
    styleSettings: DEFAULT_STYLE_SETTINGS,
    criadoPorUid: "system",
    criadoPorNome: "Ponto Chave",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "modelo-locacao-loft",
    companyId: "global",
    nome: "Contrato Locação Loft",
    descricao: "Locação residencial no modelo da imobiliária, com garantia Loft (fiança CredPago), multa de 1,5 aluguel e rescisão sem multa após 12 meses.",
    tipoLocacao: "residencial",
    isPadrao: false,
    categoria: "Garantia Digital",
    blocks: LOCACAO_LOFT_BLOCKS,
    styleSettings: DEFAULT_STYLE_SETTINGS,
    criadoPorUid: "system",
    criadoPorNome: "Ponto Chave",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "modelo-locacao-locarmais",
    companyId: "global",
    nome: "Contrato Locação Locarmais",
    descricao: "Locação residencial no modelo da imobiliária, com garantia Locarmais (Anexo I), multa de 1,5 aluguel e rescisão sem multa após 12 meses.",
    tipoLocacao: "residencial",
    isPadrao: false,
    categoria: "Garantia Digital",
    blocks: LOCACAO_LOCARMAIS_BLOCKS,
    styleSettings: DEFAULT_STYLE_SETTINGS,
    criadoPorUid: "system",
    criadoPorNome: "Ponto Chave",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "modelo-comercial-padrao",
    companyId: "global",
    nome: "Locação Comercial / Não Residencial",
    descricao: "Estrutura para salas, galpões e lojas com cláusulas de alvará, benfeitorias comerciais e ramo de atividade.",
    tipoLocacao: "comercial",
    isPadrao: false,
    categoria: "Comercial",
    blocks: COMMERCIAL_TEMPLATE_BLOCKS,
    styleSettings: {
      ...DEFAULT_STYLE_SETTINGS,
      primaryColor: "#0f766e" // teal
    },
    criadoPorUid: "system",
    criadoPorNome: "Ponto Chave",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "modelo-venda-financiamento",
    companyId: "global",
    nome: "Compra e Venda com Intermediação e Financiamento Bancário",
    tipoDocumento: "venda",
    descricao: "Instrumento particular de compra e venda com sinal, recursos de financiamento (ex.: Caixa), prazo para documentação, posse, despesas e comissão da imobiliária.",
    tipoLocacao: "residencial",
    isPadrao: false,
    categoria: "Compra e Venda",
    blocks: VENDA_FINANCIAMENTO_BLOCKS,
    styleSettings: DEFAULT_STYLE_SETTINGS,
    criadoPorUid: "system",
    criadoPorNome: "Ponto Chave",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
