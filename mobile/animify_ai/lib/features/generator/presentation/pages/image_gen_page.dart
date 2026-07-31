import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';

class ImageGenPage extends ConsumerStatefulWidget {
  final String initialStyle;

  const ImageGenPage({super.key, this.initialStyle = 'ghibli'});

  @override
  ConsumerState<ImageGenPage> createState() => _ImageGenPageState();
}

class _ImageGenPageState extends ConsumerState<ImageGenPage> {
  final _promptController = TextEditingController();
  late String _style;
  bool _loading = false;
  String? _resultUrl;

  static const _styles = [
    'ghibli',
    'anime',
    'cartoon',
    'pixar',
    'realistic',
    '3d',
  ];

  @override
  void initState() {
    super.initState();
    _style = widget.initialStyle;
  }

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    if (_promptController.text.trim().length < 3) return;
    setState(() {
      _loading = true;
      _resultUrl = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post<Map<String, dynamic>>(
        '/images/generate',
        data: {
          'prompt': _promptController.text.trim(),
          'style': _style,
        },
      );
      setState(() => _resultUrl = res.data?['resultUrl'] as String?);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Image generated')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AI Image')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          AppTextField(
            controller: _promptController,
            label: 'Prompt',
            hint: 'A floating island village at sunset...',
            maxLines: 4,
          ),
          const SizedBox(height: 16),
          Text('Style', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _styles.map((s) {
              return ChoiceChip(
                label: Text(s),
                selected: _style == s,
                onSelected: (_) => setState(() => _style = s),
              );
            }).toList(),
          ),
          const SizedBox(height: 24),
          AppButton(
            onPressed: _loading ? null : _generate,
            isLoading: _loading,
            child: const Text('Generate Image'),
          ),
          if (_resultUrl != null) ...[
            const SizedBox(height: 24),
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(
                _resultUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  height: 240,
                  color: AppColors.lightSurfaceVariant,
                  alignment: Alignment.center,
                  child: const Text('Could not load preview'),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
