/**
 * Foundation — agrupador label + control para formularios.
 *
 * Empilha um `Text size="md" weight={600}` (label) sobre `children` (input/textarea/
 * combo). Usa `Stack` com gap compacto entre label e controlo. Sem label, e' so' um wrapper com gap.
 *
 * Com `labelFor`, o label e' um `<label htmlFor=...>` — o controlo em `children`
 * deve usar o mesmo `id` para a11y (clique no texto foca o campo).
 */

import Stack from "./Stack";
import Text from "../display/Text";
import { TOKENS } from "@/garden/tokens";
import type { ReactNode } from "react";

type FieldProps = {
  label?: string;
  /** Com `label`, `id` do controlo (ex. `useId()`) para associar label ao input. */
  labelFor?: string;
  children?: ReactNode;
};

function Field({ label, labelFor, children }: FieldProps) {
  const labelNode =
    label &&
    (labelFor ? (
      <label
        htmlFor={labelFor}
        style={{
          display: "block",
          margin: 0,
          padding: 0,
          cursor: "default",
        }}
      >
        <Text size="md" weight={600}>
          {label}
        </Text>
      </label>
    ) : (
      <Text size="md" weight={600}>
        {label}
      </Text>
    ));

  return (
    <Stack gap={TOKENS.spacing[4]}>
      {labelNode}

      {children}
    </Stack>
  );
}

export default Field;