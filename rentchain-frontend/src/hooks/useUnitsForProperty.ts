import { useCallback, useEffect, useState } from "react";
import { fetchUnitsForProperty } from "../api/unitsApi";

export type UnitOption = { id: string; name: string };

export function useUnitsForProperty(propertyId?: string | null, enabled = true) {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!propertyId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUnitsForProperty(propertyId);
      const mapped = (res || [])
        .map((u: any) => ({
          id: String(u.id || u.unitId || u.uid || ""),
          name: String(u.unitNumber || u.label || u.name || u.unit || "Unit"),
        }))
        .filter((u: UnitOption) => Boolean(u.id));
      setUnits(mapped);
    } catch (err: any) {
      setUnits([]);
      setError("Unable to load units.");
    } finally {
      setLoading(false);
    }
  }, [enabled, propertyId]);

  useEffect(() => {
    if (!enabled || !propertyId) {
      setUnits([]);
      setLoading(false);
      setError(null);
      return;
    }
    void load();
  }, [enabled, load, propertyId]);

  return { units, loading, error, refetch: load };
}
