import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";

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
        console.error("Erro ao enviar cobrança automática:", e);
    }
}

export async function GET() {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from('debts')
    .select(`
      *,
      debtor:debtors(*)
    `)
    .eq('user_id', userId)
    .order('due_date', { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const { amount, dueDate, description, status, debtorId, debtTypeId } = body;

    if (!amount || !dueDate || !debtorId) {
      return new NextResponse("Campos obrigatórios ausentes (Valor, Vencimento ou Devedor)", { status: 400 });
    }

    const insertData: any = {
      amount: parseFloat(amount),
      due_date: dueDate,
      status: status || 'PENDING',
      debtor_id: debtorId,
      user_id: userId
    };

    if (description) insertData.description = description;
    if (debtTypeId) insertData.debt_type_id = debtTypeId;

    console.log("Tentando lançar dívida:", insertData);

    const { data, error } = await supabase
      .from('debts')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("Erro Supabase (debts):", error);
      return new NextResponse(`Erro no banco de dados: ${error.message}`, { status: 500 });
    }

    // === COBRANÇA AUTOMÁTICA IMEDIATA ===
    // Se a dívida vence hoje, amanhã ou já está atrasada, cobra na hora!
    try {
      const brasiliaOffset = -3 * 60;
      const now = new Date();
      const brasiliaTime = new Date(now.getTime() + (brasiliaOffset - now.getTimezoneOffset()) * 60000);
      const todayStr = brasiliaTime.toISOString().split('T')[0];
      const today = new Date(todayStr + 'T00:00:00');
      const dueDateObj = new Date(dueDate + 'T00:00:00');
      const diffTime = dueDateObj.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Buscar dados do devedor (telefone)
      const { data: debtor } = await supabase
        .from('debtors')
        .select('name, phone')
        .eq('id', debtorId)
        .single();

      // Buscar número do administrador
      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_number')
        .eq('id', userId)
        .single();

      if (debtor?.phone && profile?.notification_number && daysRemaining <= 1) {
        const adminPhone = profile.notification_number.replace(/\D/g, '');
        const formattedAmount = `R$ ${parseFloat(amount).toFixed(2)}`;
        let debtorMessage = "";

        if (daysRemaining === 1) {
          debtorMessage = `Olá *${debtor.name}*, este é um lembrete de que sua dívida no valor de *${formattedAmount}* vence AMANHÃ.\n\nPor favor, entre em contato para regularizar: https://wa.me/${adminPhone} 🙏`;
        } else if (daysRemaining === 0) {
          debtorMessage = `Olá *${debtor.name}*, informamos que sua dívida no valor de *${formattedAmount}* vence hoje.\n\nPor favor, realize o pagamento ou entre em contato agora: https://wa.me/${adminPhone}`;
        } else {
          const diasAtraso = Math.abs(daysRemaining);
          debtorMessage = `Olá *${debtor.name}*, sua dívida de *${formattedAmount}* está atrasada há ${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'}.\n\nEntre em contato urgente para regularizar: https://wa.me/${adminPhone} 🙏`;
        }

        await sendWhatsApp(debtor.phone, debtorMessage);
        console.log(`Cobrança IMEDIATA enviada para: ${debtor.name}`);

        // Marcar como notificado para o Cron não duplicar
        await supabase
          .from('debts')
          .update({ last_notified_at: now.toISOString() })
          .eq('id', data.id);

        // Notificar o admin também
        const adminMsg = daysRemaining === 0
          ? `🚨 *VENCE HOJE!*\n👤 Devedor: *${debtor.name}*\n💰 Valor: *${formattedAmount}*\n\n✅ Cobrança automática já foi enviada ao devedor.`
          : daysRemaining < 0
          ? `🔥 *DÍVIDA ATRASADA!*\n👤 Devedor: *${debtor.name}*\n💰 Valor: *${formattedAmount}*\n\n✅ Cobrança automática já foi enviada ao devedor.`
          : `🔔 *VENCE AMANHÃ:*\n👤 Devedor: *${debtor.name}*\n💰 Valor: *${formattedAmount}*\n\n✅ Lembrete automático já foi enviado ao devedor.`;
        await sendWhatsApp(profile.notification_number, adminMsg);
      }
    } catch (autoErr) {
      console.error("Erro na cobrança automática imediata (não bloqueante):", autoErr);
    }

    return NextResponse.json(data);
}

