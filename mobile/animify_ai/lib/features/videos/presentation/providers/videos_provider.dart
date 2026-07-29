import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_client.dart';
import '../../domain/entities/video_job_entity.dart';

final recentVideosProvider = FutureProvider<List<VideoJobEntity>>((ref) async {
  final apiClient = ref.watch(apiClientProvider);

  try {
    final response = await apiClient.get<List<dynamic>>(
      '/videos/recent',
      queryParameters: {'limit': 5},
    );
    final data = response.data ?? [];
    return data
        .map((json) => VideoJobEntity.fromJson(json as Map<String, dynamic>))
        .toList();
  } catch (e) {
    return [];
  }
});

final videoJobsProvider =
    StateNotifierProvider<VideoJobsNotifier, AsyncValue<List<VideoJobEntity>>>(
        (ref) {
  return VideoJobsNotifier(ref.watch(apiClientProvider));
});

class VideoJobsNotifier extends StateNotifier<AsyncValue<List<VideoJobEntity>>> {
  final ApiClient _apiClient;
  int _currentPage = 1;
  bool _hasMore = true;
  String? _statusFilter;
  Timer? _pollTimer;

  VideoJobsNotifier(this._apiClient) : super(const AsyncValue.loading()) {
    loadVideos();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _syncPolling(List<VideoJobEntity> jobs) {
    final needsPoll = jobs.any(
      (job) =>
          job.status == VideoJobStatus.pending ||
          job.status == VideoJobStatus.queued ||
          job.status == VideoJobStatus.processing,
    );

    if (needsPoll) {
      _pollTimer ??= Timer.periodic(const Duration(seconds: 3), (_) {
        refresh(silent: true);
      });
    } else {
      _pollTimer?.cancel();
      _pollTimer = null;
    }
  }

  Future<void> loadVideos({String? status}) async {
    state = const AsyncValue.loading();
    _currentPage = 1;
    _statusFilter = status;
    _hasMore = true;

    try {
      final response = await _apiClient.get<List<dynamic>>(
        '/videos',
        queryParameters: {
          'page': _currentPage,
          'limit': 10,
          if (status != null && status != 'all') 'status': status,
        },
      );

      final data = response.data ?? [];
      final jobs = data
          .map((json) => VideoJobEntity.fromJson(json as Map<String, dynamic>))
          .toList();

      if (response.pagination != null) {
        _hasMore = response.pagination!.hasMore;
      }

      state = AsyncValue.data(jobs);
      _syncPolling(jobs);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> refresh({bool silent = false}) async {
    if (!silent) {
      // keep current list visible while refreshing
    }
    _currentPage = 1;
    try {
      final response = await _apiClient.get<List<dynamic>>(
        '/videos',
        queryParameters: {
          'page': 1,
          'limit': 10,
          if (_statusFilter != null && _statusFilter != 'all')
            'status': _statusFilter,
        },
      );

      final data = response.data ?? [];
      final jobs = data
          .map((json) => VideoJobEntity.fromJson(json as Map<String, dynamic>))
          .toList();

      if (response.pagination != null) {
        _hasMore = response.pagination!.hasMore;
      }

      state = AsyncValue.data(jobs);
      _syncPolling(jobs);
    } catch (e, st) {
      if (!silent) {
        state = AsyncValue.error(e, st);
      }
    }
  }

  Future<void> loadMore() async {
    if (!_hasMore) return;

    final currentJobs = state.valueOrNull ?? [];
    _currentPage++;

    try {
      final response = await _apiClient.get<List<dynamic>>(
        '/videos',
        queryParameters: {
          'page': _currentPage,
          'limit': 10,
          if (_statusFilter != null && _statusFilter != 'all')
            'status': _statusFilter,
        },
      );

      final data = response.data ?? [];
      final newJobs = data
          .map((json) => VideoJobEntity.fromJson(json as Map<String, dynamic>))
          .toList();

      if (response.pagination != null) {
        _hasMore = response.pagination!.hasMore;
      }

      final merged = [...currentJobs, ...newJobs];
      state = AsyncValue.data(merged);
      _syncPolling(merged);
    } catch (e) {
      _currentPage--;
    }
  }

  void filterByStatus(String? status) {
    loadVideos(status: status);
  }

  Future<void> deleteJob(String jobId) async {
    await _apiClient.delete('/videos/$jobId');
    await refresh();
  }
}

final videoJobDetailProvider =
    StateNotifierProvider.family<VideoJobDetailNotifier, AsyncValue<VideoJobEntity?>, String>(
  (ref, id) => VideoJobDetailNotifier(ref.watch(apiClientProvider), id),
);

class VideoJobDetailNotifier
    extends StateNotifier<AsyncValue<VideoJobEntity?>> {
  final ApiClient _apiClient;
  final String jobId;
  Timer? _pollTimer;

  VideoJobDetailNotifier(this._apiClient, this.jobId)
      : super(const AsyncValue.loading()) {
    load();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> load({bool silent = false}) async {
    if (!silent) {
      state = const AsyncValue.loading();
    }

    try {
      final response =
          await _apiClient.get<Map<String, dynamic>>('/videos/$jobId');
      if (response.data != null) {
        final job = VideoJobEntity.fromJson(response.data!);
        state = AsyncValue.data(job);
        _syncPolling(job);
      } else {
        state = const AsyncValue.data(null);
      }
    } catch (e, st) {
      if (!silent) {
        state = AsyncValue.error(e, st);
      }
    }
  }

  void _syncPolling(VideoJobEntity job) {
    final needsPoll = job.status == VideoJobStatus.pending ||
        job.status == VideoJobStatus.queued ||
        job.status == VideoJobStatus.processing;

    if (needsPoll) {
      _pollTimer ??= Timer.periodic(const Duration(seconds: 2), (_) {
        load(silent: true);
      });
    } else {
      _pollTimer?.cancel();
      _pollTimer = null;
    }
  }

  Future<void> delete() async {
    await _apiClient.delete('/videos/$jobId');
  }
}

final videoUploadProvider =
    StateNotifierProvider<VideoUploadNotifier, VideoUploadState>((ref) {
  return VideoUploadNotifier(ref.watch(apiClientProvider));
});

class VideoUploadState {
  final bool isUploading;
  final bool isProcessing;
  final double uploadProgress;
  final String? error;
  final String? fileId;
  final String? jobId;

  const VideoUploadState({
    this.isUploading = false,
    this.isProcessing = false,
    this.uploadProgress = 0,
    this.error,
    this.fileId,
    this.jobId,
  });

  VideoUploadState copyWith({
    bool? isUploading,
    bool? isProcessing,
    double? uploadProgress,
    String? error,
    String? fileId,
    String? jobId,
    bool clearError = false,
  }) {
    return VideoUploadState(
      isUploading: isUploading ?? this.isUploading,
      isProcessing: isProcessing ?? this.isProcessing,
      uploadProgress: uploadProgress ?? this.uploadProgress,
      error: clearError ? null : (error ?? this.error),
      fileId: fileId ?? this.fileId,
      jobId: jobId ?? this.jobId,
    );
  }
}

class VideoUploadNotifier extends StateNotifier<VideoUploadState> {
  final ApiClient _apiClient;

  VideoUploadNotifier(this._apiClient) : super(const VideoUploadState());

  String _guessMimeType(String fileName) {
    final lower = fileName.toLowerCase();
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (lower.endsWith('.m4v')) return 'video/x-m4v';
    if (lower.endsWith('.hevc')) return 'video/hevc';
    if (lower.endsWith('.heic')) return 'video/quicktime';
    if (lower.endsWith('.heif')) return 'video/quicktime';
    if (lower.endsWith('.avi')) return 'video/x-msvideo';
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.mkv')) return 'video/x-matroska';
    return 'video/mp4';
  }

  Future<void> uploadVideo({
    required String filePath,
    required String fileName,
    required int fileSize,
    String? mimeType,
  }) async {
    state = state.copyWith(
      isUploading: true,
      uploadProgress: 0,
      clearError: true,
    );

    final resolvedMime = mimeType ?? _guessMimeType(fileName);

    try {
      // Step 1: Get signed upload URL
      final urlResponse = await _apiClient.post<Map<String, dynamic>>(
        '/videos/upload-url',
        data: {
          'fileName': fileName,
          'mimeType': resolvedMime,
        },
      );

      final payload = urlResponse.data ?? {};
      final tempFileId = payload['fileId'] as String?;
      final uploadUrl = payload['uploadUrl'] as String?;

      if (tempFileId == null || uploadUrl == null) {
        throw Exception('Invalid upload URL response from server');
      }

      // Step 2: PUT file bytes to Supabase signed URL
      await _apiClient.putFileToUrl(
        uploadUrl,
        filePath: filePath,
        mimeType: resolvedMime,
        onSendProgress: (sent, total) {
          if (total > 0) {
            state = state.copyWith(uploadProgress: sent / total);
          }
        },
      );

      state = state.copyWith(uploadProgress: 1.0);

      // Step 3: Confirm upload and store DB VideoFile id
      final confirmResponse = await _apiClient.post<Map<String, dynamic>>(
        '/videos/confirm-upload',
        data: {
          'fileId': tempFileId,
          'fileName': fileName,
          'fileSize': fileSize,
          'mimeType': resolvedMime,
        },
      );

      final videoFileId = confirmResponse.data?['id'] as String?;
      if (videoFileId == null) {
        throw Exception('Upload confirmed but no file id returned');
      }

      state = state.copyWith(
        isUploading: false,
        fileId: videoFileId,
        uploadProgress: 1.0,
        clearError: true,
      );
    } catch (e) {
      state = state.copyWith(
        isUploading: false,
        error: e.toString(),
      );
    }
  }

  Future<void> createJob({
    required String templateId,
    required VideoJobSettings settings,
  }) async {
    if (state.fileId == null) return;

    state = state.copyWith(isProcessing: true, clearError: true);

    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        '/videos',
        data: {
          'inputFileId': state.fileId,
          'templateId': templateId,
          'settings': settings.toJson(),
        },
      );

      final jobId = response.data?['id'] as String?;
      if (jobId == null) {
        throw Exception('Job created but no id returned');
      }

      state = state.copyWith(
        isProcessing: false,
        jobId: jobId,
        clearError: true,
      );
    } catch (e) {
      state = state.copyWith(
        isProcessing: false,
        error: e.toString(),
      );
    }
  }

  void reset() {
    state = const VideoUploadState();
  }
}
