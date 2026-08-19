import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | CakeToHome",
  description: "Sign in to your CakeToHome account",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="w-full flex-1 flex flex-col">{children}</div>;
}
