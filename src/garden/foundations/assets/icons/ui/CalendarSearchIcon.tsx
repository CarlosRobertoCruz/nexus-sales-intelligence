/** Lucide calendar-search — calendario com lupa (agendar / buscar data). */

function CalendarSearchIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M16 2v4" />
      <path d="M21 11.75V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7.25" />
      <path d="m22 22-1.875-1.875" />
      <path d="M3 10h18" />
      <path d="M8 2v4" />
      <circle cx="18" cy="18" r="3" />
    </svg>
  );
}

export default CalendarSearchIcon;
