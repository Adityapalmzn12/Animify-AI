import 'package:freezed_annotation/freezed_annotation.dart';

part 'failures.freezed.dart';

@freezed
class Failure with _$Failure {
  const factory Failure.server({
    required String message,
    String? code,
    int? statusCode,
    Map<String, dynamic>? details,
  }) = ServerFailure;

  const factory Failure.network({
    String? message,
  }) = NetworkFailure;

  const factory Failure.cache({
    String? message,
  }) = CacheFailure;

  const factory Failure.authentication({
    required String message,
    String? code,
  }) = AuthenticationFailure;

  const factory Failure.validation({
    required String message,
    Map<String, List<String>>? fieldErrors,
  }) = ValidationFailure;

  const factory Failure.notFound({
    String? message,
    String? resource,
  }) = NotFoundFailure;

  const factory Failure.permission({
    String? message,
  }) = PermissionFailure;

  const factory Failure.subscription({
    required String message,
    String? code,
  }) = SubscriptionFailure;

  const factory Failure.upload({
    required String message,
    String? code,
  }) = UploadFailure;

  const factory Failure.unknown({
    String? message,
    Object? error,
  }) = UnknownFailure;
}

extension FailureExtension on Failure {
  String get displayMessage {
    return when(
      server: (message, code, statusCode, details) => message,
      network: (message) => message ?? 'No internet connection. Please check your network.',
      cache: (message) => message ?? 'Failed to load cached data.',
      authentication: (message, code) => message,
      validation: (message, fieldErrors) => message,
      notFound: (message, resource) => message ?? '${resource ?? 'Resource'} not found.',
      permission: (message) => message ?? 'You don\'t have permission to perform this action.',
      subscription: (message, code) => message,
      upload: (message, code) => message,
      unknown: (message, error) => message ?? 'An unexpected error occurred.',
    );
  }

  bool get isNetworkError => this is NetworkFailure;
  bool get isAuthError => this is AuthenticationFailure;
  bool get isSubscriptionError => this is SubscriptionFailure;
}
