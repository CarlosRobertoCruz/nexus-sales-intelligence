function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="100%"
      height="100%"
      {...props}
    >
      <path d="M11.5 3.5 9.3 8.4 4.5 10.5l4.8 2.1 2.2 4.9 2.2-4.9 4.8-2.1-4.8-2.1-2.2-4.9Z" />
      <path d="M18.5 2.5v4" />
      <path d="M16.5 4.5h4" />
      <path d="M5.5 16.5v3" />
      <path d="M4 18h3" />
    </svg>
  );
}

export default SparklesIcon;
