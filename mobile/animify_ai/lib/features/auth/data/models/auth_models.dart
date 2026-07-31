import 'package:freezed_annotation/freezed_annotation.dart';

import '../../domain/entities/user_entity.dart';

part 'auth_models.freezed.dart';
part 'auth_models.g.dart';

@freezed
class LoginRequest with _$LoginRequest {
  const factory LoginRequest({
    required String email,
    required String password,
  }) = _LoginRequest;

  factory LoginRequest.fromJson(Map<String, dynamic> json) =>
      _$LoginRequestFromJson(json);
}

@freezed
class RegisterRequest with _$RegisterRequest {
  const factory RegisterRequest({
    required String email,
    required String password,
    required String name,
  }) = _RegisterRequest;

  factory RegisterRequest.fromJson(Map<String, dynamic> json) =>
      _$RegisterRequestFromJson(json);
}

@freezed
class GoogleAuthRequest with _$GoogleAuthRequest {
  const factory GoogleAuthRequest({
    required String idToken,
  }) = _GoogleAuthRequest;

  factory GoogleAuthRequest.fromJson(Map<String, dynamic> json) =>
      _$GoogleAuthRequestFromJson(json);
}

@freezed
class SendOtpRequest with _$SendOtpRequest {
  const factory SendOtpRequest({
    required String email,
    required String purpose,
  }) = _SendOtpRequest;

  factory SendOtpRequest.fromJson(Map<String, dynamic> json) =>
      _$SendOtpRequestFromJson(json);
}

@freezed
class VerifyOtpRequest with _$VerifyOtpRequest {
  const factory VerifyOtpRequest({
    required String email,
    required String otp,
    required String purpose,
  }) = _VerifyOtpRequest;

  factory VerifyOtpRequest.fromJson(Map<String, dynamic> json) =>
      _$VerifyOtpRequestFromJson(json);
}

@freezed
class RefreshTokenRequest with _$RefreshTokenRequest {
  const factory RefreshTokenRequest({
    required String refreshToken,
  }) = _RefreshTokenRequest;

  factory RefreshTokenRequest.fromJson(Map<String, dynamic> json) =>
      _$RefreshTokenRequestFromJson(json);
}

@freezed
class ResetPasswordRequest with _$ResetPasswordRequest {
  const factory ResetPasswordRequest({
    required String email,
    @JsonKey(name: 'code') required String otp,
    required String newPassword,
  }) = _ResetPasswordRequest;

  factory ResetPasswordRequest.fromJson(Map<String, dynamic> json) =>
      _$ResetPasswordRequestFromJson(json);
}

@freezed
class AuthResponse with _$AuthResponse {
  const factory AuthResponse({
    required String accessToken,
    required String refreshToken,
    required int expiresIn,
    required UserModel user,
  }) = _AuthResponse;

  factory AuthResponse.fromJson(Map<String, dynamic> json) =>
      _$AuthResponseFromJson(json);
}

@freezed
class UserModel with _$UserModel {
  const UserModel._();

  const factory UserModel({
    required String id,
    required String email,
    required String name,
    String? avatarUrl,
    required bool emailVerified,
    @Default('USER') String role,
    @Default(0) int creditBalance,
    required DateTime createdAt,
    SubscriptionModel? subscription,
    UsageModel? usage,
  }) = _UserModel;

  factory UserModel.fromJson(Map<String, dynamic> json) =>
      _$UserModelFromJson(json);

  UserEntity toEntity() => UserEntity(
        id: id,
        email: email,
        name: name,
        avatarUrl: avatarUrl,
        emailVerified: emailVerified,
        role: role,
        creditBalance: creditBalance,
        createdAt: createdAt,
        subscription: subscription?.toEntity(),
        usage: usage?.toEntity(),
      );
}

@freezed
class SubscriptionModel with _$SubscriptionModel {
  const SubscriptionModel._();

  const factory SubscriptionModel({
    required String planType,
    required String status,
    required DateTime expiresAt,
    required int videoLimit,
    required int minutesLimit,
  }) = _SubscriptionModel;

  factory SubscriptionModel.fromJson(Map<String, dynamic> json) =>
      _$SubscriptionModelFromJson(json);

  SubscriptionInfo toEntity() => SubscriptionInfo(
        planType: planType,
        status: status,
        expiresAt: expiresAt,
        videoLimit: videoLimit,
        minutesLimit: minutesLimit,
      );
}

@freezed
class UsageModel with _$UsageModel {
  const UsageModel._();

  const factory UsageModel({
    required int videosUsed,
    required double minutesUsed,
    required DateTime periodStart,
    required DateTime periodEnd,
  }) = _UsageModel;

  factory UsageModel.fromJson(Map<String, dynamic> json) =>
      _$UsageModelFromJson(json);

  UsageInfo toEntity() => UsageInfo(
        videosUsed: videosUsed,
        minutesUsed: minutesUsed,
        periodStart: periodStart,
        periodEnd: periodEnd,
      );
}
