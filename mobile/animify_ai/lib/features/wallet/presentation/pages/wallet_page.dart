import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/async_state_views.dart';
import '../providers/wallet_provider.dart';

class WalletPage extends ConsumerStatefulWidget {
  const WalletPage({super.key});

  @override
  ConsumerState<WalletPage> createState() => _WalletPageState();
}

class _WalletPageState extends ConsumerState<WalletPage> {
  final _promoController = TextEditingController();
  bool _isRedeeming = false;

  @override
  void dispose() {
    _promoController.dispose();
    super.dispose();
  }

  Future<void> _redeemPromo() async {
    final code = _promoController.text.trim();
    if (code.isEmpty) return;

    setState(() => _isRedeeming = true);
    try {
      final apiClient = ref.read(apiClientProvider);
      await apiClient.post('/payments/promo', data: {'code': code});
      ref.invalidate(creditBalanceProvider);
      ref.invalidate(creditLedgerProvider);
      _promoController.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Promo code applied')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Promo redemption unavailable: ${e.toString()}',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isRedeeming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final balanceAsync = ref.watch(creditBalanceProvider);
    final ledgerAsync = ref.watch(creditLedgerProvider);
    final dateFormat = DateFormat.MMMd().add_jm();

    return Scaffold(
      appBar: AppBar(title: Text(l10n.wallet)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(creditBalanceProvider);
          ref.invalidate(creditLedgerProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            balanceAsync.when(
              loading: () => const SkeletonList(itemCount: 1, itemHeight: 120),
              error: (e, _) => ErrorState(
                title: 'Failed to load balance',
                message: e.toString(),
                onRetry: () => ref.invalidate(creditBalanceProvider),
              ),
              data: (balance) => Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.credits,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${balance.balance}',
                        style: Theme.of(context)
                            .textTheme
                            .displaySmall
                            ?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                            ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Promo code',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _promoController,
                    decoration: const InputDecoration(
                      hintText: 'Enter promo code',
                      border: OutlineInputBorder(),
                    ),
                    textCapitalization: TextCapitalization.characters,
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _isRedeeming ? null : _redeemPromo,
                  child: _isRedeeming
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Apply'),
                ),
              ],
            ),
            const SizedBox(height: 32),
            Text(
              'Transaction history',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 12),
            ledgerAsync.when(
              loading: () => const SkeletonList(itemCount: 5),
              error: (e, _) => ErrorState(
                title: 'Failed to load ledger',
                message: e.toString(),
                onRetry: () => ref.invalidate(creditLedgerProvider),
              ),
              data: (entries) {
                if (entries.isEmpty) {
                  return const EmptyState(
                    icon: Icons.receipt_long_outlined,
                    title: 'No transactions yet',
                    message: 'Your credit activity will show up here.',
                  );
                }
                return Column(
                  children: entries.map((entry) {
                    final isCredit = entry.amount > 0;
                    return Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: isCredit
                              ? AppColors.success.withValues(alpha: 0.15)
                              : AppColors.error.withValues(alpha: 0.15),
                          child: Icon(
                            isCredit ? Icons.add : Icons.remove,
                            color:
                                isCredit ? AppColors.success : AppColors.error,
                            size: 20,
                          ),
                        ),
                        title: Text(entry.reason.isNotEmpty
                            ? entry.reason
                            : entry.type),
                        subtitle: Text(dateFormat.format(entry.createdAt)),
                        trailing: Text(
                          '${isCredit ? '+' : ''}${entry.amount}',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: isCredit
                                ? AppColors.success
                                : AppColors.error,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
