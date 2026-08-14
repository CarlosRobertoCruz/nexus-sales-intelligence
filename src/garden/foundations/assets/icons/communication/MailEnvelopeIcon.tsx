function MailEnvelopeIcon(props: React.SVGProps<SVGSVGElement> & { size?: string | number }) {
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
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M1.5 5.5L8 9.5L14.5 5.5" />
    </svg>
  );
}

export default MailEnvelopeIcon;
