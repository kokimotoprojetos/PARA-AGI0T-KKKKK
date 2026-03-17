'use client';

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Smartphone, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function WhatsAppConfigPage() {
  const [status, setStatus] = useState({ isConnected: false, qrCodeData: null as string | null, state: 'LOADING' });
  const [loading, setLoading] = useState(true);
  const [notificationNumber, setNotificationNumber] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const autoStartedRef = useRef(false);

  const fetchStatus = async (isFirstLoad = false) => {
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      
      const currentState = data.instance?.state || 'close';
      
      setStatus({
        isConnected: currentState === 'open',
        qrCodeData: data.instance?.qrcode || null,
        state: currentState,
      });

      // Se não estiver conectado nem conectando (ou seja, instância não iniciada), inicia automaticamente
      if (currentState !== 'open' && currentState !== 'connecting' && !autoStartedRef.current) {
        autoStartedRef.current = true;
        console.log("Instância não encontrada ou fechada. Iniciando...");
        createInstance();
      }

      // Se por algum motivo o QR sumiu mas o estado é conectando, tenta novamente resetando o ref
      if (currentState === 'connecting' && !data.instance?.qrcode && autoStartedRef.current) {
          // Pequena espera antes de tentar de novo, talvez a Evolution ainda esteja gerando
          console.log("Conectando mas sem QR. Aguardando...");
      }

    } catch (error) {
      console.error("Erro ao buscar status:", error);
      setStatus({ isConnected: false, qrCodeData: null, state: 'ERROR' });
      
      // Tenta criar se der erro de fetch, pois a instância pode não existir
      if (!autoStartedRef.current) {
        autoStartedRef.current = true;
        createInstance();
      }
    } finally {
      if (isFirstLoad) setLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        if (data.notification_number) {
          setNotificationNumber(data.notification_number);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
    }
  };

  const createInstance = async () => {
    try {
      const res = await fetch('/api/whatsapp/status', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.info("Iniciando conexão automática...");
      
      // Imediatamente tenta pegar o QR após criar
      setTimeout(() => fetchStatus(), 1500);
    } catch {
      autoStartedRef.current = false;
      toast.error("Erro ao iniciar conexão automática.");
    }
  };

  const disconnectInstance = async () => {
    if (!confirm("Tem certeza que deseja desconectar este WhatsApp?")) return;
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/status', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success("WhatsApp desconectado com sucesso.");
      autoStartedRef.current = false; // Permite auto-start novamente após desconectar
      fetchStatus();
    } catch {
      toast.error("Erro ao desconectar WhatsApp.");
    } finally {
      setLoading(false);
    }
  };

  const saveNotificationNumber = async () => {
    setSavingProfile(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_number: notificationNumber })
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }
      toast.success("Número de notificação salvo!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar número. Verifique se executou o SQL de migração.");
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    fetchStatus(true);
    fetchProfile();
    const interval = setInterval(() => fetchStatus(false), 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Agente WhatsApp</h1>
        <p className="text-slate-400">Conecte seu celular para enviar cobranças automáticas pela Evolution API.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Smartphone className="w-5 h-5 mr-2 text-emerald-500" /> Status da Conexão
            </CardTitle>
            <CardDescription className="text-slate-400">
              Vincule seu número para disparar cobranças.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6 space-y-6 min-h-[300px]">
            {loading ? (
              <div className="flex flex-col items-center text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
                <p>Verificando Evolution API...</p>
              </div>
            ) : status.isConnected ? (
              <div className="flex flex-col items-center p-6 border border-emerald-500/30 bg-emerald-500/10 rounded-2xl w-full">
                <CheckCircle className="w-16 h-16 text-emerald-500 mb-4" />
                <h2 className="text-xl font-bold text-white">WhatsApp Conectado!</h2>
                <Button variant="destructive" onClick={disconnectInstance} className="mt-6 w-full font-semibold">
                  Desconectar WhatsApp
                </Button>
              </div>
            ) : status.qrCodeData ? (
               <div className="flex flex-col items-center">
                <div className="p-4 bg-white rounded-xl shadow-lg border-4 border-slate-800">
                  {status.qrCodeData.startsWith('data:image') ? (
                    <img src={status.qrCodeData} alt="QR Code" width={256} className="rounded-md" />
                  ) : (
                    <QRCodeSVG value={status.qrCodeData} size={256} className="rounded-md" />
                  )}
                </div>
                <p className="text-slate-400 mt-6 text-xs text-center">
                  Escaneie o QR Code com seu WhatsApp.
                </p>
              </div>
            ) : (
               <div className="flex flex-col items-center text-slate-400 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
                <h2 className="text-lg font-bold text-white mb-2">Preparando Conexão...</h2>
                <p className="text-sm">Aguarde enquanto geramos seu QR Code automaticamente.</p>
                <div className="mt-6 p-3 bg-slate-950 rounded-lg border border-slate-800 text-[10px] uppercase tracking-widest text-slate-500">
                  Estado: {status.state}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg font-semibold flex items-center">
              <RefreshCw className="w-5 h-5 mr-2 text-blue-500" /> Agente de IA Financeiro
            </CardTitle>
            <CardDescription className="text-slate-400">
              Configure o número que poderá interagir com a IA para consultar dívidas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-300 font-medium">WhatsApp do Administrador</label>
              <input 
                type="text" 
                placeholder="Ex: 5511999999999" 
                value={notificationNumber}
                onChange={(e) => setNotificationNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg h-10 px-3 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-500 font-medium">Este número receberá notificações de novos devedores e poderá fazer perguntas para a IA (DeepSeek).</p>
            </div>
            <Button 
              onClick={saveNotificationNumber} 
              disabled={savingProfile}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold"
            >
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Salvar Configuração"}
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-lg font-semibold">Modelo da Mensagem</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 text-sm mb-2">As cobranças enviadas para os devedores seguem este padrão:</p>
          <div className="italic text-slate-300 border-l-2 border-emerald-500 pl-4 py-3 bg-slate-950 rounded-r-lg text-sm">
            "Olá, *&#123;nome&#125;*.<br/>
            Gostaria de lembrar sobre sua dívida pendente no valor de *&#123;valor&#125;* com vencimento em *&#123;data&#125;*.<br/>
            Agradecemos se puder regularizar sua situação em breve!"
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
