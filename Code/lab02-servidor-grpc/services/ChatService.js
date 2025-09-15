const { Status } = require('@grpc/grpc-js');

class ChatService {
  constructor() {
    this.subscribers = new Set(); // Set<ServerWritableStream>
  }

  // Server-streaming: mantém a conexão aberta e envia mensagens conforme chegam
  receiveMessages(call) {
    this.subscribers.add(call);

    const cleanup = () => {
      this.subscribers.delete(call);
    };

    call.on('close', cleanup);
    call.on('end', cleanup);
    call.on('error', cleanup);
  }

  // Client-streaming: recebe 1..N mensagens e, ao final, responde com um Ack
  sendMessage(call, callback) {
    let received = 0;

    call.on('data', (msg) => {
      received += 1;
      const chatMsg = {
        user: msg.user || 'anon',
        text: msg.text || '',
        timestamp: msg.timestamp && Number(msg.timestamp) > 0 ? Number(msg.timestamp) : Date.now(),
      };
      this.broadcast(chatMsg);
    });

    call.on('end', () => {
      callback(null, { ok: true, info: `received=${received}` });
    });

    call.on('error', (err) => {
      // Apenas loga; o stream será encerrado pelo gRPC
      console.error('ChatService.SendMessage error:', err);
    });
  }

  broadcast(message) {
    for (const subscriber of Array.from(this.subscribers)) {
      try {
        subscriber.write(message);
      } catch (e) {
        // Se falhar, remove o assinante
        this.subscribers.delete(subscriber);
      }
    }
  }
}

module.exports = ChatService;