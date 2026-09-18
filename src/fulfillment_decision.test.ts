import assert from "node:assert/strict";
import test from "node:test";
import { fulfillCreatorOrder } from "./creator_order_service.js";
import type { ImageClient } from "./infrai_image_client.js";

test("fulfills only after the ordered image receives its creator watermark", async () => {
  const calls: string[] = [];
  const client: ImageClient = {
    async upload(_image, filename, requestId) {
      calls.push(`upload:${filename}:${requestId}`);
      return "source-17";
    },
    async watermark(imageId, text, requestId) {
      calls.push(`watermark:${imageId}:${text}:${requestId}`);
      return "asset-29";
    }
  };

  const result = await fulfillCreatorOrder(
    {
      orderId: "order-1042",
      customerEmail: "buyer@example.com",
      creatorName: "Mira Chen",
      imagePath: "fixtures/poster.jpg",
      filename: "poster.jpg"
    },
    client,
    async () => new Uint8Array([1, 2, 3]),
    () => new Date("2026-09-03T10:00:00.000Z")
  );

  assert.deepEqual(calls, [
    "upload:poster.jpg:order-1042:upload",
    "watermark:source-17:Created by Mira Chen:order-1042:watermark"
  ]);
  assert.deepEqual(result, {
    orderId: "order-1042",
    state: "fulfilled",
    customerEmail: "buyer@example.com",
    assetId: "asset-29",
    receipt: {
      description: "Watermarked creator image poster.jpg",
      deliveredAt: "2026-09-03T10:00:00.000Z"
    }
  });
});
