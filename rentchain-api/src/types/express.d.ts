import "express";

type UnitImportStatus = "vacant" | "occupied" | "notice" | "offline";

declare module "express-serve-static-core" {
  interface Request {
    importCache?: {
      units?: Array<{
        unitNumber: string;
        beds: number;
        baths: number;
        sqft: number;
        marketRentCents: number;
        status: UnitImportStatus;
      }>;
      unitsUniqueCount?: number;
      newUnitsToCreate?: number;
      errors?: { row: number; message: string }[];
      skippedCount?: number;
      headers?: string[];
      rowsCount?: number;
    };
  }
}
