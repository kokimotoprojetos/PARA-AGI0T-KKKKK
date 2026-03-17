'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Pencil, Trash2, CheckCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";

type Debtor = { id: string; name: string; phone: string };
type Debt = {
  id: string;
  amount: number;
  dueDate: string;
  description: string | null;
  status: string;
  debtor: Debtor;
};

export default function DividasPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ amount: '', dueDate: '', description: '', status: 'PENDING', debtorId: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [debtsRes, debtorsRes] = await Promise.all([
        fetch('/api/dividas'),
        fetch('/api/devedores')
      ]);
      const [debtsData, debtorsData] = await Promise.all([debtsRes.json(), debtorsRes.json()]);
      setDebts(Array.isArray(debtsData) ? debtsData : []);
      setDebtors(Array.isArray(debtorsData) ? debtorsData : []);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.debtorId) {
      toast.error("Selecione um devedor");
      return;
    }

    try {
      const isEditing = !!editingId;
      const url = isEditing ? `/api/dividas/${editingId}` : '/api/dividas';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount)
        })
      });

      if (!res.ok) throw new Error();
      
      toast.success(`Dívida ${isEditing ? 'atualizada' : 'adicionada'} com sucesso!`);
      setIsOpen(false);
      setFormData({ amount: '', dueDate: '', description: '', status: 'PENDING', debtorId: '' });
      setEditingId(null);
      fetchData();
    } catch {
      toast.error("Erro ao salvar dívida");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta dívida?")) return;

    try {
      const res = await fetch(`/api/dividas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success("Dívida removida");
      fetchData();
    } catch {
      toast.error("Erro ao remover dívida");
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      const res = await fetch(`/api/dividas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' })
      });
      if (!res.ok) throw new Error();
      toast.success("Dívida marcada como paga!");
      fetchData();
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const triggerCobrar = async (debt: Debt) => {
    if (!debt.debtor.phone) {
      toast.error(`O devedor ${debt.debtor.name} não possui um número de WhatsApp cadastrado.`);
      return;
    }

    toast.promise(
      fetch('/api/whatsapp/cobrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          debtId: debt.id,
          phone: debt.debtor.phone,
          amount: debt.amount,
          dueDate: debt.dueDate,
          name: debt.debtor.name
        })
      }),
      {
        loading: 'Enviando cobrança via WhatsApp...',
        success: 'Cobrança enviada com sucesso!',
        error: 'Erro ao enviar ou WhatsApp desconectado.'
      }
    );
  };

  const openEdit = (debt: Debt) => {
    setFormData({ 
      amount: debt.amount.toString(), 
      dueDate: debt.dueDate.split('T')[0], 
      description: debt.description || '', 
      status: debt.status, 
      debtorId: debt.debtor.id 
    });
    setEditingId(debt.id);
    setIsOpen(true);
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Dívidas</h1>
          <p className="text-slate-400">Controle o que você tem a receber e envie cobranças.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if(!v) setEditingId(null); setFormData({amount:'', dueDate:'', description:'', status:'PENDING', debtorId:''}); }}>
          <DialogTrigger render={
            <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20">
              <Plus className="w-4 h-4 mr-2" /> Nova Dívida
            </Button>
          } />
          <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl">{editingId ? 'Editar Dívida' : 'Adicionar Nova Dívida'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="debtorId" className="text-slate-300">Devedor</Label>
                <select 
                  id="debtorId"
                  value={formData.debtorId} 
                  onChange={e => setFormData({...formData, debtorId: e.target.value})} 
                  className="w-full bg-slate-950 border border-slate-800 text-white focus:ring-emerald-500 rounded-md h-10 px-3" 
                  required
                >
                  <option value="" disabled>Selecione um devedor</option>
                  {debtors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-slate-300">Valor (R$)</Label>
                  <Input id="amount" type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="bg-slate-950 border-slate-800 focus-visible:ring-emerald-500 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate" className="text-slate-300">Vencimento</Label>
                  <Input id="dueDate" type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="bg-slate-950 border-slate-800 focus-visible:ring-emerald-500 text-white md:block" required style={{ colorScheme: 'dark' }} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-300">Descrição/Motivo</Label>
                <Input id="description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Ex: Empréstimo, Serviço prestado..." className="bg-slate-950 border-slate-800 focus-visible:ring-emerald-500 text-white" />
              </div>
              {editingId && (
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-slate-300">Status</Label>
                  <select 
                    id="status"
                    value={formData.status} 
                    onChange={e => setFormData({...formData, status: e.target.value})} 
                    className="w-full bg-slate-950 border border-slate-800 text-white focus:ring-emerald-500 rounded-md h-10 px-3"
                  >
                    <option value="PENDING">Pendente</option>
                    <option value="OVERDUE">Atrasada</option>
                    <option value="PAID">Paga</option>
                  </select>
                </div>
              )}
              <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold mt-4">
                {editingId ? 'Salvar Alterações' : 'Lançar Dívida'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50 backdrop-blur w-full">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-900">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 whitespace-nowrap">Devedor</TableHead>
                <TableHead className="text-slate-400 whitespace-nowrap">Descrição</TableHead>
                <TableHead className="text-slate-400 whitespace-nowrap">Vencimento</TableHead>
                <TableHead className="text-slate-400 whitespace-nowrap">Valor</TableHead>
                <TableHead className="text-slate-400 whitespace-nowrap">Status</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="border-slate-800 hover:bg-slate-900/50">
                  <TableCell colSpan={6} className="h-32 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
                  </TableCell>
                </TableRow>
              ) : debts.length === 0 ? (
                <TableRow className="border-slate-800 hover:bg-slate-900/50">
                  <TableCell colSpan={6} className="h-32 text-center text-slate-400">
                    Nenhuma dívida cadastrada. Clique em "Nova Dívida" para adicionar.
                  </TableCell>
                </TableRow>
              ) : (
                debts.map((debt) => (
                  <TableRow key={debt.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <TableCell className="font-medium text-slate-200 whitespace-nowrap">{debt.debtor.name}</TableCell>
                    <TableCell className="text-slate-400 max-w-[200px] truncate">{debt.description || '-'}</TableCell>
                    <TableCell className="text-slate-400 whitespace-nowrap">{new Date(debt.dueDate).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-emerald-400 font-medium whitespace-nowrap">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(debt.amount)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        debt.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-500' :
                        debt.status === 'OVERDUE' ? 'bg-red-500/10 text-red-500' :
                        'bg-amber-500/10 text-amber-500'
                      }`}>
                        {debt.status === 'PAID' ? 'Paga' : debt.status === 'OVERDUE' ? 'Atrasada' : 'Pendente'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {debt.status !== 'PAID' && (
                        <Button variant="ghost" size="sm" onClick={() => triggerCobrar(debt)} title="Cobrar por WhatsApp" className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-400/10 ml-2">
                          <Smartphone className="w-4 h-4 mr-2" /> Cobrar
                        </Button>
                      )}
                      {debt.status !== 'PAID' && (
                        <Button variant="ghost" size="sm" onClick={() => markAsPaid(debt.id)} title="Marcar como Paga" className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-400/10 ml-2">
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEdit(debt)} className="text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 ml-2">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(debt.id)} className="text-slate-400 hover:text-red-400 hover:bg-red-400/10 ml-2">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
