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
    return data.map((json) => VideoJobEntity.fromJson(json as Map<String, dynamic>)).toList();
  } catch (e) {
    return [];
  }
});

final videoJobsProvider = StateNotifierProvider<VideoJobsNotifier, AsyncValue<List<VideoJobEntity>>>((ref) {
  return VideoJobsNotifier(ref.watch(apiClientProvider));
});

class VideoJobsNotifier extends StateNotifier<AsyncValue<List<VideoJobEntity>>> {
  final ApiClient _apiClient;
  int _currentPage = 1;
  bool _hasMore = true;
  String? _statusFilter;

  VideoJobsNotifier(this._apiClient) : super(const AsyncValue.loading()) {
    loadVideos();
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
          if (status != null) 'status': status,
        },
      );
      
      final data = response.data ?? [];
      final jobs = data.map((json) => VideoJobEntity.fromJson(json as Map<String, dynamic>)).toList();
      
      if (response.pagination != null) {
        _hasMore = _currentPage < response.pagination!.totalPages;
      }
      
      state = AsyncValue.data(jobs);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> refresh() async {
    await loadVideos(status: _statusFilter);
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
          if (_statusFilter != null) 'status': _statusFilter,
        },
      );
      
      final data = response.data ?? [];
      final newJobs = data.map((json) => VideoJobEntity.fromJson(json as Map<String, dynamic>)).toList();
      
      if (response.pagination != null) {
        _hasMore = _currentPage < response.pagination!.totalPages;
      }
      
      state = AsyncValue.data([...currentJobs, ...newJobs]);
    } catch (e) {
      _currentPage--;
    }
  }

  void filterByStatus(String? status) {
    loadVideos(status: status);
  }
}

final videoJobDetailProvider = FutureProvider.family<VideoJobEntity?, String>((ref, id) async {
  final apiClient = ref.watch(apiClientProvider);
  
  try {
    final response = await apiClient.get<Map<String, dynamic>>('/videos/$id');
    if (response.data != null) {
      return VideoJobEntity.fromJson(response.data!);
    }
    return null;
  } catch (e) {
    return null;
  }
});

final videoUploadProvider = StateNotifierProvider<VideoUploadNotifier, VideoUploadState>((ref) {
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
  }) {
    return VideoUploadState(
      isUploading: isUploading ?? this.isUploading,
      isProcessing: isProcessing ?? this.isProcessing,
      uploadProgress: uploadProgress ?? this.uploadProgress,
      error: error,
      fileId: fileId ?? this.fileId,
      jobId: jobId ?? this.jobId,
    );
  }
}

class VideoUploadNotifier extends StateNotifier<VideoUploadState> {
  final ApiClient _apiClient;

  VideoUploadNotifier(this._apiClient) : super(const VideoUploadState());

  Future<void> uploadVideo({
    required String filePath,
    required String fileName,
    required int fileSize,
    required String mimeType,
  }) async {
    state = state.copyWith(isUploading: true, uploadProgress: 0, error: null);

    try {
      // Step 1: Get upload URL
      final urlResponse = await _apiClient.post<Map<String, dynamic>>(
        '/videos/upload-url',
        data: {
          'fileName': fileName,
          'mimeType': mimeType,
        },
      );
      
      final fileId = urlResponse.data?['fileId'] as String?;

      // Step 2: Upload file (simulated progress for now)
      for (int i = 0; i <= 100; i += 10) {
        await Future.delayed(const Duration(milliseconds: 100));
        state = state.copyWith(uploadProgress: i / 100);
      }

      // Step 3: Confirm upload
      await _apiClient.post('/videos/confirm-upload', data: {
        'fileId': fileId,
        'fileName': fileName,
        'fileSize': fileSize,
        'mimeType': mimeType,
      });

      state = state.copyWith(
        isUploading: false,
        fileId: fileId,
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

    state = state.copyWith(isProcessing: true, error: null);

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

      state = state.copyWith(
        isProcessing: false,
        jobId: jobId,
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
