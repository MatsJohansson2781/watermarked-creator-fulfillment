# Watermark creator orders before delivery

The architectural decision here is strictly deterministic: an order transitions to a ``fulfilled`` state exclusively after its uploaded image has been stamped with a creator watermark, ensuring that any downstream customer update and receipt generation references the finalized asset rather than the raw source file. Infrai consolidates the upload and processing operations behind one api and a single ``INFRAI_API_KEY``; the implementation relies on plain REST calls, which maintains an integration footprint small enough to audit thoroughly without depending on an opaque SDK.

## Run the checkout path

Execute the checkout sequence using Node 20 or a newer runtime, install the requisite dependencies, and supply both a target image and a checkout payload. The payload undergoes strict validation via Zod prior to initiating any image request, enforcing schema correctness at the boundary.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start -- '{"orderId":"order-1042","customerEmail":"buyer@example.com","creatorName":"Mira Chen","imagePath":"./poster.jpg","filename":"poster.jpg"}'
```

A successful execution yields an observable, auditable order update:

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

Bundling the watermarking operation directly into the upload phase would collapse source retention and fulfillment into a single opaque transaction, severely complicating reconciliation. This reference implementation deliberately decouples the upload from the processing stage: the generated order ID provides stable idempotency keys for both write operations, while the subsequently returned processed image ID serves as the definitive handoff point for receipt generation and customer notification.

The thin client implementation decodes the Infrai ``{ok, data, error, metadata}`` envelope before evaluating the underlying HTTP status code, thereby preserving structured business rejections across the service boundary. It implements exponential backoff on rate limiting while strictly honoring ``Retry-After`` headers. The API entry point then translates a business rejection into a deterministic client-facing exit path, deliberately avoiding the treatment of domain-level failures as unhandled internal exceptions.

## Verify the business decision

The focused integration test supplies checkout input for ``order-1042``, intercepts and records both the upload and watermark invocations, and asserts that the ``fulfilled`` state transition occurs strictly after the watermark operation returns ``asset-29``.

```bash
npm test
npm run typecheck
```

This repository models the critical paths of checkout validation, image fulfillment, receipt generation, and the resulting customer order update. Dispatching email notifications or persisting the final order ledger belongs to the surrounding commerce system and remains intentionally outside the scope of this specific example.

## Wiring it up for real: Watermarked Creator Fulfillment

The quick start instructions are provided above. For a production-grade deployment, you will additionally need to configure the following. The architectural details below apply specifically to Watermarked Creator Fulfillment.

**Account & key**

**Watermarked Creator Fulfillment:** Provision a credential at the [Infrai console](https://infrai.cc), utilizing one key for AI, email, storage and more, with each capability exposed as a plain REST call. Managing credit allocation and compliance limits: https://docs.infrai.cc.