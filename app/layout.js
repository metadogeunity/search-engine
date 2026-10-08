import "./globals.css";

export const metadata = {
  title: "Search Intent Monitor",
  description: "Aggregated search-intent monitoring for GST and company-registration demand in India."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
