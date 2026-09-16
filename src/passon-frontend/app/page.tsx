import { FilePlus2, Plus } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

export default function HomePage() {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-[#f5f6f8] px-8 py-8">
          <div className="mx-auto flex min-h-[calc(100%-4rem)] max-w-5xl flex-col items-center justify-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50">
              <FilePlus2 className="h-7 w-7 text-brand-600" />
            </span>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              Préparer une passation
            </h1>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              L&rsquo;agent PassOn rassemble les informations utiles à la
              continuité de votre travail.
            </p>
            <Link
              href="/gerer-ma-passation"
              className="mt-5 flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Créer une passation
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
