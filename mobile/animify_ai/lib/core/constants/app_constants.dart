abstract class AppConstants {
  static const String appName = 'Animify AI';
  static const String appTagline = 'Turn Any Video Into Animated Magic';
  
  static const String apiVersion = 'v1';
  
  static const int maxUploadSizeBytes = 52428800; // 50 MB
  static const int maxVideoDurationSeconds = 180; // 3 minutes
  
  static const List<String> allowedVideoFormats = [
    'mp4',
    'mov',
    'm4v',
    'hevc',
    'heic',
    'avi',
    'webm',
    'mkv',
  ];
  
  static const List<String> allowedVideoMimeTypes = [
    'video/mp4',
    'video/quicktime',
    'video/x-m4v',
    'video/hevc',
    'video/mp4v-es',
    'image/heic', // some iOS exports label HEVC containers this way
    'image/heif',
    'video/x-msvideo',
    'video/webm',
    'video/x-matroska',
  ];
  
  static const Duration accessTokenExpiry = Duration(minutes: 15);
  static const Duration refreshTokenExpiry = Duration(days: 7);
  
  static const Duration otpExpiry = Duration(minutes: 5);
  static const int otpMaxAttempts = 3;
  
  static const int paginationDefaultLimit = 20;
  static const int paginationMaxLimit = 100;
  
  static const Duration animationDuration = Duration(milliseconds: 300);
  static const Duration snackbarDuration = Duration(seconds: 3);
  
  static const double borderRadius = 12.0;
  static const double borderRadiusLarge = 16.0;
  static const double borderRadiusSmall = 8.0;
  
  static const double padding = 16.0;
  static const double paddingLarge = 24.0;
  static const double paddingSmall = 8.0;
}

abstract class StorageKeys {
  static const String accessToken = 'access_token';
  static const String refreshToken = 'refresh_token';
  static const String user = 'user';
  static const String theme = 'theme';
  static const String locale = 'locale';
  static const String onboardingCompleted = 'onboarding_completed';
  static const String fcmToken = 'fcm_token';
}

abstract class ApiEndpoints {
  static const String auth = '/auth';
  static const String users = '/users';
  static const String videos = '/videos';
  static const String templates = '/templates';
  static const String subscriptions = '/subscriptions';
  static const String payments = '/payments';
  static const String notifications = '/notifications';
  static const String admin = '/admin';
  
  static const String projects = '/projects';
  static const String generator = '/generator';
  static const String credits = '/credits';
  
  static const String login = '$auth/login';
  static const String register = '$auth/register';
  static const String googleAuth = '$auth/google';
  static const String sendOtp = '$auth/send-otp';
  static const String verifyOtp = '$auth/verify-otp';
  static const String refreshToken = '$auth/refresh';
  static const String logout = '$auth/logout';
  static const String forgotPassword = '$auth/forgot-password';
  static const String resetPassword = '$auth/reset-password';
  
  static const String me = '$users/me';
  
  static const String projectsList = projects;
  static const String creditsBalance = '$credits/balance';
  static const String creditsLedger = '$credits/ledger';
  static const String paymentsPromo = '$payments/promo';
  static const String generatorJobs = generator;
  static const String studio = '/studio';
  static const String studioModes = '$studio/modes';
  static const String studioGenerate = '$studio/generate';
  static const String imagesGenerate = '/images/generate';
  static const String scriptsGenerate = '/scripts/generate';
  static const String adminMetrics = '$admin/metrics';
  
  static const String videoUploadUrl = '$videos/upload-url';
  static const String videoConfirmUpload = '$videos/confirm-upload';
  static const String videoJobs = videos;
  
  static const String templateCategories = '$templates/categories';
  
  static const String subscriptionPlans = '$subscriptions/plans';
  static const String subscriptionCurrent = '$subscriptions/current';
  static const String subscribe = '$subscriptions/subscribe';
  static const String cancelSubscription = '$subscriptions/cancel';
}
