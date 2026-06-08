import React from "react";
import { cn } from "../../lib/utils";

interface StatusBadgeProps {
  status: "PENDING" | "PARTIAL" | "PAID";
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const styles = {
    PENDING: "bg-amber-100 text-amber-800 border-amber-200",
    PARTIAL: "bg-orange-100 text-orange-850 border-orange-200",
    PAID: "bg-emerald-100 text-emerald-800 border-emerald-200"
  };

  const labels = {
    PENDING: "Pendente",
    PARTIAL: "Parcial",
    PAID: "Pago"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
        styles[status] || styles.PENDING,
        className
      )}
    >
      <span className={cn(
        "w-1.5 h-1.5 rounded-full mr-1.5",
        status === "PENDING" ? "bg-amber-500" : status === "PARTIAL" ? "bg-orange-500" : "bg-emerald-500"
      )} />
      {labels[status] || status}
    </span>
  );
};
