import { APP_ICON_URL } from "@/core/assets/appAssets";

export function SalesBrand() {
  return (
    <div className="sales-auth-brand" aria-label="Nexus Sales Intelligence">
      <img src={APP_ICON_URL} alt="" width="64" height="64" />
      <span>
        <strong>NEXUS</strong>
        <small>SALES INTELLIGENCE</small>
      </span>
    </div>
  );
}
