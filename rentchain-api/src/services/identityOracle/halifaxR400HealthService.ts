import { getHalifaxR400SourceHealth } from "./clients/halifaxR400SourceClient";

export async function checkHalifaxR400Health() {
  return getHalifaxR400SourceHealth();
}
