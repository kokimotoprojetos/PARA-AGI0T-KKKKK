import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const evolutionUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, ""); 
const evolutionKey = process.env.EVOLUTION_API_KEY;
const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "AgenteCobrador";
const openaiKey = process.env.OPENAI_API_KEY;

export async function GET() {
  return new NextResponse("Webhook do Agente de IA está online e aguardando POSTs da Evolution API.", { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // LOG TOTAL para debug na Vercel
    console.log("--- WEBHOOK REQUISICAO ---");
    console.log(JSON.stringify(body, null, 2));

    // A Evolution pode mandar como Object direto ou dentro de um Array
    let messageData = null;
    if (Array.isArray(body.data)) {
        messageData = body.data[0];
    } else {
        messageData = body.data?.messages?.[0] || body.data;
    }

    const remoteJid = messageData?.key?.remoteJid || messageData?.remoteJid;
    
    if (!remoteJid) {
      console.log("Erro: remoteJid não encontrado no body.");
      return NextResponse.json({ skipped: true, reason: "no_remote_jid" });
    }

    const cleanNumber = remoteJid.split('@')[0].replace(/\D/g, '');
    console.log("Número Remetente Detectado:", cleanNumber);

    // Extrair Texto
    let userMessage = "";
    const msg = messageData.message;
    
    // Verificações robustas de tipo de mensagem
    if (msg?.conversation) {
      userMessage = msg.conversation;
    } else if (msg?.extendedTextMessage?.text) {
      userMessage = msg.extendedTextMessage.text;
    } else if (msg?.imageMessage?.caption) {
      userMessage = msg.imageMessage.caption;
    } else if (messageData.messageType === 'audioMessage' || msg?.audioMessage) {
      console.log("Áudio detectado, iniciando transcrição...");
      const messageKey = messageData.key?.id || messageData.id;
      
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
      console.log("Pulo: Mensagem vazia ou tipo não suportado.");
      return NextResponse.json({ skipped: true, reason: "empty_message" });
    }

    // VERIFICAÇÃO DE ADMIN (NUCLEAR)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, notification_number')
      .not('notification_number', 'is', null);

    const adminProfile = profiles?.find(p => {
      const dbNum = p.notification_number?.replace(/\D/g, '');
      if (!dbNum) return false;
      // Compara se o final dos números coincide (últimos 8 dígitos para ser seguro)
      const lastDigitsClean = cleanNumber.slice(-8);
      const lastDigitsDb = dbNum.slice(-8);
      return lastDigitsClean === lastDigitsDb;
    });

    if (!adminProfile) {
      console.log("BLOQUEIO: Número", cleanNumber, "não corresponde ao admin.");
      return NextResponse.json({ skipped: true, reason: "not_admin" });
    }

    console.log("Admin validado! Consultando painel...");
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
    DADOS ATUAIS:
    - Devedores: ${debtors.length}
    - Total Pendente: R$ ${pendingAmount.toFixed(2)}
    - Total Recebido: R$ ${paidAmount.toFixed(2)}
    - Devedores Recentes: ${debtors.slice(0, 5).map(d => d.name).join(", ")}
    `;

    // Chamar GPT-4o
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: `Aja como o Agente de IA do AgenteCobrador. Seja conciso.\n\n${systemContext}` },
          { role: "user", content: userMessage }
        ]
      })
    });

    const aiData = await aiResponse.json();
    const replyText = aiData.choices?.[0]?.message?.content || "Erro na IA.";

    // Enviar Resposta (Tentando múltiplos campos de número para compatibilidade)
    await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": evolutionKey as string },
      body: JSON.stringify({ 
        number: cleanNumber, 
        remoteJid: remoteJid, // Alguns formats pedem remoteJid
        text: replyText 
      }),
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("ERRO CRITICO:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
