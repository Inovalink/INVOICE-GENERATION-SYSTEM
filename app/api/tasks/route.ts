import { NextResponse } from 'next/server';
import { PrismaClient, type TaskPriority } from '@prisma/client';
import { getDefaultUserId } from '@/lib/auth/getCurrentUser';

const prisma = new PrismaClient();

/** Month 1–12, year full (e.g. 2026). Returns tasks whose dueDate falls in that calendar month. */
export async function GET(request: Request) {
  try {
    const userId = await getDefaultUserId();
    if (!userId) {
      return NextResponse.json({ message: 'No user in system' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') ?? '', 10);
    const month = parseInt(searchParams.get('month') ?? '', 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ message: 'Invalid year/month' }, { status: 400 });
    }

    const monthIdx = month - 1;
    const start = new Date(year, monthIdx, 1, 0, 0, 0, 0);
    const end = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);

    const tasks = await prisma.task.findMany({
      where: {
        userId,
        dueDate: { gte: start, lte: end },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json(
      tasks.map((t) => ({
        id: t.id,
        title: t.title,
        notes: t.notes,
        dueDate: t.dueDate.toISOString(),
        priority: t.priority,
        completed: t.completed,
        createdAt: t.createdAt.toISOString(),
      })),
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: 'Failed to load tasks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getDefaultUserId();
    if (!userId) {
      return NextResponse.json({ message: 'No user in system' }, { status: 500 });
    }

    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    const dueDateStr = typeof body.dueDate === 'string' ? body.dueDate : '';
    const priority: TaskPriority = ['NORMAL', 'HIGH', 'URGENT'].includes(body.priority)
      ? body.priority
      : 'NORMAL';

    if (!title) {
      return NextResponse.json({ message: 'Title is required' }, { status: 400 });
    }

    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDateStr);
    if (!m) {
      return NextResponse.json({ message: 'Invalid dueDate (use YYYY-MM-DD)' }, { status: 400 });
    }
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    const dueDate = new Date(y, mo, d, 12, 0, 0, 0);

    const task = await prisma.task.create({
      data: {
        userId,
        title,
        notes: notes || null,
        dueDate,
        priority,
      },
    });

    return NextResponse.json(
      {
        id: task.id,
        title: task.title,
        notes: task.notes,
        dueDate: task.dueDate.toISOString(),
        priority: task.priority,
        completed: task.completed,
        createdAt: task.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: 'Failed to create task' }, { status: 500 });
  }
}
