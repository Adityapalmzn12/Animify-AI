import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/widgets/app_text_field.dart';

class TemplatesPage extends ConsumerStatefulWidget {
  const TemplatesPage({super.key});

  @override
  ConsumerState<TemplatesPage> createState() => _TemplatesPageState();
}

class _TemplatesPageState extends ConsumerState<TemplatesPage> {
  final _searchController = TextEditingController();
  String _selectedCategory = 'all';

  final List<Map<String, dynamic>> _categories = [
    {'id': 'all', 'name': 'All', 'icon': Icons.apps},
    {'id': 'anime', 'name': 'Anime', 'icon': Icons.animation},
    {'id': 'cartoon', 'name': 'Cartoon', 'icon': Icons.face},
    {'id': '3d', 'name': '3D', 'icon': Icons.view_in_ar},
    {'id': 'artistic', 'name': 'Artistic', 'icon': Icons.brush},
    {'id': 'realistic', 'name': 'Realistic', 'icon': Icons.photo_camera},
  ];

  final List<Map<String, dynamic>> _templates = [
    {
      'id': '1',
      'name': 'Anime Hero',
      'category': 'anime',
      'isPremium': false,
      'usageCount': 15420,
    },
    {
      'id': '2',
      'name': 'Cartoon Fun',
      'category': 'cartoon',
      'isPremium': false,
      'usageCount': 12300,
    },
    {
      'id': '3',
      'name': 'Pixar Style',
      'category': '3d',
      'isPremium': true,
      'usageCount': 8900,
    },
    {
      'id': '4',
      'name': 'Watercolor',
      'category': 'artistic',
      'isPremium': false,
      'usageCount': 6700,
    },
    {
      'id': '5',
      'name': 'Oil Painting',
      'category': 'artistic',
      'isPremium': true,
      'usageCount': 5400,
    },
    {
      'id': '6',
      'name': 'Manga Style',
      'category': 'anime',
      'isPremium': false,
      'usageCount': 11200,
    },
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _filteredTemplates {
    return _templates.where((t) {
      if (_selectedCategory != 'all' && t['category'] != _selectedCategory) {
        return false;
      }
      if (_searchController.text.isNotEmpty) {
        return (t['name'] as String)
            .toLowerCase()
            .contains(_searchController.text.toLowerCase());
      }
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Templates'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: AppSearchField(
              controller: _searchController,
              hint: 'Search templates...',
              onChanged: (_) => setState(() {}),
            ),
          ),
          SizedBox(
            height: 48,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _categories.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final category = _categories[index];
                final isSelected = _selectedCategory == category['id'];
                return FilterChip(
                  label: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        category['icon'] as IconData,
                        size: 16,
                        color: isSelected
                            ? Theme.of(context).colorScheme.onPrimaryContainer
                            : Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                      const SizedBox(width: 6),
                      Text(category['name'] as String),
                    ],
                  ),
                  selected: isSelected,
                  onSelected: (_) {
                    setState(() => _selectedCategory = category['id'] as String);
                  },
                  showCheckmark: false,
                  backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
                  selectedColor: Theme.of(context).colorScheme.primaryContainer,
                );
              },
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.all(16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 16,
                crossAxisSpacing: 16,
                childAspectRatio: 0.85,
              ),
              itemCount: _filteredTemplates.length,
              itemBuilder: (context, index) {
                final template = _filteredTemplates[index];
                return _TemplateCard(
                  name: template['name'] as String,
                  category: template['category'] as String,
                  isPremium: template['isPremium'] as bool,
                  usageCount: template['usageCount'] as int,
                  onTap: () {
                    context.push(AppRoutes.videoUpload);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _TemplateCard extends StatelessWidget {
  final String name;
  final String category;
  final bool isPremium;
  final int usageCount;
  final VoidCallback onTap;

  const _TemplateCard({
    required this.name,
    required this.category,
    required this.isPremium,
    required this.usageCount,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Theme.of(context).colorScheme.primaryContainer,
                          Theme.of(context).colorScheme.secondaryContainer,
                        ],
                      ),
                    ),
                    child: Center(
                      child: Icon(
                        _getCategoryIcon(category),
                        size: 48,
                        color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.5),
                      ),
                    ),
                  ),
                  if (isPremium)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.amber,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.star,
                              size: 12,
                              color: Colors.white,
                            ),
                            SizedBox(width: 4),
                            Text(
                              'PRO',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        Icons.people_outline,
                        size: 14,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _formatCount(usageCount),
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                            ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _getCategoryIcon(String category) {
    switch (category) {
      case 'anime':
        return Icons.animation;
      case 'cartoon':
        return Icons.face;
      case '3d':
        return Icons.view_in_ar;
      case 'artistic':
        return Icons.brush;
      case 'realistic':
        return Icons.photo_camera;
      default:
        return Icons.style;
    }
  }

  String _formatCount(int count) {
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M uses';
    }
    if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}K uses';
    }
    return '$count uses';
  }
}
