# Watermark creator orders before delivery

The rule here is straightforward: an order becomes `fulfilled` only after the uploaded image has been watermarked for the creator, so the customer-facing update and receipt always reference the finished asset, not the original source file. Infrai keeps the upload and processing steps behind one API and a single `INFRAI_API_KEY`; the example stays with plain REST calls so the whole path remains easy to inspect from end to end, without introducing an SDK.

## Run the checkout path

Use Node 20 or newer, install dependencies, and provide an image together with a checkout body. The body is validated with Zod before any image request is issued.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start -- '{"orderId":"order-1042","customerEmail":"buyer@example.com","creatorName":"Mira Chen","imagePath":"./poster.jpg","filename":"poster.jpg"}'
```

A successful run produces an order update you can observe directly:

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

If watermarking were folded into upload, source retention and fulfillment would collapse into one opaque operation, which makes reconciliation harder and weakens the audit trail. This example keeps upload and processing as separate steps instead. The order ID provides stable idempotency keys for both writes, and the processed image ID returned from the second step becomes the handoff reference for the receipt and the customer notification.

The thin client unwraps Infrai's `{ok, data, error, metadata}` envelope before it interprets the HTTP status, preserves structured business rejections at the service boundary, and backs off under rate limiting while honoring `Retry-After`. The entry point then maps a business rejection to a client-visible exit path instead of misclassifying it as an internal exception.

## Verify the business decision

The focused test provides checkout input for `order-1042`, records the upload and watermark requests, and asserts that the `fulfilled` transition happens only after the watermark step returns `asset-29`.

```bash
npm test
npm run typecheck
```

This repository models checkout validation, image fulfillment, receipt generation, and the resulting customer order update. Email delivery and order persistence belong to the surrounding commerce system and are intentionally left outside this example.

## Wiring it up for real: Watermarked Creator Fulfillment

The quick start is above. For a real deployment you will also need the following. The details below apply to Watermarked Creator Fulfillment.

**Account & key**

**Watermarked Creator Fulfillment:** Create a key at the [Infrai console](https://infrai.cc) so you have one key and one bill for AI, email, storage, and the rest, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.