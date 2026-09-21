import "./globals.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./readability.css";
export const metadata = {
  title: "News Pulse — Follow the bigger story",
  description:
    "Explore how news stories develop across sources and time. A live, topic-clustered news timeline.",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
