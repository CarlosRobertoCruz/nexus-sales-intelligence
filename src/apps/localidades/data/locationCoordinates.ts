import type { CommercialLocationMetric, MappedCommercialLocation } from "../types/locations";

type Coordinate = { label: string; latitude: number; longitude: number };

const KNOWN_LOCATIONS: ReadonlyArray<{ pattern: RegExp; coordinate: Coordinate }> = [
  { pattern: /conceicao de jacarei/, coordinate: { label: "Conceição de Jacareí", latitude: -23.035, longitude: -44.164 } },
  { pattern: /itacuruca/, coordinate: { label: "Itacuruçá", latitude: -22.927, longitude: -43.899 } },
  { pattern: /praia grande/, coordinate: { label: "Praia Grande", latitude: -22.923208, longitude: -43.978044 } },
  { pattern: /vila muriqui|muriqui/, coordinate: { label: "Muriqui", latitude: -22.929, longitude: -43.956 } },
  { pattern: /serra do piloto/, coordinate: { label: "Serra do Piloto", latitude: -22.894, longitude: -44.102 } },
  { pattern: /praia pequena/, coordinate: { label: "Praia Pequena", latitude: -22.946667, longitude: -44.015 } },
  { pattern: /praia brava/, coordinate: { label: "Praia Brava", latitude: -22.95163, longitude: -44.01606 } },
  { pattern: /praia do saco/, coordinate: { label: "Praia do Saco", latitude: -22.94697, longitude: -44.04393 } },
  { pattern: /praia do apara|\bapara\b/, coordinate: { label: "Apara", latitude: -22.955637, longitude: -44.021617 } },
  { pattern: /ibicui/, coordinate: { label: "Ibicuí", latitude: -22.966, longitude: -44.037 } },
  { pattern: /junqueira/, coordinate: { label: "Junqueira", latitude: -22.968, longitude: -44.050 } },
  { pattern: /sahy/, coordinate: { label: "Sahy", latitude: -22.936, longitude: -43.998 } },
  { pattern: /parque bela vista|bela vista/, coordinate: { label: "Mangaratiba", latitude: -22.9600193, longitude: -44.04111 } },
  { pattern: /mangaratiba/, coordinate: { label: "Mangaratiba", latitude: -22.959, longitude: -44.041 } },
];

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function fallbackCoordinate(location: string): Coordinate {
  const seed = [...normalize(location)].reduce((total, character) => total + character.charCodeAt(0), 0);
  const angle = (seed % 360) * (Math.PI / 180);
  const distance = 0.018 + (seed % 7) * 0.004;
  return { label: location, latitude: -22.959 + Math.sin(angle) * distance, longitude: -44.041 + Math.cos(angle) * distance };
}

export function mapCommercialLocations(metrics: ReadonlyArray<CommercialLocationMetric>): ReadonlyArray<MappedCommercialLocation> {
  const consolidated = new Map<string, MappedCommercialLocation>();
  for (const metric of metrics) {
    const known = KNOWN_LOCATIONS.find((item) => item.pattern.test(normalize(metric.location)));
    const coordinate = known?.coordinate ?? fallbackCoordinate(metric.location);
    const current = consolidated.get(coordinate.label);
    consolidated.set(coordinate.label, {
      location: coordinate.label,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      approximate: current ? current.approximate && !known : !known,
      sales: (current?.sales ?? 0) + metric.sales,
      renewals: (current?.renewals ?? 0) + metric.renewals,
      cancellations: (current?.cancellations ?? 0) + metric.cancellations,
    });
  }
  return [...consolidated.values()];
}
