import { ServerUnaryCall, ServerWritableStream, sendUnaryData, status, Metadata } from '@grpc/grpc-js';
import { 
  Task, 
  CreateTaskRequest, 
  GetTaskRequest, 
  UpdateTaskRequest, 
  DeleteTaskRequest,
  ListTasksRequest,
  ListTasksResponse,
  SubscribeTaskUpdatesRequest,
  TaskUpdate,
  TaskStatus,
  TaskPriority
} from '../types';
import { dataStore } from '../utils/dataStore';
import { authenticateCall } from '../middleware/auth';
import logger from '../utils/logger';

export class TaskServiceImpl {
  static CreateTask(call: ServerUnaryCall<CreateTaskRequest, Task>, callback: sendUnaryData<Task>) {
    try {
      // Authenticate the request
      const user = authenticateCall(call);
      if (!user) {
        const error = {
          code: status.UNAUTHENTICATED,
          message: 'Authentication required',
        };
        return callback(error);
      }

      const request = call.request;
      
      // Validate required fields
      if (!request.title || !request.description) {
        const error = {
          code: status.INVALID_ARGUMENT,
          message: 'Title and description are required',
        };
        return callback(error);
      }

      // Create the task
      const task = dataStore.createTask({
        title: request.title,
        description: request.description,
        status: TaskStatus.PENDING,
        priority: request.priority || TaskPriority.MEDIUM,
        assignee_id: request.assignee_id || user.user_id,
        due_date: request.due_date,
        tags: request.tags || [],
      });

      logger.info(`Task created: ${task.id} by user: ${user.username}`);
      callback(null, task);
    } catch (error) {
      logger.error('CreateTask error:', error);
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
      });
    }
  }

  static GetTask(call: ServerUnaryCall<GetTaskRequest, Task>, callback: sendUnaryData<Task>) {
    try {
      // Authenticate the request
      const user = authenticateCall(call);
      if (!user) {
        const error = {
          code: status.UNAUTHENTICATED,
          message: 'Authentication required',
        };
        return callback(error);
      }

      const request = call.request;
      const task = dataStore.getTask(request.id);

      if (!task) {
        const error = {
          code: status.NOT_FOUND,
          message: 'Task not found',
        };
        return callback(error);
      }

      logger.info(`Task retrieved: ${task.id} by user: ${user.username}`);
      callback(null, task);
    } catch (error) {
      logger.error('GetTask error:', error);
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
      });
    }
  }

  static UpdateTask(call: ServerUnaryCall<UpdateTaskRequest, Task>, callback: sendUnaryData<Task>) {
    try {
      // Authenticate the request
      const user = authenticateCall(call);
      if (!user) {
        const error = {
          code: status.UNAUTHENTICATED,
          message: 'Authentication required',
        };
        return callback(error);
      }

      const request = call.request;
      const existingTask = dataStore.getTask(request.id);

      if (!existingTask) {
        const error = {
          code: status.NOT_FOUND,
          message: 'Task not found',
        };
        return callback(error);
      }

      // Build update object from request
      const updates: any = {};
      if (request.title !== undefined) updates.title = request.title;
      if (request.description !== undefined) updates.description = request.description;
      if (request.status !== undefined) updates.status = request.status;
      if (request.priority !== undefined) updates.priority = request.priority;
      if (request.assignee_id !== undefined) updates.assignee_id = request.assignee_id;
      if (request.due_date !== undefined) updates.due_date = request.due_date;
      if (request.tags !== undefined) updates.tags = request.tags;

      const updatedTask = dataStore.updateTask(request.id, updates);
      if (!updatedTask) {
        const error = {
          code: status.INTERNAL,
          message: 'Failed to update task',
        };
        return callback(error);
      }

      logger.info(`Task updated: ${updatedTask.id} by user: ${user.username}`);
      callback(null, updatedTask);
    } catch (error) {
      logger.error('UpdateTask error:', error);
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
      });
    }
  }

  static DeleteTask(call: ServerUnaryCall<DeleteTaskRequest, {}>, callback: sendUnaryData<{}>) {
    try {
      // Authenticate the request
      const user = authenticateCall(call);
      if (!user) {
        const error = {
          code: status.UNAUTHENTICATED,
          message: 'Authentication required',
        };
        return callback(error);
      }

      const request = call.request;
      const deleted = dataStore.deleteTask(request.id);

      if (!deleted) {
        const error = {
          code: status.NOT_FOUND,
          message: 'Task not found',
        };
        return callback(error);
      }

      logger.info(`Task deleted: ${request.id} by user: ${user.username}`);
      callback(null, {});
    } catch (error) {
      logger.error('DeleteTask error:', error);
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
      });
    }
  }

  static ListTasks(call: ServerUnaryCall<ListTasksRequest, ListTasksResponse>, callback: sendUnaryData<ListTasksResponse>) {
    try {
      // Authenticate the request
      const user = authenticateCall(call);
      if (!user) {
        const error = {
          code: status.UNAUTHENTICATED,
          message: 'Authentication required',
        };
        return callback(error);
      }

      const request = call.request;
      
      // Set defaults
      const page = request.page || 1;
      const pageSize = Math.min(request.page_size || 10, 100); // Limit to 100 items per page

      const result = dataStore.listTasks({
        page,
        page_size: pageSize,
        status_filter: request.status_filter,
        priority_filter: request.priority_filter,
        assignee_filter: request.assignee_filter,
      });

      logger.info(`Tasks listed: ${result.tasks.length} tasks on page ${page} by user: ${user.username}`);
      callback(null, result);
    } catch (error) {
      logger.error('ListTasks error:', error);
      callback({
        code: status.INTERNAL,
        message: 'Internal server error',
      });
    }
  }

  static SubscribeTaskUpdates(call: ServerWritableStream<SubscribeTaskUpdatesRequest, TaskUpdate>) {
    try {
      // Authenticate the request
      const user = authenticateCall(call);
      if (!user) {
        call.emit('error', {
          code: status.UNAUTHENTICATED,
          message: 'Authentication required',
        });
        return;
      }

      const request = call.request;
      logger.info(`User ${user.username} subscribed to task updates`);

      // Subscribe to task updates
      const unsubscribe = dataStore.subscribeToTaskUpdates(
        user.user_id,
        (update: TaskUpdate) => {
          try {
            call.write(update);
          } catch (error) {
            logger.error('Error writing to stream:', error);
          }
        },
        request.task_ids
      );

      // Handle client disconnect
      call.on('cancelled', () => {
        logger.info(`User ${user.username} unsubscribed from task updates`);
        unsubscribe();
      });

      call.on('error', (error) => {
        logger.error('Stream error:', error);
        unsubscribe();
      });

      // Send initial connection confirmation
      call.write({
        type: 'CREATED' as any,
        task: {
          id: 'connection',
          title: 'Streaming connection established',
          description: 'You are now subscribed to task updates',
          status: TaskStatus.COMPLETED,
          priority: TaskPriority.LOW,
          assignee_id: user.user_id,
          created_at: new Date(),
          updated_at: new Date(),
          tags: ['system'],
        },
        timestamp: new Date(),
      });

    } catch (error) {
      logger.error('SubscribeTaskUpdates error:', error);
      call.emit('error', {
        code: status.INTERNAL,
        message: 'Internal server error',
      });
    }
  }
}