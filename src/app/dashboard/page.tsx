import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, AlertCircle, CheckCircle, TrendingUp, Wallet, ArrowUpRight, Calendar } from "lucide-react";

export default async function DashboardPage() {
  const { userId } = auth();
  
  if (!userId) return null;

  // 1. Buscar dados essenciais
  const [debtorsRes, debtsRes] = await Promise.all([
    supabase.from('debtors').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('debts').select('*, debtor:debtors(name)').eq('user_id', userId)
  ]);

  const debtorsCount = debtorsRes.count || 0;
  const allDebts = debtsRes.data || [];

  // 2. Cálculos Financeiros
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const totalReceivable = allDebts.filter(d => d.status !== 'PAID').reduce((acc, d) => acc + Number(d.amount), 0);
  const totalLent = allDebts.reduce((acc, d) => acc + Number(d.original_amount || d.amount), 0);
  const totalProfitExpected = allDebts.reduce((acc, d) => acc + (Number(d.amount) - Number(d.original_amount || d.amount)), 0);
  const totalProfitRealized = allDebts.filter(d => d.status === 'PAID').reduce((acc, d) => acc + (Number(d.amount) - Number(d.original_amount || d.amount)), 0);
  
  const pendingDebts = allDebts.filter(d => d.status === 'PENDING').length;
  const overdueDebts = allDebts.filter(d => d.status === 'OVERDUE').length;
  const paidDebtsCount = allDebts.filter(d => d.status === 'PAID').length;

  const dueToday = allDebts.filter(d => (d.due_date || d.dueDate) === todayStr && d.status !== 'PAID');
  const totalDueToday = dueToday.reduce((acc, d) => acc + Number(d.amount), 0);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const recentDebts = [...allDebts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  return (
    <div className="space-y-8 w-full max-w-6xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Painel de Controle</h1>
          <p className="text-slate-400 text-lg">Resumo financeiro e performance da sua carteira.</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-lg backdrop-blur-sm">
          <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider mb-1">Recebimentos para Hoje</p>
          <p className="text-xl font-bold text-white">{formatCurrency(totalDueToday)}</p>
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <Wallet className="w-12 h-12 text-emerald-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Emprestado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(totalLent)}</div>
            <p className="text-xs text-slate-500 mt-1">Capital principal em circulação</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden relative group border-t-emerald-500/50">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-12 h-12 text-emerald-400" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Lucro Total Acumulado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{formatCurrency(totalProfitExpected)}</div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-slate-500">Realizado:</span>
              <span className="text-xs font-bold text-emerald-500">{formatCurrency(totalProfitRealized)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <CreditCard className="w-12 h-12 text-blue-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Valor em Aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(totalReceivable)}</div>
            <p className="text-xs text-slate-500 mt-1">Soma de todas as dívidas pendentes</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden relative group border-t-red-500/30">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Inadimplência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{overdueDebts}</div>
            <p className="text-xs text-slate-500 mt-1">Dívidas com prazo vencido</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        {/* Painel de Estatística Lateral */}
        <Card className="md:col-span-2 bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg text-white">Estatísticas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">Total Devedores</span>
              </div>
              <span className="font-bold text-white">{debtorsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-300">Dívidas Lançadas</span>
              </div>
              <span className="font-bold text-white">{allDebts.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-slate-300">Dívidas Pagas</span>
              </div>
              <span className="font-bold text-emerald-400">{paidDebtsCount}</span>
            </div>
            
            <div className="pt-4 border-t border-slate-800">
              <div className="w-full bg-slate-950 rounded-full h-2 mb-2">
                <div 
                  className="bg-emerald-500 h-2 rounded-full" 
                  style={{ width: `${allDebts.length > 0 ? (paidDebtsCount / allDebts.length) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 text-center uppercase font-bold">Taxa de Recuperação: {allDebts.length > 0 ? Math.round((paidDebtsCount / allDebts.length) * 100) : 0}%</p>
            </div>
          </CardContent>
        </Card>

        {/* Últimas Atividades */}
        <Card className="md:col-span-5 bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg text-white">Atividades Recentes</CardTitle>
            <ArrowUpRight className="w-4 h-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            {recentDebts.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-10">Nenhuma atividade recente.</p>
            ) : (
              <div className="space-y-3">
                {recentDebts.map(debt => (
                  <div key={debt.id} className="flex items-center justify-between bg-slate-950/50 p-3 rounded-lg border border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${debt.status === 'PAID' ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}>
                        {debt.status === 'PAID' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Plus className="w-4 h-4 text-blue-500" />}
                      </div>
                      <div>
                        {/* @ts-ignore */}
                        <p className="font-bold text-slate-200 text-sm">{debt.debtor?.name || "Desconhecido"}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{debt.description || "Sem descrição"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white text-sm">{formatCurrency(debt.amount)}</p>
                      <p className="text-[10px] text-slate-500">{new Date(debt.due_date || debt.dueDate).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Plus({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14" /><path d="M12 5v14" /></svg>
  )
}

