import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, Home, Users, CreditCard, MessageCircle, Settings, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth();
  const user = await currentUser();

  if (!userId) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <Link href="/dashboard" className="font-bold text-xl text-emerald-400">
            AgenteCobrador
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-2 relative z-10">
          <Link href="/dashboard" className="flex items-center text-slate-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors">
            <Home className="w-5 h-5 mr-3" /> Dashboard
          </Link>
          <Link href="/dashboard/devedores" className="flex items-center text-slate-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors">
            <Users className="w-5 h-5 mr-3" /> Devedores
          </Link>
          <Link href="/dashboard/dividas" className="flex items-center text-slate-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors">
            <CreditCard className="w-5 h-5 mr-3" /> Dívidas
          </Link>
          <Link href="/dashboard/dividas/tipos" className="flex items-center text-slate-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors">
            <Tag className="w-5 h-5 mr-3" /> Tipos de Dívida
          </Link>
          <Link href="/dashboard/whatsapp" className="flex items-center text-slate-300 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors">
            <MessageCircle className="w-5 h-5 mr-3" /> Agente WhatsApp
          </Link>
        </nav>
        <div className="p-4 border-t border-slate-800 relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white truncate max-w-[120px]">
                {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.username || "Usuário"}
              </span>
              <span className="text-xs text-slate-400 truncate max-w-[120px]">
                {user?.emailAddresses[0].emailAddress}
              </span>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-slate-950 p-6 lg:p-10 relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none z-0" />
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
