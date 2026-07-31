import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';

class ImageToVideoPage extends ConsumerStatefulWidget {
  const ImageToVideoPage({super.key});

  @override
  ConsumerState<ImageToVideoPage> createState() => _ImageToVideoPageState();
}

class _ImageToVideoPageState extends ConsumerState<ImageToVideoPage> {
  final _formKey = GlobalKey<FormState>();
  final _promptController = TextEditingController();
  String? _inputFileId;
  String _aspect = '9:16';
  String _style = 'anime';
  bool _isSubmitting = false;

  static const _aspects = ['9:16', '16:9', '1:1'];
  static const _styles = ['anime', 'cartoon', '3d', 'cinematic'];

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_inputFileId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please upload an image first'),
        ),
      );
      return;
    }
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);
    try {
      final apiClient = ref.read(apiClientProvider);
      await apiClient.post<Map<String, dynamic>>(
        '/generator',
        data: {
          'jobType': 'IMAGE_TO_VIDEO',
          'inputFileId': _inputFileId,
          'prompt': _promptController.text.trim(),
          'aspect': _aspect,
          'style': _style,
        },
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Image-to-video job started')),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Image to Video')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.info.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.info.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(Icons.info_outline, color: AppColors.info),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Upload an image first, then describe how it should move.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () => context.push(AppRoutes.videoUpload),
                icon: const Icon(Icons.upload_file),
                label: Text(
                  _inputFileId == null
                      ? 'Upload Image'
                      : 'Image ready ($_inputFileId)',
                ),
              ),
              const SizedBox(height: 24),
              AppTextField(
                controller: _promptController,
                label: 'Motion prompt',
                hint: 'Describe the animation...',
                maxLines: 3,
                validator: (v) {
                  if (v == null || v.trim().length < 3) {
                    return 'Enter at least 3 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),
              Text(
                'Aspect ratio',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: _aspects
                    .map((a) => ButtonSegment(value: a, label: Text(a)))
                    .toList(),
                selected: {_aspect},
                onSelectionChanged: (s) => setState(() => _aspect = s.first),
              ),
              const SizedBox(height: 24),
              Text('Style', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: _styles.map((s) {
                  return ChoiceChip(
                    label: Text(s),
                    selected: _style == s,
                    onSelected: (_) => setState(() => _style = s),
                  );
                }).toList(),
              ),
              const SizedBox(height: 32),
              AppButton(
                onPressed: _isSubmitting ? null : _submit,
                isLoading: _isSubmitting,
                child: const Text('Generate Video'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
