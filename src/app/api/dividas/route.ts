import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from('debts')
    .select(`
      *,
      debtor:debtors(*)
    `)
    .eq('user_id', session.user.id)
    .order('due_date', { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { amount, dueDate, description, status, debtorId, debtTypeId } = await req.json();

  if (!amount || !dueDate || !debtorId) return new NextResponse("Missing required fields", { status: 400 });

  const { data, error } = await supabase
    .from('debts')
    .insert([{
      amount,
      due_date: dueDate,
      description,
      status: status || 'PENDING',
      debtor_id: debtorId,
      debt_type_id: debtTypeId,
      user_id: session.user.id
    }])
    .select()
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json(data);
}
