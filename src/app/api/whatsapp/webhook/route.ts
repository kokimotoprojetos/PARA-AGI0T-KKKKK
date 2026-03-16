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

    // Buscar dados completos do usuário para dar contexto total à IA
    const [debtorsRes, debtsRes, typesRes] = await Promise.all([
      supabase.from('debtors').select('*').eq('user_id', userId),
      supabase.from('debts').select('*, debtor:debtors(name), type:debt_types(name)').eq('user_id', userId),
      supabase.from('debt_types').select('*').eq('user_id', userId)
    ]);

    const debtors = debtorsRes.data || [];
    const debts = debtsRes.data || [];
    const types = typesRes.data || [];

    const totalAmount = debts.reduce((sum, d) => sum + Number(d.amount), 0);
    const pendingDebts = debts.filter(d => d.status === 'PENDING');
    const pendingAmount = pendingDebts.reduce((sum, d) => sum + Number(d.amount), 0);
    const paidAmount = debts.filter(d => d.status === 'PAID').reduce((sum, d) => sum + Number(d.amount), 0);
    
    // Criar um resumo detalhado (Cérebro do Agente)
    const systemContext = `
    DADOS DO PAINEL FINANCEIRO:
    - Total de Clientes (Devedores): ${debtors.length}
    - Lista de Clientes: ${debtors.map(d => `${d.name} (${d.phone})`).join(", ")}
    
    - Resumo de Dívidas:
      * Total histórico lançado: R$ ${totalAmount.toFixed(2)}
      * Total já RECEBIDO: R$ ${paidAmount.toFixed(2)}
      * Total PENDENTE (A receber): R$ ${pendingAmount.toFixed(2)}
    
    - Tipos de Cobrança configurados: ${types.map(t => t.name).join(", ")}
    
    - Detalhes das Dívidas Pendentes:
      ${pendingDebts.map(d => `- ${d.debtor?.name}: R$ ${d.amount} (Vence em: ${new Date(d.due_date).toLocaleDateString('pt-BR')}) - ${d.description || 'Sem descrição'}`).join("\n      ")}
    
    - Últimos Registros (Histórico):
      ${debts.slice(-10).map(d => `- ${d.debtor?.name}: R$ ${d.amount} [${d.status}]`).join("\n      ")}
    `;

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
            Você ajuda o administrador a gerenciar suas cobranças com precisão total. 
            
            ${systemContext}
            
            INSTRUÇÕES:
            1. Responda de forma curta, direta e amigável. Use emojis. 
            2. Se perguntarem "quem deve", liste os nomes e valores pendentes.
            3. Se perguntarem o total, informe o "Total PENDENTE".
            4. Você tem acesso a todo o painel, então pode responder sobre devedores, valores, datas de vencimento e tipos de cobrança.` 
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
