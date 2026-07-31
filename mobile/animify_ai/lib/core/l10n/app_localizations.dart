import 'package:flutter/material.dart';

enum AppLocale { en, hi }

class AppLocalizations {
  final AppLocale locale;

  const AppLocalizations(this.locale);

  static AppLocalizations of(BuildContext context) {
    final code = Localizations.localeOf(context).languageCode;
    return AppLocalizations(
      code == 'hi' ? AppLocale.hi : AppLocale.en,
    );
  }

  static const _strings = {
    AppLocale.en: {
      'appTitle': 'Animify AI',
      'generate': 'Generate',
      'wallet': 'Wallet',
      'credits': 'Credits',
      'projects': 'Projects',
      'admin': 'Admin',
    },
    AppLocale.hi: {
      'appTitle': 'Animify AI',
      'generate': 'जनरेट करें',
      'wallet': 'वॉलेट',
      'credits': 'क्रेडिट',
      'projects': 'प्रोजेक्ट',
      'admin': 'एडमिन',
    },
  };

  String get appTitle => _strings[locale]!['appTitle']!;
  String get generate => _strings[locale]!['generate']!;
  String get wallet => _strings[locale]!['wallet']!;
  String get credits => _strings[locale]!['credits']!;
  String get projects => _strings[locale]!['projects']!;
  String get admin => _strings[locale]!['admin']!;
}

class AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) =>
      locale.languageCode == 'en' || locale.languageCode == 'hi';

  @override
  Future<AppLocalizations> load(Locale locale) async {
    return AppLocalizations(
      locale.languageCode == 'hi' ? AppLocale.hi : AppLocale.en,
    );
  }

  @override
  bool shouldReload(covariant LocalizationsDelegate<AppLocalizations> old) =>
      false;
}
