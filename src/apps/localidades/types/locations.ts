export type LocationMetricId = "sales" | "renewals" | "cancellations";

export type CommercialLocationMetric = {
  location: string;
  sales: number;
  renewals: number;
  cancellations: number;
};

export type MappedCommercialLocation = CommercialLocationMetric & {
  latitude: number;
  longitude: number;
  approximate: boolean;
};
