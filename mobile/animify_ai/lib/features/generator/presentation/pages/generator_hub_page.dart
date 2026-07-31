import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors.dart';

class GeneratorHubPage extends StatelessWidget {
  const GeneratorHubPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final tools = [
      _GeneratorTool(
        title: 'Creative Studio',
        subtitle: 'Logo · Fashion · Ghibli · Brand',
        icon: Icons.auto_awesome_mosaic,
        gradient: AppColors.primaryGradient,
        route: AppRoutes.creativeStudio,
      ),
      _GeneratorTool(
        title: 'Prompt → Video',
        subtitle: 'Text to cinematic AI video',
        icon: Icons.movie_creation_outlined,
        gradient: AppColors.accentGradient,
        route: AppRoutes.generatorTextToVideo,
      ),
      _GeneratorTool(
        title: 'Image → Video',
        subtitle: 'Animate a still image',
        icon: Icons.image_outlined,
        gradient: AppColors.primaryGradient,
        route: AppRoutes.generatorImageToVideo,
      ),
      _GeneratorTool(
        title: 'Ghibli / Anime',
        subtitle: 'OpenAI image styles',
        icon: Icons.brush_outlined,
        gradient: AppColors.accentGradient,
        route: '${AppRoutes.imageGen}?style=ghibli',
      ),
      _GeneratorTool(
        title: 'Logo Maker',
        subtitle: 'Company & startup logos',
        icon: Icons.hexagon_outlined,
        gradient: AppColors.primaryGradient,
        route: '${AppRoutes.creativeStudio}?mode=logo',
      ),
      _GeneratorTool(
        title: 'Fashion Design',
        subtitle: 'Designer clothing concepts',
        icon: Icons.checkroom_outlined,
        gradient: AppColors.accentGradient,
        route: '${AppRoutes.creativeStudio}?mode=fashion',
      ),
      _GeneratorTool(
        title: 'AI Image',
        subtitle: 'Any style from a prompt',
        icon: Icons.photo_filter,
        gradient: AppColors.primaryGradient,
        route: AppRoutes.imageGen,
      ),
      _GeneratorTool(
        title: 'Script Writer',
        subtitle: 'Reels, ads, YouTube',
        icon: Icons.description_outlined,
        gradient: AppColors.accentGradient,
        route: AppRoutes.scriptWriter,
      ),
      _GeneratorTool(
        title: 'Stylize Clip',
        subtitle: 'Upload video → cartoon',
        icon: Icons.animation,
        gradient: AppColors.primaryGradient,
        route: AppRoutes.videoUpload,
      ),
    ];

    return Scaffold(
      appBar: AppBar(title: Text(l10n.generate)),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.0,
        ),
        itemCount: tools.length,
        itemBuilder: (context, index) {
          final tool = tools[index];
          return _GeneratorCard(
            tool: tool,
            onTap: () => context.push(tool.route),
          );
        },
      ),
    );
  }
}

class _GeneratorTool {
  final String title;
  final String subtitle;
  final IconData icon;
  final Gradient gradient;
  final String route;

  const _GeneratorTool({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.gradient,
    required this.route,
  });
}

class _GeneratorCard extends StatelessWidget {
  final _GeneratorTool tool;
  final VoidCallback onTap;

  const _GeneratorCard({required this.tool, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  gradient: tool.gradient,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(tool.icon, color: Colors.white),
              ),
              const Spacer(),
              Text(
                tool.title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                tool.subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
