import { v4 as uuidv4 } from 'uuid';
import { Task, TaskStatus, TaskPriority, User } from '../types';

// In-memory data store (in production, this would be a database)
class DataStore {
  private tasks: Map<string, Task> = new Map();
  private users: Map<string, User & { password: string }> = new Map();
  private taskUpdateSubscribers: Map<string, Set<(update: any) => void>> = new Map();

  // Task operations
  createTask(data: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Task {
    const task: Task = {
      id: uuidv4(),
      ...data,
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    this.tasks.set(task.id, task);
    this.notifyTaskUpdate('CREATED', task);
    return task;
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'created_at'>>): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    const updatedTask: Task = {
      ...task,
      ...updates,
      id: task.id,
      created_at: task.created_at,
      updated_at: new Date(),
    };

    this.tasks.set(id, updatedTask);
    this.notifyTaskUpdate('UPDATED', updatedTask);
    return updatedTask;
  }

  deleteTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;

    this.tasks.delete(id);
    this.notifyTaskUpdate('DELETED', task);
    return true;
  }

  listTasks(filter: {
    page: number;
    page_size: number;
    status_filter?: TaskStatus;
    priority_filter?: TaskPriority;
    assignee_filter?: string;
  }) {
    const allTasks = Array.from(this.tasks.values());
    
    // Apply filters
    let filteredTasks = allTasks;
    
    if (filter.status_filter) {
      filteredTasks = filteredTasks.filter(task => task.status === filter.status_filter);
    }
    
    if (filter.priority_filter) {
      filteredTasks = filteredTasks.filter(task => task.priority === filter.priority_filter);
    }
    
    if (filter.assignee_filter) {
      filteredTasks = filteredTasks.filter(task => task.assignee_id === filter.assignee_filter);
    }

    // Sort by created_at descending
    filteredTasks.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    const totalCount = filteredTasks.length;
    const startIndex = (filter.page - 1) * filter.page_size;
    const endIndex = startIndex + filter.page_size;
    const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

    return {
      tasks: paginatedTasks,
      total_count: totalCount,
      page: filter.page,
      page_size: filter.page_size,
    };
  }

  // User operations
  createUser(userData: User & { password: string }): User {
    const user = {
      ...userData,
      id: uuidv4(),
      created_at: new Date(),
    };
    
    this.users.set(user.id, user);
    
    // Return user without password
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  getUserByUsername(username: string): (User & { password: string }) | undefined {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  getUserById(id: string): User | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Streaming operations
  subscribeToTaskUpdates(userId: string, callback: (update: any) => void, taskIds?: string[]) {
    const key = taskIds ? `${userId}:${taskIds.join(',')}` : userId;
    
    if (!this.taskUpdateSubscribers.has(key)) {
      this.taskUpdateSubscribers.set(key, new Set());
    }
    
    this.taskUpdateSubscribers.get(key)!.add(callback);
    
    return () => {
      const subscribers = this.taskUpdateSubscribers.get(key);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.taskUpdateSubscribers.delete(key);
        }
      }
    };
  }

  private notifyTaskUpdate(type: 'CREATED' | 'UPDATED' | 'DELETED', task: Task) {
    const update = {
      type,
      task,
      timestamp: new Date(),
    };

    // Notify all general subscribers
    for (const [key, subscribers] of this.taskUpdateSubscribers.entries()) {
      if (!key.includes(':')) {
        // General subscription
        subscribers.forEach(callback => callback(update));
      } else {
        // Task-specific subscription
        const [, taskIds] = key.split(':');
        if (taskIds && taskIds.split(',').includes(task.id)) {
          subscribers.forEach(callback => callback(update));
        }
      }
    }
  }

  // Initialize with some sample data
  async init() {
    // Create sample users with properly hashed passwords
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('password', 10);
    
    const user1 = this.createUser({
      id: '',
      username: 'admin',
      password: hashedPassword,
      email: 'admin@example.com',
      full_name: 'System Administrator',
      created_at: new Date(),
    });

    const user2 = this.createUser({
      id: '',
      username: 'user1',
      password: hashedPassword,
      email: 'user1@example.com',
      full_name: 'John Doe',
      created_at: new Date(),
    });

    // Create sample tasks
    this.createTask({
      title: 'Setup Project Infrastructure',
      description: 'Initialize the project with basic infrastructure and CI/CD',
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assignee_id: user1.id,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      tags: ['infrastructure', 'setup'],
    });

    this.createTask({
      title: 'Implement User Authentication',
      description: 'Add JWT-based authentication system',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assignee_id: user2.id,
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      tags: ['authentication', 'security'],
    });

    this.createTask({
      title: 'Add Task Management Features',
      description: 'Implement CRUD operations for task management',
      status: TaskStatus.PENDING,
      priority: TaskPriority.MEDIUM,
      assignee_id: user2.id,
      due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      tags: ['features', 'tasks'],
    });
  }
}

export const dataStore = new DataStore();

// Initialize with sample data
(async () => {
  await dataStore.init();
})();