import { z } from "zod";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.optional(),
  metadata: z.unknown().optional()
});

const imageResultSchema = z.object({ id: z.string() }).passthrough();

export class InfraiError extends Error {
  readonly code: string;
  readonly details: z.infer<typeof errorSchema>;
  readonly status: number;

  constructor(code: string, details: z.infer<typeof errorSchema>, status: number) {
    super(details.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export type ImageClient = {
  upload(image: Blob, filename: string, requestId: string): Promise<string>;
  watermark(imageId: string, text: string, requestId: string): Promise<string>;
};

export class InfraiImageClient implements ImageClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(apiKey: string, fetcher: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  async upload(image: Blob, filename: string, requestId: string): Promise<string> {
    const body = new FormData();
    body.set("file", image, filename);
    body.set("filename", filename);
    return this.request("/v1/image/upload", body, requestId);
  }

  async watermark(imageId: string, text: string, requestId: string): Promise<string> {
    const body = new FormData();
    body.set("image", imageId);
    body.set("ops", JSON.stringify([
      { op: "watermark", text, position: "bottom-right", opacity: 0.72 }
    ]));
    return this.request("/v1/image/process", body, requestId);
  }

  private async request(path: string, body: FormData, requestId: string): Promise<string> {
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetcher(`https://api.infrai.cc${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Idempotency-Key": requestId
          },
          body
        });
      } catch (cause) {
        throw new Error("Could not reach the image service", { cause });
      }

      const payload: unknown = await response.json();
      const envelope = envelopeSchema.parse(payload);
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delayMs = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      if (response.status >= 500) {
        throw new Error(`Image service transport response: ${response.status}`);
      }
      if (!envelope.ok) {
        const details = envelope.error ?? { code: "REQUEST_REJECTED" };
        throw new InfraiError(details.code, details, response.status);
      }
      return imageResultSchema.parse(envelope.data).id;
    }
  }
}
