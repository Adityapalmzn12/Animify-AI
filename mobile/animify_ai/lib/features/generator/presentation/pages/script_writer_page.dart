import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/themed_choice_chip.dart';
import '../../../../core/widgets/video_duration_chips.dart';

class ScriptWriterPage extends ConsumerStatefulWidget {
  const ScriptWriterPage({super.key});

  @override
  ConsumerState<ScriptWriterPage> createState() => _ScriptWriterPageState();
}

class _ScriptWriterPageState extends ConsumerState<ScriptWriterPage> {
  final _promptController = TextEditingController();
  String _type = 'reel';
  int _duration = 30;
  bool _loading = false;
  bool _makingVideo = false;
  String? _script;

  static const _types = ['reel', 'youtube', 'ads', 'story', 'scene', 'podcast'];
  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    if (_promptController.text.trim().length < 3) return;
    setState(() {
      _loading = true;
      _script = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post<Map<String, dynamic>>(
        '/scripts/generate',
        data: {
          'type': _type,
          'prompt':
              '${_promptController.text.trim()}\nTarget length: ${_duration}s. Format as Scene 1, Scene 2, etc.',
        },
      );
      final data = res.data ?? {};
      final nested = data['job'] is Map
          ? (data['job'] as Map)['settings']
          : data['settings'];
      final fromSettings = nested is Map ? nested['scriptText'] as String? : null;
      setState(() {
        _script = data['scriptText'] as String? ??
            fromSettings ??
            data['script'] as String? ??
            'Script generated.';
      });
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

  Future<void> _createVideo() async {
    final script = (_script ?? _promptController.text).trim();
    if (script.length < 3) return;
    setState(() => _makingVideo = true);
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post<Map<String, dynamic>>(
        '/studio/generate',
        data: {
          'mode': 'story_reel',
          'prompt': script,
          'duration': _duration,
          'aspect': '9:16',
          'addAudio': true,
          'style': 'cinematic',
        },
      );
      final jobId = res.data?['id'] as String?;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Video processing started')),
        );
        if (jobId != null) {
          context.go('/videos/$jobId');
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _makingVideo = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('AI Script')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          AppTextField(
            controller: _promptController,
            label: 'What should the script be about?',
            hint: '30s reel about a sneaker drop...',
            maxLines: 3,
          ),
          const SizedBox(height: 16),
          Text('Format', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _types
                .map(
                  (t) => ThemedChoiceChip(
                    label: t,
                    selected: _type == t,
                    onSelected: (_) => setState(() => _type = t),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 16),
          VideoDurationChips(
            value: _duration,
            onChanged: (d) => setState(() => _duration = d),
          ),
          const SizedBox(height: 24),
          AppButton(
            onPressed: _loading ? null : _generate,
            isLoading: _loading,
            child: const Text('Write Script'),
          ),
          if (_script != null) ...[
            const SizedBox(height: 24),
            SelectableText(_script!),
            const SizedBox(height: 16),
            AppButton(
              onPressed: _makingVideo ? null : _createVideo,
              isLoading: _makingVideo,
              child: Text('Create ${_duration}s Video'),
            ),
          ],
        ],
      ),
    );
  }
}
