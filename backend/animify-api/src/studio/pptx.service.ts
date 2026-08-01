import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PptxGenJS from 'pptxgenjs';

export type PptSlide = {
  title: string;
  bullets: string[];
  notes?: string;
};

@Injectable()
export class PptxService {
  private readonly logger = new Logger(PptxService.name);

  constructor(private readonly config: ConfigService) {}

  async buildOutline(topic: string, brandName?: string): Promise<{
    title: string;
    slides: PptSlide[];
  }> {
    const openaiKey = this.config.get<string>('ai.openai.apiKey');
    if (openaiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.4,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content:
                  'You create professional presentation outlines. Return JSON: {"title":"...","slides":[{"title":"...","bullets":["..."],"notes":"..."}]} with 6-10 slides.',
              },
              {
                role: 'user',
                content: `Topic: ${topic}${brandName ? `\nBrand: ${brandName}` : ''}`,
              },
            ],
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const raw = data.choices?.[0]?.message?.content || '{}';
          const parsed = JSON.parse(raw) as {
            title?: string;
            slides?: PptSlide[];
          };
          if (parsed.slides?.length) {
            return {
              title: parsed.title || brandName || 'Presentation',
              slides: parsed.slides.slice(0, 12).map((s) => ({
                title: s.title || 'Slide',
                bullets: (s.bullets || []).slice(0, 6),
                notes: s.notes,
              })),
            };
          }
        } else {
          this.logger.warn(`PPT outline OpenAI failed: ${await res.text()}`);
        }
      } catch (error) {
        this.logger.warn(
          `PPT outline error: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    return this.heuristicOutline(topic, brandName);
  }

  private heuristicOutline(topic: string, brandName?: string) {
    const title = brandName || topic.slice(0, 60) || 'Presentation';
    const lines = topic
      .split(/\n+|Scene\s*\d+[:.\-]\s*/i)
      .map((l) => l.trim())
      .filter(Boolean);
    const chunks = lines.length >= 3 ? lines.slice(0, 8) : [
      topic,
      'Key benefits and value proposition',
      'How it works',
      'Audience & use cases',
      'Roadmap / next steps',
      'Call to action',
    ];
    return {
      title,
      slides: chunks.map((c, i) => ({
        title: i === 0 ? title : `Slide ${i + 1}`,
        bullets: c
          .split(/[.•\-]\s+/)
          .map((b) => b.trim())
          .filter(Boolean)
          .slice(0, 5),
      })),
    };
  }

  async renderPptx(title: string, slides: PptSlide[]): Promise<Buffer> {
    const pptx = new PptxGenJS();
    pptx.author = 'Animify AI';
    pptx.title = title;
    pptx.subject = 'AI generated presentation';

    const titleSlide = pptx.addSlide();
    titleSlide.addText(title, {
      x: 0.5,
      y: 2.2,
      w: 9,
      h: 1.2,
      fontSize: 36,
      bold: true,
      color: '111827',
    });
    titleSlide.addText('Created with Animify AI', {
      x: 0.5,
      y: 3.5,
      w: 9,
      h: 0.4,
      fontSize: 14,
      color: '6B7280',
    });

    for (const slide of slides) {
      const s = pptx.addSlide();
      s.addText(slide.title, {
        x: 0.5,
        y: 0.4,
        w: 9,
        h: 0.8,
        fontSize: 26,
        bold: true,
        color: '111827',
      });
      const bullets = (slide.bullets?.length ? slide.bullets : ['…']).map(
        (b) => ({ text: b, options: { bullet: true, breakLine: true } }),
      );
      s.addText(bullets, {
        x: 0.7,
        y: 1.4,
        w: 8.6,
        h: 4.5,
        fontSize: 16,
        color: '374151',
        valign: 'top',
      });
      if (slide.notes) {
        s.addNotes(slide.notes);
      }
    }

    const out = await pptx.write({ outputType: 'nodebuffer' });
    return Buffer.from(out as ArrayBuffer);
  }
}
