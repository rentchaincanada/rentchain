import { beforeEach, describe, expect, it } from "vitest";

describe("ontarioGatewaySourceClient", () => {
  beforeEach(() => {
    process.env.ONTARIO_GATEWAY_MODE = "stub";
    delete process.env.ONTARIO_GATEWAY_STUB_RESPONSE_JSON;
  });

  it("returns a healthy stubbed gateway match when configured", async () => {
    process.env.ONTARIO_GATEWAY_STUB_RESPONSE_JSON = JSON.stringify({
      records: [
        {
          gatewayPropertyId: "gw-1",
          pin: "123456789",
          addressLine1: "10 Ontario Street",
          city: "Toronto",
          province: "ON",
          postalCode: "M5V1A1",
          registrationNumber: "101260418",
          confidenceHint: 0.93,
        },
      ],
    });

    const { lookupOntarioGatewayByPin } = await import("../identityOracle/clients/ontarioGatewaySourceClient");
    const result = await lookupOntarioGatewayByPin("12345-6789");

    expect(result.ok).toBe(true);
    expect(result.sourceType).toBe("PAID_GATEWAY");
    expect(result.records[0]?.registrationNumber).toBe("101260418");
  });

  it("returns deterministic no-match when the stub response contains no matching record", async () => {
    process.env.ONTARIO_GATEWAY_STUB_RESPONSE_JSON = JSON.stringify({ records: [] });

    const { lookupOntarioGatewayByPin } = await import("../identityOracle/clients/ontarioGatewaySourceClient");
    const result = await lookupOntarioGatewayByPin("123456789");

    expect(result.ok).toBe(true);
    expect(result.noMatch).toBe(true);
  });

  it("guards against malformed gateway stub responses", async () => {
    process.env.ONTARIO_GATEWAY_STUB_RESPONSE_JSON = JSON.stringify({
      records: [{ pin: "123456789" }],
    });

    const { lookupOntarioGatewayByPin } = await import("../identityOracle/clients/ontarioGatewaySourceClient");
    const result = await lookupOntarioGatewayByPin("123456789");

    expect(result.ok).toBe(false);
    expect(result.failureKind).toBe("schema_mismatch");
  });
});
