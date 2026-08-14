import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { SpreadsheetImportController } from "@/apps/importacao/controller/useSpreadsheetImportController";
import { Badge, KpiCard, Row, Select, Stack, Surface, Text } from "@/garden/foundations";
import { ChartColumnBigIcon, MapPinnedIcon, SalesChartIcon, SparklesIcon } from "@/garden/foundations/assets/icons/icons";
import { TOKENS } from "@/garden/tokens";
import { mapCommercialLocations } from "../data/locationCoordinates";
import type { LocationMetricId, MappedCommercialLocation } from "../types/locations";

const METRICS: ReadonlyArray<{ value: LocationMetricId; label: string; singular: string; color: string }> = [
  { value: "sales", label: "Vendas", singular: "vendas", color: TOKENS.color.brand.primary },
  { value: "renewals", label: "Renovações", singular: "renovações", color: TOKENS.color.feedback.success },
  { value: "cancellations", label: "Cancelamentos", singular: "cancelamentos", color: TOKENS.color.feedback.danger },
];

function metricValue(location: MappedCommercialLocation, metric: LocationMetricId): number {
  return location[metric];
}

function MapView({ locations, metric }: { locations: ReadonlyArray<MappedCommercialLocation>; metric: LocationMetricId }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const metricConfig = METRICS.find((item) => item.value === metric) ?? METRICS[0];

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [-44.035, -22.958],
      zoom: 10.4,
      minZoom: 8,
      maxZoom: 16,
      attributionControl: false,
      style: {
        version: 8,
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
        layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.68, "raster-contrast": 0.08, "raster-brightness-max": 0.84 } }],
      },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    const visible = locations.filter((location) => metricValue(location, metric) > 0);
    const maximum = Math.max(...visible.map((location) => metricValue(location, metric)), 1);

    markersRef.current = visible.map((location) => {
      const value = metricValue(location, metric);
      const size = 34 + Math.sqrt(value / maximum) * 34;
      const element = document.createElement("button");
      element.type = "button";
      element.className = "commercial-map-marker";
      element.setAttribute("aria-label", `${location.location}: ${value} ${metricConfig.singular}`);
      Object.assign(element.style, {
        width: `${size}px`, height: `${size}px`, background: metricConfig.color,
        borderColor: TOKENS.color.content.inverse, boxShadow: `0 8px 24px ${metricConfig.color}66`,
      });
      element.textContent = String(value);

      const popupContent = document.createElement("div");
      popupContent.className = "commercial-map-popup";
      const title = document.createElement("strong");
      title.textContent = location.location;
      const details = document.createElement("span");
      details.textContent = `${location.sales} vendas · ${location.renewals} renovações · ${location.cancellations} cancelamentos`;
      popupContent.append(title, details);
      if (location.approximate) {
        const note = document.createElement("small");
        note.textContent = "Posição aproximada pela localidade informada";
        popupContent.append(note);
      }
      return new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([location.longitude, location.latitude])
        .setPopup(new maplibregl.Popup({ offset: Math.ceil(size / 2), closeButton: false }).setDOMContent(popupContent))
        .addTo(map);
    });

    if (visible.length > 1) {
      const bounds = visible.reduce((current, location) => current.extend([location.longitude, location.latitude]), new maplibregl.LngLatBounds());
      map.fitBounds(bounds, { padding: 72, maxZoom: 12, duration: 650 });
    } else if (visible[0]) {
      map.easeTo({ center: [visible[0].longitude, visible[0].latitude], zoom: 11.5, duration: 650 });
    }
  }, [locations, metric, metricConfig.color, metricConfig.singular]);

  return <div ref={containerRef} className="commercial-map" aria-label={`Mapa comercial por ${metricConfig.label.toLowerCase()}`} />;
}

export function LocalitiesPage({ controller, periodSelector }: { controller: SpreadsheetImportController; periodSelector: ReactNode }) {
  const [metric, setMetric] = useState<LocationMetricId>("sales");
  const locations = useMemo(() => mapCommercialLocations(controller.locationMetrics), [controller.locationMetrics]);
  const ranked = useMemo(() => [...locations].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)), [locations, metric]);
  const total = ranked.reduce((sum, location) => sum + metricValue(location, metric), 0);
  const leader = ranked[0];
  const leaderValue = leader ? metricValue(leader, metric) : 0;
  const concentration = total ? Math.round((leaderValue / total) * 100) : 0;
  const metricConfig = METRICS.find((item) => item.value === metric) ?? METRICS[0];

  return (
    <main className="app-main">
      <Stack gap={TOKENS.spacing[24]}>
        <header className="page-header">
          <Stack gap={TOKENS.spacing[8]}>
            <Text size="xs" weight={800} tone="brand" style={{ textTransform: "uppercase", letterSpacing: TOKENS.typography.letterSpacing.eyebrow }}>INTELIGÊNCIA GEOGRÁFICA</Text>
            <Text size="title-lg" weight={800} block>Mapa por localidade</Text>
            <Text size="md" tone="secondary" block>Enxergue onde os movimentos comerciais estão concentrados sem expor endereços individuais.</Text>
          </Stack>
          <Row align="center" gap={TOKENS.spacing[10]} style={{ flexWrap: "wrap" }}><Badge variant="info">Dados importados</Badge>{periodSelector}</Row>
        </header>

        <section className="kpi-grid" aria-label="Indicadores geográficos">
          <KpiCard label="Localidades ativas" value={String(ranked.filter((location) => metricValue(location, metric) > 0).length)} subLabel={`com ${metricConfig.singular} no período`} icon={<MapPinnedIcon />} iconColor={TOKENS.color.chart.seriesPrimary} iconBg={TOKENS.color.brand.soft} />
          <KpiCard label={metricConfig.label} value={String(total)} subLabel="registros no mapa" icon={<SalesChartIcon />} iconColor={metricConfig.color} iconBg={TOKENS.color.brand.soft} />
          <KpiCard label="Maior concentração" value={leader?.location ?? "Sem dados"} subLabel={`${leaderValue} ${metricConfig.singular}`} icon={<SparklesIcon />} iconColor={TOKENS.color.feedback.warning} iconBg={TOKENS.color.feedback.warningSoft} />
          <KpiCard label="Participação líder" value={`${concentration}%`} subLabel="do volume selecionado" icon={<ChartColumnBigIcon />} iconColor={TOKENS.color.feedback.info} iconBg={TOKENS.color.feedback.infoSoft} />
        </section>

        <section className="location-map-layout">
          <Surface tone="subtle" padding={TOKENS.spacing[16]} style={{ border: `1px solid ${TOKENS.color.stroke.default}`, minWidth: 0 }}>
            <Stack gap={TOKENS.spacing[14]}>
              <Row align="center" justify="space-between" gap={TOKENS.spacing[16]} style={{ flexWrap: "wrap" }}>
                <Stack gap={TOKENS.spacing[3]}><Text size="xl" weight={800}>Distribuição territorial</Text><Text size="sm" tone="muted">O tamanho de cada círculo acompanha o volume da métrica.</Text></Stack>
                <div style={{ width: 190 }}><Select aria-label="Métrica exibida no mapa" value={metric} onChange={(value) => setMetric(value as LocationMetricId)} options={METRICS.map(({ value, label }) => ({ value, label }))} size="md" weight={600} /></div>
              </Row>
              <MapView locations={locations} metric={metric} />
            </Stack>
          </Surface>

          <Surface tone="subtle" padding={TOKENS.spacing[20]} style={{ border: `1px solid ${TOKENS.color.stroke.default}` }}>
            <Stack gap={TOKENS.spacing[18]}>
              <Stack gap={TOKENS.spacing[4]}><Text size="xl" weight={800}>Ranking de localidades</Text><Text size="sm" tone="muted">Ordenado por {metricConfig.singular} no período.</Text></Stack>
              <Stack gap={TOKENS.spacing[10]}>
                {ranked.slice(0, 8).map((location, index) => (
                  <Row key={`${location.location}-${index}`} align="center" gap={TOKENS.spacing[12]} style={{ padding: TOKENS.spacing[12], borderRadius: TOKENS.radius[10], background: index === 0 ? TOKENS.color.brand.fillSubtle : TOKENS.color.surface.card }}>
                    <span className="location-rank"><Text size="sm" weight={800} tone={index === 0 ? "brand" : "muted"}>{index + 1}</Text></span>
                    <Stack gap={TOKENS.spacing[2]} style={{ flex: 1, minWidth: 0 }}><Text size="sm" weight={800} truncate title={location.location}>{location.location}</Text><Text size="xs" tone="muted">{location.sales} vendas · {location.renewals} renovações · {location.cancellations} cancelamentos</Text></Stack>
                    <Text size="lg" weight={800}>{metricValue(location, metric)}</Text>
                  </Row>
                ))}
                {!ranked.length && <Text size="sm" tone="muted">Importe planilhas com localidades para preencher o mapa.</Text>}
              </Stack>
            </Stack>
          </Surface>
        </section>
      </Stack>
    </main>
  );
}
