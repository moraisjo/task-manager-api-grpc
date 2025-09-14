// Generated TypeScript interfaces from task_manager.proto

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string;
  created_at: Date;
  updated_at: Date;
  due_date?: Date;
  tags: string[];
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  priority: TaskPriority;
  assignee_id: string;
  due_date?: Date;
  tags: string[];
}

export interface GetTaskRequest {
  id: string;
}

export interface UpdateTaskRequest {
  id: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string;
  due_date?: Date;
  tags?: string[];
}

export interface DeleteTaskRequest {
  id: string;
}

export interface ListTasksRequest {
  page: number;
  page_size: number;
  status_filter?: TaskStatus;
  priority_filter?: TaskPriority;
  assignee_filter?: string;
}

export interface ListTasksResponse {
  tasks: Task[];
  total_count: number;
  page: number;
  page_size: number;
}

export enum UpdateType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED'
}

export interface TaskUpdate {
  type: UpdateType;
  task: Task;
  timestamp: Date;
}

export interface SubscribeTaskUpdatesRequest {
  user_id: string;
  task_ids?: string[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  created_at: Date;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  email: string;
  full_name: string;
}

// JWT Payload interface
export interface JWTPayload {
  user_id: string;
  username: string;
  iat: number;
  exp: number;
}