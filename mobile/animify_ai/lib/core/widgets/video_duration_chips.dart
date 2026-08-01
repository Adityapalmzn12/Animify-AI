import 'package:flutter/material.dart';

import 'themed_choice_chip.dart';

/// Shared 10 / 30 / 60 second picker for every video generate screen.
class VideoDurationChips extends StatelessWidget {
  static const options = [10, 30, 60];

  final int value;
  final ValueChanged<int> onChanged;
  /// Optional map like {10: 25, 30: 49, 60: 94} from GET /credits/pricing
  final Map<int, int>? creditsByDuration;

  const VideoDurationChips({
    super.key,
    required this.value,
    required this.onChanged,
    this.creditsByDuration,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Duration', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: options.map((d) {
            final credits = creditsByDuration?[d];
            final label = credits != null ? '${d}s · $credits cr' : '${d}s';
            return ThemedChoiceChip(
              label: label,
              selected: value == d,
              onSelected: (_) => onChanged(d),
            );
          }).toList(),
        ),
        const SizedBox(height: 4),
        Text(
          creditsByDuration != null && creditsByDuration![value] != null
              ? 'This video uses ${creditsByDuration![value]} credits (scenes + voice).'
              : 'Voice narration is generated automatically for the full length.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      ],
    );
  }
}
