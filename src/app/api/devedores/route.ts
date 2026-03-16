import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const debtors = await prisma.debtor.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json(debtors);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { name, phone, email } = await req.json();

  if (!name) return new NextResponse("Name is required", { status: 400 });

  const debtor = await prisma.debtor.create({
    data: {
      name,
      phone,
      email,
      userId: session.user.id
    }
  });

  return NextResponse.json(debtor);
}
