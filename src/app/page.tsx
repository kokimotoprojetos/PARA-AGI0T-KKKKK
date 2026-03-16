import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-50">
      <header className="px-6 lg:px-14 h-16 flex items-center border-b border-slate-800">
        <Link className="flex items-center justify-center" href="#">
          <span className="font-bold text-xl tracking-tight text-white">AgenteCobrador</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link className="text-sm font-medium hover:text-emerald-400 transition-colors" href="#features">
            Recursos
          </Link>
          <Link className="text-sm font-medium hover:text-emerald-400 transition-colors" href="/login">
            Login
          </Link>
          <Button asChild size="sm" className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold shadow-lg shadow-emerald-500/20">
            <Link href="/register">Começar Grátis</Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <section className="w-full py-24 md:py-32 lg:py-48 flex items-center justify-center flex-col text-center px-4 relative z-10">
          <div className="space-y-6 max-w-4xl">
            <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl/none text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
              Gerencie suas dívidas e cobre via WhatsApp.
            </h1>
            <p className="mx-auto max-w-[700px] text-slate-300 md:text-xl leading-relaxed">
              Pare de perder tempo cobrando seus devedores manualmente. Nosso SaaS organiza contas a receber e envia alertas amigáveis automaticamente pelo WhatsApp.
            </p>
          </div>
          <div className="mt-10 flex gap-4">
            <Button asChild size="lg" className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 font-semibold shadow-lg shadow-emerald-500/30">
              <Link href="/dashboard">Acessar Dashboard</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white">
              <Link href="/login">Conectar WhatsApp</Link>
            </Button>
          </div>
        </section>

        {/* Features preview */}
        <section id="features" className="w-full py-24 bg-slate-900/50 border-t border-slate-800">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid gap-12 lg:grid-cols-3 lg:gap-8">
              <div className="flex flex-col flex-1 gap-2 items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <h3 className="text-xl font-bold">Gerenciador de Devedores</h3>
                <p className="text-slate-400">Cadastre milhares de devedores e categorize suas dívidas em uma interface super ágil.</p>
              </div>
              <div className="flex flex-col flex-1 gap-2 items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <h3 className="text-xl font-bold">Agente por WhatsApp</h3>
                <p className="text-slate-400">Integração nativa. Suas contas recebem e disparam notificações via WhatsApp do seu número.</p>
              </div>
              <div className="flex flex-col flex-1 gap-2 items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <h3 className="text-xl font-bold">Controle Financeiro</h3>
                <p className="text-slate-400">Dashboard em tempo real mostrando total a receber, histórico de pagamentos e mais.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full items-center px-6 lg:px-14 border-t border-slate-800">
        <p className="text-xs text-slate-400">© 2026 AgenteCobrador. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
