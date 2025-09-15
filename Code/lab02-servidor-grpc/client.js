const grpc = require('@grpc/grpc-js');
const ProtoLoader = require('./utils/protoLoader');

/**
 * Cliente gRPC configurado para NGINX load balancing
 */

class GrpcClient {
    constructor(taskServerAddress = 'localhost:5000', authServerAddress = 'localhost:50051') {
        this.taskServerAddress = taskServerAddress; // NGINX
        this.authServerAddress = authServerAddress; // Backend direto ou outro proxy
        this.protoLoader = new ProtoLoader();
        this.authClient = null;
        this.taskClient = null;
        this.currentToken = null;
    }

    async initialize() {
        try {
            // Carregar protobuf
            const authProto = this.protoLoader.loadProto('auth_service.proto', 'auth');
            const taskProto = this.protoLoader.loadProto('task_service.proto', 'tasks');

            const credentials = grpc.credentials.createInsecure();

            this.authClient = new authProto.AuthService(this.authServerAddress, credentials);
            this.taskClient = new taskProto.TaskService(this.taskServerAddress, credentials);

            console.log(`✅ Cliente gRPC inicializado`);
            console.log(`🔹 AuthService: ${this.authServerAddress}`);
            console.log(`🔹 TaskService (via NGINX): ${this.taskServerAddress}`);
        } catch (error) {
            console.error('❌ Erro na inicialização do cliente:', error);
            throw error;
        }
    }

    promisify(client, method) {
        return (request) => {
            return new Promise((resolve, reject) => {
                client[method](request, (error, response) => {
                    if (error) reject(error);
                    else {
                        console.log(`✅ [${method}] resposta recebida do servidor gRPC`);
                        resolve(response);
                    }
                });
            });
        };
    }

    async register(userData) {
        const registerPromise = this.promisify(this.authClient, 'Register');
        return await registerPromise(userData);
    }

    async login(credentials) {
        const loginPromise = this.promisify(this.authClient, 'Login');
        const response = await loginPromise(credentials);
        if (response.success) this.currentToken = response.token;
        return response;
    }

    async createTask(taskData) {
        const createPromise = this.promisify(this.taskClient, 'CreateTask');
        return await createPromise({ token: this.currentToken, ...taskData });
    }

    async getTasks(filters = {}) {
        const getTasksPromise = this.promisify(this.taskClient, 'GetTasks');
        return await getTasksPromise({ token: this.currentToken, ...filters });
    }

    async getTask(taskId) {
        const getTaskPromise = this.promisify(this.taskClient, 'GetTask');
        return await getTaskPromise({ token: this.currentToken, task_id: taskId });
    }

    async updateTask(taskId, updates) {
        const updatePromise = this.promisify(this.taskClient, 'UpdateTask');
        return await updatePromise({ token: this.currentToken, task_id: taskId, ...updates });
    }

    async deleteTask(taskId) {
        const deletePromise = this.promisify(this.taskClient, 'DeleteTask');
        return await deletePromise({ token: this.currentToken, task_id: taskId });
    }

    async getStats() {
        const statsPromise = this.promisify(this.taskClient, 'GetTaskStats');
        return await statsPromise({ token: this.currentToken });
    }

    streamTasks(filters = {}) {
        const stream = this.taskClient.StreamTasks({ token: this.currentToken, ...filters });
        stream.on('data', (task) => console.log('📋 Tarefa via stream:', task));
        stream.on('end', () => console.log('📋 Stream finalizado'));
        stream.on('error', (err) => console.error('❌ Erro no stream:', err));
        return stream;
    }

    streamNotifications() {
        const stream = this.taskClient.StreamNotifications({ token: this.currentToken });
        stream.on('data', (notification) => console.log('🔔 Notificação via stream:', notification));
        stream.on('end', () => console.log('🔔 Stream de notificações finalizado'));
        stream.on('error', (err) => console.error('❌ Erro no stream:', err));
        return stream;
    }
}

// Demonstração de uso
async function demonstrateGrpcClient() {
    const client = new GrpcClient(); // usa NGINX para TaskService

    try {
        await client.initialize();

        console.log('\n1️⃣ Registrando usuário...');
        const registerResponse = await client.register({
            email: 'usuario@teste.com',
            username: 'usuarioteste',
            password: 'senha123',
            first_name: 'João',
            last_name: 'Silva'
        });
        console.log('Registro:', registerResponse.message);

        console.log('\n2️⃣ Fazendo login...');
        const loginResponse = await client.login({
            identifier: 'usuario@teste.com',
            password: 'senha123'
        });
        console.log('Login:', loginResponse.message);

        console.log('\n3️⃣ Criando tarefa...');
        const createResponse = await client.createTask({
            title: 'Estudar gRPC',
            description: 'Aprender Protocol Buffers e streaming',
            priority: 2
        });
        console.log('Tarefa criada:', createResponse.message, `(atendida pelo servidor ${createResponse.serverPort})`);

        console.log('\n4️⃣ Listando tarefas...');
        const tasksResponse = await client.getTasks({ page: 1, limit: 10 });
        console.log(`Encontradas ${tasksResponse.tasks.length} tarefas`);

    } catch (error) {
        console.error('❌ Erro na demonstração:', error);
    }
}

// Executar demonstração se arquivo for executado diretamente
if (require.main === module) demonstrateGrpcClient();

module.exports = GrpcClient;
