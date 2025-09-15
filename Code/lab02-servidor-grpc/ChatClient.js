const grpc = require('@grpc/grpc-js');
const ProtoLoader = require('../utils/protoLoader');

class ChatClient {
  constructor(address = 'localhost:50051') {
    this.protoLoader = new ProtoLoader();
    this.chatProto = this.protoLoader.loadProto('chat_service.proto', 'chat');
    this.client = new this.chatProto.ChatService(address, grpc.credentials.createInsecure());
  }

  sendStream() {
    return this.client.sendMessage();
  }

  receive(callback) {
    const call = this.client.receiveMessages({});
    call.on('data', callback);
    call.on('end', () => console.log('Receive stream ended.'));
    call.on('error', (e) => console.error('Receive error:', e.message));
  }
}

// Execução direta: recebe mensagens e lê do stdin para enviar
if (require.main === module) {
  const chat = new ChatClient();
  chat.receive((m) => console.log(`[${new Date(Number(m.timestamp)).toISOString()}] ${m.user}: ${m.text}`));

  const sender = chat.sendStream();
  process.stdin.setEncoding('utf8');
  process.stdout.write('Digite mensagens e pressione Enter (Ctrl+C para sair)\n');

  process.stdin.on('data', (line) => {
    const text = line.toString().trim();
    if (!text) return;
    sender.write({ user: process.env.USER || 'User', text, timestamp: Date.now() });
  });

  process.on('SIGINT', () => {
    sender.end();
    process.exit(0);
  });
}

module.exports = ChatClient;