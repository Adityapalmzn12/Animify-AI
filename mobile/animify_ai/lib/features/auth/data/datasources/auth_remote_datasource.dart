import '../../../../core/constants/app_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/auth_models.dart';

abstract class AuthRemoteDataSource {
  Future<AuthResponse> login(LoginRequest request);
  Future<AuthResponse> register(RegisterRequest request);
  Future<AuthResponse> googleSignIn(GoogleAuthRequest request);
  Future<void> sendOtp(SendOtpRequest request);
  Future<AuthResponse> verifyOtp(VerifyOtpRequest request);
  Future<Map<String, dynamic>> refreshToken(RefreshTokenRequest request);
  Future<void> logout(RefreshTokenRequest request);
  Future<void> forgotPassword(String email);
  Future<void> resetPassword(ResetPasswordRequest request);
  Future<UserModel> getCurrentUser();
  Future<UserModel> updateProfile({String? name, String? avatarUrl});
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final ApiClient _apiClient;

  AuthRemoteDataSourceImpl(this._apiClient);

  @override
  Future<AuthResponse> login(LoginRequest request) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiEndpoints.login,
      data: request.toJson(),
    );
    return AuthResponse.fromJson(response.data!);
  }

  @override
  Future<AuthResponse> register(RegisterRequest request) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiEndpoints.register,
      data: request.toJson(),
    );
    return AuthResponse.fromJson(response.data!);
  }

  @override
  Future<AuthResponse> googleSignIn(GoogleAuthRequest request) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiEndpoints.googleAuth,
      data: request.toJson(),
    );
    return AuthResponse.fromJson(response.data!);
  }

  @override
  Future<void> sendOtp(SendOtpRequest request) async {
    await _apiClient.post(
      ApiEndpoints.sendOtp,
      data: request.toJson(),
    );
  }

  @override
  Future<AuthResponse> verifyOtp(VerifyOtpRequest request) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiEndpoints.verifyOtp,
      data: request.toJson(),
    );
    return AuthResponse.fromJson(response.data!);
  }

  @override
  Future<Map<String, dynamic>> refreshToken(RefreshTokenRequest request) async {
    final response = await _apiClient.post<Map<String, dynamic>>(
      ApiEndpoints.refreshToken,
      data: request.toJson(),
    );
    return response.data!;
  }

  @override
  Future<void> logout(RefreshTokenRequest request) async {
    await _apiClient.post(
      ApiEndpoints.logout,
      data: request.toJson(),
    );
  }

  @override
  Future<void> forgotPassword(String email) async {
    await _apiClient.post(
      ApiEndpoints.forgotPassword,
      data: {'email': email},
    );
  }

  @override
  Future<void> resetPassword(ResetPasswordRequest request) async {
    await _apiClient.post(
      ApiEndpoints.resetPassword,
      data: request.toJson(),
    );
  }

  @override
  Future<UserModel> getCurrentUser() async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      ApiEndpoints.me,
    );
    return UserModel.fromJson(response.data!);
  }

  @override
  Future<UserModel> updateProfile({String? name, String? avatarUrl}) async {
    final response = await _apiClient.patch<Map<String, dynamic>>(
      ApiEndpoints.me,
      data: {
        if (name != null) 'name': name,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
      },
    );
    return UserModel.fromJson(response.data!);
  }
}
