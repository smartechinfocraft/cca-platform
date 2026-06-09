import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "CCA Platform",
  description: "California Cricket Academy",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}