export default function AuthorLayout({ children }: { children: React.ReactNode }) {
  // Route pages own auth so each sign-in redirect keeps its exact destination.
  return children;
}
