'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || 'Erro ao cadastrar');
      } else {
        toast.success(data.message);
        router.push('/login');
      }
    } catch {
      toast.error('Ocorreu um erro na requisição');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-8 flex flex-col gap-6 rounded-2xl shadow-xl">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white tracking-tight">Criar Conta</h1>
        <p className="text-slate-400">Comece a usar o AgenteCobrador hoje.</p>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-slate-300">Nome</Label>
          <Input 
            id="name" 
            type="text" 
            placeholder="Seu nome" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="bg-slate-950 border-slate-800 text-white focus-visible:ring-emerald-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-300">Email</Label>
          <Input 
            id="email" 
            type="email" 
            placeholder="seu@email.com" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-slate-950 border-slate-800 text-white focus-visible:ring-emerald-500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-slate-300">Senha</Label>
          <Input 
            id="password" 
            type="password" 
            placeholder="••••••••" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-slate-950 border-slate-800 text-white focus-visible:ring-emerald-500"
          />
        </div>
        <Button 
          type="submit" 
          disabled={loading} 
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold mt-4"
        >
          {loading ? 'Cadastrando...' : 'Criar Conta'}
        </Button>
      </form>

      <div className="text-center text-sm text-slate-400 mt-4">
        Já tem uma conta?{' '}
        <Link href="/login" className="text-emerald-400 hover:underline">
          Fazer Login
        </Link>
      </div>
    </div>
  );
}
