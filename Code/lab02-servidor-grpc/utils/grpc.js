const grpc = require('@grpc/grpc-js');

function grpcError(status, message, metadata) {
  const err = new Error(message || 'gRPC error');
  err.code = status;
  err.details = message || 'gRPC error';
  if (metadata) err.metadata = metadata;
  return err;
}

function mapError(err) {
  if (typeof err?.code === 'number') return err; // já é erro gRPC
  const msg = err?.details || err?.message || 'Unexpected error';
  switch (err?.name) {
    case 'ValidationError':
      return grpcError(grpc.status.INVALID_ARGUMENT, msg);
    case 'AuthError':
      return grpcError(grpc.status.UNAUTHENTICATED, msg);
    case 'PermissionError':
      return grpcError(grpc.status.PERMISSION_DENIED, msg);
    case 'NotFoundError':
      return grpcError(grpc.status.NOT_FOUND, msg);
    case 'ConflictError':
      return grpcError(grpc.status.ALREADY_EXISTS, msg);
    default:
      return grpcError(grpc.status.INTERNAL, msg);
  }
}

// Wrapper simples para handlers (call, callback) e também async
function safe(handler) {
  return (call, callback) => {
    try {
      const result = handler(call, callback);
      if (result && typeof result.then === 'function') {
        result.then(
          (res) => res !== undefined && callback(null, res),
          (err) => callback(mapError(err))
        );
      }
    } catch (err) {
      callback(mapError(err));
    }
  };
}

module.exports = { grpcError, mapError, safe, status: grpc.status };