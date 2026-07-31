import 'package:fpdart/fpdart.dart';

import '../../../../core/errors/exceptions.dart';
import '../../../../core/errors/failures.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_local_datasource.dart';
import '../datasources/auth_remote_datasource.dart';
import '../models/auth_models.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource _remoteDataSource;
  final AuthLocalDataSource _localDataSource;

  AuthRepositoryImpl(this._remoteDataSource, this._localDataSource);

  @override
  Future<Either<Failure, (UserEntity, AuthTokens)>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _remoteDataSource.login(
        LoginRequest(email: email, password: password),
      );
      
      await _cacheAuthData(response);
      
      return Right((
        response.user.toEntity(),
        AuthTokens(
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          expiresIn: response.expiresIn,
        ),
      ));
    } on NetworkException catch (e) {
      return Left(Failure.network(message: e.message));
    } on AuthenticationException catch (e) {
      return Left(Failure.authentication(message: e.message, code: e.code));
    } on ServerException catch (e) {
      return Left(Failure.server(
        message: e.message,
        code: e.code,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      return Left(Failure.unknown(error: e));
    }
  }

  @override
  Future<Either<Failure, (UserEntity, AuthTokens)>> register({
    required String email,
    required String password,
    required String name,
  }) async {
    try {
      final response = await _remoteDataSource.register(
        RegisterRequest(email: email, password: password, name: name),
      );
      
      await _cacheAuthData(response);
      
      return Right((
        response.user.toEntity(),
        AuthTokens(
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          expiresIn: response.expiresIn,
        ),
      ));
    } on NetworkException catch (e) {
      return Left(Failure.network(message: e.message));
    } on ValidationException catch (e) {
      return Left(Failure.validation(
        message: e.message,
        fieldErrors: e.fieldErrors,
      ));
    } on ServerException catch (e) {
      return Left(Failure.server(
        message: e.message,
        code: e.code,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      return Left(Failure.unknown(error: e));
    }
  }

  @override
  Future<Either<Failure, (UserEntity, AuthTokens)>> googleSignIn({
    required String idToken,
  }) async {
    try {
      final response = await _remoteDataSource.googleSignIn(
        GoogleAuthRequest(idToken: idToken),
      );
      
      await _cacheAuthData(response);
      
      return Right((
        response.user.toEntity(),
        AuthTokens(
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          expiresIn: response.expiresIn,
        ),
      ));
    } on NetworkException catch (e) {
      return Left(Failure.network(message: e.message));
    } on AuthenticationException catch (e) {
      return Left(Failure.authentication(message: e.message, code: e.code));
    } on ServerException catch (e) {
      return Left(Failure.server(
        message: e.message,
        code: e.code,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      return Left(Failure.unknown(error: e));
    }
  }

  @override
  Future<Either<Failure, void>> sendOtp({
    required String email,
    required String purpose,
  }) async {
    try {
      await _remoteDataSource.sendOtp(
        SendOtpRequest(email: email, purpose: purpose),
      );
      return const Right(null);
    } on NetworkException catch (e) {
      return Left(Failure.network(message: e.message));
    } on ServerException catch (e) {
      return Left(Failure.server(
        message: e.message,
        code: e.code,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      return Left(Failure.unknown(error: e));
    }
  }

  @override
  Future<Either<Failure, (UserEntity, AuthTokens)>> verifyOtp({
    required String email,
    required String otp,
    required String purpose,
  }) async {
    try {
      final response = await _remoteDataSource.verifyOtp(
        VerifyOtpRequest(email: email, otp: otp, purpose: purpose),
      );
      
      if (purpose != 'password_reset') {
        await _cacheAuthData(response);
      }
      
      return Right((
        response.user.toEntity(),
        AuthTokens(
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
          expiresIn: response.expiresIn,
        ),
      ));
    } on NetworkException catch (e) {
      return Left(Failure.network(message: e.message));
    } on AuthenticationException catch (e) {
      return Left(Failure.authentication(message: e.message, code: e.code));
    } on ServerException catch (e) {
      return Left(Failure.server(
        message: e.message,
        code: e.code,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      return Left(Failure.unknown(error: e));
    }
  }

  @override
  Future<Either<Failure, AuthTokens>> refreshToken({
    required String refreshToken,
  }) async {
    try {
      final response = await _remoteDataSource.refreshToken(
        RefreshTokenRequest(refreshToken: refreshToken),
      );
      
      final newAccessToken = response['accessToken'] as String;
      final expiresIn = response['expiresIn'] as int;
      
      await _localDataSource.cacheTokens(
        accessToken: newAccessToken,
        refreshToken: refreshToken,
      );
      
      return Right(AuthTokens(
        accessToken: newAccessToken,
        refreshToken: refreshToken,
        expiresIn: expiresIn,
      ));
    } on NetworkException catch (e) {
      return Left(Failure.network(message: e.message));
    } on AuthenticationException catch (e) {
      await clearLocalData();
      return Left(Failure.authentication(message: e.message, code: e.code));
    } on ServerException catch (e) {
      return Left(Failure.server(
        message: e.message,
        code: e.code,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      return Left(Failure.unknown(error: e));
    }
  }

  @override
  Future<Either<Failure, void>> logout({
    required String refreshToken,
  }) async {
    try {
      await _remoteDataSource.logout(
        RefreshTokenRequest(refreshToken: refreshToken),
      );
      await clearLocalData();
      return const Right(null);
    } catch (e) {
      await clearLocalData();
      return const Right(null);
    }
  }

  @override
  Future<Either<Failure, void>> forgotPassword({
    required String email,
  }) async {
    try {
      await _remoteDataSource.forgotPassword(email);
      return const Right(null);
    } on NetworkException catch (e) {
      return Left(Failure.network(message: e.message));
    } on ServerException catch (e) {
      return Left(Failure.server(
        message: e.message,
        code: e.code,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      return Left(Failure.unknown(error: e));
    }
  }

  @override
  Future<Either<Failure, void>> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    try {
      await _remoteDataSource.resetPassword(
        ResetPasswordRequest(email: email, otp: otp, newPassword: newPassword),
      );
      return const Right(null);
    } on NetworkException catch (e) {
      return Left(Failure.network(message: e.message));
    } on AuthenticationException catch (e) {
      return Left(Failure.authentication(message: e.message, code: e.code));
    } on ServerException catch (e) {
      return Left(Failure.server(
        message: e.message,
        code: e.code,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      return Left(Failure.unknown(error: e));
    }
  }

  @override
  Future<Either<Failure, UserEntity>> getCurrentUser() async {
    try {
      final user = await _remoteDataSource.getCurrentUser();
      await _localDataSource.cacheUser(user);
      return Right(user.toEntity());
    } on NetworkException catch (e) {
      final cachedUser = await _localDataSource.getCachedUser();
      if (cachedUser != null) {
        return Right(cachedUser.toEntity());
      }
      return Left(Failure.network(message: e.message));
    } on AuthenticationException catch (e) {
      await clearLocalData();
      return Left(Failure.authentication(message: e.message, code: e.code));
    } on ServerException catch (e) {
      return Left(Failure.server(
        message: e.message,
        code: e.code,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      return Left(Failure.unknown(error: e));
    }
  }

  @override
  Future<Either<Failure, UserEntity>> updateProfile({
    String? name,
    String? avatarUrl,
  }) async {
    try {
      final user = await _remoteDataSource.updateProfile(
        name: name,
        avatarUrl: avatarUrl,
      );
      await _localDataSource.cacheUser(user);
      return Right(user.toEntity());
    } on NetworkException catch (e) {
      return Left(Failure.network(message: e.message));
    } on ValidationException catch (e) {
      return Left(Failure.validation(
        message: e.message,
        fieldErrors: e.fieldErrors,
      ));
    } on ServerException catch (e) {
      return Left(Failure.server(
        message: e.message,
        code: e.code,
        statusCode: e.statusCode,
      ));
    } catch (e) {
      return Left(Failure.unknown(error: e));
    }
  }

  @override
  Future<bool> isLoggedIn() async {
    return await _localDataSource.isLoggedIn();
  }

  @override
  Future<void> clearLocalData() async {
    await _localDataSource.clearAll();
  }

  Future<void> _cacheAuthData(AuthResponse response) async {
    await _localDataSource.cacheTokens(
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    );
    await _localDataSource.cacheUser(response.user);
  }
}
