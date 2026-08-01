import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';

class CreditPricing {
  final Map<String, int> byModule;
  final Map<int, int> videoCredits;
  final List<Map<String, dynamic>> modules;

  const CreditPricing({
    required this.byModule,
    required this.videoCredits,
    required this.modules,
  });

  factory CreditPricing.fromJson(Map<String, dynamic> json) {
    final video = (json['video'] as Map?)?.cast<String, dynamic>() ?? {};
    final byModule = <String, int>{};
    final rawBy = json['byModule'];
    if (rawBy is Map) {
      rawBy.forEach((k, v) {
        byModule[k.toString()] = (v as num).toInt();
      });
    }
    final modules = <Map<String, dynamic>>[];
    final list = json['modules'];
    if (list is List) {
      for (final item in list) {
        if (item is Map) {
          final m = Map<String, dynamic>.from(item);
          modules.add(m);
          final key = m['key']?.toString();
          final credits = m['credits'];
          if (key != null && credits is num) {
            byModule[key] = credits.toInt();
          }
        }
      }
    }
    return CreditPricing(
      byModule: byModule,
      videoCredits: {
        10: (video['10s'] as num?)?.toInt() ?? byModule['STORY_10'] ?? 25,
        30: (video['30s'] as num?)?.toInt() ?? byModule['STORY_30'] ?? 50,
        60: (video['60s'] as num?)?.toInt() ?? byModule['STORY_60'] ?? 95,
      },
      modules: modules,
    );
  }
}

final creditPricingProvider = FutureProvider<CreditPricing>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<Map<String, dynamic>>('/credits/pricing');
  return CreditPricing.fromJson(res.data ?? {});
});
