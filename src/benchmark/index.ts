import autocannon from 'autocannon';
import { GrpcClient } from '../client/grpcClient';
import { GrpcServer } from '../server';
import { TaskPriority } from '../types';
import logger from '../utils/logger';
import express from 'express';
import { dataStore } from '../utils/dataStore';
import { AuthService } from '../middleware/auth';

// REST API Server for comparison
class RestServer {
  private app: express.Application;
  private server: any;
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    
    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      next();
    });

    // Auth middleware
    this.app.use('/api/tasks', (req, res, next): void => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({ error: 'Authorization header required' });
        return;
      }

      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
      const user = AuthService.verifyToken(token);
      
      if (!user) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      (req as any).user = user;
      next();
    });
  }

  private setupRoutes() {
    // Auth routes
    this.app.post('/api/auth/login', async (req, res): Promise<void> => {
      try {
        const { username, password } = req.body;
        const loginResponse = await AuthService.login({ username, password });
        
        if (!loginResponse) {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }

        res.json(loginResponse);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Task routes
    this.app.post('/api/tasks', (req, res) => {
      try {
        const user = (req as any).user;
        const { title, description, priority, assignee_id, due_date, tags } = req.body;

        const task = dataStore.createTask({
          title,
          description,
          status: 'PENDING' as any,
          priority: priority || TaskPriority.MEDIUM,
          assignee_id: assignee_id || user.user_id,
          due_date: due_date ? new Date(due_date) : undefined,
          tags: tags || [],
        });

        res.status(201).json(task);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/tasks/:id', (req, res): void => {
      try {
        const task = dataStore.getTask(req.params.id);
        if (!task) {
          res.status(404).json({ error: 'Task not found' });
          return;
        }
        res.json(task);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.put('/api/tasks/:id', (req, res): void => {
      try {
        const updates = req.body;
        const updatedTask = dataStore.updateTask(req.params.id, updates);
        
        if (!updatedTask) {
          res.status(404).json({ error: 'Task not found' });
          return;
        }
        
        res.json(updatedTask);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.delete('/api/tasks/:id', (req, res): void => {
      try {
        const deleted = dataStore.deleteTask(req.params.id);
        if (!deleted) {
          res.status(404).json({ error: 'Task not found' });
          return;
        }
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    this.app.get('/api/tasks', (req, res) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.page_size as string) || 10;
        
        const result = dataStore.listTasks({
          page,
          page_size: pageSize,
        });
        
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(`REST server started on port ${this.port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('REST server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export class PerformanceBenchmark {
  private grpcServer: GrpcServer;
  private restServer: RestServer;
  private grpcClient: GrpcClient;

  constructor() {
    this.grpcServer = new GrpcServer(50051);
    this.restServer = new RestServer(3000);
    this.grpcClient = new GrpcClient();
  }

  async setup() {
    // Start servers
    await this.grpcServer.start();
    await this.restServer.start();
    
    // Login to get token
    await this.grpcClient.login('admin', 'password');
    
    logger.info('Benchmark setup completed');
  }

  async cleanup() {
    this.grpcClient.close();
    await this.grpcServer.stop();
    await this.restServer.stop();
    logger.info('Benchmark cleanup completed');
  }

  async benchmarkGrpcTaskCreation(): Promise<any> {
    logger.info('Starting gRPC task creation benchmark...');
    
    let taskCount = 0;
    const startTime = Date.now();
    
    // Create 1000 tasks
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(
        this.grpcClient.createTask({
          title: `Benchmark Task ${i}`,
          description: `Task created for performance testing #${i}`,
          priority: TaskPriority.MEDIUM,
          assignee_id: '',
          tags: ['benchmark', 'performance'],
        }).then(() => {
          taskCount++;
        }).catch((error) => {
          logger.error(`Task creation failed for task ${i}:`, error);
        })
      );
    }
    
    await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return {
      protocol: 'gRPC',
      operation: 'task_creation',
      total_requests: 1000,
      successful_requests: taskCount,
      duration_ms: duration,
      requests_per_second: (taskCount / duration) * 1000,
      avg_response_time_ms: duration / taskCount,
    };
  }

  async benchmarkRestTaskCreation(): Promise<any> {
    logger.info('Starting REST task creation benchmark...');
    
    // First get auth token
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password' }),
    });
    
    const { access_token } = await loginResponse.json() as { access_token: string };
    
    const result = await autocannon({
      url: 'http://localhost:3000/api/tasks',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        title: 'Benchmark REST Task',
        description: 'Task created for REST performance testing',
        priority: 'MEDIUM',
        tags: ['benchmark', 'rest'],
      }),
      connections: 10,
      duration: 10, // 10 seconds
    });

    return {
      protocol: 'REST',
      operation: 'task_creation',
      total_requests: result.requests.total,
      successful_requests: result.requests.total - result.errors,
      duration_ms: result.duration,
      requests_per_second: result.requests.average,
      avg_response_time_ms: result.latency.average,
      throughput: result.throughput,
    };
  }

  async benchmarkGrpcTaskRetrieval(): Promise<any> {
    logger.info('Starting gRPC task retrieval benchmark...');
    
    // First create a task to retrieve
    const task = await this.grpcClient.createTask({
      title: 'Retrieval Benchmark Task',
      description: 'Task for retrieval performance testing',
      priority: TaskPriority.MEDIUM,
      assignee_id: '',
      tags: ['benchmark'],
    });

    let retrievalCount = 0;
    const startTime = Date.now();
    
    // Retrieve the task 1000 times
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(
        this.grpcClient.getTask(task.id).then(() => {
          retrievalCount++;
        }).catch((error) => {
          logger.error(`Task retrieval failed for iteration ${i}:`, error);
        })
      );
    }
    
    await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return {
      protocol: 'gRPC',
      operation: 'task_retrieval',
      total_requests: 1000,
      successful_requests: retrievalCount,
      duration_ms: duration,
      requests_per_second: (retrievalCount / duration) * 1000,
      avg_response_time_ms: duration / retrievalCount,
    };
  }

  async benchmarkRestTaskRetrieval(): Promise<any> {
    logger.info('Starting REST task retrieval benchmark...');
    
    // Get auth token and create a task
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password' }),
    });
    
    const { access_token } = await loginResponse.json() as { access_token: string };
    
    const createResponse = await fetch('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        title: 'REST Retrieval Benchmark Task',
        description: 'Task for REST retrieval performance testing',
        priority: 'MEDIUM',
        tags: ['benchmark'],
      }),
    });
    
    const task = await createResponse.json() as { id: string };

    const result = await autocannon({
      url: `http://localhost:3000/api/tasks/${task.id}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
      connections: 10,
      duration: 10, // 10 seconds
    });

    return {
      protocol: 'REST',
      operation: 'task_retrieval',
      total_requests: result.requests.total,
      successful_requests: result.requests.total - result.errors,
      duration_ms: result.duration,
      requests_per_second: result.requests.average,
      avg_response_time_ms: result.latency.average,
      throughput: result.throughput,
    };
  }

  async runFullBenchmark(): Promise<void> {
    try {
      await this.setup();
      
      logger.info('Running performance benchmarks...');
      
      const results = [];
      
      // gRPC benchmarks
      results.push(await this.benchmarkGrpcTaskCreation());
      results.push(await this.benchmarkGrpcTaskRetrieval());
      
      // REST benchmarks
      results.push(await this.benchmarkRestTaskCreation());
      results.push(await this.benchmarkRestTaskRetrieval());
      
      // Display results
      logger.info('\n=== PERFORMANCE BENCHMARK RESULTS ===');
      results.forEach(result => {
        logger.info(`\n${result.protocol} - ${result.operation}:`);
        logger.info(`  Total Requests: ${result.total_requests}`);
        logger.info(`  Successful Requests: ${result.successful_requests}`);
        logger.info(`  Duration: ${result.duration_ms}ms`);
        logger.info(`  Requests/sec: ${result.requests_per_second.toFixed(2)}`);
        logger.info(`  Avg Response Time: ${result.avg_response_time_ms.toFixed(2)}ms`);
        if (result.throughput) {
          logger.info(`  Throughput: ${result.throughput.average.toFixed(2)} bytes/sec`);
        }
      });
      
      // Compare results
      const grpcCreation = results.find(r => r.protocol === 'gRPC' && r.operation === 'task_creation');
      const restCreation = results.find(r => r.protocol === 'REST' && r.operation === 'task_creation');
      const grpcRetrieval = results.find(r => r.protocol === 'gRPC' && r.operation === 'task_retrieval');
      const restRetrieval = results.find(r => r.protocol === 'REST' && r.operation === 'task_retrieval');
      
      logger.info('\n=== COMPARISON ===');
      if (grpcCreation && restCreation) {
        const speedup = grpcCreation.requests_per_second / restCreation.requests_per_second;
        logger.info(`Task Creation - gRPC is ${speedup.toFixed(2)}x ${speedup > 1 ? 'faster' : 'slower'} than REST`);
      }
      
      if (grpcRetrieval && restRetrieval) {
        const speedup = grpcRetrieval.requests_per_second / restRetrieval.requests_per_second;
        logger.info(`Task Retrieval - gRPC is ${speedup.toFixed(2)}x ${speedup > 1 ? 'faster' : 'slower'} than REST`);
      }
      
    } catch (error) {
      logger.error('Benchmark failed:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run benchmark if this file is executed directly
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.runFullBenchmark();
}