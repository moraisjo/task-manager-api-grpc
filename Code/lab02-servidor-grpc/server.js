const grpc = require('@grpc/grpc-js');
const ProtoLoader = require('./utils/protoLoader');
const AuthService = require('./services/AuthService');
const TaskService = require('./services/TaskService');
const database = require('./database/database');
const { safe } = require('./utils/grpc');
const ChatService = require('./services/ChatService'); // + ChatService

/**
 * Servidor gRPC
 * 
 * Implementa comunicação de alta performance usando:
 * - Protocol Buffers para serialização eficiente
 * - HTTP/2 como protocolo de transporte
 * - Streaming bidirecional para tempo real
 */

class GrpcServer {
    constructor() {
        this.server = new grpc.Server();
        this.protoLoader = new ProtoLoader();
        this.authService = new AuthService();
        this.taskService = new TaskService();
        this.chatService = new ChatService();
    }

    async initialize() {
        try {
            // Inicializar banco de dados
            await database.init();

            // Carregar definições dos protobuf
            const authProto = this.protoLoader.loadProto('auth_service.proto', 'auth');
            const taskProto = this.protoLoader.loadProto('task_service.proto', 'tasks');
            const chatProto = this.protoLoader.loadProto('chat_service.proto', 'chat'); // + chat


            // Registrar serviços de autenticação
            this.server.addService(authProto.AuthService.service, {
                Register: safe(this.authService.register.bind(this.authService)),
                Login: safe(this.authService.login.bind(this.authService)),
                ValidateToken: safe(this.authService.validateToken.bind(this.authService))
            });

            // Registrar serviços de tarefas
            this.server.addService(taskProto.TaskService.service, {
                CreateTask: safe(this.taskService.createTask.bind(this.taskService)),
                GetTasks: safe(this.taskService.getTasks.bind(this.taskService)),
                GetTask: safe(this.taskService.getTask.bind(this.taskService)),
                UpdateTask: safe(this.taskService.updateTask.bind(this.taskService)),
                DeleteTask: safe(this.taskService.deleteTask.bind(this.taskService)),
                GetTaskStats: safe(this.taskService.getTaskStats.bind(this.taskService)),
                StreamTasks: this.taskService.streamTasks.bind(this.taskService),
                StreamNotifications: this.taskService.streamNotifications.bind(this.taskService)
            });

            this.server.addService(chatProto.ChatService.service, {
                SendMessage: this.chatService.sendMessage.bind(this.chatService),
                ReceiveMessages: this.chatService.receiveMessages.bind(this.chatService)
            });

            console.log('✅ Serviços gRPC registrados com sucesso');
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            throw error;
        }
    }

    async start() {
        try {
            await this.initialize();

            const port = process.env.GRPC_PORT || 50051; // respeita variável de ambiente
            const serverCredentials = grpc.ServerCredentials.createInsecure();

            this.server.bindAsync(`0.0.0.0:${port}`, serverCredentials, (error, boundPort) => {
                if (error) {
                    console.error('❌ Falha ao iniciar servidor:', error);
                    process.exit(1);
                }

                this.server.start();
                console.log('🚀 =================================');
                console.log(`🚀 Servidor gRPC iniciado na porta ${boundPort}`);
                console.log(`🚀 Protocolo: gRPC/HTTP2`);
                console.log(`🚀 Serialização: Protocol Buffers`);
                console.log('🚀 Serviços disponíveis:');
                console.log('🚀   - AuthService (Register, Login, ValidateToken)');
                console.log('🚀   - TaskService (CRUD + Streaming)');
                console.log('🚀 =================================');
            });

            // Graceful shutdown
            process.on('SIGINT', () => {
                console.log('\n⏳ Encerrando servidor...');
                this.server.tryShutdown((error) => {
                    if (error) {
                        console.error('❌ Erro ao encerrar servidor:', error);
                        process.exit(1);
                    } else {
                        console.log('✅ Servidor encerrado com sucesso');
                        process.exit(0);
                    }
                });
            });

        } catch (error) {
            console.error('❌ Falha na inicialização do servidor:', error);
            process.exit(1);
        }
    }
}

// Inicialização direta
if (require.main === module) {
    const server = new GrpcServer();
    server.start();
}

module.exports = GrpcServer;
