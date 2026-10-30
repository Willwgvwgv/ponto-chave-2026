import * as React from "react";
import { Clock } from "lucide-react";

// createdAt/completedAt vêm do Firestore (Timestamp), mas logo após criar a tarefa
// o valor ainda é null até o servidor confirmar. Aceita também texto ISO ou número.
export const paraData = (valor: any): Date | null => {
  if (!valor) return null;
  if (typeof valor.toDate === "function") return valor.toDate();
  if (typeof valor.seconds === "number") return new Date(valor.seconds * 1000);
  const d = new Date(valor);
  return isNaN(d.getTime()) ? null : d;
};

const p2 = (n: number) => String(n).padStart(2, "0");
const formatarDataHora = (d: Date) =>
  `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} às ${p2(d.getHours())}:${p2(d.getMinutes())}`;

export const tempoDecorrido = (desde: Date, agora = new Date()) => {
  const min = Math.max(0, Math.floor((agora.getTime() - desde.getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "1 dia" : `${dias} dias`;
};

/**
 * Mostra quando a tarefa foi criada e, se ainda não foi concluída, há quanto
 * tempo está parada (cor muda conforme o tempo: cinza, laranja a partir de
 * 1 dia, vermelho a partir de 3 dias). Concluídas mostram quando foram concluídas.
 */
export const TaskIdade = ({ task, compacto = false }: { task: any; compacto?: boolean }) => {
  const temCriacao = task && "createdAt" in task;
  const criada = paraData(task?.createdAt) || (temCriacao ? new Date() : null); // null = gravando agora
  if (!criada) return null; // tarefas antigas, de antes de existir a data de criação

  const agora = new Date();
  const horasParada = (agora.getTime() - criada.getTime()) / 3600000;
  const concluida = paraData(task.completedAt);

  const corParada =
    horasParada >= 72 ? "bg-red-50 text-red-700 border-red-200" :
    horasParada >= 24 ? "bg-amber-50 text-amber-700 border-amber-200" :
    "bg-slate-50 text-slate-500 border-slate-200";

  const texto = compacto ? "text-[9px]" : "text-[10px]";

  return (
    <div className={`mt-1 flex flex-wrap items-center gap-1.5 ${texto}`}>
      <span className="text-slate-400 font-medium inline-flex items-center gap-1" title={`Criada em ${formatarDataHora(criada)}`}>
        <Clock className="w-3 h-3" />
        Criada em {formatarDataHora(criada)}
      </span>
      {!task.completed ? (
        <span
          className={`px-1.5 py-0.5 rounded-md border font-bold uppercase tracking-wide ${corParada}`}
          title="Tempo desde a criação sem ser concluída"
        >
          Parada há {tempoDecorrido(criada, agora)}
        </span>
      ) : concluida ? (
        <span className="px-1.5 py-0.5 rounded-md border font-bold uppercase tracking-wide bg-green-50 text-green-700 border-green-200">
          Concluída em {tempoDecorrido(criada, concluida)}
        </span>
      ) : null}
    </div>
  );
};
