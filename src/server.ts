import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { TaskServiceImpl } from './services/taskService';
import { AuthServiceImpl } from './services/authService';
import { dataStore } from './utils/dataStore';
import logger from './utils/logger';

const PROTO_PATH = path.join(__dirname, '../proto/task_manager.proto');

// Load proto definitions
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const taskManagerProto = grpc.loadPackageDefinition(packageDefinition) as any;

export class GrpcServer {
  private server: grpc.Server;
  private port: number;

  constructor(port: number = 50051) {
    this.server = new grpc.Server();
    this.port = port;
    this.setupServices();
  }

  private setupServices() {
    // Add TaskService
    this.server.addService(taskManagerProto.taskmanager.TaskService.service, {
      CreateTask: TaskServiceImpl.CreateTask,
      GetTask: TaskServiceImpl.GetTask,
      UpdateTask: TaskServiceImpl.UpdateTask,
      DeleteTask: TaskServiceImpl.DeleteTask,
      ListTasks: TaskServiceImpl.ListTasks,
      SubscribeTaskUpdates: TaskServiceImpl.SubscribeTaskUpdates,
    });

    // Add AuthService
    this.server.addService(taskManagerProto.taskmanager.AuthService.service, {
      Login: AuthServiceImpl.Login,
      RefreshToken: AuthServiceImpl.RefreshToken,
      CreateUser: AuthServiceImpl.CreateUser,
    });

    logger.info('gRPC services registered successfully');
  }

  public async start(): Promise<void> {
    // Wait for data store to be initialized
    await dataStore.init();
    
    return new Promise((resolve, reject) => {
      this.server.bindAsync(
        `0.0.0.0:${this.port}`,
        grpc.ServerCredentials.createInsecure(),
        (error, port) => {
          if (error) {
            logger.error('Failed to start gRPC server:', error);
            reject(error);
            return;
          }

          this.server.start();
          logger.info(`gRPC server started on port ${port}`);
          resolve();
        }
      );
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.tryShutdown((error) => {
        if (error) {
          logger.error('Error during graceful shutdown:', error);
          this.server.forceShutdown();
        }
        logger.info('gRPC server stopped');
        resolve();
      });
    });
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new GrpcServer();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  server.start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}