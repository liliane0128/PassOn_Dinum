import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { RoleProvider } from "@/context/RoleContext";
import { PassationStatusProvider } from "@/components/PassationStatusProvider";

export const metadata: Metadata = {
  title: "PassOn — Assistant de passation",
  description:
    "PassOn rassemble les informations utiles à la continuité de votre travail.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="font-sans text-gray-900 antialiased">
        <AuthProvider>
          <RoleProvider>
            <PassationStatusProvider>{children}</PassationStatusProvider>
          </RoleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
