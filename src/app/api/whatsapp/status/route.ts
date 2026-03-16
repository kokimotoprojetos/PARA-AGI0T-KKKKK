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
    
    // Se estiver conectando e houver necessidade, pegamos o base64 se Evolution v2 disponibilizar de outra rota
    // Em versoes recentes o connectioState exibe o auth e qr se 'connecting' 
    let qrcodeBase64 = null;
    let state = data?.instance?.state || 'close';

    if (state === 'connecting') {
        const qrRes = await fetch(`${evolutionUrl}/instance/connect/${instanceName}`, {
            method: "GET",
            headers: { "apikey": apikey as string }
        });
        if (qrRes.ok) {
            const qrData = await qrRes.json();
            qrcodeBase64 = qrData.base64; // base64 da imagem QR na evolution API
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
      const res = await fetch(`${evolutionUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": apikey as string },
        body: JSON.stringify({
            instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
        })
      });
      
      const data = await res.json();
      return NextResponse.json(data);
    } catch (error: any) {
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
