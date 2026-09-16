import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { RequireSession } from "@/components/RequireSession";
import { ResumeBoard } from "@/components/passation/ResumeBoard";

export default function HomePage() {
  return (
    <RequireSession>
      <div className="flex h-screen flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />

          <main className="flex-1 overflow-y-auto bg-[#f5f6f8] px-8 py-8">
            <div className="mx-auto max-w-5xl">
              <ResumeBoard />
            </div>
          </main>
        </div>
      </div>
    </RequireSession>
  );
}
