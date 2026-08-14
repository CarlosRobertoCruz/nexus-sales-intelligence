function SalesChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.91"
      strokeMiterlimit="10"
      width="100%"
      height="100%"
      {...props}
    >
      <rect x="2.43" y="16.76" width="3.83" height="5.74" />
      <rect x="17.74" y="9.11" width="3.83" height="13.39" />
      <rect x="10.09" y="12.93" width="3.83" height="9.57" />
      <line x1="0.52" y1="22.5" x2="23.48" y2="22.5" />
      <path d="M9.13,8.15h3.35a1.43,1.43,0,0,0,1.43-1.43h0a1.43,1.43,0,0,0-1.43-1.44h-1a1.43,1.43,0,0,1-1.43-1.43h0a1.44,1.44,0,0,1,1.43-1.44h3.35" />
      <line x1="12" y1="0.5" x2="12" y2="2.41" />
      <line x1="12" y1="8.15" x2="12" y2="10.07" />
    </svg>
  );
}

export default SalesChartIcon;
