import type { CSSProperties } from "react";
import {
  BRAZIL_STATES,
  MANGARATIBA_PATH,
  MAP_FOCUS,
} from "./geography/brazilMap";

export function BrazilMap({ animated = false }: { animated?: boolean }) {
  const cameraStyle = {
    "--focus-x": `${MAP_FOCUS.x}px`,
    "--focus-y": `${MAP_FOCUS.y}px`,
    "--pan-x": `${500 - MAP_FOCUS.x}px`,
    "--pan-y": `${480 - MAP_FOCUS.y}px`,
  } as CSSProperties;
  return (
    <svg
      className={animated ? "sales-brazil-map is-animated" : "sales-brazil-map"}
      viewBox="0 0 1000 960"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g className="sales-map-camera" style={cameraStyle}>
        {BRAZIL_STATES.map((state) => (
          <path
            key={state.id}
            d={state.path}
            className={
              state.id === "33" ? "sales-map-state is-rio" : "sales-map-state"
            }
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          d={MANGARATIBA_PATH}
          className="sales-map-municipality"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={MAP_FOCUS.x}
          cy={MAP_FOCUS.y}
          r="4"
          className="sales-map-dot"
        />
      </g>
    </svg>
  );
}
