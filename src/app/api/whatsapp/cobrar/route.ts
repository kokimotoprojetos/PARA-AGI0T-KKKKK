import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { phone, amount, dueDate, name } = await req.json();

  if (!phone) {
    return new NextResponse("Número de telefone não informado.", { status: 400 });
  }

  // Buscar número do administrador para incluir na mensagem
  const { data: profile } = await supabase
    .from('profiles')
    .select('notification_number')
    .eq('id', userId)
    .single();

  const adminPhone = profile?.notification_number?.replace(/\D/g, '') || '';

  const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  const formattedDate = new Date(dueDate).toLocaleDateString('pt-BR');

  const contactLine = adminPhone 
    ? `\nEntre em contato para regularizar: https://wa.me/${adminPhone}` 
    : `\nAgradecemos se puder regularizar sua situação em breve!`;

  const message = `Olá, *${name}*.\nGostaria de lembrar sobre sua dívida pendente no valor de *${formattedAmount}* com vencimento em *${formattedDate}*.${contactLine}`;

  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const apikey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "AgenteCobrador";

  try {
    const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apikey as string,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    if (!res.ok) {
      const errorData = await res.text();
      throw new Error(`Falha no envio via Evolution API: ${errorData}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return new NextResponse(error.message || "Service Unavailable", { status: 503 });
  }
}
