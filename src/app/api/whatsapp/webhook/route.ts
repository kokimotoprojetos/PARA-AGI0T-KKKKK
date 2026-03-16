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
      userMessage = msg.text; 
    } else if (data?.messageType === 'audioMessage' || msg?.audioMessage || msgData?.messageType === 'audioMessage') {
      console.log("Áudio v2 detectado...");
      
      // Como o Webhook está configurado para enviar base64, o áudio já vem embutido!
      let base64Audio = msg?.base64 || msgData?.base64;
      
      if (!base64Audio) {
         console.log("Baixando áudio da API...");
         const messageKey = msgData?.key || data?.key;
         const mediaRes = await fetch(`${evolutionUrl}/message/downloadMedia/${instanceName}`, {
           method: "POST",
           headers: { "Content-Type": "application/json", "apikey": evolutionKey as string },
           body: JSON.stringify({ message: { key: messageKey, message: msg } })
         });
         if (mediaRes.ok) {
           const mediaData = await mediaRes.json();
           base64Audio = mediaData.base64;
         } else {
             console.log("Erro ao baixar áudio da API", await mediaRes.text());
         }
      }

      if (base64Audio) {
        console.log("Áudio em Base64 recebido! Enviando para a OpenAI Whisper...");
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
          console.log("Transcrição Whisper concluída:", userMessage);
        } else {
          console.log("Erro na OpenAI Whisper:", await whisperRes.text());
        }
      } else {
         console.log("Falha ao obter base64 do áudio.");
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
      const registered = profiles?.map(p => p.notification_number) || [];
      return NextResponse.json({ skipped: true, reason: "not_admin", received: cleanNumber, registeredInDB: registered });
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
    
    LISTA DETALHADA DE DÍVIDAS PENDENTES:
    ${pendingDebts.map(d => `- Nome: ${d.debtor?.name}\n  Valor: R$ ${Number(d.amount).toFixed(2)}\n  Vencimento: ${new Date(d.due_date).toLocaleDateString('pt-BR')}\n  Descrição: ${d.description || 'Sem descrição'}`).join('\n')}
    `;

    // Resposta com OpenAI
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `Você é o Agente de IA do AgenteCobrador. Sua função é ajudar o administrador com informações financeiras.
            
            QUANDO O ADMIN PERGUNTAR "QUEM ESTÁ DEVENDO" OU PEDIR RELATÓRIOS:
            - Forneça uma lista completa e organizada.
            - Para cada devedor, apresente: Nome, Valor da Dívida e Data de Vencimento.
            - Seja cordial mas direto. Use emojis para organizar a lista.
            
            DADOS DO PAINEL PARA CONSULTA:
            ${systemContext}` 
          },
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
