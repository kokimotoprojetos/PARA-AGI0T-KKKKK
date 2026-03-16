'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

type DebtType = {
  id: string;
  name: string;
};

export default function DebtTypesPage() {
  const [types, setTypes] = useState<DebtType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dividas/tipos');
      const data = await res.json();
      setTypes(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Erro ao carregar tipos de dívida");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEditing = !!editingId;
      const url = isEditing ? `/api/dividas/tipos/${editingId}` : '/api/dividas/tipos';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      if (!res.ok) throw new Error();
      
      toast.success(`Tipo de dívida ${isEditing ? 'atualizado' : 'adicionado'}!`);
      setIsOpen(false);
      setName('');
      setEditingId(null);
      fetchTypes();
    } catch {
      toast.error("Erro ao salvar tipo de dívida");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este tipo? Dívidas vinculadas ficarão sem categoria.")) return;
    try {
      const res = await fetch(`/api/dividas/tipos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success("Tipo removido");
      fetchTypes();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Tipos de Dívida</h1>
          <p className="text-slate-400">Categorize suas cobranças (ex: Empréstimo, Aluguel, Venda).</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if(!v) setEditingId(null); setName(''); }}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 h-10 px-4 py-2">
            <Plus className="w-4 h-4 mr-2" /> Novo Tipo
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Tipo' : 'Novo Tipo de Dívida'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome da Categoria</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Venda de Produto" className="bg-slate-950 border-slate-800 text-white" required />
              </div>
              <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950">
                Salvar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-slate-800 rounded-xl bg-slate-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800">
              <TableHead className="text-slate-400">Nome</TableHead>
              <TableHead className="text-right text-slate-400">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-slate-800"><TableCell colSpan={2} className="text-center h-24"><Loader2 className="animate-spin mx-auto text-emerald-500"/></TableCell></TableRow>
            ) : types.length === 0 ? (
              <TableRow className="border-slate-800"><TableCell colSpan={2} className="text-center h-24 text-slate-400">Nenhum tipo cadastrado.</TableCell></TableRow>
            ) : (
              types.map(t => (
                <TableRow key={t.id} className="border-slate-800">
                  <TableCell className="text-slate-200 font-medium flex items-center"><Tag className="w-4 h-4 mr-2 text-emerald-500/50" /> {t.name}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingId(t.id); setName(t.name); setIsOpen(true); }} className="text-slate-400 hover:text-white"><Pencil className="w-4 h-4"/></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4"/></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
