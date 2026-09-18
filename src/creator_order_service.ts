import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { InfraiError, InfraiImageClient, type ImageClient } from "./infrai_image_client.js";

export const checkoutSchema = z.object({
  orderId: z.string().min(1),
  customerEmail: z.string().email(),
  creatorName: z.string().min(1),
  imagePath: z.string().min(1),
  filename: z.string().min(1)
});

export type Checkout = z.infer<typeof checkoutSchema>;
export type OrderUpdate = {
  orderId: string;
  state: "fulfilled";
  customerEmail: string;
  assetId: string;
  receipt: { description: string; deliveredAt: string };
};

export async function fulfillCreatorOrder(
  input: unknown,
  client: ImageClient,
  loadImage: (path: string) => Promise<Uint8Array> = readFile,
  now: () => Date = () => new Date()
): Promise<OrderUpdate> {
  const checkout = checkoutSchema.parse(input);
  const bytes = Uint8Array.from(await loadImage(checkout.imagePath));
  const sourceId = await client.upload(
    new Blob([bytes.buffer]),
    checkout.filename,
    `${checkout.orderId}:upload`
  );
  const assetId = await client.watermark(
    sourceId,
    `Created by ${checkout.creatorName}`,
    `${checkout.orderId}:watermark`
  );

  return {
    orderId: checkout.orderId,
    state: "fulfilled",
    customerEmail: checkout.customerEmail,
    assetId,
    receipt: {
      description: `Watermarked creator image ${checkout.filename}`,
      deliveredAt: now().toISOString()
    }
  };
}

async function main(): Promise<void> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the example");

  const raw = process.argv[2];
  if (!raw) throw new Error("Pass checkout JSON as the first argument");

  try {
    const result = await fulfillCreatorOrder(JSON.parse(raw), new InfraiImageClient(apiKey));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof InfraiError) {
      console.error(JSON.stringify({ status: error.status, code: error.code, message: error.message }));
      process.exitCode = error.status >= 400 && error.status < 500 ? 2 : 1;
      return;
    }
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
