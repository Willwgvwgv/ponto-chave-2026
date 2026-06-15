import React from "react";
import { cn } from "../../lib/utils";

interface StatusBadgeProps {
  status: "PENDING" | "PARTIAL" | "PAID" | "overdue" | "OVERDUE" | "pending";
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const styles = {
    PENDING: "bg-amber-100 text-amber-800 border-amber-200",
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    PARTIAL: "bg-orange-100 text-orange-850 border-orange-200",
    PAID: "bg-emerald-100 text-emerald-800 border-emerald-200",
    overdue: "bg-red-100 text-red-800 border-red-200 animate-pulse-slow",
    OVERDUE: "bg-red-100 text-red-800 border-red-200 animate-pulse-slow",
  };

  const labels = {
    PENDING: "Pendente",
    pending: "Pendente",
    PARTIAL: "Parcial",
    PAID: "Pago",
    overdue: "Atrasado",
    OVERDUE: "Atrasado",
  };

  const isOverdue = status === "overdue" || status === "OVERDUE";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all duration-300",
        styles[status] || styles.PENDING,
        isOverdue && "border-red-300 shadow-sm shadow-red-100",
        className
      )}
    >
      <span className={cn(
        "w-1.5 h-1.5 rounded-full mr-1.5",
        status === "PENDING" || status === "pending" ? "bg-amber-500" :
        status === "PARTIAL" ? "bg-orange-500" :
        isOverdue ? "bg-red-600 animate-ping absolute block w-1.5 h-1.5 rounded-full opacity-75" :
        "bg-emerald-500"
      )} />
      {isOverdue && (
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-600 mr-1.5"></span>
      )}
      {labels[status] || status}
    </span>
  );
};
