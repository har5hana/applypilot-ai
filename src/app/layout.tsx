import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApplyPilot AI — Your AI Job Search, on Autopilot",
  description: "Discover matching roles, prepare application materials, and review every application before anything is sent.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
