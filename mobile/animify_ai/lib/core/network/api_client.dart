import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

import '../config/env_config.dart';
import '../errors/exceptions.dart';
import 'api_interceptors.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.development().apiBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  dio.interceptors.addAll([
    AuthInterceptor(ref),
    ErrorInterceptor(),
    PrettyDioLogger(
      requestHeader: true,
      requestBody: true,
      responseBody: true,
      responseHeader: false,
      error: true,
      compact: true,
    ),
  ]);

  return dio;
});

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.watch(dioProvider));
});

class ApiClient {
  final Dio _dio;

  ApiClient(this._dio);

  Future<ApiResponse<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    T Function(dynamic json)? fromJson,
  }) async {
    try {
      final response = await _dio.get(
        path,
        queryParameters: queryParameters,
        options: options,
      );
      return ApiResponse.fromResponse(response, fromJson);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<ApiResponse<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    T Function(dynamic json)? fromJson,
  }) async {
    try {
      final response = await _dio.post(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
      return ApiResponse.fromResponse(response, fromJson);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<ApiResponse<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    T Function(dynamic json)? fromJson,
  }) async {
    try {
      final response = await _dio.put(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
      return ApiResponse.fromResponse(response, fromJson);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<ApiResponse<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    T Function(dynamic json)? fromJson,
  }) async {
    try {
      final response = await _dio.patch(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
      return ApiResponse.fromResponse(response, fromJson);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<ApiResponse<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    T Function(dynamic json)? fromJson,
  }) async {
    try {
      final response = await _dio.delete(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
      return ApiResponse.fromResponse(response, fromJson);
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<Response> uploadFile(
    String url, {
    required String filePath,
    Map<String, dynamic>? fields,
    void Function(int, int)? onSendProgress,
  }) async {
    try {
      final formData = FormData.fromMap({
        if (fields != null) ...fields,
        'file': await MultipartFile.fromFile(filePath),
      });

      return await _dio.post(
        url,
        data: formData,
        onSendProgress: onSendProgress,
        options: Options(
          headers: {'Content-Type': 'multipart/form-data'},
        ),
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Exception _handleDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const NetworkException('Connection timed out. Please try again.');
      case DioExceptionType.connectionError:
        return const NetworkException('No internet connection. Please check your network.');
      case DioExceptionType.badResponse:
        return _handleBadResponse(error.response);
      case DioExceptionType.cancel:
        return const ServerException(message: 'Request was cancelled.');
      default:
        return const ServerException(message: 'An unexpected error occurred.');
    }
  }

  Exception _handleBadResponse(Response? response) {
    if (response == null) {
      return const ServerException(message: 'No response from server.');
    }

    final statusCode = response.statusCode;
    final data = response.data;

    String message = 'An error occurred.';
    String? code;
    Map<String, dynamic>? details;

    if (data is Map<String, dynamic>) {
      final error = data['error'] as Map<String, dynamic>?;
      message = error?['message'] ?? data['message'] ?? message;
      code = error?['code'] ?? data['code'];
      details = error?['details'] ?? data['details'];
    }

    switch (statusCode) {
      case 400:
        if (code == 'VALIDATION_ERROR') {
          return ValidationException(
            message: message,
            fieldErrors: details?.map((key, value) => MapEntry(
              key,
              (value as List).cast<String>(),
            )),
          );
        }
        return ServerException(
          message: message,
          code: code,
          statusCode: statusCode,
          details: details,
        );
      case 401:
        return AuthenticationException(message: message, code: code);
      case 403:
        if (code?.contains('SUBSCRIPTION') ?? false) {
          return SubscriptionException(message: message, code: code);
        }
        return PermissionException(message);
      case 404:
        return NotFoundException(message: message);
      case 429:
        return const ServerException(
          message: 'Too many requests. Please wait and try again.',
          code: 'RATE_LIMIT_EXCEEDED',
          statusCode: 429,
        );
      case 500:
      case 502:
      case 503:
        return const ServerException(
          message: 'Server error. Please try again later.',
          statusCode: 500,
        );
      default:
        return ServerException(
          message: message,
          code: code,
          statusCode: statusCode,
          details: details,
        );
    }
  }
}

class ApiResponse<T> {
  final bool success;
  final T? data;
  final ApiMeta? meta;
  final ApiPagination? pagination;

  ApiResponse({
    required this.success,
    this.data,
    this.meta,
    this.pagination,
  });

  factory ApiResponse.fromResponse(
    Response response,
    T Function(dynamic json)? fromJson,
  ) {
    final json = response.data as Map<String, dynamic>;
    
    T? data;
    if (fromJson != null && json['data'] != null) {
      data = fromJson(json['data']);
    } else if (json['data'] != null) {
      data = json['data'] as T?;
    }

    return ApiResponse(
      success: json['success'] ?? true,
      data: data,
      meta: json['meta'] != null 
          ? ApiMeta.fromJson(json['meta']) 
          : null,
      pagination: json['pagination'] != null 
          ? ApiPagination.fromJson(json['pagination']) 
          : null,
    );
  }
}

class ApiMeta {
  final DateTime? timestamp;
  final String? requestId;

  ApiMeta({this.timestamp, this.requestId});

  factory ApiMeta.fromJson(Map<String, dynamic> json) {
    return ApiMeta(
      timestamp: json['timestamp'] != null 
          ? DateTime.parse(json['timestamp']) 
          : null,
      requestId: json['requestId'],
    );
  }
}

class ApiPagination {
  final int page;
  final int limit;
  final int total;
  final int totalPages;
  final bool hasMore;

  ApiPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
    required this.hasMore,
  });

  factory ApiPagination.fromJson(Map<String, dynamic> json) {
    return ApiPagination(
      page: json['page'] ?? 1,
      limit: json['limit'] ?? 20,
      total: json['total'] ?? 0,
      totalPages: json['totalPages'] ?? 0,
      hasMore: json['hasMore'] ?? false,
    );
  }
}
