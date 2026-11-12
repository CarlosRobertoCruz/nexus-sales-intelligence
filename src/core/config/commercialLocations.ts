export type CoverageLocation = { id: string; label: string; aliases: ReadonlyArray<string>; mapRegion: string };

// Coverage names supplied by the team. Network folders are not neighborhoods.
export const COVERAGE_LOCATIONS: ReadonlyArray<CoverageLocation> = [
  { id: "muriqui", label: "Muriqui", aliases: ["muriqui", "vila muriqui", "vila de muriqui", "cunhambe", "cunhambebe", "cunhambebe cachoeira", "cachoeira", "cachoeira de muriqui", "cachoeira do muriqui", "cachoeira muriqui", "cunhambebe muriqui", "cunhambebe cachoeira muriqui", "vila muriqui cunhambebe"], mapRegion: "Muriqui" },
  { id: "praia-grande", label: "Praia Grande", aliases: ["praia grande"], mapRegion: "Praia Grande" },
  { id: "sahy-condominios", label: "Sahy (Condomínios)", aliases: ["sahy condominios", "sahy condominio", "condominios sahy", "condominios do sahy", "condominio sahy", "condominio do sahy"], mapRegion: "Sahy" },
  { id: "sahy-bairro", label: "Sahy (Bairro)", aliases: ["sahy bairro", "bairro sahy", "bairro do sahy"], mapRegion: "Sahy" },
  { id: "sahy", label: "Sahy", aliases: ["sahy"], mapRegion: "Sahy" },
  { id: "praia-pequena", label: "Praia Pequena", aliases: ["praia pequena"], mapRegion: "Praia Pequena" },
  { id: "praia-brava", label: "Praia Brava", aliases: ["praia brava"], mapRegion: "Praia Brava" },
  { id: "apara", label: "Apara", aliases: ["apara", "praia do apara", "praia de apara"], mapRegion: "Apara" },
  { id: "ibicui", label: "Ibicuí", aliases: ["ibicui", "praia de ibicui"], mapRegion: "Ibicuí" },
  { id: "centro", label: "Centro", aliases: ["centro", "centro de mangaratiba", "mangaratiba centro"], mapRegion: "Centro" },
  { id: "praia-do-saco", label: "Praia do Saco", aliases: ["praia do saco", "praia de saco"], mapRegion: "Praia do Saco" },
  { id: "junqueira", label: "Junqueira (Santo Antônio)", aliases: ["junqueira", "santo antonio", "junqueira santo antonio", "santo antonio junqueira"], mapRegion: "Junqueira (Santo Antônio)" },
];

const LEGACY_LOCATIONS: ReadonlyArray<CoverageLocation> = [
  { id: "itacuruca", label: "Itacuruçá", aliases: ["itacuruca"], mapRegion: "Itacuruçá" },
  { id: "jacarei", label: "Conceição de Jacareí", aliases: ["conceicao de jacarei"], mapRegion: "Conceição de Jacareí" },
  { id: "piloto", label: "Serra do Piloto", aliases: ["serra do piloto"], mapRegion: "Serra do Piloto" },
  { id: "bela-vista", label: "Parque Bela Vista", aliases: ["parque bela vista", "bela vista"], mapRegion: "Parque Bela Vista" },
];
const LOCATIONS = [...COVERAGE_LOCATIONS, ...LEGACY_LOCATIONS];

export function locationKey(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function folderKey(value: string): string {
  return locationKey(value.replace(/^\s*\d{1,2}\s*[.-]\s*/, "").replace(/\s*\(\d+\)\s*$/, ""));
}
export function isMissingLocation(value: unknown): boolean {
  return /^(?:|nao informad[oa]|localidade nao informada|sem bairro|sem localidade|n a|na|backbone\s*\d*)$/.test(locationKey(value));
}
export function coverageLocation(value: string): CoverageLocation | undefined {
  const key = folderKey(value);
  return LOCATIONS.find(item => folderKey(item.label) === key || item.aliases.includes(key));
}
export function canonicalLocation(value: unknown, city?: unknown): string | undefined {
  if (typeof value !== "string" || isMissingLocation(value) || /^\d+$/.test(value.trim())) return undefined;
  const item = coverageLocation(value);
  // A homonymous neighborhood in another city must not become a Mangaratiba pin.
  if (item && ["centro", "muriqui", "junqueira"].includes(item.id) && city &&
      !/^(?:mangaratiba|muriqui|vila muriqui)$/.test(locationKey(city))) return `${value.trim()} (${String(city).trim()})`;
  return item?.label ?? value.trim().replace(/\s+/g, " ");
}

function matches(text: string): string | undefined {
  const padded = ` ${locationKey(text)} `;
  let found = LOCATIONS.filter(item => item.aliases.some(alias => padded.includes(` ${alias} `)));
  // A sublocality carries its explicitly supplied parent without being ambiguous.
  if (found.some(item => item.id === "sahy-bairro" || item.id === "sahy-condominios")) found = found.filter(item => item.id !== "sahy");
  return found.length === 1 ? found[0].label : undefined;
}
export function locationInAddress(value: string, city?: string, structured = false): string | undefined {
  // Ordinary conversation mentioning a neighborhood is not address evidence.
  const labelled = [...value.matchAll(/\b(?:bairro|localidade|regi[aã]o)\s*[:=-]\s*([^\n;|]+)/gi)].map(match => match[1]);
  const addressLines = value.split(/\r?\n/).filter(line => /\bendere[cç]o\s*[:=-]|^\s*(?:rua|r\.|avenida|av\.|estrada|rodovia|travessa|alameda)\s/i.test(line));
  const sources = labelled.length ? labelled : (structured ? [value] : addressLines).map(source => {
    const address=source.replace(/^.*?endere[cç]o\s*[:=-]\s*/i, "");
    // A street can share a neighborhood name. Inspect the address suffix only.
    if(/^\s*(?:rua|r\.|avenida|av\.|estrada|rodovia|travessa|alameda)\s/i.test(address)) {
      const parts=address.split(/,|\s+-\s+/);
      return parts.length>1?parts.slice(1).join(" "):"";
    }
    return address;
  });
  const found = new Set(sources.map(source => matches(source)).filter((label): label is string => Boolean(label)));
  return found.size === 1 ? canonicalLocation([...found][0], city) : undefined;
}
