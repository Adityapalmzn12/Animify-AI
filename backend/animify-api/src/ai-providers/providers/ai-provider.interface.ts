export interface AiSubmitResult {
  externalId: string;
  provider: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface AiPollResult {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  resultUrl?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AiSubmitInput {
  jobId: string;
  jobType: string;
  prompt?: string;
  inputUrl?: string;
  style?: string;
  settings?: Record<string, unknown>;
}

export interface AiProvider {
  readonly name: string;
  isConfigured(): boolean;
  estimateCredits(jobType: string, settings?: Record<string, unknown>): number;
  submit(input: AiSubmitInput): Promise<AiSubmitResult>;
  poll(externalId: string): Promise<AiPollResult>;
  cancel?(externalId: string): Promise<void>;
}
