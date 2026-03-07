import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "BitCredit",
    description: "Bitcoin-backed credit for emerging markets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.className} bg-white dark:bg-black text-gray-900 dark:text-gray-100 transition-colors duration-300`}>
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                    <WalletProvider>{children}</WalletProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
