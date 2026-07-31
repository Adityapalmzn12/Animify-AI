import 'package:freezed_annotation/freezed_annotation.dart';

part 'user_entity.freezed.dart';
part 'user_entity.g.dart';

@freezed
class UserEntity with _$UserEntity {
  const factory UserEntity({
    required String id,
    required String email,
    required String name,
    String? avatarUrl,
    required bool emailVerified,
    @Default('USER') String role,
    @Default(0) int creditBalance,
    required DateTime createdAt,
    SubscriptionInfo? subscription,
    UsageInfo? usage,
  }) = _UserEntity;

  factory UserEntity.fromJson(Map<String, dynamic> json) =>
      _$UserEntityFromJson(json);
}

@freezed
class SubscriptionInfo with _$SubscriptionInfo {
  const factory SubscriptionInfo({
    required String planType,
    required String status,
    required DateTime expiresAt,
    required int videoLimit,
    required int minutesLimit,
  }) = _SubscriptionInfo;

  factory SubscriptionInfo.fromJson(Map<String, dynamic> json) =>
      _$SubscriptionInfoFromJson(json);
}

@freezed
class UsageInfo with _$UsageInfo {
  const factory UsageInfo({
    required int videosUsed,
    required double minutesUsed,
    required DateTime periodStart,
    required DateTime periodEnd,
  }) = _UsageInfo;

  factory UsageInfo.fromJson(Map<String, dynamic> json) =>
      _$UsageInfoFromJson(json);
}

@freezed
class AuthTokens with _$AuthTokens {
  const factory AuthTokens({
    required String accessToken,
    required String refreshToken,
    required int expiresIn,
  }) = _AuthTokens;

  factory AuthTokens.fromJson(Map<String, dynamic> json) =>
      _$AuthTokensFromJson(json);
}

@freezed
class AuthState with _$AuthState {
  const AuthState._();

  const factory AuthState.initial() = _Initial;
  const factory AuthState.loading() = _Loading;
  const factory AuthState.authenticated({
    required UserEntity user,
    required AuthTokens tokens,
  }) = _Authenticated;
  const factory AuthState.unauthenticated() = _Unauthenticated;
  const factory AuthState.error({required String message}) = _Error;

  bool get isAuthenticated => this is _Authenticated;
  bool get isLoading => this is _Loading;
  
  UserEntity? get user => maybeWhen(
    authenticated: (user, _) => user,
    orElse: () => null,
  );
}
