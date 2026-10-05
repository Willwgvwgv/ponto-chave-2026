import { ContractBlock, ContractStyleSettings } from "../types/contractTypes";

/**
 * A4 physical dimensions at standard 96 DPI screen resolution
 * Width: 210mm = 793.7px (~794px)
 * Height: 297mm = 1122.5px (~1123px)
 */
export const A4_DIMENSIONS = {
  widthPx: 794,
  heightPx: 1123,
  widthMm: 210,
  heightMm: 297
};

export interface MarginConfig {
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  contentWidthPx: number;
}

export function getMarginConfig(marginType?: "estreita" | "padrao" | "ampla"): MarginConfig {
  switch (marginType) {
    case "estreita": // ~15mm
      return {
        paddingTop: 48,
        paddingBottom: 44,
        paddingLeft: 56,
        paddingRight: 56,
        contentWidthPx: 794 - 112 // 682px
      };
    case "ampla": // ~30mm
      return {
        paddingTop: 75,
        paddingBottom: 65,
        paddingLeft: 95,
        paddingRight: 95,
        contentWidthPx: 794 - 190 // 604px
      };
    case "padrao": // ~25mm
    default:
      return {
        paddingTop: 60,
        paddingBottom: 52,
        paddingLeft: 76,
        paddingRight: 76,
        contentWidthPx: 794 - 152 // 642px
      };
  }
}

/**
 * Calculates available vertical height inside an A4 sheet for document content
 */
export function getAvailableContentHeight(
  pageIndex: number,
  styles: ContractStyleSettings,
  marginConfig: MarginConfig
): number {
  const totalHeight = A4_DIMENSIONS.heightPx;
  const verticalPadding = marginConfig.paddingTop + marginConfig.paddingBottom;

  // Header height
  let headerHeight = 0;
  if (styles.showHeader) {
    if (pageIndex === 0) {
      headerHeight = 85; // First page full header with logo & company info
    } else {
      headerHeight = 36; // Subsequent pages running header
    }
  }

  // Footer height
  let footerHeight = 0;
  if (styles.showFooter) {
    footerHeight = 42; // Footer with page numbers and company address
  }

  // Safety buffer to ensure no line touches the footer boundary
  const safetyBuffer = 24;

  const available = totalHeight - verticalPadding - headerHeight - footerHeight - safetyBuffer;
  return Math.max(300, available);
}

/**
 * Strips HTML tags to count raw readable characters
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Estimates rendered height of a contract block in pixels based on styling parameters
 */
export function estimateBlockHeight(
  block: ContractBlock,
  styles: ContractStyleSettings,
  hasFiador = false
): number {
  if (block.type === "page_break") {
    return 0;
  }

  const fontSize = styles.fontSizePt || 11;
  const lineSpacing = styles.lineSpacing || 1.35;
  const paragraphSpacing = styles.paragraphSpacingPx || 12;
  const lineHeightPx = fontSize * 1.33 * lineSpacing;

  if (block.type === "title") {
    return 55 + paragraphSpacing;
  }

  if (block.type === "subtitle") {
    return 40 + paragraphSpacing;
  }

  if (block.type === "divider") {
    return 28;
  }

  if (block.type === "parties") {
    const rawText = stripHtml(block.content || "");
    const estimatedLines = Math.max(3, Math.ceil(rawText.length / 75));
    // Box padding (32px) + header (26px) + text lines + margin
    return 58 + estimatedLines * (13.5 * lineSpacing) + paragraphSpacing;
  }

  if (block.type === "signatures") {
    const rawText = stripHtml(block.content || "");
    const introLines = Math.max(1, Math.ceil(rawText.length / 80));
    const introHeight = introLines * lineHeightPx + 16;
    const baseGridHeight = 130; // Locador + Locatário
    const fiadorHeight = hasFiador ? 75 : 0;
    const witnessesHeight = 90; // 2 Testemunhas
    return introHeight + baseGridHeight + fiadorHeight + witnessesHeight + 20;
  }

  if (block.type === "clause") {
    const rawText = stripHtml(block.content || "");
    // Clause header: CLÁUSULA Xª - TITULO (~32px)
    const headerHeight = 32;
    // Estimate paragraphs and lines
    const paragraphs = block.content.split(/<\/?p>/).filter(p => p.trim().length > 0);
    const countP = Math.max(1, paragraphs.length);
    const estimatedLines = Math.max(1, Math.ceil(rawText.length / 78));
    const textHeight = estimatedLines * lineHeightPx + (countP - 1) * 8;
    return headerHeight + textHeight + paragraphSpacing;
  }

  // Default / paragraph block
  const rawText = stripHtml(block.content || "");
  const estimatedLines = Math.max(1, Math.ceil(rawText.length / 80));
  return estimatedLines * lineHeightPx + paragraphSpacing;
}

export interface PageBlockItem {
  block: ContractBlock;
  globalIndex: number;
  /** Quando a cláusula é dividida entre páginas: trechos [partStart, partEnd) */
  partStart?: number;
  partEnd?: number;
}

/** Medida real de um bloco divisível: altura do título e de cada trecho do texto */
export interface BlockPartsMeasure {
  header: number;
  parts: number[];
}

export interface PageLayout {
  pageIndex: number;
  pageNumber: number; // 1-indexed
  blocks: PageBlockItem[];
  estimatedHeight: number;
  maxAvailableHeight: number;
}

/**
 * Distributes contract blocks across real A4 pages so that no content
 * spills beyond physical page borders.
 */
export function paginateBlocks(
  blocks: ContractBlock[],
  styles: ContractStyleSettings,
  measuredHeights?: Record<string, number>,
  hasFiador = false,
  measuredParts?: Record<string, BlockPartsMeasure>,
  alturaUtilMedida?: { primeira?: number; demais?: number }
): PageLayout[] {
  const marginConfig = getMarginConfig(styles.marginType);
  // Usa a altura útil medida na tela (cabeçalho/rodapé reais) quando houver
  const maxPage1 = alturaUtilMedida?.primeira || getAvailableContentHeight(0, styles, marginConfig);
  const maxOther = alturaUtilMedida?.demais || getAvailableContentHeight(1, styles, marginConfig);

  const pages: PageLayout[] = [];
  let currentPageBlocks: PageBlockItem[] = [];
  let currentHeight = 0;
  let currentPageIndex = 0;

  const getPageMax = (pageIdx: number) => (pageIdx === 0 ? maxPage1 : maxOther);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Manual page break block forces new page immediately
    if (block.type === "page_break") {
      if (currentPageBlocks.length > 0) {
        pages.push({
          pageIndex: currentPageIndex,
          pageNumber: currentPageIndex + 1,
          blocks: currentPageBlocks,
          estimatedHeight: currentHeight,
          maxAvailableHeight: getPageMax(currentPageIndex)
        });
        currentPageIndex++;
        currentPageBlocks = [];
        currentHeight = 0;
      }
      continue;
    }

    // Cláusulas e parágrafos longos podem continuar na página seguinte,
    // para não deixar espaço em branco no fim da página.
    const medida = measuredParts?.[block.id];
    if (medida && medida.parts.length > 1 && (block.type === "clause" || block.type === "paragraph")) {
      const gap = Math.max(styles.paragraphSpacingPx || 12, 16);
      const fecharPagina = () => {
        pages.push({
          pageIndex: currentPageIndex,
          pageNumber: currentPageIndex + 1,
          blocks: currentPageBlocks,
          estimatedHeight: currentHeight,
          maxAvailableHeight: getPageMax(currentPageIndex)
        });
        currentPageIndex++;
        currentPageBlocks = [];
        currentHeight = 0;
      };
      let start = 0;
      while (start < medida.parts.length) {
        const restante = getPageMax(currentPageIndex) - currentHeight;
        // o primeiro bloco da folha não tem espaço acima dele
        let altura = (start === 0 ? medida.header : 0) + (currentPageBlocks.length > 0 ? gap : 0);
        let end = start;
        while (end < medida.parts.length && altura + medida.parts[end] <= restante) {
          altura += medida.parts[end];
          end++;
        }
        if (end === start) {
          if (currentPageBlocks.length > 0) { fecharPagina(); continue; }
          // Página vazia e o trecho não cabe: coloca assim mesmo
          altura += medida.parts[start];
          end = start + 1;
        }
        const inteiro = start === 0 && end === medida.parts.length;
        currentPageBlocks.push(inteiro ? { block, globalIndex: i } : { block, globalIndex: i, partStart: start, partEnd: end });
        currentHeight += altura;
        start = end;
        if (start < medida.parts.length) fecharPagina();
      }
      continue;
    }

    const blockHeight = measuredHeights?.[block.id] || estimateBlockHeight(block, styles, hasFiador);
    const maxH = getPageMax(currentPageIndex);

    // If adding this block would exceed page limit AND page already has at least one block:
    // Move block to next page!
    if (currentPageBlocks.length > 0 && currentHeight + blockHeight > maxH) {
      pages.push({
        pageIndex: currentPageIndex,
        pageNumber: currentPageIndex + 1,
        blocks: currentPageBlocks,
        estimatedHeight: currentHeight,
        maxAvailableHeight: maxH
      });
      currentPageIndex++;
      currentPageBlocks = [{ block, globalIndex: i }];
      currentHeight = blockHeight;
    } else {
      currentPageBlocks.push({ block, globalIndex: i });
      currentHeight += blockHeight;
    }
  }

  // Push final page
  if (currentPageBlocks.length > 0 || pages.length === 0) {
    pages.push({
      pageIndex: currentPageIndex,
      pageNumber: currentPageIndex + 1,
      blocks: currentPageBlocks,
      estimatedHeight: currentHeight,
      maxAvailableHeight: getPageMax(currentPageIndex)
    });
  }

  return pages;
}
