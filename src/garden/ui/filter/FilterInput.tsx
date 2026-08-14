/** Camada core/ui/filter — input de busca padrao para listas (forwardRef); nao normaliza nem aplica debounce/filter. */
import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { Input } from "@/garden/foundations";

interface FilterInputProps extends Omit<HTMLAttributes<HTMLElement>, "onChange" | "size" | "disabled"> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  size?: string;
  disabled?: boolean;
}

const FilterInput = forwardRef<HTMLInputElement, FilterInputProps>(
  (
    {
      value,
      onChange,
      placeholder = "Buscar...",
      icon,
      size,
      ...props
    },
    ref
  ) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      onChange?.(e.target.value);
    }

    return (
      <Input
        ref={ref as React.Ref<HTMLInputElement>}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        icon={icon}
        size={size as "sm" | "md" | "lg" | undefined}
        multiline={false}
        {...props}
      />
    );
  }
);

export default FilterInput;
