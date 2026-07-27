import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up | CakeToHome",
  description: "Create your CakeToHome account",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="justify-center mx-auto max-w-96">{children}</div>;
}
