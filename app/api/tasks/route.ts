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
    const yearStr  = searchParams.get('year');
    const monthStr = searchParams.get('month');

    const formatTask = (t: { id: string; title: string; notes: string | null; dueDate: Date; priority: TaskPriority; completed: boolean; createdAt: Date }) => ({
      id: t.id,
      title: t.title,
      notes: t.notes,
      dueDate: t.dueDate.toISOString(),
      priority: t.priority,
      completed: t.completed,
      createdAt: t.createdAt.toISOString(),
    });

    // No date filters → return all tasks (for Kanban view)
    if (!yearStr || !monthStr) {
      const tasks = await prisma.task.findMany({
        where: { userId },
        orderBy: [{ completed: 'asc' }, { priority: 'desc' }, { dueDate: 'asc' }],
        take: 1000,
      });
      return NextResponse.json(tasks.map(formatTask));
    }

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
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

    return NextResponse.json(tasks.map(formatTask));
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

    const dtMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(dueDateStr);
    const dMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDateStr);
    let dueDate: Date;
    if (dtMatch) {
      const [, yr, mo, dy, hr, mn] = dtMatch.map(Number);
      dueDate = new Date(yr, mo - 1, dy, hr, mn, 0, 0);
    } else if (dMatch) {
      const [, yr, mo, dy] = dMatch.map(Number);
      dueDate = new Date(yr, mo - 1, dy, 12, 0, 0, 0);
    } else {
      return NextResponse.json({ message: 'Invalid dueDate (use YYYY-MM-DD or YYYY-MM-DDTHH:mm)' }, { status: 400 });
    }

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
