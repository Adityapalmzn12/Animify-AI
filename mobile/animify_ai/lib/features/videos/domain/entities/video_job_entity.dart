import 'package:freezed_annotation/freezed_annotation.dart';

part 'video_job_entity.freezed.dart';
part 'video_job_entity.g.dart';

enum VideoJobStatus {
  pending,
  queued,
  processing,
  completed,
  failed,
  cancelled,
}

@freezed
class VideoJobEntity with _$VideoJobEntity {
  const VideoJobEntity._();

  const factory VideoJobEntity({
    required String id,
    required VideoJobStatus status,
    required int progress,
    String? currentStep,
    String? errorMessage,
    VideoFileInfo? inputFile,
    VideoFileInfo? outputFile,
    TemplateInfo? template,
    required VideoJobSettings settings,
    required DateTime createdAt,
    DateTime? startedAt,
    DateTime? completedAt,
  }) = _VideoJobEntity;

  factory VideoJobEntity.fromJson(Map<String, dynamic> json) =>
      _$VideoJobEntityFromJson(json);

  bool get isCompleted => status == VideoJobStatus.completed;
  bool get isFailed => status == VideoJobStatus.failed;
  bool get isProcessing =>
      status == VideoJobStatus.processing ||
      status == VideoJobStatus.queued ||
      status == VideoJobStatus.pending;
  bool get canDownload =>
      isCompleted &&
      (outputFile?.downloadUrl != null || inputFile?.downloadUrl != null);
}

@freezed
class VideoFileInfo with _$VideoFileInfo {
  const factory VideoFileInfo({
    required String id,
    @JsonKey(name: 'fileName') required String originalName,
    String? thumbnailUrl,
    @JsonKey(name: 'url') String? downloadUrl,
    DateTime? downloadUrlExpiresAt,
    @JsonKey(name: 'fileSize') int? sizeBytes,
    double? durationSeconds,
    int? width,
    int? height,
  }) = _VideoFileInfo;

  factory VideoFileInfo.fromJson(Map<String, dynamic> json) =>
      _$VideoFileInfoFromJson(json);
}

@freezed
class TemplateInfo with _$TemplateInfo {
  const factory TemplateInfo({
    required String id,
    required String name,
    String? thumbnailUrl,
  }) = _TemplateInfo;

  factory TemplateInfo.fromJson(Map<String, dynamic> json) =>
      _$TemplateInfoFromJson(json);
}

@freezed
class VideoJobSettings with _$VideoJobSettings {
  const factory VideoJobSettings({
    @Default(true) bool removeBackground,
    @Default('transparent') String backgroundType,
    String? backgroundValue,
    @Default(true) bool enhanceFace,
    @Default(true) bool enhanceAudio,
    @Default(true) bool generateSubtitles,
    @Default('hd') String outputQuality,
  }) = _VideoJobSettings;

  factory VideoJobSettings.fromJson(Map<String, dynamic> json) =>
      _$VideoJobSettingsFromJson(json);
}

@freezed
class CreateVideoJobRequest with _$CreateVideoJobRequest {
  const factory CreateVideoJobRequest({
    required String inputFileId,
    String? templateId,
    required VideoJobSettings settings,
  }) = _CreateVideoJobRequest;

  factory CreateVideoJobRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateVideoJobRequestFromJson(json);
}

@freezed
class UploadUrlResponse with _$UploadUrlResponse {
  const factory UploadUrlResponse({
    required String uploadUrl,
    required String fileId,
    required int expiresIn,
  }) = _UploadUrlResponse;

  factory UploadUrlResponse.fromJson(Map<String, dynamic> json) =>
      _$UploadUrlResponseFromJson(json);
}
