function LoginHistoryIcon(props: React.SVGProps<SVGSVGElement> & { size?: string | number }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      width="100%"
      height="100%"
      {...props}
    >
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l3 3" />
    </svg>
  );
}

export default LoginHistoryIcon;
