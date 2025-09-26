import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { 
  TaskStatus, 
  TaskPriority, 
  CreateTaskRequest,
  UpdateTaskRequest,
  LoginRequest,
  CreateUserRequest 
} from '../types';
import logger from '../utils/logger';

const PROTO_PATH = path.join(__dirname, '../../proto/task_manager.proto');

// Load proto definitions
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const taskManagerProto = grpc.loadPackageDefinition(packageDefinition) as any;

export class GrpcClient {
  private taskClient: any;
  private authClient: any;
  private accessToken: string | null = null;

  constructor(serverAddress: string = 'localhost:50051') {
    this.taskClient = new taskManagerProto.taskmanager.TaskService(
      serverAddress,
      grpc.credentials.createInsecure()
    );

    this.authClient = new taskManagerProto.taskmanager.AuthService(
      serverAddress,
      grpc.credentials.createInsecure()
    );
  }

  private getMetadata(): grpc.Metadata {
    const metadata = new grpc.Metadata();
    if (this.accessToken) {
      metadata.add('authorization', `Bearer ${this.accessToken}`);
    }
    return metadata;
  }

  // Authentication methods
  async login(username: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request: LoginRequest = { username, password };

      this.authClient.Login(request, (error: any, response: any) => {
        if (error) {
          logger.error('Login failed:', error);
          reject(error);
          return;
        }

        this.accessToken = response.access_token;
        logger.info(`Logged in successfully as ${username}`);
        resolve();
      });
    });
  }

  async createUser(userData: CreateUserRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      this.authClient.CreateUser(userData, (error: any, response: any) => {
        if (error) {
          logger.error('User creation failed:', error);
          reject(error);
          return;
        }

        logger.info(`User created successfully: ${response.username}`);
        resolve(response);
      });
    });
  }

  // Task methods
  async createTask(taskData: CreateTaskRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      this.taskClient.CreateTask(taskData, this.getMetadata(), (error: any, response: any) => {
        if (error) {
          logger.error('Task creation failed:', error);
          reject(error);
          return;
        }

        logger.info(`Task created successfully: ${response.id}`);
        resolve(response);
      });
    });
  }

  async getTask(id: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.taskClient.GetTask({ id }, this.getMetadata(), (error: any, response: any) => {
        if (error) {
          logger.error('Get task failed:', error);
          reject(error);
          return;
        }

        resolve(response);
      });
    });
  }

  async updateTask(updateData: UpdateTaskRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      this.taskClient.UpdateTask(updateData, this.getMetadata(), (error: any, response: any) => {
        if (error) {
          logger.error('Task update failed:', error);
          reject(error);
          return;
        }

        logger.info(`Task updated successfully: ${response.id}`);
        resolve(response);
      });
    });
  }

  async deleteTask(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.taskClient.DeleteTask({ id }, this.getMetadata(), (error: any, response: any) => {
        if (error) {
          logger.error('Task deletion failed:', error);
          reject(error);
          return;
        }

        logger.info(`Task deleted successfully: ${id}`);
        resolve();
      });
    });
  }

  async listTasks(page: number = 1, pageSize: number = 10): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = {
        page,
        page_size: pageSize,
      };

      this.taskClient.ListTasks(request, this.getMetadata(), (error: any, response: any) => {
        if (error) {
          logger.error('List tasks failed:', error);
          reject(error);
          return;
        }

        resolve(response);
      });
    });
  }

  // Streaming method
  subscribeToTaskUpdates(userId: string, taskIds?: string[]): grpc.ClientReadableStream<any> {
    const request = {
      user_id: userId,
      task_ids: taskIds,
    };

    const stream = this.taskClient.SubscribeTaskUpdates(request, this.getMetadata());

    stream.on('data', (update: any) => {
      logger.info('Received task update:', {
        type: update.type,
        taskId: update.task.id,
        taskTitle: update.task.title,
        timestamp: update.timestamp,
      });
    });

    stream.on('error', (error: any) => {
      logger.error('Stream error:', error);
    });

    stream.on('end', () => {
      logger.info('Stream ended');
    });

    return stream;
  }

  close(): void {
    this.taskClient.close();
    this.authClient.close();
  }
}

// Demo usage
export async function runDemo() {
  const client = new GrpcClient();

  try {
    logger.info('Starting gRPC client demo...');

    // 1. Login with existing user
    await client.login('admin', 'password');

    // 2. Create a new task
    const task = await client.createTask({
      title: 'Test gRPC Task',
      description: 'This is a test task created via gRPC',
      priority: TaskPriority.HIGH,
      assignee_id: '',
      tags: ['test', 'grpc'],
    });

    // 3. Get the task
    const retrievedTask = await client.getTask(task.id);
    logger.info('Retrieved task:', retrievedTask);

    // 4. Update the task
    const updatedTask = await client.updateTask({
      id: task.id,
      status: TaskStatus.IN_PROGRESS,
      description: 'Updated description via gRPC',
    });

    // 5. List all tasks
    const taskList = await client.listTasks();
    logger.info(`Found ${taskList.tasks.length} tasks`);

    // 6. Subscribe to task updates (for demo, we'll close after 5 seconds)
    const stream = client.subscribeToTaskUpdates('user1');
    
    setTimeout(() => {
      stream.cancel();
      logger.info('Demo completed');
      client.close();
    }, 5000);

  } catch (error) {
    logger.error('Demo failed:', error);
    client.close();
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  runDemo();
}