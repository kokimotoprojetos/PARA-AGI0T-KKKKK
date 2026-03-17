'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Debtor = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

export default function DevedoresPage() {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchDebtors = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/devedores');
      const data = await res.json();
      setDebtors(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar devedores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebtors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEditing = !!editingId;
      const url = isEditing ? `/api/devedores/${editingId}` : '/api/devedores';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Erro ao salvar devedor");
      }
      
      toast.success(`Devedor ${isEditing ? 'atualizado' : 'adicionado'} com sucesso!`);
      setIsOpen(false);
      setFormData({ name: '', phone: '', email: '' });
      setEditingId(null);
      fetchDebtors();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar devedor");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este devedor? (Isso também apagará suas dívidas)")) return;

    try {
      const res = await fetch(`/api/devedores/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success("Devedor removido");
      fetchDebtors();
    } catch {
      toast.error("Erro ao remover devedor");
    }
  };

  const openEdit = (debtor: Debtor) => {
    setFormData({ name: debtor.name, phone: debtor.phone || '', email: debtor.email || '' });
    setEditingId(debtor.id);
    setIsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Devedores</h1>
          <p className="text-slate-400">Gerencie sua carteira de clientes inadimplentes.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if(!v) setEditingId(null); setFormData({name:'', phone:'', email:''}); }}>
          <DialogTrigger render={
            <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20">
              <Plus className="w-4 h-4 mr-2" /> Novo Devedor
            </Button>
          } />
          <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl">{editingId ? 'Editar Devedor' : 'Adicionar Novo Devedor'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300">Nome Completo</Label>
                <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="bg-slate-950 border-slate-800 focus-visible:ring-emerald-500 text-white" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300">WhatsApp (Opcional)</Label>
                <Input id="phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Ex: 11999999999" className="bg-slate-950 border-slate-800 focus-visible:ring-emerald-500 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email (Opcional)</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-slate-950 border-slate-800 focus-visible:ring-emerald-500 text-white" />
              </div>
              <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold mt-4">
                {editingId ? 'Salvar Alterações' : 'Cadastrar Devedor'}
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
                <TableHead className="text-slate-400 whitespace-nowrap">Nome</TableHead>
                <TableHead className="text-slate-400 whitespace-nowrap">WhatsApp</TableHead>
                <TableHead className="text-slate-400 whitespace-nowrap">Email</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="border-slate-800 hover:bg-slate-900/50">
                  <TableCell colSpan={4} className="h-32 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
                  </TableCell>
                </TableRow>
              ) : debtors.length === 0 ? (
                <TableRow className="border-slate-800 hover:bg-slate-900/50">
                  <TableCell colSpan={4} className="h-32 text-center text-slate-400">
                    Nenhum devedor encontrado. Clique em "Novo Devedor" para adicionar.
                  </TableCell>
                </TableRow>
              ) : (
                debtors.map((debtor) => (
                  <TableRow key={debtor.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <TableCell className="font-medium text-slate-200 whitespace-nowrap">{debtor.name}</TableCell>
                    <TableCell className="text-slate-400 whitespace-nowrap">{debtor.phone || '-'}</TableCell>
                    <TableCell className="text-slate-400 whitespace-nowrap">{debtor.email || '-'}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(debtor)} className="text-slate-400 hover:text-blue-400 hover:bg-blue-400/10">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(debtor.id)} className="text-slate-400 hover:text-red-400 hover:bg-red-400/10 ml-2">
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
