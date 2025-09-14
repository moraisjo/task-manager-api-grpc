#!/usr/bin/env ts-node

import { GrpcClient } from './client/grpcClient';
import { GrpcServer } from './server';
import { TaskPriority, TaskStatus } from './types';
import logger from './utils/logger';

/**
 * Demo script showcasing the Task Manager gRPC API functionality
 */
async function runDemo() {
  const server = new GrpcServer();
  const client = new GrpcClient();

  try {
    // Start server
    await server.start();
    logger.info('🚀 Demo: gRPC server started');

    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    logger.info('🔐 Demo: Authenticating...');
    await client.login('admin', 'password');
    logger.info('✅ Demo: Authenticated successfully');

    // Create tasks
    logger.info('📝 Demo: Creating tasks...');
    const task1 = await client.createTask({
      title: 'Implement gRPC API',
      description: 'Build a high-performance task management API using gRPC',
      priority: TaskPriority.HIGH,
      assignee_id: '',
      tags: ['api', 'grpc', 'backend'],
    });

    const task2 = await client.createTask({
      title: 'Write Documentation',
      description: 'Create comprehensive documentation for the API',
      priority: TaskPriority.MEDIUM,
      assignee_id: '',
      tags: ['documentation', 'api'],
    });

    logger.info(`✅ Demo: Created task "${task1.title}" (ID: ${task1.id})`);
    logger.info(`✅ Demo: Created task "${task2.title}" (ID: ${task2.id})`);

    // Update a task
    logger.info('📝 Demo: Updating task status...');
    await client.updateTask({
      id: task1.id,
      status: TaskStatus.IN_PROGRESS,
    });
    logger.info(`✅ Demo: Updated task ${task1.id} to IN_PROGRESS`);

    // List tasks
    logger.info('📋 Demo: Listing all tasks...');
    const taskList = await client.listTasks();
    logger.info(`✅ Demo: Found ${taskList.tasks.length} tasks (total: ${taskList.total_count})`);

    // Start streaming (for 3 seconds)
    logger.info('📡 Demo: Starting real-time streaming...');
    const stream = client.subscribeToTaskUpdates('demo-user');
    
    // Create another task to trigger stream update
    setTimeout(async () => {
      logger.info('📝 Demo: Creating task while streaming...');
      await client.createTask({
        title: 'Performance Testing',
        description: 'Test the performance of the gRPC API',
        priority: TaskPriority.URGENT,
        assignee_id: '',
        tags: ['testing', 'performance'],
      });
    }, 1000);

    // Stop streaming after 3 seconds
    setTimeout(() => {
      stream.cancel();
      logger.info('✅ Demo: Streaming stopped');
    }, 3000);

    // Wait for streaming demo to complete
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Complete the demo
    logger.info('🎉 Demo: All features demonstrated successfully!');
    logger.info('');
    logger.info('Features showcased:');
    logger.info('  ✅ JWT Authentication');
    logger.info('  ✅ Task Creation');
    logger.info('  ✅ Task Updates');
    logger.info('  ✅ Task Listing with Pagination');
    logger.info('  ✅ Real-time Streaming');
    logger.info('  ✅ gRPC Protocol Buffers');
    logger.info('');
    logger.info('🚀 gRPC Task Manager API Demo Complete!');

  } catch (error) {
    logger.error('❌ Demo failed:', error);
  } finally {
    client.close();
    await server.stop();
    logger.info('🛑 Demo: Server stopped');
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}

export { runDemo };