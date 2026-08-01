import 'package:flutter/material.dart';

import 'themed_choice_chip.dart';

class QualityTierOption {
  final String id;
  final String name;
  final String tagline;
  final Map<int, int> videoCredits;
  final int imageCredits;
  final bool isDefault;

  const QualityTierOption({
    required this.id,
    required this.name,
    required this.tagline,
    required this.videoCredits,
    required this.imageCredits,
    this.isDefault = false,
  });
}

/// Economy (default/cheap) · Standard · Premium
class QualityTierChips extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;
  final List<QualityTierOption> tiers;
  final int? durationSec;

  const QualityTierChips({
    super.key,
    required this.value,
    required this.onChanged,
    required this.tiers,
    this.durationSec,
  });

  @override
  Widget build(BuildContext context) {
    final list = tiers.isEmpty
        ? const [
            QualityTierOption(
              id: 'economy',
              name: 'Economy',
              tagline: 'Cheapest',
              videoCredits: {10: 15, 30: 29, 60: 55},
              imageCredits: 3,
              isDefault: true,
            ),
            QualityTierOption(
              id: 'standard',
              name: 'Standard',
              tagline: 'Balanced',
              videoCredits: {10: 45, 30: 119, 60: 229},
              imageCredits: 4,
            ),
            QualityTierOption(
              id: 'premium',
              name: 'Premium',
              tagline: 'Cinema',
              videoCredits: {10: 249, 30: 699, 60: 1299},
              imageCredits: 8,
            ),
          ]
        : tiers;

    final selected = list.firstWhere(
      (t) => t.id == value,
      orElse: () => list.first,
    );
    final dur = durationSec ?? 30;
    final credits = selected.videoCredits[dur];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Quality', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: list.map((t) {
            final c = t.videoCredits[dur];
            final label = c != null ? '${t.name} · $c cr' : t.name;
            return ThemedChoiceChip(
              label: label,
              selected: t.id == value,
              onSelected: (_) => onChanged(t.id),
            );
          }).toList(),
        ),
        const SizedBox(height: 4),
        Text(
          credits != null
              ? '${selected.tagline} — this create uses $credits credits.'
              : selected.tagline,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      ],
    );
  }
}
