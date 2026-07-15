"use client";
import { useState } from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 ${className}`}>
      {children}
    </div>
  );
}

export function PageTitle({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
      <h1 className="text-xl font-bold">{children}</h1>
      {actions}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "big";
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary: "bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm",
    secondary: "bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-4 py-2 text-sm",
    danger: "bg-white hover:bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 text-xs",
    big: "bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 text-lg w-full",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-semibold transition-colors disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-emerald-600"
      />
      {label}
    </label>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-slate-400 py-10 text-sm">{children}</div>;
}

/** Collapsible "Add" form wrapper. */
export function AddPanel({
  buttonLabel,
  children,
  open,
  setOpen,
}: {
  buttonLabel: string;
  children: React.ReactNode;
  open?: boolean;
  setOpen?: (v: boolean) => void;
}) {
  const [internal, setInternal] = useState(false);
  const isOpen = open ?? internal;
  const toggle = setOpen ?? setInternal;
  return (
    <div className="mb-4">
      {!isOpen ? (
        <Btn onClick={() => toggle(true)}>+ {buttonLabel}</Btn>
      ) : (
        <Card className="border-emerald-300">
          <div className="flex justify-between items-center mb-3">
            <span className="font-semibold text-sm">{buttonLabel}</span>
            <button onClick={() => toggle(false)} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          </div>
          {children}
        </Card>
      )}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-start text-xs text-slate-500 border-b border-slate-200">
            {head.map((h, i) => (
              <th key={i} className="text-start py-2 px-2 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
