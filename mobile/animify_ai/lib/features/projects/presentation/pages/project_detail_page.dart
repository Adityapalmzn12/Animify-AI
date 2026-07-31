import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/widgets/async_state_views.dart';
import '../providers/projects_provider.dart';

class ProjectDetailPage extends ConsumerWidget {
  final String projectId;

  const ProjectDetailPage({super.key, required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projectAsync = ref.watch(projectDetailProvider(projectId));

    return Scaffold(
      appBar: AppBar(
        title: projectAsync.maybeWhen(
          data: (p) => Text(p.name),
          orElse: () => const Text('Project'),
        ),
      ),
      body: projectAsync.when(
        loading: () => const SkeletonList(itemCount: 4),
        error: (error, _) => ErrorState(
          title: 'Failed to load project',
          message: error.toString(),
          onRetry: () => ref.invalidate(projectDetailProvider(projectId)),
        ),
        data: (project) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (project.description != null &&
                  project.description!.isNotEmpty) ...[
                Text(
                  project.description!,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: 24),
              ],
              Text(
                'Jobs',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),
              if (project.jobs.isEmpty)
                const EmptyState(
                  icon: Icons.movie_creation_outlined,
                  title: 'No jobs yet',
                  message: 'Jobs linked to this project will appear here.',
                )
              else
                ...project.jobs.map(
                  (job) => Card(
                    child: ListTile(
                      leading: const Icon(Icons.auto_awesome),
                      title: Text(job['jobType']?.toString() ?? 'Job'),
                      subtitle: Text(job['status']?.toString() ?? ''),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
