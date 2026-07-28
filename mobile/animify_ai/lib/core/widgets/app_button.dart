import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

enum AppButtonVariant { filled, outlined, text, gradient }

class AppButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final Widget child;
  final AppButtonVariant variant;
  final bool isLoading;
  final bool isFullWidth;
  final EdgeInsetsGeometry? padding;
  final double? height;
  final double borderRadius;
  final Color? backgroundColor;
  final Color? foregroundColor;

  const AppButton({
    super.key,
    required this.onPressed,
    required this.child,
    this.variant = AppButtonVariant.filled,
    this.isLoading = false,
    this.isFullWidth = true,
    this.padding,
    this.height,
    this.borderRadius = 12,
    this.backgroundColor,
    this.foregroundColor,
  });

  const AppButton.outlined({
    super.key,
    required this.onPressed,
    required this.child,
    this.isLoading = false,
    this.isFullWidth = true,
    this.padding,
    this.height,
    this.borderRadius = 12,
    this.backgroundColor,
    this.foregroundColor,
  }) : variant = AppButtonVariant.outlined;

  const AppButton.text({
    super.key,
    required this.onPressed,
    required this.child,
    this.isLoading = false,
    this.isFullWidth = false,
    this.padding,
    this.height,
    this.borderRadius = 12,
    this.backgroundColor,
    this.foregroundColor,
  }) : variant = AppButtonVariant.text;

  const AppButton.gradient({
    super.key,
    required this.onPressed,
    required this.child,
    this.isLoading = false,
    this.isFullWidth = true,
    this.padding,
    this.height,
    this.borderRadius = 12,
    this.backgroundColor,
    this.foregroundColor,
  }) : variant = AppButtonVariant.gradient;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final effectivePadding = padding ??
        const EdgeInsets.symmetric(horizontal: 24, vertical: 16);

    Widget buttonContent = isLoading
        ? SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(
                variant == AppButtonVariant.filled ||
                        variant == AppButtonVariant.gradient
                    ? colorScheme.onPrimary
                    : colorScheme.primary,
              ),
            ),
          )
        : child;

    Widget button;

    switch (variant) {
      case AppButtonVariant.filled:
        button = ElevatedButton(
          onPressed: isLoading ? null : onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: backgroundColor ?? colorScheme.primary,
            foregroundColor: foregroundColor ?? colorScheme.onPrimary,
            padding: effectivePadding,
            minimumSize: height != null ? Size(0, height!) : null,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(borderRadius),
            ),
            disabledBackgroundColor: colorScheme.primary.withValues(alpha: 0.5),
          ),
          child: buttonContent,
        );
        break;

      case AppButtonVariant.outlined:
        button = OutlinedButton(
          onPressed: isLoading ? null : onPressed,
          style: OutlinedButton.styleFrom(
            foregroundColor: foregroundColor ?? colorScheme.primary,
            padding: effectivePadding,
            minimumSize: height != null ? Size(0, height!) : null,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(borderRadius),
            ),
            side: BorderSide(
              color: backgroundColor ?? colorScheme.outline,
            ),
          ),
          child: buttonContent,
        );
        break;

      case AppButtonVariant.text:
        button = TextButton(
          onPressed: isLoading ? null : onPressed,
          style: TextButton.styleFrom(
            foregroundColor: foregroundColor ?? colorScheme.primary,
            padding: effectivePadding,
            minimumSize: height != null ? Size(0, height!) : null,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(borderRadius),
            ),
          ),
          child: buttonContent,
        );
        break;

      case AppButtonVariant.gradient:
        button = Container(
          height: height ?? 52,
          decoration: BoxDecoration(
            gradient: onPressed != null && !isLoading
                ? AppColors.primaryGradient
                : LinearGradient(
                    colors: [
                      AppColors.primary.withValues(alpha: 0.5),
                      AppColors.secondary.withValues(alpha: 0.5),
                    ],
                  ),
            borderRadius: BorderRadius.circular(borderRadius),
            boxShadow: onPressed != null && !isLoading
                ? [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: isLoading ? null : onPressed,
              borderRadius: BorderRadius.circular(borderRadius),
              child: Container(
                padding: effectivePadding,
                alignment: Alignment.center,
                child: DefaultTextStyle(
                  style: theme.textTheme.labelLarge!.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                  child: buttonContent,
                ),
              ),
            ),
          ),
        );
        break;
    }

    if (isFullWidth) {
      return SizedBox(
        width: double.infinity,
        child: button,
      );
    }

    return button;
  }
}
