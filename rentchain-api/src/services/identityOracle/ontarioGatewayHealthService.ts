import { getOntarioGatewayHealth } from "./clients/ontarioGatewaySourceClient";

export async function checkOntarioGatewayHealth() {
  return getOntarioGatewayHealth();
}
