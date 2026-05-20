import { afterEach, describe, expect, it, vi } from "vitest"
import {
  __setResendClientForTest,
  processInboundWebhook,
} from "@/lib/inbound-email"

// Minimal stub of the Resend client shape we exercise. Matches the surface
// we hit in inbound-email.ts so TS doesn't complain.
type StubResend = {
  webhooks: { verify: ReturnType<typeof vi.fn> }
  emails: {
    receiving: { forward: ReturnType<typeof vi.fn> }
  }
}

function makeStub(overrides: Partial<StubResend> = {}): StubResend {
  return {
    webhooks: {
      verify: overrides.webhooks?.verify ?? vi.fn(),
    },
    emails: {
      receiving: {
        forward: overrides.emails?.receiving?.forward ?? vi.fn(),
      },
    },
  }
}

const validHeaders = {
  svixId: "msg_test_1",
  svixTimestamp: "1716268800",
  svixSignature: "v1,fakesignature=",
}

const sampleEvent = {
  type: "email.received" as const,
  created_at: "2026-05-21T02:55:00Z",
  data: {
    email_id: "received_123",
    created_at: "2026-05-21T02:54:50Z",
    from: "external@example.com",
    to: ["support@tubemine.tech"],
    bcc: [],
    cc: [],
    message_id: "<abc@example.com>",
    subject: "TUB-8 test",
    attachments: [],
  },
}

afterEach(() => {
  __setResendClientForTest(null)
  vi.restoreAllMocks()
})

describe("processInboundWebhook", () => {
  it("returns 500 when RESEND_WEBHOOK_SECRET is missing", async () => {
    const result = await processInboundWebhook({
      rawBody: "{}",
      svixId: validHeaders.svixId,
      svixTimestamp: validHeaders.svixTimestamp,
      svixSignature: validHeaders.svixSignature,
      webhookSecret: undefined,
    })
    expect(result.status).toBe(500)
    expect(result.body.reason).toBe("secret-not-configured")
  })

  it("returns 400 when svix headers are missing", async () => {
    const result = await processInboundWebhook({
      rawBody: "{}",
      svixId: null,
      svixTimestamp: validHeaders.svixTimestamp,
      svixSignature: validHeaders.svixSignature,
      webhookSecret: "whsec_fake",
    })
    expect(result.status).toBe(400)
    expect(result.body.reason).toBe("missing-svix-headers")
  })

  it("returns 500 when RESEND_API_KEY/client is not configured", async () => {
    // No stub injected; lib will try process.env.RESEND_API_KEY and fail.
    delete process.env.RESEND_API_KEY
    const result = await processInboundWebhook({
      rawBody: "{}",
      svixId: validHeaders.svixId,
      svixTimestamp: validHeaders.svixTimestamp,
      svixSignature: validHeaders.svixSignature,
      webhookSecret: "whsec_fake",
    })
    expect(result.status).toBe(500)
    expect(result.body.reason).toBe("resend-not-configured")
  })

  it("returns 401 when signature verification throws", async () => {
    const stub = makeStub()
    stub.webhooks.verify.mockImplementation(() => {
      throw new Error("bad signature")
    })
    __setResendClientForTest(stub as never)

    const result = await processInboundWebhook({
      rawBody: '{"type":"email.received"}',
      svixId: validHeaders.svixId,
      svixTimestamp: validHeaders.svixTimestamp,
      svixSignature: "v1,wrong=",
      webhookSecret: "whsec_fake",
    })
    expect(result.status).toBe(401)
    expect(result.body.reason).toBe("invalid-signature")
    expect(stub.emails.receiving.forward).not.toHaveBeenCalled()
  })

  it("ignores non email.received events with 200", async () => {
    const stub = makeStub()
    stub.webhooks.verify.mockReturnValue({
      type: "email.delivered",
      created_at: "2026-05-21T02:55:00Z",
      data: { email_id: "ignored_1" },
    })
    __setResendClientForTest(stub as never)

    const result = await processInboundWebhook({
      rawBody: '{"type":"email.delivered"}',
      svixId: validHeaders.svixId,
      svixTimestamp: validHeaders.svixTimestamp,
      svixSignature: validHeaders.svixSignature,
      webhookSecret: "whsec_fake",
    })
    expect(result.status).toBe(200)
    expect(result.body.reason).toBe("ignored-event-type")
    expect(stub.emails.receiving.forward).not.toHaveBeenCalled()
  })

  it("forwards email.received to the configured gmail address", async () => {
    const forwardSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: "forwarded_999" }, error: null })
    const stub = makeStub({
      webhooks: { verify: vi.fn().mockReturnValue(sampleEvent) },
      emails: { receiving: { forward: forwardSpy } },
    })
    __setResendClientForTest(stub as never)

    const result = await processInboundWebhook({
      rawBody: JSON.stringify(sampleEvent),
      svixId: validHeaders.svixId,
      svixTimestamp: validHeaders.svixTimestamp,
      svixSignature: validHeaders.svixSignature,
      webhookSecret: "whsec_fake",
    })

    expect(result.status).toBe(200)
    expect(result.body.ok).toBe(true)
    expect(result.body.forwardedId).toBe("forwarded_999")
    expect(forwardSpy).toHaveBeenCalledExactlyOnceWith({
      emailId: "received_123",
      to: "erke.bulan622@gmail.com",
      from: "TubeMine Support <support@tubemine.tech>",
    })
  })

  it("respects forwardTo and forwardFrom overrides", async () => {
    const forwardSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: "fwd_2" }, error: null })
    const stub = makeStub({
      webhooks: { verify: vi.fn().mockReturnValue(sampleEvent) },
      emails: { receiving: { forward: forwardSpy } },
    })
    __setResendClientForTest(stub as never)

    await processInboundWebhook({
      rawBody: JSON.stringify(sampleEvent),
      svixId: validHeaders.svixId,
      svixTimestamp: validHeaders.svixTimestamp,
      svixSignature: validHeaders.svixSignature,
      webhookSecret: "whsec_fake",
      forwardTo: ["a@example.com", "b@example.com"],
      forwardFrom: "Custom <noreply@example.com>",
    })

    expect(forwardSpy).toHaveBeenCalledExactlyOnceWith({
      emailId: "received_123",
      to: ["a@example.com", "b@example.com"],
      from: "Custom <noreply@example.com>",
    })
  })

  it("returns 500 when forward() resolves with an error field", async () => {
    const forwardSpy = vi.fn().mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "bad emailId" },
    })
    const stub = makeStub({
      webhooks: { verify: vi.fn().mockReturnValue(sampleEvent) },
      emails: { receiving: { forward: forwardSpy } },
    })
    __setResendClientForTest(stub as never)

    const result = await processInboundWebhook({
      rawBody: JSON.stringify(sampleEvent),
      svixId: validHeaders.svixId,
      svixTimestamp: validHeaders.svixTimestamp,
      svixSignature: validHeaders.svixSignature,
      webhookSecret: "whsec_fake",
    })
    expect(result.status).toBe(500)
    expect(result.body.reason).toBe("forward-error")
  })

  it("returns 500 when forward() throws (lets Resend retry)", async () => {
    const forwardSpy = vi.fn().mockRejectedValue(new Error("network"))
    const stub = makeStub({
      webhooks: { verify: vi.fn().mockReturnValue(sampleEvent) },
      emails: { receiving: { forward: forwardSpy } },
    })
    __setResendClientForTest(stub as never)

    const result = await processInboundWebhook({
      rawBody: JSON.stringify(sampleEvent),
      svixId: validHeaders.svixId,
      svixTimestamp: validHeaders.svixTimestamp,
      svixSignature: validHeaders.svixSignature,
      webhookSecret: "whsec_fake",
    })
    expect(result.status).toBe(500)
    expect(result.body.reason).toBe("forward-threw")
  })

  it("returns 400 when email_id is missing from a verified email.received event", async () => {
    const stub = makeStub({
      webhooks: {
        verify: vi.fn().mockReturnValue({
          ...sampleEvent,
          data: { ...sampleEvent.data, email_id: "" },
        }),
      },
    })
    __setResendClientForTest(stub as never)

    const result = await processInboundWebhook({
      rawBody: JSON.stringify(sampleEvent),
      svixId: validHeaders.svixId,
      svixTimestamp: validHeaders.svixTimestamp,
      svixSignature: validHeaders.svixSignature,
      webhookSecret: "whsec_fake",
    })
    expect(result.status).toBe(400)
    expect(result.body.reason).toBe("missing-email-id")
  })
})
