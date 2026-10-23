import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://dsvv.live/contrigraph/";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "ContriGraph | Intelligent project management", template: "%s | ContriGraph" },
  description:
    "Plan student software projects, balance team capacity, manage dependencies, and understand contribution with explainable workload forecasts.",
  keywords: ["intelligent project management", "student project management", "team workload planning", "task dependencies", "contribution analysis"],
  alternates: { canonical: siteUrl },
  openGraph: { type: "website", url: siteUrl, siteName: "ContriGraph", title: "ContriGraph | Intelligent project management", description: "Make teamwork visible with skill-aware planning, joint workload schedules, and explainable delivery forecasts.", images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "ContriGraph project planning workspace" }] },
  twitter: { card: "summary_large_image", title: "ContriGraph | Intelligent project management", description: "Plan work, balance capacity, and understand every contribution.", images: ["/og-image.svg"] },
  robots: { index: true, follow: true },
  manifest: "/site.webmanifest",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }], apple: "/favicon.svg" },
};

const structuredData = { "@context": "https://schema.org", "@graph": [
  { "@type": "SoftwareApplication", name: "ContriGraph", applicationCategory: "ProjectManagement", operatingSystem: "Web", url: siteUrl, description: metadata.description, featureList: ["Skill-aware task assignment", "Dependency and blocker analysis", "Cross-project workload scheduling", "Contribution and progress reporting"] },
  { "@type": "FAQPage", mainEntity: [
    { "@type": "Question", name: "How does ContriGraph calculate workload?", acceptedAnswer: { "@type": "Answer", text: "ContriGraph compares declared weekly availability with remaining task effort scheduled into working-day half-hour slots." } },
    { "@type": "Question", name: "Can ContriGraph handle a task only one person can do?", acceptedAnswer: { "@type": "Answer", text: "Yes. ContriGraph identifies single-specialist tasks and recommends schedule, scope, or deadline changes instead of unsafe reassignment." } },
  ] },
]};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /></body>
    </html>
  );
}
