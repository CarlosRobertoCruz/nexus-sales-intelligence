function EyeOpenIcon(props: React.SVGProps<SVGSVGElement> & { size?: string | number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width="100%"
      height="100%"
      {...props}
    >
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

export default EyeOpenIcon;
