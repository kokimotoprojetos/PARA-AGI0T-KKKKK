import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, AlertCircle, CheckCircle } from "lucide-react";

export default async function DashboardPage() {
  const { userId } = auth();
  
  if (!userId) return null;

  // Buscar contagem de devedores
  const { count: debtorsCount } = await supabase
    .from('debtors')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  // Buscar últimas dívidas
  const { data: debts } = await supabase
    .from('debts')
    .select('*, debtor:debtors(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  const debtsList = debts || [];

  const totalReceivable = debtsList.reduce((acc, debt) => acc + Number(debt.amount), 0);
  const pendingDebts = debtsList.filter(d => d.status === 'PENDING').length;
  const overdueDebts = debtsList.filter(d => d.status === 'OVERDUE').length;

  return (
    <div className="space-y-8 w-full max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Painel Geral</h1>
        <p className="text-slate-400">Visão geral das suas cobranças e devedores.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total a Receber</CardTitle>
            <CreditCard className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalReceivable)}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Devedores Ativos</CardTitle>
            <Users className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{debtorsCount || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Dívidas Pendentes</CardTitle>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{pendingDebts}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Dívidas Atrasadas</CardTitle>
            <CheckCircle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{overdueDebts}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Últimas Dívidas Adicionadas</CardTitle>
        </CardHeader>
        <CardContent>
          {debtsList.length === 0 ? (
            <p className="text-slate-400 text-sm">Nenhuma dívida registrada ainda. Vá até a aba Devedores para começar a cobrar.</p>
          ) : (
            <div className="space-y-4">
              {debtsList.map(debt => {
                const id = debt.id || Math.random().toString(36).substr(2, 9);
                return (
                  <div key={id} className="flex items-center justify-between bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <div>
                      {/* @ts-ignore */}
                      <p className="font-semibold text-white">{debt.debtor?.name || "Devedor desconhecido"}</p>
                      <p className="text-xs text-slate-400">{debt.description || "Sem descrição"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(debt.amount)}</p>
                      <p className="text-xs text-slate-400">{new Date(debt.due_date || debt.dueDate).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
