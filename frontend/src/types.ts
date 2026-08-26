export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'READONLY';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface WorkflowStatus {
  id: string;
  workflowId: string;
  name: string;
  order: number;
  color: string;
  isTerminal: boolean;
  isSuccess: boolean;
}

export interface Workflow {
  id: string;
  key: string;
  name: string;
  description?: string;
  statuses: WorkflowStatus[];
  _count?: { items: number };
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Comment {
  id: string;
  body: string;
  aiGenerated: boolean;
  createdAt: string;
  author: { id: string; name: string };
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ActivityEntry {
  id: string;
  action: string;
  fromValue?: string | null;
  toValue?: string | null;
  createdAt: string;
  actor?: { id: string; name: string } | null;
}

export interface Item {
  id: string;
  workflowId: string;
  statusId: string;
  status: WorkflowStatus;
  workflow?: Workflow;
  title: string;
  description?: string;
  priority: Priority;
  assigneeId?: string | null;
  assignee?: { id: string; name: string; email: string } | null;
  dueDate?: string | null;
  customFields: Record<string, unknown>;
  riskScore: number;
  aiSummary?: string | null;
  aiNextAction?: string | null;
  labels?: { label: Label }[];
  comments?: Comment[];
  attachments?: Attachment[];
  activities?: ActivityEntry[];
  createdAt: string;
  updatedAt: string;
  _count?: { comments: number; attachments: number };
}

export interface DashboardData {
  cards: {
    total: number;
    active: number;
    blocked: number;
    completed: number;
    overdue: number;
    avgRiskScore: number;
  };
  statusDistribution: { status: string; workflow: string; count: number; color: string }[];
  completionTrend: { date: string; count: number }[];
  cycleTimes: { workflow: string; avgDays: number }[];
  assigneePerformance: { name: string; count: number }[];
  bottlenecks: { status: string; workflow: string; itemCount: number }[];
}
