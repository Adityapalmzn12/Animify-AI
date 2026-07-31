import { Module } from '@nestjs/common';
import { EditorService } from './editor.service';
import { EditorController } from './editor.controller';
import { VideosModule } from '../videos/videos.module';

@Module({
  imports: [VideosModule],
  providers: [EditorService],
  controllers: [EditorController],
  exports: [EditorService],
})
export class EditorModule {}
