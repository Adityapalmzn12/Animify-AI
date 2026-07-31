import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';

class ProjectItem {
  final String id;
  final String name;
  final String? description;
  final int jobCount;
  final DateTime updatedAt;

  const ProjectItem({
    required this.id,
    required this.name,
    this.description,
    required this.jobCount,
    required this.updatedAt,
  });

  factory ProjectItem.fromJson(Map<String, dynamic> json) {
    final counts = json['_count'] as Map<String, dynamic>?;
    final updated = json['updatedAt'] ?? json['createdAt'];
    return ProjectItem(
      id: json['id'] as String,
      name: json['name'] as String? ?? 'Untitled',
      description: json['description'] as String?,
      jobCount: (counts?['jobs'] as num?)?.toInt() ?? 0,
      updatedAt: updated != null
          ? DateTime.parse(updated as String)
          : DateTime.now(),
    );
  }
}

class ProjectDetail {
  final String id;
  final String name;
  final String? description;
  final List<Map<String, dynamic>> jobs;

  const ProjectDetail({
    required this.id,
    required this.name,
    this.description,
    required this.jobs,
  });

  factory ProjectDetail.fromJson(Map<String, dynamic> json) {
    final jobsRaw = json['jobs'] as List<dynamic>? ?? [];
    return ProjectDetail(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      jobs: jobsRaw.cast<Map<String, dynamic>>(),
    );
  }
}

final projectsProvider =
    StateNotifierProvider<ProjectsNotifier, AsyncValue<List<ProjectItem>>>(
  (ref) => ProjectsNotifier(ref.watch(apiClientProvider)),
);

class ProjectsNotifier extends StateNotifier<AsyncValue<List<ProjectItem>>> {
  final ApiClient _apiClient;

  ProjectsNotifier(this._apiClient) : super(const AsyncValue.loading()) {
    load();
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('/projects');
      final data = response.data ?? {};
      final items = (data['items'] as List<dynamic>? ?? [])
          .map((e) => ProjectItem.fromJson(e as Map<String, dynamic>))
          .toList();
      state = AsyncValue.data(items);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> refresh() => load();

  Future<ProjectItem?> create({required String name, String? description}) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/projects',
        data: {
          'name': name,
          if (description != null && description.isNotEmpty)
            'description': description,
        },
      );
      await refresh();
      if (response.data != null) {
        return ProjectItem.fromJson(response.data!);
      }
      return null;
    } catch (e) {
      rethrow;
    }
  }
}

final projectDetailProvider = FutureProvider.family<ProjectDetail, String>(
  (ref, id) async {
    final apiClient = ref.watch(apiClientProvider);
    final response =
        await apiClient.get<Map<String, dynamic>>('/projects/$id');
    if (response.data == null) {
      throw Exception('Project not found');
    }
    return ProjectDetail.fromJson(response.data!);
  },
);
