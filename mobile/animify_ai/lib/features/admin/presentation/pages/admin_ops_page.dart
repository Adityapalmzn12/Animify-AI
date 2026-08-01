import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/widgets/async_state_views.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

final adminOpsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get<Map<String, dynamic>>('/admin/ops');
  return res.data ?? {};
});

class AdminOpsPage extends ConsumerWidget {
  const AdminOpsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final opsAsync = ref.watch(adminOpsProvider);

    if (user?.role != 'ADMIN') {
      return Scaffold(
        appBar: AppBar(title: const Text('Ops')),
        body: const EmptyState(
          icon: Icons.lock_outline,
          title: 'Access denied',
          message: 'Admin only',
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('API & Live Ops'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(adminOpsProvider),
          ),
        ],
      ),
      body: opsAsync.when(
        loading: () => const SkeletonList(itemCount: 8),
        error: (e, _) => ErrorState(
          title: 'Failed to load ops',
          message: e.toString(),
          onRetry: () => ref.invalidate(adminOpsProvider),
        ),
        data: (data) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(adminOpsProvider),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _sectionTitle(context, 'Buy / top up APIs'),
              Text(
                'Red = needs purchase. Tap Buy to open the provider billing page.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
              ..._asList(data['buyNow']).map((p) => _BuyNowCard(item: p)),
              if (_asList(data['buyNow']).isEmpty)
                const Card(
                  child: ListTile(
                    leading: Icon(Icons.check_circle, color: Colors.green),
                    title: Text('No urgent API top-ups'),
                    subtitle: Text('All critical providers look OK'),
                  ),
                ),
              const SizedBox(height: 16),
              _sectionTitle(context, 'Provider health'),
              ..._asList(data['providers']).map((p) => _ProviderTile(item: p)),
              const SizedBox(height: 16),
              _sectionTitle(context, 'Summary'),
              _SummaryGrid(summary: _asMap(data['summary'])),
              const SizedBox(height: 16),
              _sectionTitle(context, 'Live active jobs'),
              if (_asList(data['liveActiveUsers']).isEmpty)
                const Text('No jobs processing right now')
              else
                ..._asList(data['liveActiveUsers'])
                    .map((u) => _LiveUserTile(item: u)),
              const SizedBox(height: 16),
              _sectionTitle(context, 'Top consumers (7 days)'),
              ..._asList(data['topConsumers7d'])
                  .map((u) => _ConsumerTile(item: u)),
              const SizedBox(height: 16),
              _sectionTitle(context, 'Subscriptions'),
              ..._asList(data['subscriptions']).take(20).map(
                    (s) => ListTile(
                      dense: true,
                      title: Text(s['email']?.toString() ?? s['userId']?.toString() ?? ''),
                      subtitle: Text(
                        '${s['planType']} · ${s['status']} · wallet ${s['creditBalance']}',
                      ),
                      trailing: Text(
                        s['expiresAt'] != null
                            ? s['expiresAt'].toString().split('T').first
                            : '',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  ),
              const SizedBox(height: 16),
              _sectionTitle(context, 'Billing failures (provider)'),
              if (_asList(data['billingFailures']).isEmpty)
                const Text('None in last 7 days')
              else
                ..._asList(data['billingFailures']).map(
                  (f) => ListTile(
                    dense: true,
                    leading: const Icon(Icons.error_outline, color: Colors.red),
                    title: Text('${f['provider']} · ${f['jobType']}'),
                    subtitle: Text(
                      f['errorMessage']?.toString() ?? '',
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              _sectionTitle(context, 'Recent user payments'),
              ..._asList(data['recentPayments']).map(
                (p) => ListTile(
                  dense: true,
                  title: Text(p['email']?.toString() ?? ''),
                  subtitle: Text('${p['status']} · ${p['provider']}'),
                  trailing: Text('${p['currency']} ${p['amount']}'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _sectionTitle(BuildContext context, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 4),
      child: Text(
        text,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }

  static List<Map<String, dynamic>> _asList(dynamic v) {
    if (v is! List) return [];
    return v
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  static Map<String, dynamic> _asMap(dynamic v) {
    if (v is Map) return Map<String, dynamic>.from(v);
    return {};
  }
}

class _BuyNowCard extends StatelessWidget {
  final Map<String, dynamic> item;
  const _BuyNowCard({required this.item});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      color: scheme.errorContainer.withValues(alpha: 0.35),
      child: ListTile(
        leading: Icon(Icons.warning_amber_rounded, color: scheme.error),
        title: Text(item['name']?.toString() ?? item['id']?.toString() ?? ''),
        subtitle: Text(item['reason']?.toString() ?? ''),
        trailing: FilledButton(
          onPressed: () => _open(item['buyUrl']?.toString()),
          child: const Text('Buy'),
        ),
      ),
    );
  }
}

class _ProviderTile extends StatelessWidget {
  final Map<String, dynamic> item;
  const _ProviderTile({required this.item});

  Color _statusColor(BuildContext context) {
    switch (item['status']?.toString()) {
      case 'ok':
        return Colors.green;
      case 'needs_topup':
        return Colors.orange;
      case 'error':
        return Theme.of(context).colorScheme.error;
      case 'not_configured':
        return Colors.grey;
      default:
        return Colors.blueGrey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final usedFor = (item['usedFor'] is List)
        ? (item['usedFor'] as List).join(', ')
        : '';
    return Card(
      child: ListTile(
        leading: Icon(Icons.cloud_outlined, color: _statusColor(context)),
        title: Text(item['name']?.toString() ?? ''),
        subtitle: Text(
          '${item['status']} · ${item['message']}\nUsed for: $usedFor',
        ),
        isThreeLine: true,
        trailing: TextButton(
          onPressed: () => _open(item['buyUrl']?.toString()),
          child: Text(item['mustBuy'] == true ? 'Buy' : 'Open'),
        ),
      ),
    );
  }
}

class _SummaryGrid extends StatelessWidget {
  final Map<String, dynamic> summary;
  const _SummaryGrid({required this.summary});

  @override
  Widget build(BuildContext context) {
    final entries = [
      ['Users', summary['users']],
      ['Premium', summary['premiumSubscribers']],
      ['Free trial', summary['freeTrialSubscribers']],
      ['Credits out (24h)', summary['creditsSpent24h']],
      ['Active jobs', summary['activeJobs']],
      ['Wallet credits', summary['totalCreditsInCirculation']],
      ['Revenue', summary['revenue']],
    ];
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: entries
          .map(
            (e) => Chip(
              label: Text('${e[0]}: ${e[1] ?? '-'}'),
            ),
          )
          .toList(),
    );
  }
}

class _LiveUserTile extends StatelessWidget {
  final Map<String, dynamic> item;
  const _LiveUserTile({required this.item});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        title: Text(item['email']?.toString() ?? ''),
        subtitle: Text(
          '${item['jobType']} · ${item['status']} · ${item['progress']}% · cost ${item['creditsCost']} · ${item['provider']}',
        ),
        trailing: Text('bal ${item['creditBalance']}'),
      ),
    );
  }
}

class _ConsumerTile extends StatelessWidget {
  final Map<String, dynamic> item;
  const _ConsumerTile({required this.item});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      title: Text(item['email']?.toString() ?? ''),
      subtitle: Text('Plan ${item['plan']} · wallet ${item['creditBalance']}'),
      trailing: Text('-${item['creditsSpent']} cr'),
    );
  }
}

Future<void> _open(String? url) async {
  if (url == null || url.isEmpty) return;
  await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
}
