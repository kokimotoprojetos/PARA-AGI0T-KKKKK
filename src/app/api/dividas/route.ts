import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from('debts')
    .select(`
      *,
      debtor:debtors(*)
    `)
    .eq('user_id', userId)
    .order('due_date', { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const { amount, dueDate, description, status, debtorId, debtTypeId } = body;

    if (!amount || !dueDate || !debtorId) {
      return new NextResponse("Campos obrigatórios ausentes (Valor, Vencimento ou Devedor)", { status: 400 });
    }

    const insertData: any = {
      amount: parseFloat(amount),
      due_date: dueDate,
      status: status || 'PENDING',
      debtor_id: debtorId,
      user_id: userId
    };

    if (description) insertData.description = description;
    if (debtTypeId) insertData.debt_type_id = debtTypeId;

    console.log("Tentando lançar dívida:", insertData);

    const { data, error } = await supabase
      .from('debts')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("Erro Supabase (debts):", error);
      return new NextResponse(`Erro no banco de dados: ${error.message}`, { status: 500 });
    }

    return NextResponse.json(data);
}
