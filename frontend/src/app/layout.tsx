import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const spaceGrotesk = Space_Grotesk({
	variable: "--font-space-grotesk",
	subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
	variable: "--font-plex-mono",
	subsets: ["latin"],
	weight: ["400", "500"],
});

export const metadata: Metadata = {
	title: "Shrinkly | Bulk Video Minimizer",
	description:
		"Upload multiple videos, run backend batch compression, and review size reduction reports in one place.",
};

const appShellClassName = [
	spaceGrotesk.variable,
	plexMono.variable,
	"min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.22),_transparent_34%),radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(180deg,_#fffdf8_0%,_#f5f7fb_48%,_#eef4f8_100%)]",
	"antialiased",
].join(" ");

export const viewport = {
	themeColor: "#f5f7fb",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
				{process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
			</head>
			<body className={appShellClassName}>{children}</body>
		</html>
	);
}
