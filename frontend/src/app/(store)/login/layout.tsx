import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | CakeToHome",
  description: "Sign in to your CakeToHome account",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="justify-center mx-auto max-w-96">{children}</div>;
}
