import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/async_state_views.dart';

class CreativeStudioPage extends ConsumerStatefulWidget {
  final String? initialMode;

  const CreativeStudioPage({super.key, this.initialMode});

  @override
  ConsumerState<CreativeStudioPage> createState() => _CreativeStudioPageState();
}

class _CreativeStudioPageState extends ConsumerState<CreativeStudioPage> {
  final _promptController = TextEditingController();
  final _brandController = TextEditingController();
  List<Map<String, dynamic>> _modes = [];
  String? _selectedMode;
  bool _loadingModes = true;
  bool _submitting = false;
  // Off by default — animate costs extra video credits.
  bool _animate = false;
  String? _resultUrl;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selectedMode = widget.initialMode;
    _loadModes();
  }

  @override
  void dispose() {
    _promptController.dispose();
    _brandController.dispose();
    super.dispose();
  }

  Future<void> _loadModes() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get<dynamic>('/studio/modes');
      final data = res.data;
      final list = data is List
          ? data
          : (data is Map && data['data'] is List)
              ? data['data'] as List
              : <dynamic>[];
      setState(() {
        _modes = list
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        _selectedMode ??=
            _modes.isNotEmpty ? _modes.first['mode'] as String? : 'logo';
        _loadingModes = false;
      });
    } catch (e) {
      setState(() {
        _loadingModes = false;
        _error = e.toString();
        // Offline fallback modes
        _modes = const [
          {'mode': 'logo', 'title': 'Logo Maker', 'subtitle': 'Company logos'},
          {
            'mode': 'fashion',
            'title': 'Fashion Designer',
            'subtitle': 'Clothing concepts'
          },
          {
            'mode': 'ghibli',
            'title': 'Ghibli Studio',
            'subtitle': 'Ghibli-style art'
          },
          {
            'mode': 'anime',
            'title': 'Anime Art',
            'subtitle': 'Anime key visuals'
          },
          {
            'mode': 'prompt_to_video',
            'title': 'Prompt → Video',
            'subtitle': 'AI text to video'
          },
          {
            'mode': 'product',
            'title': 'Product Shot',
            'subtitle': 'E-commerce visuals'
          },
          {
            'mode': 'thumbnail',
            'title': 'Thumbnail Pro',
            'subtitle': 'YouTube thumbnails'
          },
          {
            'mode': 'character',
            'title': 'Character IP',
            'subtitle': 'Mascot design'
          },
        ];
        _selectedMode ??= 'logo';
      });
    }
  }

  Future<void> _generate() async {
    final prompt = _promptController.text.trim();
    if (prompt.length < 3 || _selectedMode == null) return;

    setState(() {
      _submitting = true;
      _resultUrl = null;
      _error = null;
    });

    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post<Map<String, dynamic>>(
        '/studio/generate',
        data: {
          'mode': _selectedMode,
          'prompt': prompt,
          if (_brandController.text.trim().isNotEmpty)
            'brandName': _brandController.text.trim(),
          'animate': _animate,
          'aspect': '1:1',
        },
      );

      final data = res.data ?? {};
      final url = data['resultUrl'] as String? ??
          (data['imageJob'] is Map
              ? (data['imageJob'] as Map)['resultUrl'] as String?
              : null);
      final jobId = data['id'] as String? ??
          (data['videoJob'] is Map
              ? (data['videoJob'] as Map)['id'] as String?
              : null);

      setState(() => _resultUrl = url);

      if (mounted) {
        final isVideo = _selectedMode == 'prompt_to_video' ||
            _selectedMode == 'story_reel' ||
            _animate;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              url != null
                  ? 'Created successfully'
                  : 'Job started — opening Videos…',
            ),
          ),
        );
        if (isVideo && jobId != null) {
          context.go('/videos/$jobId');
        } else if (isVideo) {
          context.go(AppRoutes.videos);
        }
      }
    } catch (e) {
      setState(() => _error = e.toString());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isVideoMode = _selectedMode == 'prompt_to_video' ||
        _selectedMode == 'story_reel';

    return Scaffold(
      appBar: AppBar(title: const Text('Creative Studio')),
      body: _loadingModes
          ? const SkeletonList(itemCount: 6)
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'Think beyond video — logos, fashion, Ghibli & more',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _modes.map((m) {
                    final mode = m['mode'] as String? ?? '';
                    final selected = mode == _selectedMode;
                    return ChoiceChip(
                      selected: selected,
                      label: Text(m['title']?.toString() ?? mode),
                      onSelected: (_) => setState(() => _selectedMode = mode),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
                AppTextField(
                  controller: _promptController,
                  label: 'Prompt',
                  hint: _hintForMode(_selectedMode),
                  maxLines: 4,
                ),
                const SizedBox(height: 12),
                if (_selectedMode == 'logo' ||
                    _selectedMode == 'brand_kit' ||
                    _selectedMode == 'fashion')
                  AppTextField(
                    controller: _brandController,
                    label: 'Brand / company name (optional)',
                    hint: 'e.g. Ember Coffee',
                  ),
                if (!isVideoMode) ...[
                  const SizedBox(height: 8),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Also animate to video'),
                    subtitle: const Text('Uses Fal image→video when available'),
                    value: _animate,
                    onChanged: (v) => setState(() => _animate = v),
                  ),
                ],
                const SizedBox(height: 16),
                AppButton(
                  onPressed: _submitting ? null : _generate,
                  isLoading: _submitting,
                  child: Text(
                    isVideoMode ? 'Generate Video' : 'Generate with AI',
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  ErrorState(title: _error!, onRetry: _generate),
                ],
                if (_resultUrl != null) ...[
                  const SizedBox(height: 20),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: AspectRatio(
                      aspectRatio: 1,
                      child: Image.network(
                        _resultUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          color: AppColors.lightSurfaceVariant,
                          alignment: Alignment.center,
                          child: const Text('Preview unavailable'),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
    );
  }

  String _hintForMode(String? mode) {
    switch (mode) {
      case 'logo':
        return 'Fox mascot logo for a coffee brand, minimal, orange accent';
      case 'fashion':
        return 'Oversized linen bomber jacket, earth tones, runway look';
      case 'ghibli':
        return 'Girl on a train watching rain through the window';
      case 'prompt_to_video':
        return 'Anime city at night, neon lights, cinematic camera flyover';
      case 'thumbnail':
        return 'Shocked creator pointing at floating AI robot, bold colors';
      default:
        return 'Describe what you want to create...';
    }
  }
}
