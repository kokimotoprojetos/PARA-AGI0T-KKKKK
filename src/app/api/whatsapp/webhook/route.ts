import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const evolutionUrl = process.env.EVOLUTION_API_URL;
const evolutionKey = process.env.EVOLUTION_API_KEY;
const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "AgenteCobrador";
const openaiKey = process.env.OPENAI_API_KEY;

export async function GET() {
  return new NextResponse("Webhook do Agente de IA está online e aguardando POSTs da Evolution API.", { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("--- WEBHOOK EVOLUTION RECEBIDO ---");
    console.log("Evento:", body.event);
    console.log("Tipo Mensagem:", body.data?.messageType);
    console.log("JID Remoto:", body.data?.key?.remoteJid);

    const remoteJid = body.data?.key?.remoteJid;
    if (!remoteJid) {
      console.log("Pulo: remetente não identificado.");
      return NextResponse.json({ skipped: true });
    }

    const cleanNumber = remoteJid.split('@')[0].replace(/\D/g, '');
    console.log("Número limpo do remetente:", cleanNumber);
    const messageType = body.data?.messageType;
    let userMessage = "";

    // 1. Extrair Texto ou Transcrever Áudio
    if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
      userMessage = body.data?.message?.conversation || body.data?.message?.extendedTextMessage?.text;
    } else if (messageType === 'audioMessage') {
      console.log("Processando áudio para transcrição...");
      
      // Baixar áudio da Evolution API
      const messageKey = body.data.key.id;
      const mediaRes = await fetch(`${evolutionUrl}/instance/media/base64/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": evolutionKey as string },
        body: JSON.stringify({ key: { id: messageKey } })
      });

      if (mediaRes.ok) {
        const mediaData = await mediaRes.json();
        const base64Audio = mediaData.base64;

        if (base64Audio) {
          // Converter base64 para Blob/File para o Whisper
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
            console.log("Transcrição concluída:", userMessage);
          }
        }
      }
    }

    if (!userMessage) return NextResponse.json({ skipped: true });

    // 2. Verificar Administrador (Busca flexível)
    // Procuramos o número exatamente como veio ou sem o prefixo 55 se o usuário salvou sem.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, notification_number')
      .or(`notification_number.eq.${cleanNumber},notification_number.eq.${cleanNumber.replace(/^55/, '')}`)
      .single();

    if (profileError || !profile) {
      console.log("BLOQUEIO: Número", cleanNumber, "não autorizado como administrador.");
      return NextResponse.json({ skipped: "not_admin", numberTried: cleanNumber });
    }

    console.log("Admin validado! Processando resposta da IA...");

    const userId = profile.id;

    // 3. Buscar Dados do Painel
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
      ${pendingDebts.map(d => `- ${d.debtor?.name}: R$ ${d.amount} (Vence em: ${new Date(d.due_date).toLocaleDateString('pt-BR')})`).join("\n      ")}
    `;

    // 4. Responder com OpenAI GPT-4o
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `Você é o Agente Financeiro do sistema AgenteCobrador. 
            Você ajuda o administrador a gerenciar suas cobranças com precisão total. 
            
            ${systemContext}
            
            INSTRUÇÕES:
            1. Responda de forma curta, direta e amigável. Use emojis. 
            2. Se perguntarem "quem deve", liste os nomes e valores pendentes.
            3. Se você transcreveu um áudio e a pessoa te agradecer ou pedir algo, responda normalmente.
            4. Você tem acesso a todo o painel, responda sobre valores, devedores e vencimentos.` 
          },
          { role: "user", content: userMessage }
        ]
      })
    });

    const aiData = await aiResponse.json();
    const replyText = aiData.choices[0].message.content;

    // 5. Enviar Resposta via WhatsApp
    const sendRes = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": evolutionKey as string },
      body: JSON.stringify({ number: cleanNumber, text: replyText }),
    });

    if (sendRes.ok) {
        console.log("Resposta enviada com sucesso para o WhatsApp!");
    } else {
        const errTxt = await sendRes.text();
        console.error("Erro ao enviar resposta via Evolution:", errTxt);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erro no Webhook:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
