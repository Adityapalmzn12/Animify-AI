import 'package:fpdart/fpdart.dart';

import '../../../../core/errors/failures.dart';
import '../entities/user_entity.dart';

abstract class AuthRepository {
  Future<Either<Failure, (UserEntity, AuthTokens)>> login({
    required String email,
    required String password,
  });

  Future<Either<Failure, (UserEntity, AuthTokens)>> register({
    required String email,
    required String password,
    required String name,
  });

  Future<Either<Failure, (UserEntity, AuthTokens)>> googleSignIn({
    required String idToken,
  });

  Future<Either<Failure, void>> sendOtp({
    required String email,
    required String purpose,
  });

  Future<Either<Failure, (UserEntity, AuthTokens)>> verifyOtp({
    required String email,
    required String otp,
    required String purpose,
  });

  Future<Either<Failure, AuthTokens>> refreshToken({
    required String refreshToken,
  });

  Future<Either<Failure, void>> logout({
    required String refreshToken,
  });

  Future<Either<Failure, void>> forgotPassword({
    required String email,
  });

  Future<Either<Failure, void>> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  });

  Future<Either<Failure, UserEntity>> getCurrentUser();

  Future<Either<Failure, UserEntity>> updateProfile({
    String? name,
    String? avatarUrl,
  });

  Future<bool> isLoggedIn();

  Future<void> clearLocalData();
}
