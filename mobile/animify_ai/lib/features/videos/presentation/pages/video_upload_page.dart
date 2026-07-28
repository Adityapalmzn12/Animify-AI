import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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

  @override
  void dispose() {
    _videoController?.dispose();
    super.dispose();
  }

  Future<void> _pickVideo() async {
    if (_isPickingFile) return;
    
    setState(() {
      _isPickingFile = true;
    });
    
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.video,
        allowMultiple: false,
      );

    if (result != null && result.files.isNotEmpty) {
      final file = result.files.first;
      
      if (file.size > AppConstants.maxUploadSizeBytes) {
        _showError('File size exceeds 50MB limit');
        return;
      }

      setState(() {
        _selectedFile = file;
      });

      if (file.path != null) {
        _videoController?.dispose();
        _videoController = VideoPlayerController.file(File(file.path!))
          ..initialize().then((_) {
            if (_videoController!.value.duration.inSeconds > AppConstants.maxVideoDurationSeconds) {
              _showError('Video duration exceeds 3 minutes limit');
              _selectedFile = null;
              _videoController?.dispose();
              _videoController = null;
            }
            setState(() {});
          });
      }
    }
    } catch (e) {
      if (e.toString().contains('multiple_request')) {
        // Ignore multiple request error
      } else {
        _showError('Failed to pick video: $e');
      }
    } finally {
      setState(() {
        _isPickingFile = false;
      });
    }
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
          mimeType: 'video/mp4',
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

    // Refresh the videos list
    ref.read(videoJobsProvider.notifier).refresh();

    if (mounted) {
      context.pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Video processing started!'),
          backgroundColor: Colors.green,
        ),
      );
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
                    child: AppButton(
                      onPressed: (_currentStep == 0 && _selectedFile == null) ||
                              uploadState.isUploading
                          ? null
                          : details.onStepContinue,
                      isLoading: uploadState.isUploading,
                      child: Text(_currentStep == 0 ? 'Upload & Continue' : 'Continue'),
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
    if (_selectedFile != null && _videoController?.value.isInitialized == true) {
      return Column(
        children: [
          AspectRatio(
            aspectRatio: _videoController!.value.aspectRatio,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: VideoPlayer(_videoController!),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _selectedFile!.name,
                style: Theme.of(context).textTheme.bodyMedium,
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
              'MP4, MOV, AVI, WebM up to 50MB\nMax 3 minutes duration',
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
            _buildTemplateCard('anime', 'Anime Style', Icons.animation),
            _buildTemplateCard('cartoon', 'Cartoon', Icons.face),
            _buildTemplateCard('3d', '3D Animation', Icons.view_in_ar),
            _buildTemplateCard('artistic', 'Artistic', Icons.brush),
          ],
        ),
      ],
    );
  }

  Widget _buildTemplateCard(String id, String name, IconData icon) {
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
