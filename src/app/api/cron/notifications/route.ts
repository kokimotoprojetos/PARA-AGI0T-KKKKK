import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const evolutionUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, ""); 
const evolutionKey = process.env.EVOLUTION_API_KEY;
const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "AgenteCobrador";

async function sendWhatsApp(number: string, text: string) {
    if (!evolutionUrl || !evolutionKey) return;
    try {
        await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": evolutionKey },
            body: JSON.stringify({ 
                number: number.replace(/\D/g, ''),
                text: text
            }),
        });
    } catch (e) {
        console.error("Erro ao enviar notificação CRON:", e);
    }
}

export async function GET(req: Request) {
  // Verificação simples de segurança
  const { searchParams } = new URL(req.url);
  const cronKey = searchParams.get('key');
  
  // Recomenda-se configurar uma KEY secreta no .env e comparar aqui:
  // if (cronKey !== process.env.CRON_SECRET) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const now = new Date();
    // Ajuste para o fuso de Brasília (UTC-3) se necessário para cálculos precisos
    const todayStr = now.toISOString().split('T')[0];
    const today = new Date(todayStr + 'T00:00:00');

    // 1. Buscar perfis que possuem número de notificação
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, notification_number')
      .not('notification_number', 'is', null);

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ message: "Nenhum usuário com notificações ativas." });
    }

    let notificationsSent = 0;

    for (const profile of profiles) {
      // 2. Buscar dívidas pendentes deste usuário
      const { data: debts } = await supabase
        .from('debts')
        .select('*, debtor:debtors(name)')
        .eq('user_id', profile.id)
        .eq('status', 'PENDING');

      if (!debts) continue;

      for (const debt of debts) {
        const dueDate = new Date(debt.due_date + 'T00:00:00');
        
        // Calcular diferença em dias
        const diffTime = dueDate.getTime() - today.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const lastNotified = debt.last_notified_at ? new Date(debt.last_notified_at) : null;
        
        let message = "";
        let shouldNotify = false;

        // Lógica de 3, 2, 1 dias antes (Apenas uma vez por dia)
        const wasNotifiedToday = lastNotified && lastNotified.toISOString().split('T')[0] === todayStr;
        
        if (!wasNotifiedToday) {
            if (daysRemaining === 3) {
                message = `⚠️ *AVISO:* Faltam 3 dias para o vencimento da dívida de *${debt.debtor.name}* (R$ ${Number(debt.amount).toFixed(2)}).`;
                shouldNotify = true;
            } else if (daysRemaining === 2) {
                message = `⚠️ *AVISO:* Faltam 2 dias para o vencimento da dívida de *${debt.debtor.name}* (R$ ${Number(debt.amount).toFixed(2)}).`;
                shouldNotify = true;
            } else if (daysRemaining === 1) {
                message = `🔔 *AMANHÃ:* Vence a dívida de *${debt.debtor.name}* (R$ ${Number(debt.amount).toFixed(2)}).`;
                shouldNotify = true;
            }
        }

        // Lógica de "Hora em Hora" no dia do vencimento (ou se já estiver atrasado)
        if (daysRemaining <= 0) {
            // Se for hoje ou já passou da data e ainda está pendente
            const oneHourInMs = 55 * 60 * 1000; 
            const isHourPassed = !lastNotified || (now.getTime() - lastNotified.getTime() > oneHourInMs);
            
            if (isHourPassed) {
                const statusText = daysRemaining === 0 ? "🚨 *VENCE HOJE!*" : "🔥 *ATRASADO!*";
                message = `${statusText}\n👤 Devedor: *${debt.debtor.name}*\n💰 Valor: *R$ ${Number(debt.amount).toFixed(2)}*\n\nRealize a cobrança ou atualize o status no painel.`;
                shouldNotify = true;
            }
        }

        if (shouldNotify && message) {
            await sendWhatsApp(profile.notification_number, message);
            
            // Atualizar o banco com o horário da última notificação
            await supabase
                .from('debts')
                .update({ last_notified_at: now.toISOString() })
                .eq('id', debt.id);
            
            notificationsSent++;
        }
      }
    }

    return NextResponse.json({ 
        success: true, 
        notificationsSent,
        timestamp: now.toISOString()
    });

  } catch (err: any) {
    console.error("Erro no processamento do CRON:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
