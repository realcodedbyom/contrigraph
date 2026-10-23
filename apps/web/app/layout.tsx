import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://dsvv.live/contrigraph/";

export const metadata: Metadata = {
  metadataBase: new URL("https://dsvv.live"),
  title: {
    default: "ContriGraph | Intelligent project management",
    template: "%s | ContriGraph",
  },
  description:
    "Plan student software projects, balance team capacity, manage dependencies, and understand contribution with explainable workload forecasts.",
  keywords: [
    "intelligent project management",
    "student project management",
    "team workload planning",
    "task dependencies",
    "contribution analysis",
  ],
  alternates: { canonical: siteUrl },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "ContriGraph",
    title: "ContriGraph | Intelligent project management",
    description:
      "Make teamwork visible with skill-aware planning, joint workload schedules, and explainable delivery forecasts.",
    images: [
      {
        url: "/contrigraph/og-image.png",
        width: 1200,
        height: 630,
        alt: "ContriGraph project planning workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ContriGraph | Intelligent project management",
    description:
      "Plan work, balance capacity, and understand every contribution.",
    images: ["/contrigraph/og-image.png"],
  },
  robots: { index: true, follow: true },
  verification: { google: "pKzuRuF1pI6pjW6jGAI4_P4vor89xp19ZdBCNHw6-Dw" },
  manifest: "/contrigraph/site.webmanifest",
  icons: {
    icon: [
      { url: "/contrigraph/favicon.ico", sizes: "16x16 32x32 48x48" },
      {
        url: "/contrigraph/favicon-96x96.png",
        type: "image/png",
        sizes: "96x96",
      },
      { url: "/contrigraph/favicon.svg", type: "image/svg+xml", sizes: "any" },
    ],
    apple: [
      {
        url: "/contrigraph/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "ContriGraph",
      url: siteUrl,
      sameAs: ["https://github.com/realcodedbyom/contrigraph"],
    },
    {
      "@type": "WebSite",
      name: "ContriGraph",
      url: siteUrl,
      inLanguage: "en",
      description: metadata.description,
    },
    {
      "@type": "SoftwareApplication",
      name: "ContriGraph",
      applicationCategory: "ProjectManagement",
      operatingSystem: "Web",
      url: siteUrl,
      description: metadata.description,
      featureList: [
        "Skill-aware task assignment",
        "Dependency and blocker analysis",
        "Cross-project workload scheduling",
        "Contribution and progress reporting",
      ],
      publisher: { "@type": "Organization", name: "ContriGraph", url: siteUrl },
    },
  ],
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
