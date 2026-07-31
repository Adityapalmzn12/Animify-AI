import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';

class CreditBalance {
  final int balance;

  const CreditBalance({required this.balance});

  factory CreditBalance.fromJson(Map<String, dynamic> json) {
    return CreditBalance(balance: (json['balance'] as num).toInt());
  }
}

class LedgerEntry {
  final String id;
  final String type;
  final int amount;
  final int balanceAfter;
  final String reason;
  final DateTime createdAt;

  const LedgerEntry({
    required this.id,
    required this.type,
    required this.amount,
    required this.balanceAfter,
    required this.reason,
    required this.createdAt,
  });

  factory LedgerEntry.fromJson(Map<String, dynamic> json) {
    return LedgerEntry(
      id: json['id'] as String,
      type: json['type'] as String,
      amount: (json['amount'] as num).toInt(),
      balanceAfter: (json['balanceAfter'] as num).toInt(),
      reason: json['reason'] as String? ?? '',
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

final creditBalanceProvider =
    FutureProvider<CreditBalance>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final response =
      await apiClient.get<Map<String, dynamic>>('/credits/balance');
  return CreditBalance.fromJson(response.data ?? {'balance': 0});
});

final creditLedgerProvider =
    FutureProvider<List<LedgerEntry>>((ref) async {
  final apiClient = ref.watch(apiClientProvider);
  final response =
      await apiClient.get<Map<String, dynamic>>('/credits/ledger');
  final data = response.data ?? {};
  return (data['items'] as List<dynamic>? ?? [])
      .map((e) => LedgerEntry.fromJson(e as Map<String, dynamic>))
      .toList();
});
