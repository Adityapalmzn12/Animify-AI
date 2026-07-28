import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/app_button.dart';
import '../../domain/entities/video_job_entity.dart';
import '../providers/videos_provider.dart';

class VideoDetailPage extends ConsumerWidget {
  final String videoId;

  const VideoDetailPage({super.key, required this.videoId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final videoAsync = ref.watch(videoJobDetailProvider(videoId));

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: const Text('Video Details'),
        actions: [
          PopupMenuButton(
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
            onSelected: (value) {
              if (value == 'delete') {
                _showDeleteConfirmation(context);
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
                onPressed: () => ref.refresh(videoJobDetailProvider(videoId)),
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
          if (video.canDownload) ...[
            const SizedBox(height: 24),
            _buildDownloadButton(context, video),
          ],
        ],
      ),
    );
  }

  Widget _buildVideoPreview(BuildContext context, VideoJobEntity video) {
    final thumbnailUrl = video.inputFile?.thumbnailUrl ?? 
                         video.outputFile?.thumbnailUrl;

    return AspectRatio(
      aspectRatio: 16 / 9,
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (thumbnailUrl != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Image.network(
                  thumbnailUrl,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  height: double.infinity,
                ),
              )
            else
              Icon(
                Icons.video_file,
                size: 64,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            if (video.isCompleted)
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.play_arrow,
                  color: Colors.white,
                  size: 32,
                ),
              ),
            if (video.isProcessing)
              Container(
                color: Colors.black.withValues(alpha: 0.5),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularProgressIndicator(
                      value: video.progress / 100,
                      color: Colors.white,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      '${video.progress}%',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    if (video.currentStep != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        video.currentStep!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.white.withValues(alpha: 0.8),
                            ),
                      ),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
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
                if (video.errorMessage != null)
                  Text(
                    video.errorMessage!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: statusColor,
                        ),
                  ),
              ],
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
        _buildDetailRow(context, 'File Name', video.inputFile?.originalName ?? '-'),
        _buildDetailRow(
          context,
          'Duration',
          video.inputFile?.durationSeconds != null
              ? '${video.inputFile!.durationSeconds!.toStringAsFixed(0)}s'
              : '-',
        ),
        _buildDetailRow(context, 'Template', video.template?.name ?? 'Default'),
        _buildDetailRow(
          context,
          'Created',
          _formatDateTime(video.createdAt),
        ),
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
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
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
            _buildSettingChip(context, video.settings.outputQuality.toUpperCase()),
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
      onPressed: () {
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

  void _showDeleteConfirmation(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Video'),
        content: const Text('Are you sure you want to delete this video? This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              context.pop();
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}
