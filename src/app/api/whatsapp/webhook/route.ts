import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Recebendo Webhook Evolution:", JSON.stringify(body, null, 2));

    // A Evolution API envia diferentes tipos de eventos. 
    // O evento de mensagem geralmente é 'messages.upsert' ou similar.
    // Verificamos se há uma mensagem de texto.
    const message = body.data?.message?.conversation || body.data?.message?.extendedTextMessage?.text;
    const remoteJid = body.data?.key?.remoteJid; // Ex: 5511999999999@s.whatsapp.net

    if (!message || !remoteJid) {
      return NextResponse.json({ skipped: true });
    }

    const cleanNumber = remoteJid.split('@')[0];

    // Verificar se este número é de um administrador (configurado no perfil)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, notification_number')
      .eq('notification_number', cleanNumber)
      .single();

    if (profileError || !profile) {
      console.log("Mensagem ignorada (não é admin):", cleanNumber);
      return NextResponse.json({ skipped: true });
    }

    const userId = profile.id;

    // Buscar dados do usuário para dar contexto à IA
    const [debtorsRes, debtsRes] = await Promise.all([
      supabase.from('debtors').select('*').eq('user_id', userId),
      supabase.from('debts').select('*, debtor:debtors(name)').eq('user_id', userId)
    ]);

    const debtorsCount = debtorsRes.data?.length || 0;
    const debts = debtsRes.data || [];
    const totalAmount = debts.reduce((sum, d) => sum + Number(d.amount), 0);
    const pendingAmount = debts.filter(d => d.status !== 'PAID').reduce((sum, d) => sum + Number(d.amount), 0);
    
    // Criar um resumo simplificado para o prompt
    const contextData = {
      total_devedores: debtorsCount,
      total_geral_dividas: totalAmount,
      total_pendente: pendingAmount,
      lista_devedores: debtorsRes.data?.map(d => d.name).join(", "),
      recentes: debts.slice(0, 5).map(d => `${d.debtor?.name}: R$ ${d.amount} (${d.status})`)
    };

    // Chamar DeepSeek
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    const aiResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${deepseekApiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { 
            role: "system", 
            content: `Você é o Agente Financeiro do sistema AgenteCobrador. 
            Você ajuda o administrador a gerenciar suas cobranças. 
            Aqui estão os dados atuais do banco de dados do usuário:
            - Total de devedores: ${contextData.total_devedores}
            - Total em dívidas (Geral): R$ ${contextData.total_geral_dividas}
            - Total Pendente/Atrasado: R$ ${contextData.total_pendente}
            - Devedores: ${contextData.lista_devedores}
            - Últimas movimentações: ${contextData.recentes.join("; ")}
            
            Responda de forma curta, direta e amigável. Use emojis. 
            Se ele perguntar quem deve, liste os nomes. Se perguntar quanto tem a receber, diga o valor total pendente.` 
          },
          { role: "user", content: message }
        ],
        stream: false
      })
    });

    const aiData = await aiResponse.json();
    const replyText = aiData.choices[0].message.content;

    // Enviar de volta para o WhatsApp via Evolution API
    const evolutionUrl = process.env.EVOLUTION_API_URL;
    const evolutionKey = process.env.EVOLUTION_API_KEY;
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "AgenteCobrador";

    await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey as string,
      },
      body: JSON.stringify({
        number: cleanNumber,
        text: replyText,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erro no Webhook:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
