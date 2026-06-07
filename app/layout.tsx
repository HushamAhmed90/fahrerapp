import "./globals.css";

export const metadata = {
  title: "Dirk Schröder FahrerApp",
  description: "FahrerApp für Touren und Lieferungen",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}