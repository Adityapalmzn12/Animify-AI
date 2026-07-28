import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../constants/app_constants.dart';

class AuthInterceptor extends Interceptor {
  final Ref _ref;
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  bool _isRefreshing = false;
  final List<RequestOptions> _pendingRequests = [];

  AuthInterceptor(this._ref);

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final accessToken = await _secureStorage.read(key: StorageKeys.accessToken);
    
    if (accessToken != null) {
      options.headers['Authorization'] = 'Bearer $accessToken';
    }
    
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      final refreshToken = await _secureStorage.read(key: StorageKeys.refreshToken);
      
      if (refreshToken != null && !_isRefreshing) {
        _isRefreshing = true;
        _pendingRequests.add(err.requestOptions);

        try {
          final dio = Dio();
          final response = await dio.post(
            '${err.requestOptions.baseUrl}${ApiEndpoints.refreshToken}',
            data: {'refreshToken': refreshToken},
          );

          if (response.statusCode == 200) {
            final newAccessToken = response.data['data']['accessToken'];
            await _secureStorage.write(
              key: StorageKeys.accessToken,
              value: newAccessToken,
            );

            for (final requestOptions in _pendingRequests) {
              requestOptions.headers['Authorization'] = 'Bearer $newAccessToken';
              try {
                final response = await dio.fetch(requestOptions);
                handler.resolve(response);
              } catch (e) {
                handler.reject(DioException(
                  requestOptions: requestOptions,
                  error: e,
                ));
              }
            }
            
            _pendingRequests.clear();
            _isRefreshing = false;
            return;
          }
        } catch (e) {
          await _clearTokens();
          _isRefreshing = false;
          _pendingRequests.clear();
        }
      } else if (_isRefreshing) {
        _pendingRequests.add(err.requestOptions);
        return;
      }
    }
    
    handler.next(err);
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

class RetryInterceptor extends Interceptor {
  final int maxRetries;
  final Duration retryInterval;

  RetryInterceptor({
    this.maxRetries = 3,
    this.retryInterval = const Duration(seconds: 1),
  });

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final retryCount = err.requestOptions.extra['retryCount'] ?? 0;
    
    if (_shouldRetry(err) && retryCount < maxRetries) {
      await Future.delayed(retryInterval * (retryCount + 1));
      
      err.requestOptions.extra['retryCount'] = retryCount + 1;
      
      try {
        final dio = Dio();
        final response = await dio.fetch(err.requestOptions);
        handler.resolve(response);
        return;
      } catch (e) {
        handler.next(err);
        return;
      }
    }
    
    handler.next(err);
  }

  bool _shouldRetry(DioException err) {
    return err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.sendTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        (err.response?.statusCode != null &&
            err.response!.statusCode! >= 500 &&
            err.response!.statusCode! < 600);
  }
}
