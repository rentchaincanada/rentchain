import {
  generateLeaseAutomationTasks,
  LeaseAutomationTask,
} from "./leaseTaskScheduler";

const tasksByLeaseId = new Map<string, LeaseAutomationTask[]>();

export function regenerateLeaseAutomationTasks(lease: {
  id: string;
  startDate?: string | null;
  endDate?: string | null;
  automationEnabled?: boolean;
  renewalStatus?: "unknown" | "offered" | "accepted" | "declined" | string;
}): LeaseAutomationTask[] {
  const tasks = generateLeaseAutomationTasks(lease);
  tasksByLeaseId.set(lease.id, tasks);
  return tasks;
}

export function getLeaseAutomationTasks(leaseId: string): LeaseAutomationTask[] {
  return tasksByLeaseId.get(String(leaseId || "").trim()) || [];
}

export function clearLeaseAutomationTasks(): void {
  tasksByLeaseId.clear();
}
