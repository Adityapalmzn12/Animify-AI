import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../wallet/presentation/providers/wallet_provider.dart';

class SubscriptionPage extends ConsumerStatefulWidget {
  const SubscriptionPage({super.key});

  @override
  ConsumerState<SubscriptionPage> createState() => _SubscriptionPageState();
}

class _SubscriptionPageState extends ConsumerState<SubscriptionPage> {
  bool _loading = false;
  bool _plansLoading = true;
  List<Map<String, dynamic>> _plans = [];
  String? _plansError;

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  Future<void> _loadPlans() async {
    setState(() {
      _plansLoading = true;
      _plansError = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get<Map<String, dynamic>>('/payments/plans');
      final list = (res.data?['plans'] as List?) ?? [];
      setState(() {
        _plans = list
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      });
    } catch (e) {
      setState(() => _plansError = e.toString());
    } finally {
      if (mounted) setState(() => _plansLoading = false);
    }
  }

  Future<void> _openCheckout(String planId) async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post<Map<String, dynamic>>(
        '/payments/checkout',
        data: {'planId': planId},
      );
      final url = res.data?['url'] as String?;
      if (url == null) throw Exception('No checkout URL');
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Complete payment in the browser. Wallet + plan update after Stripe success.',
            ),
          ),
        );
      }
      ref.invalidate(creditBalanceProvider);
      await ref.read(authStateProvider.notifier).refreshUser();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Subscribe failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openPortal() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post<Map<String, dynamic>>(
        '/payments/portal',
        data: {},
      );
      final url = res.data?['url'] as String?;
      if (url == null) throw Exception('No portal URL');
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      ref.invalidate(creditBalanceProvider);
      await ref.read(authStateProvider.notifier).refreshUser();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Manage billing failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final isPremium = user?.subscription?.planType == 'premium';

    return Scaffold(
      appBar: AppBar(title: const Text('Subscription')),
      body: RefreshIndicator(
        onRefresh: () async {
          await _loadPlans();
          ref.invalidate(creditBalanceProvider);
          await ref.read(authStateProvider.notifier).refreshUser();
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (isPremium) _buildCurrentPlan(context, user!),
              const SizedBox(height: 24),
              if (_plansLoading)
                const Center(child: CircularProgressIndicator())
              else if (_plansError != null)
                Text('Could not load plans: $_plansError')
              else
                _buildPlanComparison(context, isPremium),
              const SizedBox(height: 16),
              Text(
                'Buying a plan updates your Premium status and credits your wallet '
                'automatically via Stripe. Pull to refresh after payment.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
              const SizedBox(height: 24),
              _buildFeatures(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCurrentPlan(BuildContext context, user) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Premium active',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Credits renew with each paid invoice. Manage or cancel in Stripe portal.',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.9)),
          ),
          const SizedBox(height: 16),
          AppButton(
            onPressed: _loading ? null : _openPortal,
            variant: AppButtonVariant.outlined,
            child: const Text('Manage billing'),
          ),
        ],
      ),
    );
  }

  Widget _buildPlanComparison(BuildContext context, bool isPremium) {
    final plans = _plans.isEmpty
        ? [
            {
              'id': 'pro',
              'name': 'Pro',
              'priceInr': 999,
              'credits': 999,
              'description': 'Best for story videos',
              'popular': true,
            },
          ]
        : _plans;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Choose Your Plan',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 16),
        ...plans.map((p) {
          final id = p['id']?.toString() ?? 'pro';
          final name = p['name']?.toString() ?? id;
          final price = p['priceInr'] ?? 0;
          final credits = p['credits'] ?? 0;
          final desc = p['description']?.toString() ?? '';
          final popular = p['popular'] == true;
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _PlanCard(
              name: name,
              price: '₹$price',
              period: '/month',
              features: [
                '$credits credits / month',
                desc,
                'Wallet updates after Stripe',
                'Top-up anytime from Wallet',
              ],
              isCurrentPlan: false,
              isPremium: popular || isPremium,
              onSelect: _loading ? null : () => _openCheckout(id),
            ),
          );
        }),
        if (isPremium)
          Text(
            'You already have Premium — subscribe again only to change pack via Stripe.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
      ],
    );
  }

  Widget _buildFeatures(BuildContext context) {
    final features = [
      ['AI Video', 'Text/image → video with narration'],
      ['Creative Studio', 'Logo, fashion, Ghibli, PPT & more'],
      ['Credit Wallet', 'Track usage + buy top-ups'],
      ['Admin control', 'Grant / adjust credits & pricing'],
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Included',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 12),
        ...features.map(
          (f) => ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(
              Icons.check_circle,
              color: Theme.of(context).colorScheme.primary,
            ),
            title: Text(f[0]),
            subtitle: Text(f[1]),
          ),
        ),
      ],
    );
  }
}

class _PlanCard extends StatelessWidget {
  final String name;
  final String price;
  final String period;
  final List<String> features;
  final bool isCurrentPlan;
  final bool isPremium;
  final VoidCallback? onSelect;

  const _PlanCard({
    required this.name,
    required this.price,
    required this.period,
    required this.features,
    required this.isCurrentPlan,
    this.isPremium = false,
    this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isPremium
            ? Theme.of(context)
                .colorScheme
                .primaryContainer
                .withValues(alpha: 0.3)
            : Theme.of(context)
                .colorScheme
                .surfaceContainerHighest
                .withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isPremium
              ? Theme.of(context).colorScheme.primary
              : Theme.of(context).colorScheme.outlineVariant,
          width: isPremium ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            name,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                price,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: isPremium
                          ? Theme.of(context).colorScheme.primary
                          : null,
                    ),
              ),
              if (period.isNotEmpty)
                Text(period, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
          const SizedBox(height: 16),
          ...features.map(
            (f) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Icon(
                    Icons.check,
                    size: 16,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(f, style: Theme.of(context).textTheme.bodySmall),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (isCurrentPlan)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Current Plan',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelLarge,
              ),
            )
          else
            AppButton(
              onPressed: onSelect,
              variant: isPremium
                  ? AppButtonVariant.gradient
                  : AppButtonVariant.outlined,
              child: const Text('Subscribe'),
            ),
        ],
      ),
    );
  }
}
