import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ComboSelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

const NONE_TOKEN = "__combo_none__";

export type ComboSelectProps = {
  value: string | null | undefined;
  onChange: (v: string) => void;
  options: ComboSelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
  /** Se true, um item com value="" será interpretado como "nenhum". */
  allowEmpty?: boolean;
};

/**
 * Wrapper do shadcn Select com API estilo <select native>: aceita `value` string
 * (inclusive `""`) e uma lista `options`. Substitui os `<select>` nativos para
 * ter aparência consistente e legível no desktop.
 */
export function ComboSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
  triggerClassName,
  contentClassName,
  disabled,
}: ComboSelectProps) {
  const mapped = React.useMemo(
    () => options.map((o) => ({ ...o, _v: o.value === "" ? NONE_TOKEN : o.value })),
    [options],
  );
  const current = value == null || value === "" ? undefined : value;

  return (
    <Select
      value={current}
      onValueChange={(v) => onChange(v === NONE_TOKEN ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger className={cn("bg-input", className, triggerClassName)}>
        <SelectValue placeholder={placeholder ?? "Selecionar…"} />
      </SelectTrigger>
      <SelectContent className={cn("z-[100]", contentClassName)}>
        {mapped.map((o) => (
          <SelectItem key={o._v} value={o._v} disabled={o.disabled}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default ComboSelect;