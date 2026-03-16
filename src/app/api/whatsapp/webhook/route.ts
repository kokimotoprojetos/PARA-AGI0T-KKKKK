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

    // 1. Normalização Extrema do Corpo da Requisição
    let payload = body;
    if (Array.isArray(body)) {
      payload = body[0];
    }
    
    const data = payload?.data || payload;
    // Tenta encontrar a mensagem onde quer que ela esteja na árvore do JSON
    const msgData = data?.messages?.[0] || data?.message || data;

    // Se a mensagem for "fromMe" (enviada pelo próprio bot), ignora
    const fromMe = msgData?.key?.fromMe || msgData?.fromMe || data?.key?.fromMe;
    if (fromMe) {
        console.log("Pulo: Mensagem enviada por mim (fromMe).");
        return NextResponse.json({ skipped: true, reason: "from_me" });
    }

    const remoteJid = msgData?.key?.remoteJid || msgData?.remoteJid || data?.key?.remoteJid || data?.sender;
    
    if (!remoteJid) {
      console.log("Erro: remoteJid não encontrado. Estrutura recebida não possui remetente claro.");
      return NextResponse.json({ skipped: true, reason: "no_remote_jid" });
    }

    const cleanNumber = remoteJid.split('@')[0].replace(/\D/g, '');
    console.log("Número Remetente Detectado:", cleanNumber);

    // Extrair Mensagem de Texto
    let userMessage = "";
    const msg = msgData?.message || msgData;
    
    if (msg?.conversation) {
      userMessage = msg.conversation;
    } else if (msg?.extendedTextMessage?.text) {
      userMessage = msg.extendedTextMessage.text;
    } else if (msg?.imageMessage?.caption) {
      userMessage = msg.imageMessage.caption;
    } else if (msg?.text) {
      userMessage = msg.text; // Formato alternativo
    } else if (data?.messageType === 'audioMessage' || msg?.audioMessage) {
      console.log("Áudio v2 detectado...");
      const messageKey = msgData?.key?.id || msgData?.id;
      
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
            console.log("Transcrição Whisper:", userMessage);
          }
        }
      }
    }

    if (!userMessage) {
      console.log("Pulo: Mensagem vazia ou tipo não mapeado (possível evento de status).");
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
