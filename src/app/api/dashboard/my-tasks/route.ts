import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: session.user.id,
        status: { not: "DONE" },
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        updatedAt: true,
      },
      orderBy: [
        { dueDate: { sort: "asc", nulls: "last" } },
        { updatedAt: "desc" },
      ],
      take: 6,
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Error fetching my tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
