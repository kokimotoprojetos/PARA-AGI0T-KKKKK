import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { phone, amount, dueDate, name } = await req.json();

  const formattedAmount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  const formattedDate = new Date(dueDate).toLocaleDateString('pt-BR');

  const message = `Olá, *${name}*.\nGostaria de lembrar sobre sua dívida pendente no valor de *${formattedAmount}* com vencimento em *${formattedDate}*.\nAgradecemos se puder regularizar sua situação em breve!`;

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
