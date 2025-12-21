import { PubSub } from "@google-cloud/pubsub";
import { EventEnvelope } from "./types";

const pubsub = new PubSub();
const EVENTS_TOPIC =
  process.env.EVENTS_TOPIC_NAME || "rentchain-events-raw";

let topicInitialized: boolean | "failed" = false;

async function getTopic() {
  if (topicInitialized === "failed") return null;

  try {
    const [topic] = await pubsub.topic(EVENTS_TOPIC).get({ autoCreate: true });
    topicInitialized = true;
    return topic;
  } catch (err) {
    console.error("Failed to get/create Pub/Sub topic:", EVENTS_TOPIC, err);
    topicInitialized = "failed";
    return null;
  }
}

export async function publishEvent<P>(
  event: EventEnvelope<P>
): Promise<void> {
  const topic = await getTopic();
  if (!topic) {
    console.warn("Pub/Sub topic unavailable, skipping publish for:", event.eventId);
    return;
  }

  const dataBuffer = Buffer.from(JSON.stringify(event));

  await topic.publishMessage({
    data: dataBuffer,
    attributes: {
      eventType: event.eventType,
      env: event.env,
      version: event.version,
    },
  });
}
