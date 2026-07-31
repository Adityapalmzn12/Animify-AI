import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/router/app_router.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../providers/theme_provider.dart';

const _biometricLockKey = 'require_biometric_lock';

final biometricLockProvider =
    StateNotifierProvider<BiometricLockNotifier, bool>((ref) {
  return BiometricLockNotifier(ref.watch(sharedPreferencesProvider));
});

class BiometricLockNotifier extends StateNotifier<bool> {
  final SharedPreferences _prefs;

  BiometricLockNotifier(this._prefs)
      : super(_prefs.getBool(_biometricLockKey) ?? false);

  Future<void> setEnabled(bool value) async {
    await _prefs.setBool(_biometricLockKey, value);
    state = value;
  }
}

class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final l10n = AppLocalizations.of(context);
    final user = ref.watch(currentUserProvider);
    final biometricEnabled = ref.watch(biometricLockProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: ListView(
        children: [
          _buildSection(
            context,
            'Account',
            [
              _buildTile(
                context,
                icon: Icons.person_outline,
                title: 'Profile',
                onTap: () => context.push(AppRoutes.profile),
              ),
              _buildTile(
                context,
                icon: Icons.account_balance_wallet_outlined,
                title: l10n.wallet,
                subtitle: '${user?.creditBalance ?? 0} ${l10n.credits}',
                onTap: () => context.push(AppRoutes.wallet),
              ),
              _buildTile(
                context,
                icon: Icons.folder_open_outlined,
                title: l10n.projects,
                onTap: () => context.go(AppRoutes.projects),
              ),
              _buildTile(
                context,
                icon: Icons.credit_card_outlined,
                title: 'Subscription',
                onTap: () => context.go(AppRoutes.subscription),
              ),
              _buildTile(
                context,
                icon: Icons.notifications_outlined,
                title: 'Notifications',
                onTap: () => context.push(AppRoutes.notifications),
              ),
              if (user?.role == 'ADMIN')
                _buildTile(
                  context,
                  icon: Icons.admin_panel_settings_outlined,
                  title: l10n.admin,
                  onTap: () => context.push(AppRoutes.adminDashboard),
                ),
            ],
          ),
          _buildSection(
            context,
            'Security',
            [
              SwitchListTile(
                secondary: const Icon(Icons.fingerprint),
                title: const Text('Require biometric'),
                subtitle: const Text(
                  'Lock app with Face ID / fingerprint (local preference stub)',
                ),
                value: biometricEnabled,
                onChanged: (value) {
                  ref.read(biometricLockProvider.notifier).setEnabled(value);
                },
              ),
            ],
          ),
          _buildSection(
            context,
            'Appearance',
            [
              _buildThemeTile(context, ref, themeMode),
            ],
          ),
          _buildSection(
            context,
            'Support',
            [
              _buildTile(
                context,
                icon: Icons.help_outline,
                title: 'Help Center',
                onTap: () {},
              ),
              _buildTile(
                context,
                icon: Icons.mail_outline,
                title: 'Contact Us',
                onTap: () {},
              ),
              _buildTile(
                context,
                icon: Icons.star_outline,
                title: 'Rate App',
                onTap: () {},
              ),
            ],
          ),
          _buildSection(
            context,
            'Legal',
            [
              _buildTile(
                context,
                icon: Icons.description_outlined,
                title: 'Terms of Service',
                onTap: () {},
              ),
              _buildTile(
                context,
                icon: Icons.privacy_tip_outlined,
                title: 'Privacy Policy',
                onTap: () {},
              ),
            ],
          ),
          _buildSection(
            context,
            'Account Actions',
            [
              _buildTile(
                context,
                icon: Icons.logout,
                title: 'Sign Out',
                textColor: Theme.of(context).colorScheme.error,
                onTap: () => _showLogoutDialog(context, ref),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Center(
              child: Text(
                '${l10n.appTitle} v1.0.0',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSection(BuildContext context, String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ),
        ...children,
      ],
    );
  }

  Widget _buildTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    String? subtitle,
    Widget? trailing,
    Color? textColor,
    VoidCallback? onTap,
  }) {
    return ListTile(
      leading: Icon(
        icon,
        color: textColor ?? Theme.of(context).colorScheme.onSurface,
      ),
      title: Text(
        title,
        style: TextStyle(color: textColor),
      ),
      subtitle: subtitle != null ? Text(subtitle) : null,
      trailing: trailing ?? const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }

  Widget _buildThemeTile(BuildContext context, WidgetRef ref, ThemeMode themeMode) {
    String themeText;
    IconData themeIcon;

    switch (themeMode) {
      case ThemeMode.light:
        themeText = 'Light';
        themeIcon = Icons.light_mode;
        break;
      case ThemeMode.dark:
        themeText = 'Dark';
        themeIcon = Icons.dark_mode;
        break;
      case ThemeMode.system:
        themeText = 'System';
        themeIcon = Icons.brightness_auto;
        break;
    }

    return ListTile(
      leading: Icon(themeIcon),
      title: const Text('Theme'),
      subtitle: Text(themeText),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => _showThemeDialog(context, ref, themeMode),
    );
  }

  void _showThemeDialog(BuildContext context, WidgetRef ref, ThemeMode currentMode) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Choose Theme'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            RadioListTile<ThemeMode>(
              title: const Text('Light'),
              secondary: const Icon(Icons.light_mode),
              value: ThemeMode.light,
              groupValue: currentMode,
              onChanged: (value) {
                ref.read(themeModeProvider.notifier).setThemeMode(value!);
                Navigator.pop(context);
              },
            ),
            RadioListTile<ThemeMode>(
              title: const Text('Dark'),
              secondary: const Icon(Icons.dark_mode),
              value: ThemeMode.dark,
              groupValue: currentMode,
              onChanged: (value) {
                ref.read(themeModeProvider.notifier).setThemeMode(value!);
                Navigator.pop(context);
              },
            ),
            RadioListTile<ThemeMode>(
              title: const Text('System'),
              secondary: const Icon(Icons.brightness_auto),
              value: ThemeMode.system,
              groupValue: currentMode,
              onChanged: (value) {
                ref.read(themeModeProvider.notifier).setThemeMode(value!);
                Navigator.pop(context);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showLogoutDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(authStateProvider.notifier).logout();
            },
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.error,
            ),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }
}
