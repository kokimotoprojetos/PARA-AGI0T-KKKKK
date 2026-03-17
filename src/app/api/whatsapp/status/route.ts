import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const evolutionUrl = process.env.EVOLUTION_API_URL;
const apikey = process.env.EVOLUTION_API_KEY;
const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "AgenteCobrador";

export async function GET() {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const res = await fetch(`${evolutionUrl}/instance/connectionState/${instanceName}`, {
      method: "GET",
      headers: { "apikey": apikey as string }
    });

    if (!res.ok) {
        // Pode não existir a instância
        return NextResponse.json({ instance: { state: 'close' } });
    }

    const data = await res.json();
    
    // Se estiver conectando ou em estado 'close', tentamos buscar o qrcode
    let qrcodeBase64 = null;
    let state = data?.instance?.state || 'close';

    if (state === 'connecting' || state === 'close') {
        const qrRes = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
            method: "GET",
            headers: { "apikey": apikey as string }
        });
        
        if (qrRes.ok) {
            const qrData = await qrRes.json();
            // Evolution v2 pode retornar 'base64' (já com prefixo) ou 'code' (string crua do QR)
            // Priorizamos o 'code' para o frontend gerar o QR localmente, o que é mais estável
            // Se não tiver 'code', usamos o 'base64'
            qrcodeBase64 = qrData.code || qrData.base64 || null;
            
            // Log para debug interno (remova em prod se quiser)
            console.log("QR Data recebido da Evolution:", qrcodeBase64 ? "Sim (Início: " + qrcodeBase64.substring(0, 20) + "...)" : "Não");
        }
    }

    return NextResponse.json({
      instance: {
        state: state,
        qrcode: qrcodeBase64
      }
    });

  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}

export async function POST() {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  
    try {
      // 1. Criar a instância
      const createRes = await fetch(`${evolutionUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": apikey as string },
        body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
        })
      });
      
      const createData = await createRes.json();

      // URL base do seu servidor (pega do host atual ou env)
      // Como estamos no backend, usamos uma variável de ambiente ou um fallback hardcoded provisório
      const webhookUrl = process.env.NEXT_PUBLIC_APP_URL ? 
        `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook` : 
        "https://debitai.vercel.app/api/whatsapp/webhook";

      // 2. Configurar o Webhook automaticamente
      console.log("Configurando Webhook Automático na Evolution API para:", webhookUrl);
      const webhookRes = await fetch(`${evolutionUrl}/webhook/set/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": apikey as string },
        body: JSON.stringify({
            webhook: {
                enabled: true,
                url: webhookUrl,
                byEvents: false,
                base64: true,
                events: [
                    "MESSAGES_UPSERT",
                    "MESSAGES_UPDATE"
                ]
            }
        })
      });

      if (!webhookRes.ok) {
        console.error("Erro ao configurar Webhook:", await webhookRes.text());
      } else {
        console.log("Webhook configurado com sucesso!");
      }

      // 3. Configurar Settings (Avisar quando houver nova mensagem, ler áudios, etc)
      const settingsRes = await fetch(`${evolutionUrl}/settings/set/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": apikey as string },
        body: JSON.stringify({
            rejectCall: false,
            msgCall: "",
            groupsIgnore: true,
            alwaysOnline: true,
            readMessages: true,
            readStatus: false,
            syncFullHistory: false
        })
      });

      if (!settingsRes.ok) {
        console.error("Erro ao configurar Settings:", await settingsRes.text());
      } else {
        console.log("Settings configurados com sucesso!");
      }

      return NextResponse.json(createData);
    } catch (error: any) {
      console.error("Erro ao criar instância/webhook:", error);
      return new NextResponse(error.message, { status: 500 });
    }
}

export async function DELETE() {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  try {
    // Primeiro tentamos o logout, depois deletamos a instância
    await fetch(`${evolutionUrl}/instance/logout/${instanceName}`, {
      method: "DELETE",
      headers: { "apikey": apikey as string }
    });

    const res = await fetch(`${evolutionUrl}/instance/delete/${instanceName}`, {
      method: "DELETE",
      headers: { "apikey": apikey as string }
    });

    if (!res.ok) {
        const errorData = await res.text();
        throw new Error(`Erro ao deletar instância: ${errorData}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return new NextResponse(error.message, { status: 500 });
  }
}
