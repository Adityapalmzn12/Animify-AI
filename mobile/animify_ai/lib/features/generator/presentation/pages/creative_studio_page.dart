import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/async_state_views.dart';
import '../../../../core/widgets/themed_choice_chip.dart';
import '../../../../core/widgets/video_duration_chips.dart';
import '../../../wallet/presentation/providers/pricing_provider.dart';

class CreativeStudioPage extends ConsumerStatefulWidget {
  final String? initialMode;
  final String? initialPrompt;

  const CreativeStudioPage({
    super.key,
    this.initialMode,
    this.initialPrompt,
  });

  @override
  ConsumerState<CreativeStudioPage> createState() => _CreativeStudioPageState();
}

class _CreativeStudioPageState extends ConsumerState<CreativeStudioPage> {
  final _promptController = TextEditingController();
  final _brandController = TextEditingController();
  final _picker = ImagePicker();
  List<Map<String, dynamic>> _modes = [];
  String? _selectedMode;
  bool _loadingModes = true;
  bool _submitting = false;
  bool _animate = false;
  int _duration = 30;
  final List<String> _characterFileIds = [];
  String? _resultUrl;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selectedMode = widget.initialMode;
    if (widget.initialPrompt != null) {
      _promptController.text = widget.initialPrompt!;
    }
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
            'mode': 'story_reel',
            'title': 'Story Reel',
            'subtitle': 'Scripted scenes + audio'
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
          {
            'mode': 'ppt',
            'title': 'PPT Maker',
            'subtitle': 'AI PowerPoint decks'
          },
        ];
        _selectedMode ??= 'logo';
      });
    }
  }

  Future<void> _pickCharacter() async {
    if (_characterFileIds.length >= 4) return;
    final picked = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 88,
    );
    if (picked == null) return;
    try {
      final uploader = ref.read(mediaUploadServiceProvider);
      final id = await uploader.uploadFile(
        filePath: picked.path,
        mimeType: uploader.guessImageMime(picked.path),
      );
      if (mounted) {
        setState(() => _characterFileIds.add(id));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Character upload failed: $e')),
        );
      }
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
      final isVideo = _selectedMode == 'prompt_to_video' ||
          _selectedMode == 'story_reel';
      final res = await api.post<Map<String, dynamic>>(
        '/studio/generate',
        data: {
          'mode': _selectedMode,
          'prompt': prompt,
          if (_brandController.text.trim().isNotEmpty)
            'brandName': _brandController.text.trim(),
          'animate': _animate,
          'aspect': isVideo ? '9:16' : '1:1',
          if (isVideo || _animate) 'duration': _duration,
          if (isVideo || _animate) 'addAudio': true,
          if ((isVideo || _animate) && _characterFileIds.isNotEmpty)
            'characterImageFileIds': _characterFileIds,
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              url != null
                  ? 'Created successfully'
                  : 'Job started — opening Videos…',
            ),
          ),
        );
        if (isVideo || _animate) {
          if (jobId != null) {
            context.go('/videos/$jobId');
          } else {
            context.go(AppRoutes.videos);
          }
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
                    final credits = m['credits'];
                    final title = m['title']?.toString() ?? mode;
                    final label = credits != null ? '$title · $credits cr' : title;
                    return ThemedChoiceChip(
                      selected: selected,
                      label: label,
                      onSelected: (_) => setState(() => _selectedMode = mode),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),
                AppTextField(
                  controller: _promptController,
                  label: isVideoMode ? 'Script / scenes' : 'Prompt',
                  hint: _hintForMode(_selectedMode),
                  maxLines: isVideoMode ? 8 : 4,
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
                if (isVideoMode || _animate) ...[
                  VideoDurationChips(
                    value: _duration,
                    onChanged: (d) => setState(() => _duration = d),
                    creditsByDuration: ref
                        .watch(creditPricingProvider)
                        .valueOrNull
                        ?.videoCredits,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Character images (optional)',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Upload your cast — used across scenes for consistency',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ..._characterFileIds.asMap().entries.map(
                            (e) => InputChip(
                              label: Text('Char ${e.key + 1}'),
                              onDeleted: () => setState(
                                () => _characterFileIds.removeAt(e.key),
                              ),
                            ),
                          ),
                      ActionChip(
                        avatar: const Icon(Icons.add_photo_alternate_outlined),
                        label: const Text('Add character'),
                        onPressed: _characterFileIds.length >= 4
                            ? null
                            : _pickCharacter,
                      ),
                    ],
                  ),
                ],
                if (!isVideoMode) ...[
                  const SizedBox(height: 8),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Also animate to video'),
                    subtitle: Text(
                      'Creates a ${_duration}s video with voice after the image',
                    ),
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
      case 'story_reel':
        return 'Scene 1: Hero walks into neon city at night\n'
            'Scene 2: Close-up smile, rain on glass\n'
            'Scene 3: Wide shot, camera rises over rooftops';
      case 'thumbnail':
        return 'Shocked creator pointing at floating AI robot, bold colors';
      case 'ppt':
        return 'Pitch deck for an AI video app: problem, solution, market, roadmap, CTA';
      default:
        return 'Describe what you want to create...';
    }
  }
}
