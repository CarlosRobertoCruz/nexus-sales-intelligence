function ArrowRightIcon(props: React.SVGProps<SVGSVGElement> & { size?: string | number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      width="100%"
      height="100%"
      {...props}
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

export default ArrowRightIcon;
