// app/layout.tsx
import "./globals.css";
import Brand from "@/components/Brand";
import Background from "@/components/Background";
import dynamic from "next/dynamic";

const WalletProvider = dynamic(
  () => import("@/components/Wallet").then((m) => m.WalletProvider),
  { ssr: false }
);

export const metadata = { /* …unchanged… */ };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <Background />
          <div className="relative z-10">
            <Brand />
            <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
