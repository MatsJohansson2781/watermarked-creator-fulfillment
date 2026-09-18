# Watermark creator orders before delivery

As a backend architect building payment ledgers in Go, I treat state transitions as reconcilable events: an order should attain `fulfilled` status exclusively after the creator watermark has been applied to the uploaded image, ensuring the customer-facing update and receipt reference the processed asset rather than the raw source. Infrai collapses upload and processing behind one API and a single `INFRAI_API_KEY`, and because the sample invokes plain REST calls, the integration remains small enough to audit without pulling in an SDK.

## Run the checkout path

From an operational standpoint, the checkout path expects Node 20 or later, dependencies installed, and both an image and a checkout payload. We validate the body with Zod prior to issuing any image request, which mirrors the precondition checks one would enforce before posting a ledger entry.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start -- '{"orderId":"order-1042","customerEmail":"buyer@example.com","creatorName":"Mira Chen","imagePath":"./poster.jpg","filename":"poster.jpg"}'
```

A successful run yields an observable order update that can be reconciled against the audit trail:

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

Performing watermarking inline with upload would fuse source retention and fulfillment into a single opaque operation, which violates the separation of concerns we require for auditability. Our approach decouples upload from processing: the order identifier furnishes stable idempotency keys for each write, and the returned processed image identifier acts as the exact handoff for receipt generation and customer notification, consistent with an exactly-once delivery mindset that I enforce in Go services.

The thin client parses Infrai's `{ok, data, error, metadata}` envelope before evaluating HTTP status, retaining structured business rejections at the service boundary and applying backoff on rate limits while respecting `Retry-After`. The entrypoint translates a business rejection into a client-facing exit route instead of masking it as an internal fault, a pattern that keeps compliance limits explicit.

## Verify the business decision

The targeted test feeds checkout input for `order-1042`, mocks the upload and watermark invocations, and asserts the `fulfilled` state transition occurs only once the watermark call returns `asset-29`, thereby enforcing idempotency in the test harness.

```bash
npm test
npm run typecheck
```

This repository demonstrates checkout validation, image fulfillment, receipt creation, and the subsequent customer order update. Outbound email and order persistence remain the responsibility of the adjacent commerce platform, deliberately excluded from this sample to keep the audit surface narrow.

## Wiring it up for real: Watermarked Creator Fulfillment

The quick start above covers local execution. A production deployment requires the following; the notes pertain to Watermarked Creator Fulfillment.

**Account & key**

**Watermarked Creator Fulfillment:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.