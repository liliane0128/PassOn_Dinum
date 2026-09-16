import { FilePlus2, Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { PassationCard } from "@/components/passation/PassationCard";
import { passation } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-[#f5f6f8] px-8 py-8">
          <div className="mx-auto max-w-5xl">
            <section className="mb-8 flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                <FilePlus2 className="h-6 w-6 text-brand-600" />
              </span>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">
                  Préparer une passation
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  L&rsquo;agent PassOn rassemble les informations utiles à la
                  continuité de votre travail.
                </p>
                <button className="mt-4 flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card hover:bg-brand-700">
                  <Plus className="h-4 w-4" />
                  Créer une passation
                </button>
              </div>
            </section>

            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Mes passations
            </h2>

            <PassationCard passation={passation} />
          </div>
        </main>
      </div>
    </div>
  );
}
