function ChevronUpIcon(props: React.SVGProps<SVGSVGElement> & { size?: string | number }) {
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
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export default ChevronUpIcon;