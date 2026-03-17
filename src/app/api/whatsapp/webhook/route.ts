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
    } else if (msg?.contactMessage) {
      const vcard = msg?.contactMessage?.vcard || "";
      const match = vcard.match(/waid=(\d+)/) || vcard.match(/TEL.*:(\d+)/);
      const foundNumber = match ? match[1] : "";
      userMessage = `[CARTÃO DE CONTATO RECEBIDO - Nome: ${msg.contactMessage.displayName}, Telefone: ${foundNumber}]`;
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

    // 4. Definição de Funções (Tools) para o GPT
    const tools: any[] = [
      {
        type: "function",
        function: {
          name: "add_debtor",
          description: "Cadastra um novo devedor no banco de dados.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nome completo do devedor" },
              phone: { type: "string", description: "Telefone/WhatsApp (opcional)" },
              amount: { type: "number", description: "Valor da dívida inicial (opcional)" },
              dueDate: { type: "string", description: "Data de vencimento YYYY-MM-DD (opcional)" },
              description: { type: "string", description: "Descrição da dívida (opcional)" }
            },
            required: ["name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_debt",
          description: "Lança uma nova dívida para um devedor existente.",
          parameters: {
            type: "object",
            properties: {
              debtorName: { type: "string", description: "Nome do devedor conforme cadastrado" },
              amount: { type: "number", description: "Valor da dívida (ex: 150.50)" },
              dueDate: { type: "string", description: "Data de vencimento no formato YYYY-MM-DD" },
              description: { type: "string", description: "Breve descrição da dívida" }
            },
            required: ["debtorName", "amount", "dueDate"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "delete_debtor",
          description: "Remove um devedor e todas as suas dívidas do banco de dados.",
          parameters: {
            type: "object",
            properties: {
              debtorName: { type: "string", description: "Nome ou parte do nome do devedor a ser removido PERMANENTEMENTE" }
            },
            required: ["debtorName"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_debtor_phone",
          description: "Atualiza o número de WhatsApp de um devedor existente.",
          parameters: {
            type: "object",
            properties: {
              debtorName: { type: "string", description: "Nome do devedor no sistema" },
              phone: { type: "string", description: "Novo número de telefone (apenas números)" }
            },
            required: ["debtorName", "phone"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "collect_debt",
          description: "Envia uma mensagem de cobrança automática via WhatsApp diretamente para o devedor.",
          parameters: {
            type: "object",
            properties: {
              debtorName: { type: "string", description: "Nome do devedor para quem a cobrança será enviada" }
            },
            required: ["debtorName"]
          }
        }
      }
    ];

    // Chamar GPT-4o com Tools
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `Você é o AgenteCobrador AI. Sua função é EXECUÇÃO IMEDIATA de comandos financeiros. 
            
            DATA ATUAL: ${new Date().toLocaleDateString('pt-BR')} (Referência para cálculos).
            
            REGRAS DE OURO:
            1. COBRANÇA (collect_debt): Se o admin disser "Cobra o Pedro", "Manda mensagem pro Pedro" ou similar, use a função 'collect_debt'. Ela enviará uma mensagem automática com o saldo devedor diretamente para o WhatsApp do cliente.
            2. FLUXO DE CONTATO + DÍVIDA: Se enviar [CARTÃO DE CONTATO] + valor, peça a data e depois salve.
            3. VINCULAR CONTATO: Use 'update_debtor_phone' para atrelar um contato recebido a um nome.
            4. OBRIGATÓRIO NOME COMPLETO: Para novos cadastros manuais sem cartão, garanta o nome completo.
            5. SEM ENROLAÇÃO: Respostas curtas e diretas.
            6. DATA ATUAL: ${new Date().toLocaleDateString('pt-BR')}.
            
            DADOS DO PAINEL (Para consulta e match):
            ${systemContext}` 
          },
          { role: "user", content: userMessage }
        ],
        tools: tools,
        tool_choice: "auto"
      })
    });

    const aiData = await aiResponse.json();
    const message = aiData.choices?.[0]?.message;

    let finalReply = "";

    // 5. Processar execução de funções (se houver)
    if (message?.tool_calls) {
      for (const toolCall of message.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        
        if (toolCall.function.name === "add_debtor") {
          const insertObj: any = { 
            name: args.name, 
            user_id: userId 
          };
          if (args.phone) insertObj.phone = args.phone.replace(/\D/g, '');
          
          const { data: newDebtor, error: debtorError } = await supabase
            .from('debtors')
            .insert([insertObj])
            .select()
            .single();

          if (debtorError) {
            finalReply += `❌ Erro ao cadastrar ${args.name}: ${debtorError.message}\n`;
          } else {
            finalReply += `✅ Devedor *${args.name}* cadastrado.\n`;
            
            // Se houver dados de dívida, cadastra no mesmo fluxo
            if (args.amount && args.dueDate) {
              const { error: debtError } = await supabase.from('debts').insert([{
                amount: args.amount,
                due_date: args.dueDate,
                description: args.description || "Dívida inicial",
                debtor_id: newDebtor.id,
                user_id: userId,
                status: 'PENDING'
              }]);
              finalReply += debtError ? `❌ Erro ao lançar dívida: ${debtError.message}\n` : `💰 Dívida de *R$ ${args.amount}* lançada para *${args.name}*!\n`;
            }
          }
        }

        if (toolCall.function.name === "add_debt") {
          const matches = debtors.filter(d => d.name.toLowerCase().includes(args.debtorName.toLowerCase()));
          
          if (matches.length === 0) {
            finalReply += `❌ Não encontrei nenhum devedor chamado "${args.debtorName}".\n`;
          } else if (matches.length > 1) {
            finalReply += `🤔 Encontrei ${matches.length} devedores com nomes parecidos:\n\n` + 
              matches.map(m => {
                const balance = debts.filter(d => d.debtor_id === m.id && d.status === 'PENDING').reduce((s, b) => s + Number(b.amount), 0);
                return `• *${m.name}* (Saldo: R$ ${balance.toFixed(2)})`;
              }).join('\n') + 
              `\n\nPor favor, digite o nome completo para lançar a dívida.`;
          } else {
            const debtor = matches[0];
            const { error } = await supabase.from('debts').insert([{
              amount: args.amount,
              due_date: args.dueDate,
              description: args.description || "",
              debtor_id: debtor.id,
              user_id: userId,
              status: 'PENDING'
            }]);
            finalReply += error ? `❌ Erro ao lançar dívida: ${error.message}\n` : `✅ Dívida de *R$ ${args.amount}* lançada para *${debtor.name}* (Vencimento: ${new Date(args.dueDate).toLocaleDateString('pt-BR')})!\n`;
          }
        }

        if (toolCall.function.name === "delete_debtor") {
          const matches = debtors.filter(d => d.name.toLowerCase().includes(args.debtorName.toLowerCase()));
          
          if (matches.length === 0) {
            finalReply += `❌ Devedor "${args.debtorName}" não encontrado.\n`;
          } else if (matches.length > 1) {
            finalReply += `🤔 Encontrei ${matches.length} pessoas com nomes parecidos:\n\n` + 
              matches.map(m => {
                const balance = debts.filter(d => d.debtor_id === m.id && d.status === 'PENDING').reduce((s, b) => s + Number(b.amount), 0);
                return `• *${m.name}* (Saldo: R$ ${balance.toFixed(2)})`;
              }).join('\n') + 
              `\n\nQual deles você deseja remover? Digite o nome completo.`;
          } else {
            const debtor = matches[0];
            const { error } = await supabase.from('debtors').delete().eq('id', debtor.id).eq('user_id', userId);
            finalReply += error ? `❌ Erro ao deletar: ${error.message}\n` : `🗑️ *${debtor.name}* e suas dívidas foram removidos.\n`;
          }
        }

        if (toolCall.function.name === "update_debtor_phone") {
          const matches = debtors.filter(d => d.name.toLowerCase().includes(args.debtorName.toLowerCase()));
          
          if (matches.length === 0) {
            finalReply += `❌ Devedor "${args.debtorName}" não encontrado para vincular o número.\n`;
          } else if (matches.length > 1) {
            finalReply += `🤔 Encontrei vários "${args.debtorName}". Qual deles deve receber o número ${args.phone}?\n\n` + 
              matches.map(m => `• *${m.name}*`).join('\n');
          } else {
            const debtor = matches[0];
            const cleanPhone = args.phone.replace(/\D/g, '');
            const { error } = await supabase.from('debtors').update({ phone: cleanPhone }).eq('id', debtor.id).eq('user_id', userId);
            finalReply += error ? `❌ Erro ao atualizar telefone: ${error.message}\n` : `📱 WhatsApp de *${debtor.name}* atualizado para *${cleanPhone}*!\n`;
          }
        }

        if (toolCall.function.name === "collect_debt") {
          const matches = debtors.filter(d => d.name.toLowerCase().includes(args.debtorName.toLowerCase()));

          if (matches.length === 0) {
            finalReply += `❌ Devedor "${args.debtorName}" não encontrado para cobrança.\n`;
          } else if (matches.length > 1) {
            finalReply += `🤔 Encontrei vários "${args.debtorName}". Quem você quer cobrar?\n\n` + 
              matches.map(m => `• *${m.name}*`).join('\n');
          } else {
            const debtor = matches[0];
            if (!debtor.phone) {
              finalReply += `⚠️ O devedor *${debtor.name}* não possui telefone cadastrado para cobrança.\n`;
            } else {
              const debtorDebts = debts.filter(d => d.debtor_id === debtor.id && d.status === 'PENDING');
              const total = debtorDebts.reduce((sum, d) => sum + Number(d.amount), 0);
              const messageText = `Olá ${debtor.name}, estamos entrando em contato para lembrar de sua(s) pendência(s) no total de *R$ ${total.toFixed(2)}*. Por favor, entre em contato para regularizar.`;
              
              const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "apikey": evolutionKey as string },
                body: JSON.stringify({ number: debtor.phone, text: messageText }),
              });
              
              finalReply += res.ok ? `📩 Mensagem de cobrança enviada para *${debtor.name}*!\n` : `❌ Falha ao enviar cobrança para ${debtor.name}.\n`;
            }
          }
        }
      }
    } else {
      finalReply = message?.content || "Desculpe, não entendi o pedido.";
    }

    // Enviar Resposta (v2 Compatibility)
    console.log("Enviando resposta v2 para:", cleanNumber);
    await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": evolutionKey as string },
      body: JSON.stringify({ 
        number: cleanNumber,
        text: finalReply,
        options: { delay: 1000, presence: "composing" }
      }),
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("ERRO v2:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
