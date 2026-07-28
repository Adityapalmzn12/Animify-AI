class ServerException implements Exception {
  final String message;
  final String? code;
  final int? statusCode;
  final Map<String, dynamic>? details;

  const ServerException({
    required this.message,
    this.code,
    this.statusCode,
    this.details,
  });

  @override
  String toString() => 'ServerException: $message (code: $code, status: $statusCode)';
}

class NetworkException implements Exception {
  final String? message;

  const NetworkException([this.message]);

  @override
  String toString() => 'NetworkException: ${message ?? 'No internet connection'}';
}

class CacheException implements Exception {
  final String? message;

  const CacheException([this.message]);

  @override
  String toString() => 'CacheException: ${message ?? 'Cache operation failed'}';
}

class AuthenticationException implements Exception {
  final String message;
  final String? code;

  const AuthenticationException({
    required this.message,
    this.code,
  });

  @override
  String toString() => 'AuthenticationException: $message (code: $code)';
}

class ValidationException implements Exception {
  final String message;
  final Map<String, List<String>>? fieldErrors;

  const ValidationException({
    required this.message,
    this.fieldErrors,
  });

  @override
  String toString() => 'ValidationException: $message';
}

class NotFoundException implements Exception {
  final String? message;
  final String? resource;

  const NotFoundException({
    this.message,
    this.resource,
  });

  @override
  String toString() => 'NotFoundException: ${message ?? '${resource ?? 'Resource'} not found'}';
}

class PermissionException implements Exception {
  final String? message;

  const PermissionException([this.message]);

  @override
  String toString() => 'PermissionException: ${message ?? 'Permission denied'}';
}

class SubscriptionException implements Exception {
  final String message;
  final String? code;

  const SubscriptionException({
    required this.message,
    this.code,
  });

  @override
  String toString() => 'SubscriptionException: $message (code: $code)';
}

class UploadException implements Exception {
  final String message;
  final String? code;

  const UploadException({
    required this.message,
    this.code,
  });

  @override
  String toString() => 'UploadException: $message (code: $code)';
}
