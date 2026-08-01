import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/widgets/async_state_views.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

final adminMetricsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final response =
      await apiClient.get<Map<String, dynamic>>('/admin/metrics');
  return response.data ?? {};
});

class AdminDashboardPage extends ConsumerWidget {
  const AdminDashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final metricsAsync = ref.watch(adminMetricsProvider);

    if (user?.role != 'ADMIN') {
      return Scaffold(
        appBar: AppBar(title: const Text('Admin')),
        body: const EmptyState(
          icon: Icons.lock_outline,
          title: 'Access denied',
          message: 'You need admin privileges to view this page.',
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Admin Dashboard')),
      body: metricsAsync.when(
        loading: () => const SkeletonList(itemCount: 4, itemHeight: 96),
        error: (error, _) => ErrorState(
          title: 'Failed to load metrics',
          message: error.toString(),
          onRetry: () => ref.invalidate(adminMetricsProvider),
        ),
        data: (metrics) {
          if (metrics.isEmpty) {
            return const EmptyState(
              icon: Icons.analytics_outlined,
              title: 'No metrics available',
              message: 'Admin metrics endpoint returned no data.',
            );
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ListTile(
                leading: const Icon(Icons.people_outline),
                title: const Text('Manage users & grant credits'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push(AppRoutes.adminUsers),
              ),
              const Divider(),
              ...metrics.entries.map((entry) {
                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.insights),
                    title: Text(_formatKey(entry.key)),
                    trailing: Text(
                      '${entry.value}',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ),
                );
              }),
            ],
          );
        },
      ),
    );
  }

  String _formatKey(String key) {
    return key
        .replaceAllMapped(
          RegExp(r'([A-Z])'),
          (m) => ' ${m.group(0)}',
        )
        .trim()
        .split(' ')
        .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }
}
