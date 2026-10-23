import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'ContriGraph | Make teamwork visible', description: 'Plan work, understand dependencies, balance capacity, and recognize every contribution.',icons:{icon:'/favicon.svg'} };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
