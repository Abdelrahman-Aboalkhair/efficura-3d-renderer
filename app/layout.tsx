import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Efficura · Capital Stack 3D",
  description:
    "Standalone 3D capital-stack tower for iframe embedding on Framer / marketing pages.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
