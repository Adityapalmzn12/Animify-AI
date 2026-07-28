import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../domain/entities/video_job_entity.dart';

class VideoJobCard extends StatelessWidget {
  final VideoJobEntity job;
  final VoidCallback? onTap;

  const VideoJobCard({
    super.key,
    required this.job,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              _buildThumbnail(context),
              const SizedBox(width: 12),
              Expanded(child: _buildInfo(context)),
              _buildStatus(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildThumbnail(BuildContext context) {
    return Container(
      width: 80,
      height: 60,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: job.inputFile?.thumbnailUrl != null
            ? Image.network(
                job.inputFile!.thumbnailUrl!,
                fit: BoxFit.cover,
              )
            : Icon(
                Icons.video_file,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
      ),
    );
  }

  Widget _buildInfo(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          job.inputFile?.originalName ?? 'Untitled Video',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 4),
        Text(
          job.template?.name ?? 'Default Template',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          _formatDate(job.createdAt),
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
        ),
      ],
    );
  }

  Widget _buildStatus(BuildContext context) {
    Color statusColor;
    IconData statusIcon;
    String? progressText;

    switch (job.status) {
      case VideoJobStatus.pending:
        statusColor = Colors.orange;
        statusIcon = Icons.schedule;
        break;
      case VideoJobStatus.queued:
        statusColor = Colors.blue;
        statusIcon = Icons.queue;
        break;
      case VideoJobStatus.processing:
        statusColor = AppColors.primary;
        statusIcon = Icons.autorenew;
        progressText = '${job.progress}%';
        break;
      case VideoJobStatus.completed:
        statusColor = AppColors.success;
        statusIcon = Icons.check_circle;
        break;
      case VideoJobStatus.failed:
        statusColor = AppColors.error;
        statusIcon = Icons.error;
        break;
      case VideoJobStatus.cancelled:
        statusColor = Colors.grey;
        statusIcon = Icons.cancel;
        break;
    }

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: statusColor.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: job.isProcessing
              ? Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox(
                      width: 32,
                      height: 32,
                      child: CircularProgressIndicator(
                        value: job.progress / 100,
                        strokeWidth: 3,
                        color: statusColor,
                        backgroundColor: statusColor.withValues(alpha: 0.2),
                      ),
                    ),
                    Text(
                      '${job.progress}',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: statusColor,
                            fontWeight: FontWeight.bold,
                            fontSize: 10,
                          ),
                    ),
                  ],
                )
              : Icon(statusIcon, color: statusColor, size: 20),
        ),
      ],
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inDays == 0) {
      if (diff.inHours == 0) {
        return '${diff.inMinutes}m ago';
      }
      return '${diff.inHours}h ago';
    } else if (diff.inDays == 1) {
      return 'Yesterday';
    } else if (diff.inDays < 7) {
      return '${diff.inDays}d ago';
    }
    return '${date.day}/${date.month}/${date.year}';
  }
}
