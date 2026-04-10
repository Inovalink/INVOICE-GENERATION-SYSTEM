import { NextResponse } from 'next/server';
import { PrismaClient, type TaskPriority } from '@prisma/client';
import { getDefaultUserId } from '@/lib/auth/getCurrentUser';

const prisma = new PrismaClient();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getDefaultUserId();
    if (!userId) {
      return NextResponse.json({ message: 'No user in system' }, { status: 500 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.task.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    const data: {
      completed?: boolean;
      title?: string;
      notes?: string | null;
      priority?: TaskPriority;
    } = {};
    if (typeof body.completed === 'boolean') data.completed = body.completed;
    if (typeof body.title === 'string') data.title = body.title.trim();
    if (body.notes === null || typeof body.notes === 'string') data.notes = body.notes?.trim() || null;
    if (['NORMAL', 'HIGH', 'URGENT'].includes(body.priority)) data.priority = body.priority as TaskPriority;

    const task = await prisma.task.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      id: task.id,
      title: task.title,
      notes: task.notes,
      dueDate: task.dueDate.toISOString(),
      priority: task.priority,
      completed: task.completed,
      createdAt: task.createdAt.toISOString(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getDefaultUserId();
    if (!userId) {
      return NextResponse.json({ message: 'No user in system' }, { status: 500 });
    }

    const { id } = await params;
    const existing = await prisma.task.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    await prisma.task.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: 'Failed to delete task' }, { status: 500 });
  }
}
