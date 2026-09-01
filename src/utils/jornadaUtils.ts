import { UserProfile, JornadaDiasConfig, EscalaTipo } from "../types";

export interface EscalaPredefinida {
  id: EscalaTipo;
  label: string;
  shortLabel: string;
  semanalHoras: number;
  descricao: string;
  dias: JornadaDiasConfig;
  diariaBase: number;
}

export const ESCALAS_PREDEFINIDAS: EscalaPredefinida[] = [
  {
    id: "44h_seg_sex_8h_sab_4h",
    label: "44h Semanais — Seg a Sex (8h) + Sábado (4h)",
    shortLabel: "44h semanais (Seg a Sex 8h + Sáb 4h)",
    semanalHoras: 44,
    descricao: "Segunda a Sexta: 8h/dia | Sábado: 4h (08:00 às 12:00) | Domingo: Folga",
    dias: { seg: 480, ter: 480, qua: 480, qui: 480, sex: 480, sab: 240, dom: 0 },
    diariaBase: 480
  },
  {
    id: "44h_seg_sex_8h48",
    label: "44h Semanais — Seg a Sex (8h48m compensado / Sáb livre)",
    shortLabel: "44h semanais (Seg a Sex 8h48m compensado)",
    semanalHoras: 44,
    descricao: "Segunda a Sexta: 8h48m/dia (528 min) | Sábado e Domingo: Folgas",
    dias: { seg: 528, ter: 528, qua: 528, qui: 528, sex: 528, sab: 0, dom: 0 },
    diariaBase: 528
  },
  {
    id: "40h_seg_sex_8h",
    label: "40h Semanais — Seg a Sex (8h / Sáb e Dom livres)",
    shortLabel: "40h semanais (Seg a Sex 8h)",
    semanalHoras: 40,
    descricao: "Segunda a Sexta: 8h/dia | Sábado e Domingo: Folgas",
    dias: { seg: 480, ter: 480, qua: 480, qui: 480, sex: 480, sab: 0, dom: 0 },
    diariaBase: 480
  },
  {
    id: "30h_seg_sex_6h",
    label: "30h Semanais — Seg a Sex (6h / Meio período)",
    shortLabel: "30h semanais (Seg a Sex 6h)",
    semanalHoras: 30,
    descricao: "Segunda a Sexta: 6h/dia | Sábado e Domingo: Folgas",
    dias: { seg: 360, ter: 360, qua: 360, qui: 360, sex: 360, sab: 0, dom: 0 },
    diariaBase: 360
  },
  {
    id: "personalizado",
    label: "Personalizada por Dia da Semana",
    shortLabel: "Personalizada",
    semanalHoras: 0,
    descricao: "Defina a carga horária de cada dia individualmente",
    dias: { seg: 480, ter: 480, qua: 480, qui: 480, sex: 480, sab: 240, dom: 0 },
    diariaBase: 480
  }
];

export function getExpectedDailyMinutes(
  dateStrOrDay: string | number,
  userProfile?: {
    jornadaDiariaMinutos?: number;
    jornadaSemanalHoras?: number;
    escalaTipo?: EscalaTipo | string;
    jornadaDias?: JornadaDiasConfig;
  } | null
): number {
  let dayOfWeek = 0;
  if (typeof dateStrOrDay === "number") {
    dayOfWeek = dateStrOrDay;
  } else if (typeof dateStrOrDay === "string") {
    const parts = dateStrOrDay.split("-");
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      dayOfWeek = d.getDay();
    }
  }

  // Se houver configuração de dias personalizada
  if (userProfile?.jornadaDias) {
    const mapKeys: (keyof JornadaDiasConfig)[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
    const key = mapKeys[dayOfWeek];
    if (typeof userProfile.jornadaDias[key] === "number") {
      return userProfile.jornadaDias[key];
    }
  }

  const escalaId = userProfile?.escalaTipo || (
    userProfile?.jornadaSemanalHoras === 40 ? "40h_seg_sex_8h" :
    userProfile?.jornadaSemanalHoras === 30 ? "30h_seg_sex_6h" :
    userProfile?.jornadaSemanalHoras === 44 ? "44h_seg_sex_8h_sab_4h" :
    "44h_seg_sex_8h_sab_4h" // Padrão CLT comercial
  );

  const matched = ESCALAS_PREDEFINIDAS.find(e => e.id === escalaId);
  if (matched && matched.dias) {
    const mapKeys: (keyof JornadaDiasConfig)[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
    const key = mapKeys[dayOfWeek];
    return matched.dias[key] ?? 0;
  }

  // Fallback seguro
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    return userProfile?.jornadaDiariaMinutos ?? 480;
  }
  if (dayOfWeek === 6) {
    return 240; // 4h sábado
  }
  return 0; // Domingo
}

export function getJornadaDescription(userProfile?: UserProfile | null): string {
  if (!userProfile) return "44h semanais (Seg a Sex 8h + Sáb 4h)";

  if (userProfile.escalaDescricao) {
    return userProfile.escalaDescricao;
  }

  const escalaId = userProfile.escalaTipo || (
    userProfile.jornadaSemanalHoras === 40 ? "40h_seg_sex_8h" :
    userProfile.jornadaSemanalHoras === 30 ? "30h_seg_sex_6h" :
    userProfile.jornadaSemanalHoras === 44 ? "44h_seg_sex_8h_sab_4h" :
    "44h_seg_sex_8h_sab_4h"
  );

  const matched = ESCALAS_PREDEFINIDAS.find(e => e.id === escalaId);
  if (matched && matched.id !== "personalizado") {
    return matched.shortLabel;
  }

  if (userProfile.jornadaDias) {
    const totalMin = Object.values(userProfile.jornadaDias).reduce((a, b) => a + b, 0);
    const totalHoras = (totalMin / 60).toFixed(0);
    const sab = userProfile.jornadaDias.sab > 0 ? ` + Sáb ${(userProfile.jornadaDias.sab / 60).toFixed(0)}h` : "";
    return `${totalHoras}h semanais (Seg a Sex ${(userProfile.jornadaDias.seg / 60).toFixed(0)}h${sab})`;
  }

  if (userProfile.jornadaSemanalHoras) {
    return `${userProfile.jornadaSemanalHoras}h semanais`;
  }

  return "44h semanais (Seg a Sex 8h + Sáb 4h)";
}
