import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const evolutionUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, ""); 
const evolutionKey = process.env.EVOLUTION_API_KEY;
const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "AgenteCobrador";
const openaiKey = process.env.OPENAI_API_KEY;

export async function GET() {
  return new NextResponse("Webhook do Agente de IA (Evolution v2) está online.", { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // LOG TOTAL para debug na Vercel - Crucial para v2
    console.log("--- WEBHOOK EVOLUTION V2 RECEBIDO ---");
    console.log(JSON.stringify(body, null, 2));

    // Na v2, o corpo costuma vir como: { event: "messages.upsert", data: { ... } }
    // As mensagens ficam em data.message ou data (dependendo do evento selecionado)
    const event = body.event;
    const data = body.data;

    if (!data) {
        console.log("Erro: Propriedade 'data' não encontrada no body.");
        return NextResponse.json({ skipped: true, reason: "no_data" });
    }

    // Identificar o JID do remetente (v2 format)
    const remoteJid = data.key?.remoteJid || data.remoteJid;
    
    if (!remoteJid) {
      console.log("Erro: remoteJid não encontrado.");
      return NextResponse.json({ skipped: true, reason: "no_remote_jid" });
    }

    const cleanNumber = remoteJid.split('@')[0].replace(/\D/g, '');
    console.log("Número Remetente (v2):", cleanNumber);

    // Extrair Mensagem de Texto (v2 pode vir direto em data.message)
    let userMessage = "";
    const msg = data.message;
    
    if (msg?.conversation) {
      userMessage = msg.conversation;
    } else if (msg?.extendedTextMessage?.text) {
      userMessage = msg.extendedTextMessage.text;
    } else if (msg?.imageMessage?.caption) {
      userMessage = msg.imageMessage.caption;
    } else if (body.data?.messageType === 'audioMessage' || msg?.audioMessage) {
      console.log("Áudio v2 detectado...");
      const messageKey = data.key?.id || data.id;
      
      const mediaRes = await fetch(`${evolutionUrl}/instance/media/base64/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": evolutionKey as string },
        body: JSON.stringify({ key: { id: messageKey } })
      });

      if (mediaRes.ok) {
        const mediaData = await mediaRes.json();
        const base64Audio = mediaData.base64;
        if (base64Audio) {
          const audioBuffer = Buffer.from(base64Audio, 'base64');
          const formData = new FormData();
          const file = new Blob([audioBuffer], { type: 'audio/ogg' });
          formData.append('file', file, 'audio.ogg');
          formData.append('model', 'whisper-1');

          const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${openaiKey}` },
            body: formData
          });

          if (whisperRes.ok) {
            const whisperData = await whisperRes.json();
            userMessage = whisperData.text;
            console.log("Transcrição v2 Whisper:", userMessage);
          }
        }
      }
    }

    if (!userMessage) {
      console.log("Pulo: Mensagem vazia ou tipo não mapeado na v2.");
      return NextResponse.json({ skipped: true, reason: "empty_or_unsupported" });
    }

    // VERIFICAÇÃO DE ADMIN (NUCLEAR v2)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, notification_number')
      .not('notification_number', 'is', null);

    const adminProfile = profiles?.find(p => {
      const dbNum = p.notification_number?.replace(/\D/g, '');
      if (!dbNum) return false;
      const lastDigitsClean = cleanNumber.slice(-8);
      const lastDigitsDb = dbNum.slice(-8);
      return lastDigitsClean === lastDigitsDb;
    });

    if (!adminProfile) {
      console.log("BLOQUEIO v2: Número", cleanNumber, "não autorizado.");
      return NextResponse.json({ skipped: true, reason: "not_admin" });
    }

    const userId = adminProfile.id;

    // Buscar Dados do Painel
    const [debtorsRes, debtsRes] = await Promise.all([
      supabase.from('debtors').select('*').eq('user_id', userId),
      supabase.from('debts').select('*, debtor:debtors(name)').eq('user_id', userId),
    ]);

    const debtors = debtorsRes.data || [];
    const debts = debtsRes.data || [];
    const pendingDebts = debts.filter(d => d.status === 'PENDING');
    const pendingAmount = pendingDebts.reduce((sum, d) => sum + Number(d.amount), 0);
    const paidAmount = debts.filter(d => d.status === 'PAID').reduce((sum, d) => sum + Number(d.amount), 0);
    
    const systemContext = `
    DADOS PAINEL:
    - Devedores: ${debtors.length}
    - Pendente: R$ ${pendingAmount.toFixed(2)}
    - Recebido: R$ ${paidAmount.toFixed(2)}
    `;

    // Resposta com OpenAI
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: `Agente de IA do AgenteCobrador. Responda curto.\n\n${systemContext}` },
          { role: "user", content: userMessage }
        ]
      })
    });

    const aiData = await aiResponse.json();
    const replyText = aiData.choices?.[0]?.message?.content || "Erro IA";

    // Enviar Resposta (v2 Compatibility)
    console.log("Enviando resposta v2 para:", cleanNumber);
    await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": evolutionKey as string },
      body: JSON.stringify({ 
        number: cleanNumber,
        text: replyText,
        options: {
            delay: 1200,
            presence: "composing"
        }
      }),
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("ERRO v2:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
