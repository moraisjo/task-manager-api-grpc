import { dataStore } from '../utils/dataStore';
import { TaskStatus, TaskPriority } from '../types';

describe('DataStore', () => {
  beforeEach(() => {
    // Reset data store
    dataStore.init();
  });

  describe('Task operations', () => {
    it('should create a task', () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        assignee_id: 'user1',
        tags: ['test'],
      };

      const task = dataStore.createTask(taskData);

      expect(task.id).toBeDefined();
      expect(task.title).toBe(taskData.title);
      expect(task.description).toBe(taskData.description);
      expect(task.status).toBe(taskData.status);
      expect(task.priority).toBe(taskData.priority);
      expect(task.assignee_id).toBe(taskData.assignee_id);
      expect(task.tags).toEqual(taskData.tags);
      expect(task.created_at).toBeInstanceOf(Date);
      expect(task.updated_at).toBeInstanceOf(Date);
    });

    it('should get a task by id', () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        assignee_id: 'user1',
        tags: ['test'],
      };

      const createdTask = dataStore.createTask(taskData);
      const retrievedTask = dataStore.getTask(createdTask.id);

      expect(retrievedTask).toBeDefined();
      expect(retrievedTask!.id).toBe(createdTask.id);
      expect(retrievedTask!.title).toBe(taskData.title);
    });

    it('should return undefined for non-existent task', () => {
      const task = dataStore.getTask('non-existent-id');
      expect(task).toBeUndefined();
    });

    it('should update a task', async () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        assignee_id: 'user1',
        tags: ['test'],
      };

      const createdTask = dataStore.createTask(taskData);
      
      // Wait a little to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updates = {
        title: 'Updated Title',
        status: TaskStatus.IN_PROGRESS,
      };

      const updatedTask = dataStore.updateTask(createdTask.id, updates);

      expect(updatedTask).toBeDefined();
      expect(updatedTask!.title).toBe(updates.title);
      expect(updatedTask!.status).toBe(updates.status);
      expect(updatedTask!.description).toBe(taskData.description); // Unchanged
      expect(updatedTask!.updated_at.getTime()).toBeGreaterThanOrEqual(createdTask.updated_at.getTime());
    });

    it('should delete a task', () => {
      const taskData = {
        title: 'Test Task',
        description: 'Test Description',
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        assignee_id: 'user1',
        tags: ['test'],
      };

      const createdTask = dataStore.createTask(taskData);
      const deleted = dataStore.deleteTask(createdTask.id);

      expect(deleted).toBe(true);
      
      const retrievedTask = dataStore.getTask(createdTask.id);
      expect(retrievedTask).toBeUndefined();
    });

    it('should return false when deleting non-existent task', () => {
      const deleted = dataStore.deleteTask('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('should list tasks with pagination', () => {
      // Create multiple tasks
      for (let i = 0; i < 15; i++) {
        dataStore.createTask({
          title: `Task ${i}`,
          description: `Description ${i}`,
          status: TaskStatus.PENDING,
          priority: TaskPriority.MEDIUM,
          assignee_id: 'user1',
          tags: ['test'],
        });
      }

      const result = dataStore.listTasks({
        page: 1,
        page_size: 10,
      });

      expect(result.tasks.length).toBe(10);
      expect(result.total_count).toBeGreaterThanOrEqual(15); // Including sample data
      expect(result.page).toBe(1);
      expect(result.page_size).toBe(10);
    });

    it('should filter tasks by status', () => {
      dataStore.createTask({
        title: 'Pending Task',
        description: 'Description',
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        assignee_id: 'user1',
        tags: [],
      });

      dataStore.createTask({
        title: 'Completed Task',
        description: 'Description',
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.MEDIUM,
        assignee_id: 'user1',
        tags: [],
      });

      const result = dataStore.listTasks({
        page: 1,
        page_size: 10,
        status_filter: TaskStatus.PENDING,
      });

      expect(result.tasks.length).toBeGreaterThan(0);
      result.tasks.forEach(task => {
        expect(task.status).toBe(TaskStatus.PENDING);
      });
    });
  });

  describe('User operations', () => {
    it('should create a user', () => {
      const userData = {
        id: '',
        username: 'testuser',
        password: 'hashedpassword',
        email: 'test@example.com',
        full_name: 'Test User',
        created_at: new Date(),
      };

      const user = dataStore.createUser(userData);

      expect(user.id).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.full_name).toBe(userData.full_name);
      expect((user as any).password).toBeUndefined(); // Password should not be returned
    });

    it('should get user by username', () => {
      const user = dataStore.getUserByUsername('admin');
      
      expect(user).toBeDefined();
      expect(user!.username).toBe('admin');
      expect(user!.password).toBeDefined(); // Password should be included for authentication
    });

    it('should get user by id', () => {
      const userByUsername = dataStore.getUserByUsername('admin');
      expect(userByUsername).toBeDefined();
      
      const userById = dataStore.getUserById(userByUsername!.id);
      
      expect(userById).toBeDefined();
      expect(userById!.id).toBe(userByUsername!.id);
      expect(userById!.username).toBe('admin');
      expect((userById as any).password).toBeUndefined(); // Password should not be returned
    });
  });

  describe('Task update subscriptions', () => {
    it('should subscribe to task updates', (done) => {
      let updateReceived = false;
      
      const unsubscribe = dataStore.subscribeToTaskUpdates('user1', (update) => {
        if (update.type === 'CREATED' && update.task.title === 'Subscription Test') {
          updateReceived = true;
          unsubscribe();
          expect(updateReceived).toBe(true);
          done();
        }
      });

      // Create a task to trigger the update
      dataStore.createTask({
        title: 'Subscription Test',
        description: 'Test subscription',
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        assignee_id: 'user1',
        tags: [],
      });
    });

    it('should unsubscribe from task updates', () => {
      let updateCount = 0;
      
      const unsubscribe = dataStore.subscribeToTaskUpdates('user1', () => {
        updateCount++;
      });

      // Create a task
      dataStore.createTask({
        title: 'Test 1',
        description: 'Test',
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        assignee_id: 'user1',
        tags: [],
      });

      expect(updateCount).toBe(1);

      // Unsubscribe
      unsubscribe();

      // Create another task
      dataStore.createTask({
        title: 'Test 2',
        description: 'Test',
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        assignee_id: 'user1',
        tags: [],
      });

      // Update count should remain 1
      expect(updateCount).toBe(1);
    });
  });
});