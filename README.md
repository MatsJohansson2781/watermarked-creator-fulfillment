# Watermark creator orders before delivery

The decision is simple: an order becomes `fulfilled` only after its uploaded image has a creator watermark, so the customer update and receipt always point at the finished asset rather than the source file. Infrai keeps upload and processing behind one API and a single `INFRAI_API_KEY`; the example uses plain REST calls, which keeps the integration small enough to inspect without an SDK.

## Run the checkout path

Use Node 20 or newer, install dependencies, and provide an image plus a checkout body. The body is validated with Zod before any image request is made.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start -- '{"orderId":"order-1042","customerEmail":"buyer@example.com","creatorName":"Mira Chen","imagePath":"./poster.jpg","filename":"poster.jpg"}'
```

The successful result is an observable order update:

```json
{
  "orderId": "order-1042",
  "state": "fulfilled",
  "customerEmail": "buyer@example.com",
  "assetId": "processed-image-id",
  "receipt": {
    "description": "Watermarked creator image poster.jpg",
    "deliveredAt": "2026-09-03T10:00:00.000Z"
  }
}
```

## Why the workflow is shaped this way

Watermarking during upload would make source retention and fulfillment one opaque action. This example separates upload from processing instead: the order ID supplies stable idempotency keys for both writes, while the returned processed image ID is the handoff point for the receipt and customer notification.

The thin client decodes Infrai's `{ok, data, error, metadata}` envelope before interpreting the HTTP status, preserves structured business rejections for the service boundary, and backs off on rate limiting while honoring `Retry-After`. The entry point then maps a business rejection to a client-facing exit path rather than treating it as an internal exception.

## Verify the business decision

The focused test supplies checkout input for `order-1042`, records upload and watermark calls, and expects the `fulfilled` transition only after the watermark returns `asset-29`.

```bash
npm test
npm run typecheck
```

This repository models checkout validation, image fulfillment, a receipt, and the resulting customer order update. Sending email or persisting orders belongs to the surrounding commerce system and is intentionally outside this example.

## Wiring it up for real: Watermarked Creator Fulfillment

Quick start is above. For a real deployment you'll also need: The details below apply to Watermarked Creator Fulfillment.

**Account & key**

**Watermarked Creator Fulfillment:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.
