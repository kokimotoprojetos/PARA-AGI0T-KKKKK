import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const debts = await prisma.debt.findMany({
    where: { debtor: { userId: session.user.id } },
    include: { debtor: true },
    orderBy: { dueDate: 'asc' }
  });

  return NextResponse.json(debts);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { amount, dueDate, description, status, debtorId } = await req.json();

  if (!amount || !dueDate || !debtorId) return new NextResponse("Missing required fields", { status: 400 });

  const debt = await prisma.debt.create({
    data: {
      amount,
      dueDate: new Date(dueDate),
      description,
      status: status || 'PENDING',
      debtorId
    }
  });

  return NextResponse.json(debt);
}
