import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EditorService } from './editor.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EditorOpDto } from './dto/editor.dto';

@ApiTags('editor')
@ApiBearerAuth()
@Controller('editor')
export class EditorController {
  constructor(private readonly editor: EditorService) {}

  @Post('trim')
  trim(@CurrentUser('id') userId: string, @Body() dto: EditorOpDto) {
    return this.editor.run(userId, 'trim', dto);
  }

  @Post('merge')
  merge(@CurrentUser('id') userId: string, @Body() dto: EditorOpDto) {
    return this.editor.run(userId, 'merge', dto);
  }

  @Post('crop')
  crop(@CurrentUser('id') userId: string, @Body() dto: EditorOpDto) {
    return this.editor.run(userId, 'crop', dto);
  }

  @Post('filter')
  filter(@CurrentUser('id') userId: string, @Body() dto: EditorOpDto) {
    return this.editor.run(userId, 'filter', dto);
  }

  @Post('export')
  exportJob(@CurrentUser('id') userId: string, @Body() dto: EditorOpDto) {
    return this.editor.run(userId, 'export', dto);
  }
}
