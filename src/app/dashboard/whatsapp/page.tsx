'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Smartphone, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function WhatsAppConfigPage() {
  const [status, setStatus] = useState({ isConnected: false, qrCodeData: null as string | null, state: 'LOADING' });
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      
      setStatus({
        isConnected: data.instance?.state === 'open',
        qrCodeData: data.instance?.state === 'connecting' ? data.instance?.qrcode : null,
        state: data.instance?.state || 'ERROR',
      });
    } catch {
      setStatus({ isConnected: false, qrCodeData: null, state: 'ERROR' });
    } finally {
      setLoading(false);
    }
  };

  const createInstance = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/status', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success("Instância iniciada. Aguarde o QRCode...");
      fetchStatus();
    } catch {
      toast.error("Erro ao iniciar conexão com a Evolution API.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Agente WhatsApp</h1>
        <p className="text-slate-400">Conecte seu celular para enviar cobranças automáticas pela Evolution API.</p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Smartphone className="w-5 h-5 mr-2 text-emerald-500" /> Status da Conexão
          </CardTitle>
          <CardDescription className="text-slate-400">
            Escaneie o QR Code abaixo com seu WhatsApp para vincular seu número de cobrança.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-8 space-y-6 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
              <p>Verificando conexão na Evolution API...</p>
            </div>
          ) : status.isConnected ? (
            <div className="flex flex-col items-center p-6 border border-emerald-500/30 bg-emerald-500/10 rounded-2xl w-full max-w-sm">
              <CheckCircle className="w-16 h-16 text-emerald-500 mb-4" />
              <h2 className="text-xl font-bold text-white">WhatsApp Conectado!</h2>
              <p className="text-slate-300 text-center mt-2 text-sm">
                Seu AgenteCobrador está pronto para disparar notificações.
              </p>
            </div>
          ) : status.qrCodeData ? (
             <div className="flex flex-col items-center">
              <div className="p-4 bg-white rounded-xl shadow-lg border-4 border-slate-800">
                {/* Evolution retorna o qrcode em base64 e não em string bruta para o qrcode.react na versao v2, renderizando img se for base64. Tratei para os dois cenários */}
                {status.qrCodeData.startsWith('data:image') ? (
                  <img src={status.qrCodeData} alt="QR Code" width={256} className="rounded-md" />
                ) : (
                  <QRCodeSVG value={status.qrCodeData} size={256} className="rounded-md" />
                )}
              </div>
              <p className="text-slate-400 mt-6 max-w-sm text-center">
                Abra o WhatsApp no seu celular, vá em "Aparelhos Conectados" e aponte a câmera para esta tela.
              </p>
            </div>
          ) : status.state === 'ERROR' || status.state === 'close' ? (
            <div className="flex flex-col items-center text-center p-6 border border-amber-500/30 bg-amber-500/10 rounded-2xl w-full max-w-md">
              <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
              <h2 className="text-lg font-bold text-white">Instância Inativa ou Desconectada</h2>
              <p className="text-slate-300 text-sm mt-2 mb-4">
                Não conseguimos obter o QRCode.
              </p>
              <Button onClick={createInstance} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shadow-lg shadow-amber-500/20">
                <RefreshCw className="mr-2 h-4 w-4" /> Gerar QRCode / Iniciar Instância
              </Button>
            </div>
          ) : (
             <div className="flex flex-col items-center text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
              <p>Processando estado: {status.state}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-lg font-semibold">Configuração de Mensagens</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400 text-sm mb-2">Mensagem Padrão de Disparo Manual:</p>
          <div className="italic text-slate-300 border-l-2 border-emerald-500 pl-4 py-2 bg-slate-950 rounded-r-lg">
            "Olá, *&#123;nome&#125;*.<br/>
            Gostaria de lembrar sobre sua dívida pendente no valor de *&#123;valor&#125;* com vencimento em *&#123;data&#125;*.<br/>
            Agradecemos se puder regularizar sua situação em breve!"
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
