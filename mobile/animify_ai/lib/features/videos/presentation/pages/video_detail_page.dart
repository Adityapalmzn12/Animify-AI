import 'package:chewie/chewie.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/app_button.dart';
import '../../domain/entities/video_job_entity.dart';
import '../providers/videos_provider.dart';

class VideoDetailPage extends ConsumerStatefulWidget {
  final String videoId;

  const VideoDetailPage({super.key, required this.videoId});

  @override
  ConsumerState<VideoDetailPage> createState() => _VideoDetailPageState();
}

class _VideoDetailPageState extends ConsumerState<VideoDetailPage> {
  VideoPlayerController? _videoController;
  ChewieController? _chewieController;
  String? _loadedUrl;

  @override
  void dispose() {
    _chewieController?.dispose();
    _videoController?.dispose();
    super.dispose();
  }

  Future<void> _ensurePlayer(String? url) async {
    if (url == null || url.isEmpty || url == _loadedUrl) return;

    _chewieController?.dispose();
    await _videoController?.dispose();

    final controller = VideoPlayerController.networkUrl(Uri.parse(url));
    await controller.initialize();

    if (!mounted) {
      await controller.dispose();
      return;
    }

    setState(() {
      _videoController = controller;
      _chewieController = ChewieController(
        videoPlayerController: controller,
        autoPlay: false,
        looping: false,
        allowFullScreen: true,
        allowMuting: true,
        showControls: true,
        materialProgressColors: ChewieProgressColors(
          playedColor: AppColors.primary,
          handleColor: AppColors.primary,
          backgroundColor: Colors.grey.shade700,
          bufferedColor: Colors.grey.shade500,
        ),
      );
      _loadedUrl = url;
    });
  }

  @override
  Widget build(BuildContext context) {
    final videoAsync = ref.watch(videoJobDetailProvider(widget.videoId));

    ref.listen(videoJobDetailProvider(widget.videoId), (previous, next) {
      next.whenData((video) {
        if (video != null && video.isCompleted) {
          final url =
              video.outputFile?.downloadUrl ?? video.inputFile?.downloadUrl;
          _ensurePlayer(url);
        }
      });
    });

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: const Text('Video Details'),
        actions: [
          PopupMenuButton<String>(
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'share',
                child: ListTile(
                  leading: Icon(Icons.share),
                  title: Text('Share'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              const PopupMenuItem(
                value: 'delete',
                child: ListTile(
                  leading: Icon(Icons.delete, color: Colors.red),
                  title: Text('Delete', style: TextStyle(color: Colors.red)),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ],
            onSelected: (value) async {
              if (value == 'delete') {
                await _confirmDelete(context);
              } else if (value == 'share') {
                final video = ref.read(videoJobDetailProvider(widget.videoId)).valueOrNull;
                final url = video?.outputFile?.downloadUrl ??
                    video?.inputFile?.downloadUrl;
                if (url != null) {
                  await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
                }
              }
            },
          ),
        ],
      ),
      body: videoAsync.when(
        data: (video) {
          if (video == null) {
            return const Center(child: Text('Video not found'));
          }
          if (video.isCompleted && _chewieController == null) {
            final url =
                video.outputFile?.downloadUrl ?? video.inputFile?.downloadUrl;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _ensurePlayer(url);
            });
          }
          return _buildContent(context, video);
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline,
                size: 48,
                color: Theme.of(context).colorScheme.error,
              ),
              const SizedBox(height: 16),
              const Text('Failed to load video details'),
              const SizedBox(height: 8),
              ElevatedButton(
                onPressed: () => ref
                    .read(videoJobDetailProvider(widget.videoId).notifier)
                    .load(),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, VideoJobEntity video) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildVideoPreview(context, video),
          const SizedBox(height: 24),
          _buildStatusSection(context, video),
          const SizedBox(height: 24),
          _buildDetailsSection(context, video),
          const SizedBox(height: 24),
          _buildSettingsSection(context, video),
          if (video.canDownload ||
              (video.isCompleted &&
                  (video.outputFile?.downloadUrl != null ||
                      video.inputFile?.downloadUrl != null))) ...[
            const SizedBox(height: 24),
            _buildDownloadButton(context, video),
          ],
        ],
      ),
    );
  }

  Widget _buildVideoPreview(BuildContext context, VideoJobEntity video) {
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(16),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (video.isCompleted &&
                _chewieController != null &&
                _videoController?.value.isInitialized == true)
              Chewie(controller: _chewieController!)
            else if (video.isProcessing ||
                video.status == VideoJobStatus.pending)
              Container(
                color: Colors.black.withValues(alpha: 0.7),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: 64,
                      height: 64,
                      child: CircularProgressIndicator(
                        value: video.progress > 0 ? video.progress / 100 : null,
                        color: Colors.white,
                        strokeWidth: 4,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      '${video.progress}%',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      video.currentStep ?? _statusLabel(video.status),
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.white.withValues(alpha: 0.85),
                          ),
                    ),
                  ],
                ),
              )
            else if (video.isFailed)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red, size: 48),
                    const SizedBox(height: 12),
                    const Text(
                      'Processing failed',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'See error details below',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              )
            else
              const Icon(Icons.video_file, size: 64, color: Colors.white54),
          ],
        ),
      ),
    );
  }

  String _statusLabel(VideoJobStatus status) {
    switch (status) {
      case VideoJobStatus.pending:
        return 'Pending';
      case VideoJobStatus.queued:
        return 'In queue';
      case VideoJobStatus.processing:
        return 'Processing';
      case VideoJobStatus.completed:
        return 'Completed';
      case VideoJobStatus.failed:
        return 'Failed';
      case VideoJobStatus.cancelled:
        return 'Cancelled';
    }
  }

  Widget _buildStatusSection(BuildContext context, VideoJobEntity video) {
    Color statusColor;
    IconData statusIcon;
    String statusText;

    switch (video.status) {
      case VideoJobStatus.pending:
        statusColor = Colors.orange;
        statusIcon = Icons.schedule;
        statusText = 'Pending';
        break;
      case VideoJobStatus.queued:
        statusColor = Colors.blue;
        statusIcon = Icons.queue;
        statusText = 'In Queue';
        break;
      case VideoJobStatus.processing:
        statusColor = AppColors.primary;
        statusIcon = Icons.autorenew;
        statusText = 'Processing';
        break;
      case VideoJobStatus.completed:
        statusColor = AppColors.success;
        statusIcon = Icons.check_circle;
        statusText = 'Completed';
        break;
      case VideoJobStatus.failed:
        statusColor = AppColors.error;
        statusIcon = Icons.error;
        statusText = 'Failed';
        break;
      case VideoJobStatus.cancelled:
        statusColor = Colors.grey;
        statusIcon = Icons.cancel;
        statusText = 'Cancelled';
        break;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(statusIcon, color: statusColor, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  statusText,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: statusColor,
                        fontWeight: FontWeight.w600,
                      ),
                ),
                if (video.currentStep != null)
                  Text(
                    video.currentStep!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: statusColor,
                        ),
                  ),
                if (video.errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: SelectableText(
                      video.errorMessage!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: statusColor,
                          ),
                    ),
                  ),
                if (video.isProcessing || video.status == VideoJobStatus.pending)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: LinearProgressIndicator(
                      value: video.progress > 0 ? video.progress / 100 : null,
                      color: statusColor,
                      backgroundColor: statusColor.withValues(alpha: 0.2),
                    ),
                  ),
              ],
            ),
          ),
          if (video.isProcessing || video.status == VideoJobStatus.pending)
            Text(
              '${video.progress}%',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: statusColor,
                    fontWeight: FontWeight.bold,
                  ),
            ),
        ],
      ),
    );
  }

  Widget _buildDetailsSection(BuildContext context, VideoJobEntity video) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Details',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 12),
        _buildDetailRow(
          context,
          'File Name',
          video.inputFile?.originalName ?? '-',
        ),
        _buildDetailRow(
          context,
          'Duration',
          video.inputFile?.durationSeconds != null
              ? '${video.inputFile!.durationSeconds!.toStringAsFixed(0)}s'
              : '-',
        ),
        _buildDetailRow(context, 'Template', video.template?.name ?? 'Default'),
        _buildDetailRow(context, 'Created', _formatDateTime(video.createdAt)),
        if (video.completedAt != null)
          _buildDetailRow(
            context,
            'Completed',
            _formatDateTime(video.completedAt!),
          ),
      ],
    );
  }

  Widget _buildDetailRow(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsSection(BuildContext context, VideoJobEntity video) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Processing Settings',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            if (video.settings.removeBackground)
              _buildSettingChip(context, 'Background Removal'),
            if (video.settings.enhanceFace)
              _buildSettingChip(context, 'Face Enhancement'),
            if (video.settings.enhanceAudio)
              _buildSettingChip(context, 'Audio Enhancement'),
            if (video.settings.generateSubtitles)
              _buildSettingChip(context, 'Subtitles'),
            _buildSettingChip(
              context,
              video.settings.outputQuality.toUpperCase(),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSettingChip(BuildContext context, String label) {
    return Chip(
      label: Text(label),
      backgroundColor: Theme.of(context).colorScheme.primaryContainer,
      labelStyle: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: Theme.of(context).colorScheme.onPrimaryContainer,
          ),
      side: BorderSide.none,
      padding: const EdgeInsets.symmetric(horizontal: 4),
    );
  }

  Widget _buildDownloadButton(BuildContext context, VideoJobEntity video) {
    return AppButton.gradient(
      onPressed: () async {
        final url =
            video.outputFile?.downloadUrl ?? video.inputFile?.downloadUrl;
        if (url == null) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Download URL not available')),
          );
          return;
        }
        final uri = Uri.parse(url);
        final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (!ok && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not open download link')),
          );
        }
      },
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.download, color: Colors.white),
          SizedBox(width: 8),
          Text('Download Video'),
        ],
      ),
    );
  }

  String _formatDateTime(DateTime dateTime) {
    return '${dateTime.day}/${dateTime.month}/${dateTime.year} ${dateTime.hour}:${dateTime.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Video'),
        content: const Text(
          'Are you sure you want to delete this video? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      await ref
          .read(videoJobDetailProvider(widget.videoId).notifier)
          .delete();
      await ref.read(videoJobsProvider.notifier).refresh();
      if (!mounted) return;
      context.pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Delete failed: $e')),
      );
    }
  }
}
