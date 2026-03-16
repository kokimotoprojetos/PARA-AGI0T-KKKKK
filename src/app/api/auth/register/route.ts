import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Dados incompletos" }, { status: 400 });
    }

    // Criar o usuário no Supabase Auth
    // Nota: Usamos o service role key no server para criar o usuário e perfis sem RLS de sinalização de email
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });

    if (authError) {
      return NextResponse.json({ message: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ message: "Falha ao criar usuário" }, { status: 500 });
    }

    // Hash para compatibilidade com o authorize atual (opcional mas mantido para segurança extra no profile)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Inserir no perfil público
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        name,
        email,
        password: hashedPassword,
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      return NextResponse.json({ message: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Usuário criado com sucesso!" }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "Erro interno no processo." }, { status: 500 });
  }
}
