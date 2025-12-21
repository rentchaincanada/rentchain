import { getLimits } from "./caps";
import { upgradeRequired } from "../http/errors";

export async function enforcePropertyCap(args: {
  plan: string;
  currentPropertyCount: number;
}) {
  const { plan, limits } = getLimits(args.plan);
  if (args.currentPropertyCount >= limits.maxProperties) {
    throw Object.assign(new Error("upgrade_required"), {
      statusCode: 402,
      body: upgradeRequired({
        plan,
        limit: { maxProperties: limits.maxProperties },
        current: { properties: args.currentPropertyCount },
        message: `Plan '${plan}' supports up to ${limits.maxProperties} properties.`,
        upgradeHint: "Upgrade to Core/Pro to add more properties.",
      }),
    });
  }
}

export async function enforceUnitCap(args: {
  plan: string;
  currentUnitCount: number;
}) {
  const { plan, limits } = getLimits(args.plan);
  if (args.currentUnitCount >= limits.maxUnits) {
    throw Object.assign(new Error("upgrade_required"), {
      statusCode: 402,
      body: upgradeRequired({
        plan,
        limit: { maxUnits: limits.maxUnits },
        current: { units: args.currentUnitCount },
        message: `Plan '${plan}' supports up to ${limits.maxUnits} units.`,
        upgradeHint: "Upgrade to Pro/Elite to add more units.",
      }),
    });
  }
}
