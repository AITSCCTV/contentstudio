import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "AITS · คลังคอนเทนต์",
  description: "ตรวจทานและเผยแพร่คอนเทนต์ภาษาไทยของ AITSCCTV",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased">{children}</body>
    </html>
  );
}
