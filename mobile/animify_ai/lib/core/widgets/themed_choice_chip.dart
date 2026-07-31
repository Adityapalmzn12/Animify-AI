import 'package:flutter/material.dart';

/// ChoiceChip that always follows ColorScheme (light/dark).
class ThemedChoiceChip extends StatelessWidget {
  final String label;
  final bool selected;
  final ValueChanged<bool>? onSelected;

  const ThemedChoiceChip({
    super.key,
    required this.label,
    required this.selected,
    this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: onSelected,
      showCheckmark: false,
      backgroundColor: scheme.surfaceContainerHighest,
      selectedColor: scheme.primaryContainer,
      side: BorderSide(
        color: selected ? scheme.primary : scheme.outlineVariant,
      ),
      labelStyle: TextStyle(
        color: selected ? scheme.onPrimaryContainer : scheme.onSurface,
        fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
      ),
    );
  }
}
