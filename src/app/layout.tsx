import type { Metadata } from "next";
import "./fonts/fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mappr",
  description: "Describe your product. Get a system map.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="mappr-fonts h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
