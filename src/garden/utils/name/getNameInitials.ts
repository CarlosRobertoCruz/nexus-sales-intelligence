export function getNameInitials(name: string = ""): string {
  if (typeof name !== "string") return "";

  const blacklist = [
    "de", "da", "do", "das", "dos",
    "junior", "jr", "filho", "neto",
  ];

  const parts = name
    .trim()
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .filter((p) => !blacklist.includes(p));

  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0].toUpperCase();

  const first = parts[0][0];
  const last = parts[parts.length - 1][0];

  return (first + last).toUpperCase();
}
