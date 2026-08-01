import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/themed_choice_chip.dart';
import '../../../../core/widgets/quality_tier_chips.dart';
import '../../../../core/widgets/video_duration_chips.dart';
import '../../../wallet/presentation/providers/pricing_provider.dart';

class ImageToVideoPage extends ConsumerStatefulWidget {
  const ImageToVideoPage({super.key});

  @override
  ConsumerState<ImageToVideoPage> createState() => _ImageToVideoPageState();
}

class _ImageToVideoPageState extends ConsumerState<ImageToVideoPage> {
  final _formKey = GlobalKey<FormState>();
  final _promptController = TextEditingController();
  final _picker = ImagePicker();
  String? _inputFileId;
  String? _localPreviewName;
  String _aspect = '9:16';
  String _style = 'anime';
  int _duration = 30;
  String _qualityTier = 'economy';
  bool _isUploading = false;
  bool _isSubmitting = false;
  double _uploadProgress = 0;

  static const _aspects = ['9:16', '16:9', '1:1'];
  static const _styles = ['anime', 'cartoon', '3d', 'cinematic', 'ghibli'];

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  Future<void> _pickAndUpload() async {
    final picked = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 92,
    );
    if (picked == null) return;

    setState(() {
      _isUploading = true;
      _uploadProgress = 0;
      _localPreviewName = picked.name;
      _inputFileId = null;
    });

    try {
      final uploader = ref.read(mediaUploadServiceProvider);
      final id = await uploader.uploadFile(
        filePath: picked.path,
        mimeType: uploader.guessImageMime(picked.path),
        onProgress: (sent, total) {
          if (total > 0 && mounted) {
            setState(() => _uploadProgress = sent / total);
          }
        },
      );
      if (mounted) {
        setState(() {
          _inputFileId = id;
          _isUploading = false;
          _uploadProgress = 1;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Image uploaded')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isUploading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e')),
        );
      }
    }
  }

  Future<void> _submit() async {
    if (_inputFileId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please upload an image first')),
      );
      return;
    }
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);
    try {
      final apiClient = ref.read(apiClientProvider);
      final res = await apiClient.post<Map<String, dynamic>>(
        '/generator',
        data: {
          'jobType': 'IMAGE_TO_VIDEO',
          'inputFileId': _inputFileId,
          'prompt': _promptController.text.trim(),
          'aspect': _aspect,
          'style': _style,
          'duration': _duration,
          'qualityTier': _qualityTier,
          'addAudio': true,
        },
      );

      if (mounted) {
        final jobId = res.data?['id'] as String?;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${_duration}s video with voice started')),
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
                child: Text(
                  'Pick a photo, choose length, and describe motion. Voice narration is added automatically.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: _isUploading ? null : _pickAndUpload,
                icon: _isUploading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.image_outlined),
                label: Text(
                  _inputFileId != null
                      ? 'Ready: ${_localPreviewName ?? 'image'}'
                      : (_isUploading
                          ? 'Uploading… ${(_uploadProgress * 100).toStringAsFixed(0)}%'
                          : 'Pick & upload image'),
                ),
              ),
              if (_isUploading) ...[
                const SizedBox(height: 8),
                LinearProgressIndicator(value: _uploadProgress),
              ],
              const SizedBox(height: 24),
              AppTextField(
                controller: _promptController,
                label: 'Motion / script',
                hint:
                    'Scene 1: Camera slowly pushes in\nScene 2: Soft wind, smile…',
                maxLines: 4,
                validator: (v) {
                  if (v == null || v.trim().length < 3) {
                    return 'Enter at least 3 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),
              VideoDurationChips(
                value: _duration,
                onChanged: (d) => setState(() => _duration = d),
                creditsByDuration: () {
                  final pricing =
                      ref.watch(creditPricingProvider).valueOrNull;
                  final match = pricing?.tiers
                      .where((t) => t.id == _qualityTier)
                      .toList();
                  if (match == null || match.isEmpty) {
                    return pricing?.videoCredits;
                  }
                  return match.first.videoCredits;
                }(),
              ),
              const SizedBox(height: 16),
              QualityTierChips(
                value: _qualityTier,
                onChanged: (t) => setState(() => _qualityTier = t),
                tiers:
                    ref.watch(creditPricingProvider).valueOrNull?.tiers ??
                        const [],
                durationSec: _duration,
              ),
              const SizedBox(height: 24),
              Text('Aspect', style: Theme.of(context).textTheme.titleSmall),
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
                  return ThemedChoiceChip(
                    label: s,
                    selected: _style == s,
                    onSelected: (_) => setState(() => _style = s),
                  );
                }).toList(),
              ),
              const SizedBox(height: 32),
              AppButton(
                onPressed: (_isSubmitting || _isUploading) ? null : _submit,
                isLoading: _isSubmitting,
                child: Text('Generate ${_duration}s Video'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
