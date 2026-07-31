import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/auth/presentation/pages/register_page.dart';
import '../../features/auth/presentation/pages/otp_verification_page.dart';
import '../../features/auth/presentation/pages/forgot_password_page.dart';
import '../../features/auth/presentation/pages/reset_password_page.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/dashboard/presentation/pages/dashboard_page.dart';
import '../../features/videos/presentation/pages/videos_page.dart';
import '../../features/videos/presentation/pages/video_upload_page.dart';
import '../../features/videos/presentation/pages/video_detail_page.dart';
import '../../features/templates/presentation/pages/templates_page.dart';
import '../../features/subscription/presentation/pages/subscription_page.dart';
import '../../features/settings/presentation/pages/settings_page.dart';
import '../../features/profile/presentation/pages/profile_page.dart';
import '../../features/notifications/presentation/pages/notifications_page.dart';
import '../../features/projects/presentation/pages/projects_page.dart';
import '../../features/projects/presentation/pages/project_detail_page.dart';
import '../../features/generator/presentation/pages/generator_hub_page.dart';
import '../../features/generator/presentation/pages/text_to_video_page.dart';
import '../../features/generator/presentation/pages/image_to_video_page.dart';
import '../../features/generator/presentation/pages/creative_studio_page.dart';
import '../../features/generator/presentation/pages/image_gen_page.dart';
import '../../features/generator/presentation/pages/script_writer_page.dart';
import '../../features/wallet/presentation/pages/wallet_page.dart';
import '../../features/admin/presentation/pages/admin_dashboard_page.dart';
import '../widgets/main_scaffold.dart';

abstract class AppRoutes {
  static const String splash = '/';
  static const String onboarding = '/onboarding';
  
  static const String login = '/login';
  static const String register = '/register';
  static const String forgotPassword = '/forgot-password';
  static const String otpVerification = '/otp-verification';
  static const String resetPassword = '/reset-password';
  
  static const String dashboard = '/dashboard';
  static const String videos = '/videos';
  static const String videoUpload = '/videos/upload';
  static const String videoDetail = '/videos/:id';
  static const String templates = '/templates';
  static const String subscription = '/subscription';
  static const String settings = '/settings';
  static const String profile = '/profile';
  static const String notifications = '/notifications';

  static const String projects = '/projects';
  static const String projectDetail = '/projects/:id';
  static const String generator = '/generator';
  static const String generatorTextToVideo = '/generator/text-to-video';
  static const String generatorImageToVideo = '/generator/image-to-video';
  static const String creativeStudio = '/generator/studio';
  static const String imageGen = '/generator/image';
  static const String scriptWriter = '/generator/script';
  static const String wallet = '/wallet';
  
  static const String admin = '/admin';
  static const String adminDashboard = '/admin/dashboard';
  static const String adminUsers = '/admin/users';
}

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);
  
  return GoRouter(
    initialLocation: AppRoutes.login,
    debugLogDiagnostics: true,
    refreshListenable: GoRouterRefreshStream(
      ref.watch(authStateProvider.notifier).authStream,
    ),
    redirect: (context, state) {
      final isLoggedIn = authState.valueOrNull?.isAuthenticated ?? false;
      final isAuthRoute = state.matchedLocation == AppRoutes.login ||
          state.matchedLocation == AppRoutes.register ||
          state.matchedLocation == AppRoutes.forgotPassword ||
          state.matchedLocation == AppRoutes.resetPassword ||
          state.matchedLocation.startsWith(AppRoutes.otpVerification);

      if (!isLoggedIn && !isAuthRoute) {
        return AppRoutes.login;
      }

      if (isLoggedIn && isAuthRoute) {
        return AppRoutes.dashboard;
      }

      return null;
    },
    routes: [
      GoRoute(
        path: AppRoutes.login,
        name: 'login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: AppRoutes.register,
        name: 'register',
        builder: (context, state) => const RegisterPage(),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        name: 'forgotPassword',
        builder: (context, state) => const ForgotPasswordPage(),
      ),
      GoRoute(
        path: AppRoutes.otpVerification,
        name: 'otpVerification',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return OtpVerificationPage(
            email: extra?['email'] ?? '',
            purpose: extra?['purpose'] ?? 'login',
          );
        },
      ),
      GoRoute(
        path: AppRoutes.resetPassword,
        name: 'resetPassword',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return ResetPasswordPage(
            email: extra?['email'] ?? '',
            otp: extra?['otp'] ?? '',
          );
        },
      ),
      ShellRoute(
        builder: (context, state, child) => MainScaffold(child: child),
        routes: [
          GoRoute(
            path: AppRoutes.dashboard,
            name: 'dashboard',
            pageBuilder: (context, state) => NoTransitionPage(
              child: const DashboardPage(),
            ),
          ),
          GoRoute(
            path: AppRoutes.videos,
            name: 'videos',
            pageBuilder: (context, state) => NoTransitionPage(
              child: const VideosPage(),
            ),
            routes: [
              GoRoute(
                path: 'upload',
                name: 'videoUpload',
                builder: (context, state) => const VideoUploadPage(),
              ),
              GoRoute(
                path: ':id',
                name: 'videoDetail',
                builder: (context, state) => VideoDetailPage(
                  videoId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: AppRoutes.templates,
            name: 'templates',
            pageBuilder: (context, state) => NoTransitionPage(
              child: const TemplatesPage(),
            ),
          ),
          GoRoute(
            path: AppRoutes.subscription,
            name: 'subscription',
            pageBuilder: (context, state) => NoTransitionPage(
              child: const SubscriptionPage(),
            ),
          ),
          GoRoute(
            path: AppRoutes.settings,
            name: 'settings',
            pageBuilder: (context, state) => NoTransitionPage(
              child: const SettingsPage(),
            ),
          ),
          GoRoute(
            path: AppRoutes.projects,
            name: 'projects',
            pageBuilder: (context, state) => NoTransitionPage(
              child: const ProjectsPage(),
            ),
            routes: [
              GoRoute(
                path: ':id',
                name: 'projectDetail',
                builder: (context, state) => ProjectDetailPage(
                  projectId: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: AppRoutes.generator,
            name: 'generator',
            pageBuilder: (context, state) => NoTransitionPage(
              child: const GeneratorHubPage(),
            ),
            routes: [
              GoRoute(
                path: 'text-to-video',
                name: 'generatorTextToVideo',
                builder: (context, state) => const TextToVideoPage(),
              ),
              GoRoute(
                path: 'image-to-video',
                name: 'generatorImageToVideo',
                builder: (context, state) => const ImageToVideoPage(),
              ),
              GoRoute(
                path: 'studio',
                name: 'creativeStudio',
                builder: (context, state) => CreativeStudioPage(
                  initialMode: state.uri.queryParameters['mode'],
                ),
              ),
              GoRoute(
                path: 'image',
                name: 'imageGen',
                builder: (context, state) => ImageGenPage(
                  initialStyle:
                      state.uri.queryParameters['style'] ?? 'ghibli',
                ),
              ),
              GoRoute(
                path: 'script',
                name: 'scriptWriter',
                builder: (context, state) => const ScriptWriterPage(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.profile,
        name: 'profile',
        builder: (context, state) => const ProfilePage(),
      ),
      GoRoute(
        path: AppRoutes.notifications,
        name: 'notifications',
        builder: (context, state) => const NotificationsPage(),
      ),
      GoRoute(
        path: AppRoutes.wallet,
        name: 'wallet',
        builder: (context, state) => const WalletPage(),
      ),
      GoRoute(
        path: AppRoutes.adminDashboard,
        name: 'adminDashboard',
        builder: (context, state) => const AdminDashboardPage(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64),
            const SizedBox(height: 16),
            Text(
              'Page not found',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              state.error?.toString() ?? 'Unknown error',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.go(AppRoutes.dashboard),
              child: const Text('Go to Dashboard'),
            ),
          ],
        ),
      ),
    ),
  );
});

class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
