const grpc = require('@grpc/grpc-js');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'seu-secret-aqui';

function getTokenFromMetadata(metadata) {
  if (!metadata) return null;
  const values = metadata.get('authorization')?.length
    ? metadata.get('authorization')
    : metadata.get('Authorization');
  if (!values || values.length === 0) return null;

  const header = typeof values[0] === 'string' ? values[0] : String(values[0]);
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Unary: (call, callback)
function requireAuthUnary(handler) {
  return (call, callback) => {
    const token = getTokenFromMetadata(call.metadata);
    const decoded = token && verifyToken(token);
    if (!decoded) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'Token ausente ou inválido',
      });
    }
    call.user = decoded; // Ex.: { id, email, ... }
    return handler(call, callback);
  };
}

// Streaming (server/client/bidi): (call)
function requireAuthStream(handler) {
  return (call) => {
    const token = getTokenFromMetadata(call.metadata);
    const decoded = token && verifyToken(token);
    if (!decoded) {
      call.emit('error', {
        code: grpc.status.UNAUTHENTICATED,
        message: 'Token ausente ou inválido',
      });
      if (typeof call.end === 'function') call.end();
      return;
    }
    call.user = decoded;
    return handler(call);
  };
}

module.exports = {
  requireAuthUnary,
  requireAuthStream,
  getTokenFromMetadata,
  verifyToken,
};