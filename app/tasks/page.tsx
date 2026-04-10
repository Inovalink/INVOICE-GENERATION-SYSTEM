import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getDefaultUserId } from '@/lib/auth/getCurrentUser';
import '../dashboard.css';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const userId = await getDefaultUserId();
  if (!userId) {
    return (
      <div className="content-card">
        <p>Sign in to view tasks.</p>
        <Link href="/login">Sign in</Link>
      </div>
    );
  }

  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { dueDate: 'asc' },
    take: 100,
  });

  return (
    <div className="content-card">
      <div className="content-card-header">
        <h1>Tasks</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Your upcoming work items</p>
      </div>
      {tasks.length === 0 ? (
        <p>No tasks yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0' }}>
          {tasks.map((t) => (
            <li
              key={t.id}
              style={{
                padding: '0.65rem 0',
                borderBottom: '1px solid var(--border-color)',
                opacity: t.completed ? 0.55 : 1,
              }}
            >
              <strong>{t.title}</strong>
              <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Due {t.dueDate.toLocaleDateString('en-GB')} · {t.priority}
                {t.completed ? ' · Done' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
