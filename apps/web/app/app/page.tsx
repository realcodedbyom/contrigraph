import type { Metadata } from "next";
import { ClerkWorkspace } from "@/components/ClerkAccess";
export const metadata: Metadata = {
  title: "Your workspace",
  robots: { index: false, follow: false },
};
export default function WorkspacePage() {
  return <ClerkWorkspace />;
}
