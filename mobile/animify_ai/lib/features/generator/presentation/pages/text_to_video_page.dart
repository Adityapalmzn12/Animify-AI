import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';

class TextToVideoPage extends ConsumerStatefulWidget {
  const TextToVideoPage({super.key});

  @override
  ConsumerState<TextToVideoPage> createState() => _TextToVideoPageState();
}

class _TextToVideoPageState extends ConsumerState<TextToVideoPage> {
  final _formKey = GlobalKey<FormState>();
  final _promptController = TextEditingController();
  String _aspect = '9:16';
  String _style = 'anime';
  bool _isSubmitting = false;

  static const _aspects = ['9:16', '16:9', '1:1'];
  static const _styles = ['anime', 'cartoon', '3d', 'cinematic', 'watercolor'];

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);
    try {
      final apiClient = ref.read(apiClientProvider);
      final res = await apiClient.post<Map<String, dynamic>>(
        '/generator',
        data: {
          'jobType': 'TEXT_TO_VIDEO',
          'prompt': _promptController.text.trim(),
          'aspect': _aspect,
          'style': _style,
        },
      );

      if (mounted) {
        final jobId = res.data?['id'] as String?;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Video generation started')),
        );
        if (jobId != null) {
          context.go('/videos/$jobId');
        } else {
          context.go(AppRoutes.videos);
        }
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
      appBar: AppBar(title: const Text('Text to Video')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AppTextField(
                controller: _promptController,
                label: 'Prompt',
                hint: 'Describe the video you want to create...',
                maxLines: 4,
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
                runSpacing: 8,
                children: _styles.map((s) {
                  final selected = _style == s;
                  return ChoiceChip(
                    label: Text(s),
                    selected: selected,
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
