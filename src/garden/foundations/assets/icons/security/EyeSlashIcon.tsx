function EyeSlashIcon(props: React.SVGProps<SVGSVGElement> & { size?: string | number }) {
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
      <path d="M2 2l12 12M6.5 6.6A2 2 0 0 0 9.4 9.5M4.2 4.3C2.8 5.3 1.7 6.8 1 8c1.3 2.4 4 5 7 5a7 7 0 0 0 3.8-1.2M6 3.2A7 7 0 0 1 8 3c3 0 5.7 2.6 7 5-.5 1-1.3 2-2.3 2.8" />
    </svg>
  );
}

export default EyeSlashIcon;
