// Re-mounts on every navigation, so each screen fades in smoothly.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
