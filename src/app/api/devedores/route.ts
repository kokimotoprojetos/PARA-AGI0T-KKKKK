import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from('debtors')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const body = await req.json();
    const { name, phone, email, address } = body;

    if (!name || !phone) {
      return new NextResponse("Nome e Telefone são obrigatórios", { status: 400 });
    }

    const insertData: any = { 
      name, 
      phone, 
      user_id: userId 
    };
    
    // Garantir que o perfil do usuário existe (usando upsert para evitar erro de chave duplicada)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: userId }, { onConflict: 'id' })
      .select();

    if (profileError) {
      console.error("Erro ao garantir perfil:", profileError);
    }

    // Somente adiciona se existirem no body
    if (email) insertData.email = email;
    if (address) insertData.address = address;

    console.log("Tentando cadastrar devedor:", insertData);

    const { data, error } = await supabase
      .from('debtors')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("Erro Supabase (debtors):", error);
      return new NextResponse(`Erro no banco de dados: ${error.message}`, { status: 500 });
    }

    // Tentar enviar notificação para o número configurado
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_number')
        .eq('id', userId)
        .single();
      
      if (profile?.notification_number) {
        const evolutionUrl = process.env.EVOLUTION_API_URL;
        const apikey = process.env.EVOLUTION_API_KEY;
        const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "AgenteCobrador";
        
        await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": apikey as string },
          body: JSON.stringify({
            number: profile.notification_number,
            text: `📢 *Novo Devedor Cadastrado*\n\n👤 *Nome:* ${name}\n📱 *WhatsApp:* ${phone}\n📧 *Email:* ${email || 'Não informado'}\n\nO sistema agora monitora este cliente.`
          }),
        }).catch(e => console.error("Falha ao enviar alerta de admin:", e));
      }
    } catch (e) {
      console.error("Erro ao processar notificação de admin:", e);
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Erro no processamento da requisição:", err);
    return new NextResponse(err.message || "Internal Server Error", { status: 500 });
  }
}
