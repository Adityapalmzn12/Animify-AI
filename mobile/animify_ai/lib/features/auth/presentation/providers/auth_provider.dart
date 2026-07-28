import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/errors/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../data/datasources/auth_local_datasource.dart';
import '../../data/datasources/auth_remote_datasource.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';

final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError('Initialize in main.dart');
});

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );
});

final authLocalDataSourceProvider = Provider<AuthLocalDataSource>((ref) {
  return AuthLocalDataSourceImpl(
    ref.watch(secureStorageProvider),
    ref.watch(sharedPreferencesProvider),
  );
});

final authRemoteDataSourceProvider = Provider<AuthRemoteDataSource>((ref) {
  return AuthRemoteDataSourceImpl(ref.watch(apiClientProvider));
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(
    ref.watch(authRemoteDataSourceProvider),
    ref.watch(authLocalDataSourceProvider),
  );
});

final googleSignInProvider = Provider<GoogleSignIn>((ref) {
  return GoogleSignIn(scopes: ['email', 'profile']);
});

final authStateProvider =
    StateNotifierProvider<AuthStateNotifier, AsyncValue<AuthState>>((ref) {
  return AuthStateNotifier(
    ref.watch(authRepositoryProvider),
    ref.watch(googleSignInProvider),
  );
});

class AuthStateNotifier extends StateNotifier<AsyncValue<AuthState>> {
  final AuthRepository _repository;
  final GoogleSignIn _googleSignIn;
  final _streamController = StreamController<AuthState>.broadcast();

  AuthStateNotifier(this._repository, this._googleSignIn)
      : super(const AsyncValue.loading()) {
    _init();
  }

  Stream<AuthState> get authStream => _streamController.stream;

  Future<void> _init() async {
    final isLoggedIn = await _repository.isLoggedIn();
    
    if (isLoggedIn) {
      final result = await _repository.getCurrentUser();
      result.fold(
        (failure) {
          state = const AsyncValue.data(AuthState.unauthenticated());
          _streamController.add(const AuthState.unauthenticated());
        },
        (user) {
          final authState = AuthState.authenticated(
            user: user,
            tokens: const AuthTokens(
              accessToken: '',
              refreshToken: '',
              expiresIn: 0,
            ),
          );
          state = AsyncValue.data(authState);
          _streamController.add(authState);
        },
      );
    } else {
      state = const AsyncValue.data(AuthState.unauthenticated());
      _streamController.add(const AuthState.unauthenticated());
    }
  }

  Future<void> login({
    required String email,
    required String password,
  }) async {
    state = const AsyncValue.loading();
    
    final result = await _repository.login(email: email, password: password);
    
    result.fold(
      (failure) {
        state = AsyncValue.data(AuthState.error(message: failure.displayMessage));
        _streamController.add(AuthState.error(message: failure.displayMessage));
      },
      (data) {
        final authState = AuthState.authenticated(user: data.$1, tokens: data.$2);
        state = AsyncValue.data(authState);
        _streamController.add(authState);
      },
    );
  }

  Future<void> register({
    required String email,
    required String password,
    required String name,
  }) async {
    state = const AsyncValue.loading();
    
    final result = await _repository.register(
      email: email,
      password: password,
      name: name,
    );
    
    result.fold(
      (failure) {
        state = AsyncValue.data(AuthState.error(message: failure.displayMessage));
        _streamController.add(AuthState.error(message: failure.displayMessage));
      },
      (data) {
        final authState = AuthState.authenticated(user: data.$1, tokens: data.$2);
        state = AsyncValue.data(authState);
        _streamController.add(authState);
      },
    );
  }

  Future<void> signInWithGoogle() async {
    state = const AsyncValue.loading();
    
    try {
      final googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        state = const AsyncValue.data(AuthState.unauthenticated());
        _streamController.add(const AuthState.unauthenticated());
        return;
      }

      final googleAuth = await googleUser.authentication;
      final idToken = googleAuth.idToken;
      
      if (idToken == null) {
        state = const AsyncValue.data(
          AuthState.error(message: 'Failed to get Google ID token'),
        );
        return;
      }

      final result = await _repository.googleSignIn(idToken: idToken);
      
      result.fold(
        (failure) {
          state = AsyncValue.data(AuthState.error(message: failure.displayMessage));
          _streamController.add(AuthState.error(message: failure.displayMessage));
        },
        (data) {
          final authState = AuthState.authenticated(user: data.$1, tokens: data.$2);
          state = AsyncValue.data(authState);
          _streamController.add(authState);
        },
      );
    } catch (e) {
      state = AsyncValue.data(AuthState.error(message: e.toString()));
      _streamController.add(AuthState.error(message: e.toString()));
    }
  }

  Future<void> sendOtp({
    required String email,
    required String purpose,
  }) async {
    final result = await _repository.sendOtp(email: email, purpose: purpose);
    
    result.fold(
      (failure) {
        state = AsyncValue.data(AuthState.error(message: failure.displayMessage));
      },
      (_) {},
    );
  }

  Future<void> verifyOtp({
    required String email,
    required String otp,
    required String purpose,
  }) async {
    state = const AsyncValue.loading();
    
    final result = await _repository.verifyOtp(
      email: email,
      otp: otp,
      purpose: purpose,
    );
    
    result.fold(
      (failure) {
        state = AsyncValue.data(AuthState.error(message: failure.displayMessage));
        _streamController.add(AuthState.error(message: failure.displayMessage));
      },
      (data) {
        final authState = AuthState.authenticated(user: data.$1, tokens: data.$2);
        state = AsyncValue.data(authState);
        _streamController.add(authState);
      },
    );
  }

  Future<void> logout() async {
    state = const AsyncValue.loading();
    
    await _googleSignIn.signOut();
    await _repository.logout(refreshToken: '');
    
    state = const AsyncValue.data(AuthState.unauthenticated());
    _streamController.add(const AuthState.unauthenticated());
  }

  Future<void> refreshUser() async {
    final result = await _repository.getCurrentUser();
    
    result.fold(
      (failure) {},
      (user) {
        final currentState = state.valueOrNull;
        currentState?.maybeMap(
          authenticated: (auth) {
            final authState = AuthState.authenticated(
              user: user,
              tokens: auth.tokens,
            );
            state = AsyncValue.data(authState);
            _streamController.add(authState);
          },
          orElse: () {},
        );
      },
    );
  }

  @override
  void dispose() {
    _streamController.close();
    super.dispose();
  }
}

final currentUserProvider = Provider<UserEntity?>((ref) {
  final authState = ref.watch(authStateProvider);
  return authState.valueOrNull?.user;
});

final isAuthenticatedProvider = Provider<bool>((ref) {
  final authState = ref.watch(authStateProvider);
  return authState.valueOrNull?.isAuthenticated ?? false;
});
