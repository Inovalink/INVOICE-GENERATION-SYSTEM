import TasksCalendar from './TasksCalendar';
import { requireCurrentContext } from '@/lib/auth/tenantScope';


export default async function TasksPage() {
  await requireCurrentContext();
  return <TasksCalendar />;
}
