/**
 * template.tsx remounts on every navigation → each page enters with a
 * short fade/rise. Subtle by design so calm pages (settings/admin) stay calm.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
