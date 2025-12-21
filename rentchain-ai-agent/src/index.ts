import { PubSub } from "@google-cloud/pubsub";
import { v4 as uuidv4 } from "uuid";
import { EventEnvelope } from "./types";

const pubsub = new PubSub();

// Same topic your API is using
const EVENTS_TOPIC = process.env.EVENTS_TOPIC_NAME || "rentchain-events-raw";
const SUBSCRIPTION_NAME =
  process.env.AI_AGENT_SUBSCRIPTION_NAME || "rentchain-events-ai-agent";

async function main() {
  // Ensure subscription exists (autoCreate)
  const [subscription] = await pubsub
    .subscription(SUBSCRIPTION_NAME)
    .get({ autoCreate: true });

  subscription.on("message", async (message) => {
    try {
      const eventJson = JSON.parse(message.data.toString()) as EventEnvelope<any>;
      await handleEvent(eventJson);
      message.ack();
    } catch (err) {
      console.error("AI Agent Service error handling message:", err);
      message.nack();
    }
  });

  subscription.on("error", (err) => {
    console.error("AI Agent subscription error:", err);
  });

  console.log("AI Agent Service listening on subscription:", SUBSCRIPTION_NAME);
}

async function handleEvent(event: EventEnvelope<any>) {
  switch (event.eventType) {
    case "MaintenanceRequestOpened":
      await handleMaintenanceRequestOpened(event);
      break;
    default:
      // ignore other events for now
      break;
  }
}

// Example: when a maintenance ticket is opened, create an AI task
async function handleMaintenanceRequestOpened(
  event: EventEnvelope<{
    ticketPublicId: string;
    priority: string;
    category: string;
    title: string;
    initialStatus: string;
  }>
) {
  console.log("AI Agent saw MaintenanceRequestOpened:", event.eventId);

  const taskId = uuidv4();

  const taskPayload = {
    taskId,
    sourceEventId: event.eventId,
    sourceEventType: event.eventType,
    taskType: "summarize_maintenance",
    status: "pending",
    priority: event.payload.priority === "emergency" ? "high" : "normal",
    inputSummary: `Ticket ${event.payload.ticketPublicId} (${event.payload.category}) - ${event.payload.title}`,
    tenantPublicId: null,
    landlordPublicId: null,
  };

  const aiTaskEvent: EventEnvelope<typeof taskPayload> = {
    eventId: uuidv4(),
    eventType: "AIAgentTaskCreated",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    env: (process.env.NODE_ENV === "production" ? "prod" : "dev"),

    actor: {
      actorType: "system",
      actorId: null,
    },

    context: {
      sourceEventId: event.eventId,
      ticketPublicId: event.payload.ticketPublicId,
    },

    payload: taskPayload,

    integrity: {
      payloadHash: "",    // could compute hash here if desired
      previousEventHash: null,
      signature: null,
      signingMethod: null,
      nonce: 1,
    },

    links: {
      firestoreDocPath: null,
      apiEndpoint: null,
      onChainTxHash: null,
      explorerUrl: null,
    },
  };

  await publishEvent(aiTaskEvent);
}

// Publish AI events back to the same topic
async function publishEvent<P>(event: EventEnvelope<P>): Promise<void> {
  const dataBuffer = Buffer.from(JSON.stringify(event));
  await pubsub.topic(EVENTS_TOPIC).publishMessage({
    data: dataBuffer,
    attributes: {
      eventType: event.eventType,
      env: event.env,
      version: event.version,
    },
  });
  console.log("AI Agent emitted event:", event.eventType, event.eventId);
}

main().catch((err) => {
  console.error("Fatal error in AI Agent Service:", err);
  process.exit(1);
});
