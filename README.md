# Task Manager API - gRPC Implementation

A high-performance task management API built with gRPC, Protocol Buffers, and Node.js featuring real-time streaming, JWT authentication, and comprehensive performance benchmarks comparing gRPC vs REST architectures.

## 🚀 Features

- **High-Performance gRPC API** - Protocol Buffer serialization for efficient communication
- **Real-time Streaming** - Live task updates via gRPC streaming
- **JWT Authentication** - Secure authentication with access and refresh tokens
- **CRUD Operations** - Complete task management functionality
- **Performance Benchmarks** - Built-in benchmarking comparing gRPC vs REST
- **TypeScript Support** - Fully typed implementation
- **Comprehensive Testing** - Unit tests with Jest
- **Production Ready** - Structured logging, error handling, and graceful shutdown

## 📋 API Overview

### Services

#### TaskService
- `CreateTask` - Create a new task
- `GetTask` - Retrieve a task by ID
- `UpdateTask` - Update an existing task
- `DeleteTask` - Delete a task
- `ListTasks` - List tasks with pagination and filtering
- `SubscribeTaskUpdates` - Real-time task updates via streaming

#### AuthService
- `Login` - Authenticate user and get tokens
- `RefreshToken` - Refresh access token
- `CreateUser` - Register a new user

## 🛠 Installation

```bash
# Clone the repository
git clone <repository-url>
cd task-manager-api-grpc

# Install dependencies
npm install

# Build the project
npm run build
```

## 🏃‍♂️ Running the Application

### Start the gRPC Server
```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

The gRPC server will start on port `50051` by default.

### Run the Demo Client
```bash
npx ts-node src/client/grpcClient.ts
```

### Run Performance Benchmarks
```bash
npm run benchmark
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📝 Usage Examples

### Client Authentication

```typescript
import { GrpcClient } from './src/client/grpcClient';

const client = new GrpcClient('localhost:50051');

// Login
await client.login('admin', 'password');

// Create a new user
await client.createUser({
  username: 'newuser',
  password: 'password123',
  email: 'user@example.com',
  full_name: 'New User'
});
```

### Task Management

```typescript
// Create a task
const task = await client.createTask({
  title: 'Complete project documentation',
  description: 'Write comprehensive API documentation',
  priority: TaskPriority.HIGH,
  assignee_id: 'user-id',
  due_date: new Date('2024-12-31'),
  tags: ['documentation', 'api']
});

// Get a task
const retrievedTask = await client.getTask(task.id);

// Update a task
const updatedTask = await client.updateTask({
  id: task.id,
  status: TaskStatus.IN_PROGRESS,
  description: 'Updated description'
});

// List tasks with filtering
const taskList = await client.listTasks(1, 10);
```

### Real-time Streaming

```typescript
// Subscribe to task updates
const stream = client.subscribeToTaskUpdates('user-id');

stream.on('data', (update) => {
  console.log('Task update:', update.type, update.task.title);
});

stream.on('error', (error) => {
  console.error('Stream error:', error);
});
```

## 🏗 Protocol Buffers Schema

The API uses Protocol Buffers for efficient serialization. Key message types:

### Task
```protobuf
message Task {
  string id = 1;
  string title = 2;
  string description = 3;
  TaskStatus status = 4;
  TaskPriority priority = 5;
  string assignee_id = 6;
  google.protobuf.Timestamp created_at = 7;
  google.protobuf.Timestamp updated_at = 8;
  google.protobuf.Timestamp due_date = 9;
  repeated string tags = 10;
}
```

### TaskStatus Enum
```protobuf
enum TaskStatus {
  PENDING = 0;
  IN_PROGRESS = 1;
  COMPLETED = 2;
  CANCELLED = 3;
}
```

### TaskPriority Enum
```protobuf
enum TaskPriority {
  LOW = 0;
  MEDIUM = 1;
  HIGH = 2;
  URGENT = 3;
}
```

## 🔐 Authentication

The API uses JWT tokens for authentication:

1. **Login** - Provides access token and refresh token
2. **Access Token** - Short-lived (1 hour) for API requests
3. **Refresh Token** - Long-lived (7 days) for token renewal

### gRPC Metadata Authentication

Include the access token in gRPC metadata:

```typescript
const metadata = new grpc.Metadata();
metadata.add('authorization', `Bearer ${accessToken}`);
```

## 📊 Performance Benchmarks

The included benchmark suite compares gRPC vs REST performance:

### Benchmark Results

Performance tests typically show:

- **Task Creation**: gRPC ~2-3x faster than REST
- **Task Retrieval**: gRPC ~1.5-2x faster than REST
- **Lower Latency**: gRPC consistently shows lower response times
- **Better Throughput**: Higher requests/second with gRPC

Run benchmarks with:
```bash
npm run benchmark
```

## 🏗 Architecture

```
src/
├── server.ts              # Main gRPC server
├── types/                 # TypeScript type definitions
├── services/              # gRPC service implementations
│   ├── taskService.ts     # Task management service
│   └── authService.ts     # Authentication service
├── middleware/            # Authentication middleware
├── utils/                 # Utilities (logger, data store)
├── client/                # gRPC client implementation
├── benchmark/             # Performance benchmark suite
└── __tests__/             # Test suites
```

## 🔧 Configuration

Environment variables:

```bash
# JWT Configuration
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Logging
LOG_LEVEL=info
NODE_ENV=production
```

## 🤝 Sample Data

The application includes sample data for testing:

- **Users**: `admin` and `user1` (password: `password`)
- **Sample Tasks**: Pre-created tasks with different statuses and priorities

## 🎯 Production Considerations

For production deployment:

1. **Security**: Change default JWT secrets
2. **Database**: Replace in-memory store with persistent database
3. **Monitoring**: Add metrics and health checks
4. **Scaling**: Consider gRPC load balancing
5. **SSL/TLS**: Use secure gRPC credentials
6. **Rate Limiting**: Implement request rate limiting

## 📈 Performance Optimization

- **Protocol Buffers**: Binary serialization reduces payload size
- **Connection Reuse**: gRPC's HTTP/2 multiplexing
- **Streaming**: Real-time updates without polling
- **Compression**: Built-in gRPC compression support

## 🤔 Why gRPC?

### Advantages over REST/JSON:

1. **Performance**: Binary serialization is faster than JSON
2. **Type Safety**: Strong typing with Protocol Buffers
3. **Streaming**: Bi-directional streaming support
4. **Code Generation**: Auto-generated client/server code
5. **Versioning**: Built-in API versioning support
6. **Compression**: Efficient data compression

### Trade-offs:

1. **Browser Support**: Limited direct browser support
2. **Debugging**: Binary format harder to debug
3. **Learning Curve**: More complex than REST
4. **Tooling**: Fewer tools compared to REST

## 📚 Additional Resources

- [gRPC Documentation](https://grpc.io/docs/)
- [Protocol Buffers Guide](https://developers.google.com/protocol-buffers)
- [Node.js gRPC Tutorial](https://grpc.io/docs/languages/node/)

## 📄 License

MIT License - see LICENSE file for details.