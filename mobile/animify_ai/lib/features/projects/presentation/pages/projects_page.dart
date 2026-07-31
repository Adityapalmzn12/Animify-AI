import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/l10n/app_localizations.dart';
import '../../../../core/widgets/async_state_views.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../providers/projects_provider.dart';

class ProjectsPage extends ConsumerWidget {
  const ProjectsPage({super.key});

  Future<void> _showCreateDialog(BuildContext context, WidgetRef ref) async {
    final nameController = TextEditingController();
    final descController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final created = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Project'),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppTextField(
                controller: nameController,
                label: 'Name',
                hint: 'My animation project',
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Name is required' : null,
              ),
              const SizedBox(height: 12),
              AppTextField(
                controller: descController,
                label: 'Description',
                hint: 'Optional',
                maxLines: 2,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              if (formKey.currentState!.validate()) {
                Navigator.pop(ctx, true);
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );

    if (created != true || !context.mounted) return;

    try {
      await ref.read(projectsProvider.notifier).create(
            name: nameController.text.trim(),
            description: descController.text.trim(),
          );
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Project created')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create project: $e')),
        );
      }
    } finally {
      nameController.dispose();
      descController.dispose();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final projectsAsync = ref.watch(projectsProvider);
    final dateFormat = DateFormat.MMMd();

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.projects),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => _showCreateDialog(context, ref),
          ),
        ],
      ),
      body: projectsAsync.when(
        loading: () => const SkeletonList(),
        error: (error, _) => ErrorState(
          title: 'Failed to load projects',
          message: error.toString(),
          onRetry: () => ref.invalidate(projectsProvider),
        ),
        data: (projects) {
          if (projects.isEmpty) {
            return EmptyState(
              icon: Icons.folder_open_outlined,
              title: 'No projects yet',
              message: 'Organize your AI jobs into projects.',
              actionLabel: 'Create Project',
              onAction: () => _showCreateDialog(context, ref),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.read(projectsProvider.notifier).refresh(),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: projects.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final project = projects[index];
                return Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      child: Text(project.name.substring(0, 1).toUpperCase()),
                    ),
                    title: Text(project.name),
                    subtitle: Text(
                      '${project.jobCount} jobs · Updated ${dateFormat.format(project.updatedAt)}',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/projects/${project.id}'),
                  ),
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCreateDialog(context, ref),
        child: const Icon(Icons.add),
      ),
    );
  }
}
