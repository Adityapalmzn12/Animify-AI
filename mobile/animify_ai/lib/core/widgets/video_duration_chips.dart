import 'package:flutter/material.dart';

import 'themed_choice_chip.dart';

/// Shared 15 / 30 / 59 second picker for every video generate screen.
class VideoDurationChips extends StatelessWidget {
  static const options = [15, 30, 59];

  final int value;
  final ValueChanged<int> onChanged;

  const VideoDurationChips({
    super.key,
    required this.value,
    required this.onChanged,
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
          children: options
              .map(
                (d) => ThemedChoiceChip(
                  label: '${d}s',
                  selected: value == d,
                  onSelected: (_) => onChanged(d),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 4),
        Text(
          'Voice narration is generated automatically for the full length.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      ],
    );
  }
}
