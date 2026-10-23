import { IdentityProvider } from "@/components/ClerkAccess";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <IdentityProvider>{children}</IdentityProvider>;
}
