import { canonicalLocation, coverageLocation, isMissingLocation } from "../../../core/config/commercialLocations";
import type { CommercialLocationMetric, MappedCommercialLocation } from "../types/locations";

// Regional reference points, not customer addresses. No generated offsets.
const REGIONS: Readonly<Record<string, { latitude: number; longitude: number }>> = {
  "Conceição de Jacareí": { latitude: -23.035, longitude: -44.164 },
  "Itacuruçá": { latitude: -22.927, longitude: -43.899 },
  "Praia Grande": { latitude: -22.923208, longitude: -43.978044 },
  "Muriqui": { latitude: -22.929, longitude: -43.956 },
  "Serra do Piloto": { latitude: -22.894, longitude: -44.102 },
  "Praia Pequena": { latitude: -22.946667, longitude: -44.015 },
  "Praia Brava": { latitude: -22.95163, longitude: -44.01606 },
  "Praia do Saco": { latitude: -22.94697, longitude: -44.04393 },
  "Apara": { latitude: -22.955637, longitude: -44.021617 },
  "Ibicuí": { latitude: -22.966, longitude: -44.037 },
  "Junqueira (Santo Antônio)": { latitude: -22.968, longitude: -44.050 },
  "Sahy": { latitude: -22.936, longitude: -43.998 },
  "Parque Bela Vista": { latitude: -22.9600193, longitude: -44.04111 },
  "Centro": { latitude: -22.959, longitude: -44.041 },
  "Mangaratiba": { latitude: -22.959, longitude: -44.041 },
};

export function normalizeLocationMetrics(metrics: ReadonlyArray<CommercialLocationMetric>): ReadonlyArray<CommercialLocationMetric> {
  const result=new Map<string,CommercialLocationMetric>();
  for(const item of metrics) {
    const location=canonicalLocation(item.location)??"Localidade não informada";
    const current=result.get(location)??{location,sales:0,renewals:0,cancellations:0};
    result.set(location,{location,sales:current.sales+item.sales,renewals:current.renewals+item.renewals,cancellations:current.cancellations+item.cancellations});
  }
  return [...result.values()];
}
export function mapCommercialLocations(metrics: ReadonlyArray<CommercialLocationMetric>): ReadonlyArray<MappedCommercialLocation> {
  const result=new Map<string,MappedCommercialLocation>();
  for(const metric of normalizeLocationMetrics(metrics)) {
    if(isMissingLocation(metric.location))continue;
    const region=coverageLocation(metric.location)?.mapRegion??metric.location;
    const coordinate=REGIONS[region];
    if(!coordinate)continue;
    const current=result.get(region);
    result.set(region,{location:region,...coordinate,approximate:true,
      sales:(current?.sales??0)+metric.sales,renewals:(current?.renewals??0)+metric.renewals,cancellations:(current?.cancellations??0)+metric.cancellations});
  }
  return [...result.values()];
}
