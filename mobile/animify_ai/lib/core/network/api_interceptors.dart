import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../constants/app_constants.dart';

class AuthInterceptor extends Interceptor {
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  bool _isRefreshing = false;

  AuthInterceptor(Object? _);

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final accessToken = await _secureStorage.read(key: StorageKeys.accessToken);

    if (accessToken != null && accessToken.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $accessToken';
    }

    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401 ||
        err.requestOptions.path.contains('/auth/refresh') ||
        err.requestOptions.path.contains('/auth/login')) {
      handler.next(err);
      return;
    }

    final refreshToken =
        await _secureStorage.read(key: StorageKeys.refreshToken);

    if (refreshToken == null || refreshToken.isEmpty || _isRefreshing) {
      handler.next(err);
      return;
    }

    _isRefreshing = true;
    try {
      final dio = Dio(
        BaseOptions(
          baseUrl: err.requestOptions.baseUrl,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        ),
      );
      final response = await dio.post(
        ApiEndpoints.refreshToken,
        data: {'refreshToken': refreshToken},
      );

      final body = response.data;
      final data = body is Map && body['data'] is Map
          ? Map<String, dynamic>.from(body['data'] as Map)
          : (body is Map
              ? Map<String, dynamic>.from(body)
              : <String, dynamic>{});

      final newAccess = data['accessToken'] as String?;
      final newRefresh = data['refreshToken'] as String?;

      if (newAccess == null || newAccess.isEmpty) {
        await _clearTokens();
        handler.next(err);
        return;
      }

      await _secureStorage.write(
        key: StorageKeys.accessToken,
        value: newAccess,
      );
      if (newRefresh != null && newRefresh.isNotEmpty) {
        await _secureStorage.write(
          key: StorageKeys.refreshToken,
          value: newRefresh,
        );
      }

      final opts = err.requestOptions;
      opts.headers['Authorization'] = 'Bearer $newAccess';
      final clone = await dio.fetch(opts);
      handler.resolve(clone);
    } catch (_) {
      await _clearTokens();
      handler.next(err);
    } finally {
      _isRefreshing = false;
    }
  }

  Future<void> _clearTokens() async {
    await _secureStorage.delete(key: StorageKeys.accessToken);
    await _secureStorage.delete(key: StorageKeys.refreshToken);
    await _secureStorage.delete(key: StorageKeys.user);
  }
}

class ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    handler.next(err);
  }
}
