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
    
    // Garantir que o perfil do usuário existe (para satisfazer FKs se ainda existirem)
    await supabase.from('profiles').insert([{ id: userId }]).select();

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

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Erro no processamento da requisição:", err);
    return new NextResponse(err.message || "Internal Server Error", { status: 500 });
  }
}
