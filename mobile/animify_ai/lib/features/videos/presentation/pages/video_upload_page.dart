import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/app_button.dart';
import '../../domain/entities/video_job_entity.dart';
import '../providers/videos_provider.dart';

class VideoUploadPage extends ConsumerStatefulWidget {
  const VideoUploadPage({super.key});

  @override
  ConsumerState<VideoUploadPage> createState() => _VideoUploadPageState();
}

class _VideoUploadPageState extends ConsumerState<VideoUploadPage> {
  PlatformFile? _selectedFile;
  VideoPlayerController? _videoController;
  String? _selectedTemplateId;
  VideoJobSettings _settings = const VideoJobSettings();
  int _currentStep = 0;
  bool _isPickingFile = false;
  final _imagePicker = ImagePicker();

  @override
  void dispose() {
    _videoController?.dispose();
    super.dispose();
  }

  Future<void> _pickVideo() async {
    if (_isPickingFile) return;

    final source = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Photo Library'),
              subtitle: const Text('Best for iPhone HEVC / HEIC videos'),
              onTap: () => Navigator.pop(context, 'gallery'),
            ),
            ListTile(
              leading: const Icon(Icons.videocam_outlined),
              title: const Text('Record Video'),
              onTap: () => Navigator.pop(context, 'camera'),
            ),
            ListTile(
              leading: const Icon(Icons.folder_outlined),
              title: const Text('Browse Files'),
              subtitle: const Text('MP4, MOV, M4V, HEVC, HEIC'),
              onTap: () => Navigator.pop(context, 'files'),
            ),
          ],
        ),
      ),
    );

    if (source == null || !mounted) return;

    setState(() => _isPickingFile = true);

    try {
      if (source == 'files') {
        await _pickFromFiles();
      } else {
        await _pickFromMediaLibrary(
          source == 'camera' ? ImageSource.camera : ImageSource.gallery,
        );
      }
    } catch (e) {
      if (!e.toString().contains('multiple_request')) {
        _showError('Failed to pick video: $e');
      }
    } finally {
      if (mounted) {
        setState(() => _isPickingFile = false);
      }
    }
  }

  Future<void> _pickFromMediaLibrary(ImageSource source) async {
    final picked = await _imagePicker.pickVideo(
      source: source,
      maxDuration: const Duration(seconds: AppConstants.maxVideoDurationSeconds),
    );
    if (picked == null) return;

    final file = File(picked.path);
    final size = await file.length();
    final name = picked.name.isNotEmpty
        ? picked.name
        : 'video_${DateTime.now().millisecondsSinceEpoch}.mov';

    await _setSelectedVideo(
      path: picked.path,
      name: name,
      size: size,
    );
  }

  Future<void> _pickFromFiles() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: AppConstants.allowedVideoFormats,
      allowMultiple: false,
      withData: false,
    );

    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    if (file.path == null) {
      _showError('Could not read the selected file');
      return;
    }

    await _setSelectedVideo(
      path: file.path!,
      name: file.name,
      size: file.size,
    );
  }

  Future<void> _setSelectedVideo({
    required String path,
    required String name,
    required int size,
  }) async {
    final ext = name.contains('.')
        ? name.split('.').last.toLowerCase()
        : path.split('.').last.toLowerCase();

    if (!AppConstants.allowedVideoFormats.contains(ext) &&
        ext.isNotEmpty &&
        ext != 'qt') {
      // Allow unknown extension when picked from Photos (often path has no useful ext)
      // but reject clearly unsupported document types.
      const blocked = {'jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx'};
      if (blocked.contains(ext)) {
        _showError('Please select a video file (MP4, MOV, HEVC/HEIC)');
        return;
      }
    }

    if (size > AppConstants.maxUploadSizeBytes) {
      _showError('File size exceeds 50MB limit');
      return;
    }

    final platformFile = PlatformFile(
      name: _normalizeVideoFileName(name, path),
      path: path,
      size: size,
    );

    setState(() => _selectedFile = platformFile);

    _videoController?.dispose();
    _videoController = VideoPlayerController.file(File(path));
    try {
      await _videoController!.initialize();
      if (_videoController!.value.duration.inSeconds >
          AppConstants.maxVideoDurationSeconds) {
        _showError('Video duration exceeds 3 minutes limit');
        _selectedFile = null;
        await _videoController?.dispose();
        _videoController = null;
      }
    } catch (e) {
      // HEVC/HEIC can fail preview on some simulators; still allow upload
      _showError(
        'Preview unavailable for this format, but you can still upload it.',
      );
    }
    if (mounted) setState(() {});
  }

  String _normalizeVideoFileName(String name, String path) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.heic') ||
        lower.endsWith('.heif') ||
        lower.endsWith('.hevc') ||
        lower.endsWith('.mov') ||
        lower.endsWith('.mp4') ||
        lower.endsWith('.m4v')) {
      return name;
    }

    final pathLower = path.toLowerCase();
    if (pathLower.endsWith('.heic')) return '$name.heic';
    if (pathLower.endsWith('.heif')) return '$name.heif';
    if (pathLower.endsWith('.hevc')) return '$name.hevc';
    if (pathLower.endsWith('.mov')) return '$name.mov';
    if (pathLower.endsWith('.m4v')) return '$name.m4v';
    if (pathLower.endsWith('.mp4')) return '$name.mp4';

    // iOS Photos often returns HEVC video without extension — treat as MOV
    return name.contains('.') ? name : '$name.mov';
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Theme.of(context).colorScheme.error,
      ),
    );
  }

  Future<void> _startUpload() async {
    if (_selectedFile == null || _selectedFile!.path == null) return;

    await ref.read(videoUploadProvider.notifier).uploadVideo(
          filePath: _selectedFile!.path!,
          fileName: _selectedFile!.name,
          fileSize: _selectedFile!.size,
        );
  }

  Future<void> _createJob() async {
    if (_selectedTemplateId == null || _selectedTemplateId!.isEmpty) {
      _showError('Please select a template');
      return;
    }

    await ref.read(videoUploadProvider.notifier).createJob(
          templateId: _selectedTemplateId!,
          settings: _settings,
        );

    final uploadState = ref.read(videoUploadProvider);

    if (uploadState.error != null) {
      _showError(uploadState.error!);
      return;
    }

    final jobId = uploadState.jobId;
    ref.read(videoJobsProvider.notifier).refresh();
    ref.read(videoUploadProvider.notifier).reset();

    if (!mounted) return;

    if (jobId != null) {
      context.go('/videos/$jobId');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Processing started — tracking progress...'),
          backgroundColor: Colors.green,
        ),
      );
    } else {
      context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final uploadState = ref.watch(videoUploadProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Video'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      body: Stepper(
        currentStep: _currentStep,
        onStepContinue: () async {
          if (_currentStep == 0 && _selectedFile != null) {
            await _startUpload();
            final uploadState = ref.read(videoUploadProvider);
            if (uploadState.error != null) {
              _showError(uploadState.error!);
              return;
            }
            if (uploadState.fileId != null) {
              setState(() => _currentStep = 1);
            }
          } else if (_currentStep == 1) {
            if (_selectedTemplateId == null) {
              _showError('Please select a template');
              return;
            }
            setState(() => _currentStep = 2);
          } else if (_currentStep == 2) {
            await _createJob();
          }
        },
        onStepCancel: () {
          if (_currentStep > 0) {
            setState(() => _currentStep--);
          } else {
            context.pop();
          }
        },
        controlsBuilder: (context, details) {
          return Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Row(
              children: [
                if (_currentStep < 2)
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (uploadState.isUploading) ...[
                          LinearProgressIndicator(
                            value: uploadState.uploadProgress > 0
                                ? uploadState.uploadProgress
                                : null,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Uploading ${(uploadState.uploadProgress * 100).toStringAsFixed(0)}%',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          const SizedBox(height: 12),
                        ],
                        AppButton(
                          onPressed: (_currentStep == 0 &&
                                      _selectedFile == null) ||
                                  uploadState.isUploading
                              ? null
                              : details.onStepContinue,
                          isLoading: uploadState.isUploading,
                          child: Text(
                            _currentStep == 0
                                ? 'Upload & Continue'
                                : 'Continue',
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  Expanded(
                    child: AppButton.gradient(
                      onPressed: uploadState.isProcessing ? null : details.onStepContinue,
                      isLoading: uploadState.isProcessing,
                      child: const Text('Start Processing'),
                    ),
                  ),
                if (_currentStep > 0) ...[
                  const SizedBox(width: 12),
                  TextButton(
                    onPressed: details.onStepCancel,
                    child: const Text('Back'),
                  ),
                ],
              ],
            ),
          );
        },
        steps: [
          Step(
            title: const Text('Select Video'),
            subtitle: _selectedFile != null 
                ? Text(_selectedFile!.name)
                : null,
            content: _buildSelectVideoStep(),
            isActive: _currentStep >= 0,
            state: _currentStep > 0 ? StepState.complete : StepState.indexed,
          ),
          Step(
            title: const Text('Choose Template'),
            content: _buildTemplateStep(),
            isActive: _currentStep >= 1,
            state: _currentStep > 1 ? StepState.complete : StepState.indexed,
          ),
          Step(
            title: const Text('Settings'),
            content: _buildSettingsStep(),
            isActive: _currentStep >= 2,
            state: _currentStep > 2 ? StepState.complete : StepState.indexed,
          ),
        ],
      ),
    );
  }

  Widget _buildSelectVideoStep() {
    if (_selectedFile != null) {
      final hasPreview = _videoController?.value.isInitialized == true;

      return Column(
        children: [
          if (hasPreview)
            AspectRatio(
              aspectRatio: _videoController!.value.aspectRatio,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: VideoPlayer(_videoController!),
              ),
            )
          else
            Container(
              height: 180,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Theme.of(context)
                    .colorScheme
                    .surfaceContainerHighest
                    .withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.videocam,
                    size: 48,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'HEVC / HEIC video ready to upload',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  _selectedFile!.name,
                  style: Theme.of(context).textTheme.bodyMedium,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              TextButton(
                onPressed: _pickVideo,
                child: const Text('Change'),
              ),
            ],
          ),
          Text(
            '${(_selectedFile!.size / 1024 / 1024).toStringAsFixed(1)} MB',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      );
    }

    return GestureDetector(
      onTap: _pickVideo,
      child: Container(
        height: 200,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: Theme.of(context).colorScheme.outlineVariant,
            width: 2,
            style: BorderStyle.solid,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                Icons.cloud_upload_outlined,
                color: Colors.white,
                size: 32,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Tap to select video',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'MP4, MOV, M4V, HEVC/HEIC up to 50MB\nMax 3 minutes duration',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTemplateStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Select an animation style for your video',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
        const SizedBox(height: 16),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.2,
          children: [
            _buildTemplateCard('anime', 'Anime Style', Icons.animation, 'Japanese anime look'),
            _buildTemplateCard('cartoon', 'Cartoon', Icons.face, '2D cartoon animation'),
            _buildTemplateCard('3d', '3D Animation', Icons.view_in_ar, 'CGI 3D film style'),
            _buildTemplateCard('artistic', 'Artistic', Icons.brush, 'Painted art style'),
          ],
        ),
      ],
    );
  }

  Widget _buildTemplateCard(String id, String name, IconData icon, String subtitle) {
    final isSelected = _selectedTemplateId == id;
    
    return GestureDetector(
      onTap: () {
        setState(() => _selectedTemplateId = id);
      },
      child: Container(
        decoration: BoxDecoration(
          color: isSelected 
              ? Theme.of(context).colorScheme.primaryContainer
              : Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected 
                ? Theme.of(context).colorScheme.primary
                : Theme.of(context).colorScheme.outlineVariant,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 32,
              color: isSelected 
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(height: 8),
            Text(
              name,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                    color: isSelected 
                        ? Theme.of(context).colorScheme.primary
                        : null,
                  ),
            ),
            const SizedBox(height: 2),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                subtitle,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingsStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSettingSwitch(
          'Remove Background',
          'Automatically remove video background',
          _settings.removeBackground,
          (value) => setState(() => _settings = _settings.copyWith(removeBackground: value)),
        ),
        _buildSettingSwitch(
          'Enhance Face',
          'Improve facial features and expressions',
          _settings.enhanceFace,
          (value) => setState(() => _settings = _settings.copyWith(enhanceFace: value)),
        ),
        _buildSettingSwitch(
          'Enhance Audio',
          'Clean up and improve audio quality',
          _settings.enhanceAudio,
          (value) => setState(() => _settings = _settings.copyWith(enhanceAudio: value)),
        ),
        _buildSettingSwitch(
          'Generate Subtitles',
          'Auto-generate subtitles from speech',
          _settings.generateSubtitles,
          (value) => setState(() => _settings = _settings.copyWith(generateSubtitles: value)),
        ),
        const SizedBox(height: 16),
        Text(
          'Output Quality',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: 8),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'sd', label: Text('SD')),
            ButtonSegment(value: 'hd', label: Text('HD')),
            ButtonSegment(value: 'fhd', label: Text('Full HD')),
          ],
          selected: {_settings.outputQuality},
          onSelectionChanged: (value) {
            setState(() => _settings = _settings.copyWith(outputQuality: value.first));
          },
        ),
      ],
    );
  }

  Widget _buildSettingSwitch(
    String title,
    String subtitle,
    bool value,
    ValueChanged<bool> onChanged,
  ) {
    return SwitchListTile(
      title: Text(title),
      subtitle: Text(
        subtitle,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
      ),
      value: value,
      onChanged: onChanged,
      contentPadding: EdgeInsets.zero,
    );
  }
}
