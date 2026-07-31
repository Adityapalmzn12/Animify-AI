import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';

class ScriptWriterPage extends ConsumerStatefulWidget {
  const ScriptWriterPage({super.key});

  @override
  ConsumerState<ScriptWriterPage> createState() => _ScriptWriterPageState();
}

class _ScriptWriterPageState extends ConsumerState<ScriptWriterPage> {
  final _promptController = TextEditingController();
  String _type = 'reel';
  bool _loading = false;
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
          'prompt': _promptController.text.trim(),
        },
      );
      final data = res.data ?? {};
      setState(() {
        _script = data['scriptText'] as String? ??
            data['script'] as String? ??
            data.toString();
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
          Wrap(
            spacing: 8,
            children: _types
                .map(
                  (t) => ChoiceChip(
                    label: Text(t),
                    selected: _type == t,
                    onSelected: (_) => setState(() => _type = t),
                  ),
                )
                .toList(),
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
          ],
        ],
      ),
    );
  }
}
