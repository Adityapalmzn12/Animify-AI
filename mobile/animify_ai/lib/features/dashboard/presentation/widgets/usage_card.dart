import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class UsageCard extends ConsumerWidget {
  const UsageCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final subscription = user?.subscription;
    final usage = user?.usage;

    final videosUsed = usage?.videosUsed ?? 0;
    final videosLimit = subscription?.videoLimit ?? 3;
    final minutesUsed = usage?.minutesUsed ?? 0;
    final minutesLimit = subscription?.minutesLimit ?? 0;

    final videosProgress = videosLimit > 0 ? videosUsed / videosLimit : 0.0;
    final minutesProgress = minutesLimit > 0 ? minutesUsed / minutesLimit : 0.0;

    final isPremium = subscription?.planType == 'premium';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isPremium ? 'Premium Plan' : 'Free Trial',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    isPremium 
                        ? 'Unlimited creativity awaits' 
                        : '${videosLimit - videosUsed} videos remaining',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.8),
                        ),
                  ),
                ],
              ),
              if (!isPremium)
                TextButton(
                  onPressed: () => context.go(AppRoutes.subscription),
                  style: TextButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                  child: const Text('Upgrade'),
                ),
            ],
          ),
          const SizedBox(height: 20),
          _buildProgressBar(
            context,
            label: 'Videos',
            value: '$videosUsed / $videosLimit',
            progress: videosProgress,
          ),
          if (minutesLimit > 0) ...[
            const SizedBox(height: 12),
            _buildProgressBar(
              context,
              label: 'Minutes',
              value: '${minutesUsed.toStringAsFixed(1)} / $minutesLimit min',
              progress: minutesProgress,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildProgressBar(
    BuildContext context, {
    required String label,
    required String value,
    required double progress,
  }) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.8),
                  ),
            ),
            Text(
              value,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress.clamp(0.0, 1.0),
            backgroundColor: Colors.white.withValues(alpha: 0.3),
            valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
            minHeight: 6,
          ),
        ),
      ],
    );
  }
}
