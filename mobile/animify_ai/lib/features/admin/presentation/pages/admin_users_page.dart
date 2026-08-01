import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/widgets/async_state_views.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

final adminUsersProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<dynamic>('/admin/users', queryParameters: {
    'page': 1,
    'limit': 50,
  });
  final data = res.data;
  final list = data is Map && data['items'] is List
      ? data['items'] as List
      : data is Map && data['data'] is Map && data['data']['items'] is List
          ? data['data']['items'] as List
          : <dynamic>[];
  return list
      .whereType<Map>()
      .map((e) => Map<String, dynamic>.from(e))
      .toList();
});

class AdminUsersPage extends ConsumerStatefulWidget {
  const AdminUsersPage({super.key});

  @override
  ConsumerState<AdminUsersPage> createState() => _AdminUsersPageState();
}

class _AdminUsersPageState extends ConsumerState<AdminUsersPage> {
  Future<void> _grantCredits(String userId, String email) async {
    final controller = TextEditingController(text: '100');
    final amount = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Grant credits to $email'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Credits'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(ctx, int.tryParse(controller.text.trim())),
            child: const Text('Grant'),
          ),
        ],
      ),
    );
    if (amount == null || amount < 1) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.post(
        '/admin/users/$userId/credits',
        data: {'amount': amount, 'reason': 'Admin grant'},
      );
      ref.invalidate(adminUsersProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Granted $amount credits')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Grant failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final usersAsync = ref.watch(adminUsersProvider);

    if (user?.role != 'ADMIN') {
      return Scaffold(
        appBar: AppBar(title: const Text('Users')),
        body: const EmptyState(
          icon: Icons.lock_outline,
          title: 'Access denied',
          message: 'Admin only',
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Users & Credits')),
      body: usersAsync.when(
        loading: () => const SkeletonList(itemCount: 8),
        error: (e, _) => ErrorState(
          title: 'Failed to load users',
          message: e.toString(),
          onRetry: () => ref.invalidate(adminUsersProvider),
        ),
        data: (users) {
          if (users.isEmpty) {
            return const EmptyState(
              icon: Icons.people_outline,
              title: 'No users',
              message: 'Users will appear here.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(adminUsersProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: users.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final u = users[i];
                final email = u['email']?.toString() ?? '';
                final balance = u['creditBalance'] ?? u['credit_balance'] ?? 0;
                final plan = (u['subscription'] is Map)
                    ? (u['subscription'] as Map)['planType']?.toString()
                    : null;
                return Card(
                  child: ListTile(
                    title: Text(u['name']?.toString() ?? email),
                    subtitle: Text(
                      '$email\nCredits: $balance · Plan: ${plan ?? 'free'}',
                    ),
                    isThreeLine: true,
                    trailing: IconButton(
                      icon: const Icon(Icons.add_card_outlined),
                      tooltip: 'Grant credits',
                      onPressed: () => _grantCredits(
                        u['id'].toString(),
                        email,
                      ),
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
