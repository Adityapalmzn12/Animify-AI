import 'package:flutter/material.dart';

class AppColors {
  static const Color primary = Color(0xFF6366F1);
  static const Color primaryLight = Color(0xFF818CF8);
  static const Color primaryDark = Color(0xFF4F46E5);

  static const Color secondary = Color(0xFF8B5CF6);
  static const Color secondaryLight = Color(0xFFA78BFA);
  static const Color secondaryDark = Color(0xFF7C3AED);

  static const Color accent = Color(0xFF06B6D4);
  static const Color accentLight = Color(0xFF22D3EE);
  static const Color accentDark = Color(0xFF0891B2);

  static const Color success = Color(0xFF10B981);
  static const Color successLight = Color(0xFF34D399);
  static const Color successDark = Color(0xFF059669);

  static const Color warning = Color(0xFFF59E0B);
  static const Color warningLight = Color(0xFFFBBF24);
  static const Color warningDark = Color(0xFFD97706);

  static const Color error = Color(0xFFEF4444);
  static const Color errorLight = Color(0xFFF87171);
  static const Color errorDark = Color(0xFFDC2626);

  static const Color info = Color(0xFF3B82F6);
  static const Color infoLight = Color(0xFF60A5FA);
  static const Color infoDark = Color(0xFF2563EB);

  static const Color lightBackground = Color(0xFFFAFAFA);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightSurfaceVariant = Color(0xFFF4F4F5);
  
  static const Color darkBackground = Color(0xFF0F0F0F);
  static const Color darkSurface = Color(0xFF171717);
  static const Color darkSurfaceVariant = Color(0xFF262626);

  static const Color lightTextPrimary = Color(0xFF18181B);
  static const Color lightTextSecondary = Color(0xFF71717A);
  static const Color lightTextTertiary = Color(0xFFA1A1AA);

  static const Color darkTextPrimary = Color(0xFFFAFAFA);
  static const Color darkTextSecondary = Color(0xFFA1A1AA);
  static const Color darkTextTertiary = Color(0xFF71717A);

  static const Color lightBorder = Color(0xFFE4E4E7);
  static const Color darkBorder = Color(0xFF3F3F46);

  static const Color gradient1Start = Color(0xFF6366F1);
  static const Color gradient1End = Color(0xFF8B5CF6);
  
  static const Color gradient2Start = Color(0xFF06B6D4);
  static const Color gradient2End = Color(0xFF6366F1);

  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [gradient1Start, gradient1End],
  );

  static const LinearGradient accentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [gradient2Start, gradient2End],
  );

  static ColorScheme get lightColorScheme => ColorScheme.light(
    primary: primary,
    onPrimary: Colors.white,
    primaryContainer: primaryLight.withValues(alpha: 0.2),
    onPrimaryContainer: primaryDark,
    
    secondary: secondary,
    onSecondary: Colors.white,
    secondaryContainer: secondaryLight.withValues(alpha: 0.2),
    onSecondaryContainer: secondaryDark,
    
    tertiary: accent,
    onTertiary: Colors.white,
    tertiaryContainer: accentLight.withValues(alpha: 0.2),
    onTertiaryContainer: accentDark,
    
    error: error,
    onError: Colors.white,
    errorContainer: errorLight.withValues(alpha: 0.2),
    onErrorContainer: errorDark,
    
    surface: lightSurface,
    onSurface: lightTextPrimary,
    onSurfaceVariant: lightTextSecondary,
    
    surfaceContainerHighest: lightSurfaceVariant,
    surfaceContainerHigh: lightSurfaceVariant,
    
    outline: lightBorder,
    outlineVariant: lightBorder.withValues(alpha: 0.5),
    
    inverseSurface: darkSurface,
    onInverseSurface: darkTextPrimary,
    inversePrimary: primaryLight,
    
    shadow: Colors.black.withValues(alpha: 0.1),
    scrim: Colors.black.withValues(alpha: 0.5),
  );

  static ColorScheme get darkColorScheme => ColorScheme.dark(
    primary: primaryLight,
    onPrimary: darkBackground,
    primaryContainer: primary.withValues(alpha: 0.3),
    onPrimaryContainer: primaryLight,
    
    secondary: secondaryLight,
    onSecondary: darkBackground,
    secondaryContainer: secondary.withValues(alpha: 0.3),
    onSecondaryContainer: secondaryLight,
    
    tertiary: accentLight,
    onTertiary: darkBackground,
    tertiaryContainer: accent.withValues(alpha: 0.3),
    onTertiaryContainer: accentLight,
    
    error: errorLight,
    onError: darkBackground,
    errorContainer: error.withValues(alpha: 0.3),
    onErrorContainer: errorLight,
    
    surface: darkSurface,
    onSurface: darkTextPrimary,
    onSurfaceVariant: darkTextSecondary,
    
    surfaceContainerHighest: darkSurfaceVariant,
    surfaceContainerHigh: darkSurfaceVariant,
    
    outline: darkBorder,
    outlineVariant: darkBorder.withValues(alpha: 0.5),
    
    inverseSurface: lightSurface,
    onInverseSurface: lightTextPrimary,
    inversePrimary: primary,
    
    shadow: Colors.black.withValues(alpha: 0.3),
    scrim: Colors.black.withValues(alpha: 0.7),
  );
}
