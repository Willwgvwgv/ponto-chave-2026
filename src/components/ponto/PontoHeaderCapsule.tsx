import React, { useState, useEffect } from "react";
import { Clock, Check, Sparkles, Zap } from "lucide-react";
import { usePontoHoje, useRegistrarPonto } from "../../hooks/useQueries";
import { UserProfile } from "../../types";
import { toast } from "sonner";

interface PontoHeaderCapsuleProps {
  profile: UserProfile | null;
  onClick: () => void;
}

export const PontoHeaderCapsule: React.FC<PontoHeaderCapsuleProps> = ({ profile, onClick }) => {
  const userId = profile?.uid || "";
  const userName = profile?.displayName || "Colaborador";
  const agencyId = profile?.companyId || "default_agency";
  const jornada = profile?.jornadaDiariaMinutos || 480;

  const { data: pontoHoje, isLoading } = usePontoHoje(userId);
  const registrarPontoMutation = useRegistrarPonto();

  // Simple state to force update time or check intervals every 30 seconds
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  if (isLoading || !profile) {
    return (
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-100 bg-slate-50/50 animate-pulse w-32 h-8" />
    );
  }

  // Determine next register step
  let nextPunch: "entrada" | "saidaAlmoco" | "retornoAlmoco" | "saida" | "none" = "entrada";

  if (pontoHoje) {
    if (!pontoHoje.entrada) {
      nextPunch = "entrada";
    } else if (!pontoHoje.saidaAlmoco) {
      nextPunch = "saidaAlmoco";
    } else if (!pontoHoje.retornoAlmoco) {
      nextPunch = "retornoAlmoco";
    } else if (!pontoHoje.saida) {
      nextPunch = "saida";
    } else {
      nextPunch = "none";
    }
  }

  const handlePunch = (campo: "entrada" | "saidaAlmoco" | "retornoAlmoco" | "saida") => {
    const hhmm = now.toTimeString().split(" ")[0].slice(0, 5); // "HH:mm"
    const campoLabels = {
      entrada: "Entrada",
      saidaAlmoco: "Saída Almoço",
      retornoAlmoco: "Retorno Almoço",
      saida: "Saída"
    };

    registrarPontoMutation.mutate({
      userId,
      userName,
      agencyId,
      campo,
      horario: hhmm,
      jornadaDiariaMinutos: jornada
    }, {
      onSuccess: () => {
        toast.success(`Ponto registrado: ${campoLabels[campo]} às ${hhmm}`);
      },
      onError: (err: any) => {
        toast.error(`Erro ao registrar ponto: ${err?.message || err}`);
      }
    });
  };

  // Determine if a quick-stamp button should be visible in the header
  const getQuickPunchAvailability = () => {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const totalMinutesNow = currentHour * 60 + currentMinute;

    if (nextPunch === "entrada") {
      // Entrada button is visible between 06:00 and 11:30
      const isAvailable = (totalMinutesNow >= 6 * 60 && totalMinutesNow <= 11 * 60 + 30);
      return {
        isAvailable,
        label: "Iniciar Dia",
        colorClass: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100",
      };
    }

    if (nextPunch === "saidaAlmoco") {
      // Saída Almoço button is visible between 11:30 and 14:15
      const isAvailable = (totalMinutesNow >= 11 * 60 + 30 && totalMinutesNow <= 14 * 60 + 15);
      return {
        isAvailable,
        label: "Ir p/ Almoço",
        colorClass: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-100",
      };
    }

    if (nextPunch === "retornoAlmoco") {
      // Retorno do Almoço button is visible between 12:00 and 16:30
      const isAvailable = (totalMinutesNow >= 12 * 60 && totalMinutesNow <= 16 * 60 + 30);
      return {
        isAvailable,
        label: "Voltar Almoço",
        colorClass: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100",
      };
    }

    if (nextPunch === "saida") {
      // Saída button is visible after 16:00 or after completing the daily hours
      let calculatedExitMinutes = 17 * 60; // default 17:00
      if (pontoHoje?.entrada) {
        const [entH, entM] = pontoHoje.entrada.split(":").map(Number);
        // Jornada + lunch break (average 60m)
        calculatedExitMinutes = entH * 60 + entM + jornada + 60; 
      }

      const isAvailable = (totalMinutesNow >= (calculatedExitMinutes - 45) || totalMinutesNow >= 16 * 60);
      return {
        isAvailable,
        label: "Encerrar Dia",
        colorClass: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-100",
      };
    }

    return {
      isAvailable: false,
      label: "",
      colorClass: "",
    };
  };

  const getStatusLabelText = () => {
    switch (nextPunch) {
      case "entrada":
        return "Ausente";
      case "saidaAlmoco":
        return "No Expediente";
      case "retornoAlmoco":
        return "Em Almoço";
      case "saida":
        return "No Expediente";
      default:
        return "Fim de Turno";
    }
  };

  const statusLabel = getStatusLabelText();
  const quickOption = getQuickPunchAvailability();

  return (
    <div className="hidden md:flex items-center gap-2">
      {/* Small informative status capsule (Clicking goes to full point page) */}
      <div
        onClick={onClick}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-100/80 bg-slate-50/70 hover:bg-white text-slate-700 cursor-pointer transition-all hover:scale-101 active:scale-98 select-none shadow-xs group`}
        title="Visualizar Espelho de Ponto"
      >
        <div className="relative flex items-center justify-center">
          <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
          <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
            nextPunch === "none" ? "bg-teal-500" : nextPunch === "entrada" ? "bg-slate-350 bg-slate-400" : "bg-emerald-500 animate-pulse"
          }`} />
        </div>

        <div className="flex flex-col text-left">
          <span className="text-[8px] font-black uppercase tracking-wider leading-none text-slate-400">
            Ponto Hoje
          </span>
          <span className="text-[10px] font-black uppercase tracking-tight leading-none mt-0.5 text-slate-700">
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Button widget: only visible when appropriate punch window is open */}
      {quickOption.isAvailable && nextPunch !== "none" && (
        <button
          onClick={() => handlePunch(nextPunch)}
          disabled={registrarPontoMutation.isPending}
          className={`px-3 py-1.5 ${quickOption.colorClass} font-black text-[10px] uppercase tracking-wider rounded-full shadow-md hover:scale-102 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 select-none cursor-pointer`}
          title={`Registrar ${quickOption.label} agora`}
        >
          <Zap className="w-2.5 h-2.5 fill-current animate-bounce" />
          <span>{quickOption.label}</span>
        </button>
      )}

      {/* If fully completed today, show tiny subtle check to reward collaborator */}
      {nextPunch === "none" && (
        <div className="px-3 py-1.5 bg-teal-50/80 border border-teal-100 text-teal-700 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1 select-none">
          <Check className="w-3 h-3 text-teal-600 font-extrabold" />
          <span>Concluído</span>
        </div>
      )}
    </div>
  );
};
