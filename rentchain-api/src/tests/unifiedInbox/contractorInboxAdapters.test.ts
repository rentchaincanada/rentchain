import { describe, expect, it } from "vitest";
import {
  adaptContractorMessageToInboxEvent,
  adaptContractorWorkOrderCommunicationToInboxEvent,
  adaptContractorWorkOrderToInboxEvent,
  deriveContractorUnifiedInbox,
  safeIdContainsRawValue,
} from "../../services/unifiedInbox";

const context = { contractorId: "contractor_raw_abc" };

describe("contractor inbox adapters", () => {
  it("projects work orders with safe contractor references", () => {
    const event = adaptContractorWorkOrderToInboxEvent(
      {
        id: "work_order_raw_1",
        assignedContractorId: "contractor_raw_abc",
        landlordId: "landlord_raw_abc",
        tenantId: "tenant_raw_abc",
        title: "Repair sink",
        status: "assigned",
        priority: "urgent",
        updatedAt: "2026-06-09T14:00:00.000Z",
      },
      context
    );

    expect(event).toMatchObject({
      sourceKind: "contractor.work_order",
      audienceRole: "contractor",
      title: "Repair sink",
      body: "Status: assigned",
      priority: "high",
      rawIdsIncluded: false,
      tokensIncluded: false,
      secretsIncluded: false,
      providerPayloadIncluded: false,
      storagePathIncluded: false,
      privateNotesIncluded: false,
    });
    expect(event?.id).toMatch(/^inbox_v1_/);
    expect(event?.sourceId).toMatch(/^inbox_v1_/);
    expect(event?.audienceScopeKey).toMatch(/^scope_v1_/);
    expect(JSON.stringify(event)).not.toContain("contractor_raw_abc");
    expect(JSON.stringify(event)).not.toContain("work_order_raw_1");
    expect(JSON.stringify(event)).not.toContain("landlord_raw_abc");
    expect(JSON.stringify(event)).not.toContain("tenant_raw_abc");
    expect(safeIdContainsRawValue(event?.id || "", "work_order_raw_1")).toBe(false);
  });

  it("projects messages without exposing source identifiers", () => {
    const event = adaptContractorMessageToInboxEvent(
      {
        id: "message_raw_1",
        contractorId: "contractor_raw_abc",
        landlordId: "landlord_raw_abc",
        workOrderId: "work_order_raw_1",
        senderRole: "landlord",
        text: "Please confirm arrival time.",
        createdAtMs: Date.parse("2026-06-09T13:00:00.000Z"),
      },
      context
    );

    expect(event).toMatchObject({
      sourceKind: "contractor.message",
      audienceRole: "contractor",
      title: "Message from landlord",
      body: "Please confirm arrival time.",
    });
    expect(JSON.stringify(event)).not.toContain("message_raw_1");
    expect(JSON.stringify(event)).not.toContain("work_order_raw_1");
    expect(JSON.stringify(event)).not.toContain("landlord_raw_abc");
  });

  it("projects work order communications with contractor scope", () => {
    const event = adaptContractorWorkOrderCommunicationToInboxEvent(
      {
        id: "work_order_message_raw_1",
        contractorId: "contractor_raw_abc",
        workOrderId: "work_order_raw_1",
        text: "Deadline approaching. Please confirm availability.",
        createdAt: "2026-06-09T13:00:00.000Z",
      },
      context
    );

    expect(event).toMatchObject({
      sourceKind: "contractor.message",
      audienceRole: "contractor",
      title: "Work order message from property manager",
      priority: "high",
    });
    expect(JSON.stringify(event)).not.toContain("work_order_message_raw_1");
    expect(JSON.stringify(event)).not.toContain("work_order_raw_1");
    expect(JSON.stringify(event)).not.toContain("contractor_raw_abc");
  });

  it("rejects cross-contractor and sensitive source records", () => {
    expect(
      adaptContractorWorkOrderCommunicationToInboxEvent(
        {
          id: "message_raw_2",
          contractorId: "contractor_raw_abc",
          text: "landlordId leaked in body",
        },
        context
      )
    ).toBeNull();
    expect(
      adaptContractorWorkOrderToInboxEvent(
        {
          id: "work_order_raw_1",
          assignedContractorId: "contractor_other",
          title: "Other work",
        },
        context
      )
    ).toBeNull();
    expect(
      adaptContractorMessageToInboxEvent(
        {
          id: "message_raw_1",
          contractorId: "contractor_raw_abc",
          text: "token leaked",
        },
        context
      )
    ).toBeNull();
    expect(
      adaptContractorWorkOrderToInboxEvent(
        {
          id: "work_order_raw_2",
          assignedContractorId: "contractor_raw_abc",
          title: "Work",
          providerPayload: { raw: true },
        },
        context
      )
    ).toBeNull();
  });

  it("derives contractor inbox events from scoped sources only", async () => {
    const page = await deriveContractorUnifiedInbox("contractor_raw_abc", {
      workOrders: [
        {
          id: "work_order_raw_1",
          assignedContractorId: "contractor_raw_abc",
          title: "High priority work",
          priority: "high",
          updatedAt: "2026-06-09T10:00:00.000Z",
        },
        {
          id: "work_order_raw_2",
          assignedContractorId: "contractor_other",
          title: "Other work",
          updatedAt: "2026-06-09T12:00:00.000Z",
        },
      ],
      messages: [
        {
          id: "message_raw_1",
          contractorId: "contractor_raw_abc",
          text: "New note",
          createdAt: "2026-06-09T11:00:00.000Z",
        },
      ],
    });

    expect(page.items.map((item) => item.title)).toEqual(["High priority work", "Message from landlord"]);
    expect(JSON.stringify(page.items)).not.toContain("contractor_raw_abc");
    expect(JSON.stringify(page.items)).not.toContain("work_order_raw_");
    expect(JSON.stringify(page.items)).not.toContain("message_raw_");
  });
});
