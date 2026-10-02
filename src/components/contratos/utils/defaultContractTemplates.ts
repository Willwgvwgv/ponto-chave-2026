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
