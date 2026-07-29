import 'package:envied/envied.dart';

part 'env_config.g.dart';

enum Environment {
  development,
  staging,
  production,
}

@Envied(path: '.env')
abstract class EnvConfig {
  @EnviedField(varName: 'API_BASE_URL', defaultValue: 'http://192.168.1.36:3000/api/v1')
  static const String apiBaseUrl = _EnvConfig.apiBaseUrl;

  @EnviedField(varName: 'WS_BASE_URL', defaultValue: 'ws://192.168.1.36:3000')
  static const String wsBaseUrl = _EnvConfig.wsBaseUrl;

  @EnviedField(varName: 'GOOGLE_CLIENT_ID', defaultValue: '')
  static const String googleClientId = _EnvConfig.googleClientId;

  @EnviedField(varName: 'RAZORPAY_KEY_ID', defaultValue: '')
  static const String razorpayKeyId = _EnvConfig.razorpayKeyId;

  @EnviedField(varName: 'ENVIRONMENT', defaultValue: 'development')
  static const String environment = _EnvConfig.environment;
}

class AppConfig {
  final String apiBaseUrl;
  final String wsBaseUrl;
  final String googleClientId;
  final String razorpayKeyId;
  final Environment environment;
  final bool enableLogging;
  final bool enableCrashlytics;

  const AppConfig({
    required this.apiBaseUrl,
    required this.wsBaseUrl,
    required this.googleClientId,
    required this.razorpayKeyId,
    required this.environment,
    required this.enableLogging,
    required this.enableCrashlytics,
  });

  factory AppConfig.development() {
    // Use your local IP for testing on physical devices over WiFi
    // Change this IP to match your machine's WiFi IP address
    return const AppConfig(
      apiBaseUrl: 'http://192.168.1.36:3000/api/v1',
      wsBaseUrl: 'ws://192.168.1.36:3000',
      googleClientId: '',
      razorpayKeyId: 'rzp_test_',
      environment: Environment.development,
      enableLogging: true,
      enableCrashlytics: false,
    );
  }

  factory AppConfig.staging() {
    return const AppConfig(
      apiBaseUrl: 'https://staging-api.animify.ai/api/v1',
      wsBaseUrl: 'wss://staging-api.animify.ai',
      googleClientId: '',
      razorpayKeyId: 'rzp_test_',
      environment: Environment.staging,
      enableLogging: true,
      enableCrashlytics: true,
    );
  }

  factory AppConfig.production() {
    return const AppConfig(
      apiBaseUrl: 'https://zoological-commitment-production-2ef6.up.railway.app/api/v1',
      wsBaseUrl: 'wss://zoological-commitment-production-2ef6.up.railway.app',
      googleClientId: '',
      razorpayKeyId: 'rzp_live_',
      environment: Environment.production,
      enableLogging: true,
      enableCrashlytics: true,
    );
  }

  factory AppConfig.fromEnvironment(String env) {
    switch (env.toLowerCase()) {
      case 'production':
      case 'prod':
        return AppConfig.production();
      case 'staging':
      case 'stage':
        return AppConfig.staging();
      default:
        return AppConfig.development();
    }
  }

  bool get isDevelopment => environment == Environment.development;
  bool get isStaging => environment == Environment.staging;
  bool get isProduction => environment == Environment.production;
}
