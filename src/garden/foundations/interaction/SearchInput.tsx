import type { InputHTMLAttributes } from "react";
import Input from "./Input";
import Icon from "../display/Icon";
import { SearchIcon } from "@/garden/foundations/assets/icons/icons";

type SearchInputSize = "sm" | "md" | "lg";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  placeholder?: string;
  size?: SearchInputSize;
}

export function SearchInput({ placeholder = "Buscar...", size = "md", ...props }: SearchInputProps) {
  return (
    <Input
      type="text"
      size={size}
      placeholder={placeholder}
      icon={
        <Icon size="sm" color="inherit">
          <SearchIcon />
        </Icon>
      }
      {...props}
    />
  );
}
