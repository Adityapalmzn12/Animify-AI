import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/widgets/quality_tier_chips.dart';

class CreditPricing {
  final Map<String, int> byModule;
  final Map<int, int> videoCredits;
  final List<Map<String, dynamic>> modules;
  final List<QualityTierOption> tiers;
  final String defaultTier;

  const CreditPricing({
    required this.byModule,
    required this.videoCredits,
    required this.modules,
    required this.tiers,
    required this.defaultTier,
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
          modules.add(Map<String, dynamic>.from(item));
        }
      }
    }

    final tiers = <QualityTierOption>[];
    final rawTiers = json['tiers'];
    if (rawTiers is List) {
      for (final item in rawTiers) {
        if (item is! Map) continue;
        final m = Map<String, dynamic>.from(item);
        final sc = (m['storyCredits'] as Map?)?.cast<String, dynamic>() ?? {};
        final v = (m['video'] as Map?)?.cast<String, dynamic>() ?? {};
        tiers.add(
          QualityTierOption(
            id: m['id']?.toString() ?? 'economy',
            name: m['name']?.toString() ?? 'Economy',
            tagline: m['tagline']?.toString() ?? '',
            isDefault: m['default'] == true,
            imageCredits: (m['imageCredits'] as num?)?.toInt() ?? 3,
            videoCredits: {
              10: (sc['10'] as num?)?.toInt() ??
                  (v['10s'] as num?)?.toInt() ??
                  15,
              30: (sc['30'] as num?)?.toInt() ??
                  (v['30s'] as num?)?.toInt() ??
                  29,
              60: (sc['60'] as num?)?.toInt() ??
                  (v['60s'] as num?)?.toInt() ??
                  55,
            },
          ),
        );
      }
    }

    final defaultFromList = tiers.where((t) => t.isDefault).toList();
    final defaultTier = json['defaultTier']?.toString() ??
        (defaultFromList.isNotEmpty ? defaultFromList.first.id : 'economy');

    final ecoList = tiers.where((t) => t.id == defaultTier).toList();
    final eco = ecoList.isNotEmpty
        ? ecoList.first
        : (tiers.isNotEmpty ? tiers.first : null);

    return CreditPricing(
      byModule: byModule,
      videoCredits: eco?.videoCredits ??
          {
            10: (video['10s'] as num?)?.toInt() ?? 15,
            30: (video['30s'] as num?)?.toInt() ?? 29,
            60: (video['60s'] as num?)?.toInt() ?? 55,
          },
      modules: modules,
      tiers: tiers,
      defaultTier: defaultTier,
    );
  }
}

final creditPricingProvider = FutureProvider<CreditPricing>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<Map<String, dynamic>>('/credits/pricing');
  return CreditPricing.fromJson(res.data ?? {});
});
