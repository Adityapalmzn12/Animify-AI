import 'dart:io';

import 'package:uuid/uuid.dart';

import 'api_client.dart';

/// Shared upload helper for videos/images → signed URL → confirm → file id.
class MediaUploadService {
  final ApiClient _api;

  MediaUploadService(this._api);

  Future<String> uploadFile({
    required String filePath,
    required String mimeType,
    void Function(int sent, int total)? onProgress,
  }) async {
    final fileName = filePath.split(Platform.pathSeparator).last;
    final file = File(filePath);
    final fileSize = await file.length();

    final urlRes = await _api.post<Map<String, dynamic>>(
      '/videos/upload-url',
      data: {
        'fileName': fileName,
        'mimeType': mimeType,
      },
    );
    final urlData = urlRes.data ?? {};
    final uploadUrl = urlData['uploadUrl'] as String?;
    final fileId = urlData['fileId'] as String? ?? const Uuid().v4();
    if (uploadUrl == null || uploadUrl.isEmpty) {
      throw Exception('Failed to get upload URL');
    }

    await _api.putFileToUrl(
      uploadUrl,
      filePath: filePath,
      mimeType: mimeType,
      onSendProgress: onProgress,
    );

    final confirm = await _api.post<Map<String, dynamic>>(
      '/videos/confirm-upload',
      data: {
        'fileId': fileId,
        'fileName': fileName,
        'fileSize': fileSize,
        'mimeType': mimeType,
      },
    );

    final confirmedId = confirm.data?['id'] as String?;
    if (confirmedId == null) {
      throw Exception('Upload confirm failed');
    }
    return confirmedId;
  }

  String guessImageMime(String path) {
    final lower = path.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    return 'image/png';
  }
}
