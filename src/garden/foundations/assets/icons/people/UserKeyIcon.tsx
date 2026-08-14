/** Lucide `user-key` — utilizador + chave (permissões / acesso). */

function UserKeyIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M20 11v6" />
      <path d="M20 13h2" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 2.072.578" />
      <circle cx="10" cy="7" r="4" />
      <circle cx="20" cy="19" r="2" />
    </svg>
  );
}

export default UserKeyIcon;
