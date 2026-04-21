import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PortfolioBenchmarkingPanel from "./PortfolioBenchmarkingPanel";

describe("PortfolioBenchmarkingPanel", () => {
  it("renders property comparisons and benchmark insights", () => {
    render(
      <PortfolioBenchmarkingPanel
        benchmarking={{
          summary: {
            propertyCount: 2,
            comparedPropertyCount: 2,
            benchmarkDimensions: ["vacancyRate", "maintenanceCostCents"],
          },
          comparisons: [
            {
              propertyId: "prop-1",
              propertyName: "Alpha",
              metrics: {
                vacancyRate: 0,
                occupancyRate: 1,
                applicationVolume: 3,
                applicationConversionRate: 0.67,
                openWorkOrders: 1,
                maintenanceCostCents: 20000,
                maintenanceCostPerUnitCents: 10000,
                leasesEndingSoon: 0,
                estimatedScheduledRentCents: 320000,
                estimatedRentPerOccupiedUnitCents: 160000,
                totalUnits: 2,
                occupiedUnits: 2,
                vacantUnits: 0,
              },
              benchmarks: {
                vacancyRate: {
                  portfolioAverage: 0.25,
                  rank: 1,
                  direction: "better",
                  deltaFromAverage: -0.25,
                },
                maintenanceCostCents: {
                  portfolioAverage: 60000,
                  rank: 1,
                  direction: "better",
                  deltaFromAverage: -40000,
                },
                applicationConversionRate: {
                  portfolioAverage: 0.5,
                  rank: 1,
                  direction: "better",
                  deltaFromAverage: 0.17,
                },
                estimatedRentPerOccupiedUnitCents: {
                  portfolioAverage: 150000,
                  rank: 1,
                  direction: "better",
                  deltaFromAverage: 10000,
                },
              },
            },
          ],
          insights: [
            {
              type: "vacancy_leader",
              severity: "low",
              message: "Alpha currently has the lowest vacancy rate in your portfolio.",
            },
          ],
          filters: {
            period: "90d",
            propertyId: null,
            from: "2026-01-20T00:00:00.000Z",
            to: "2026-04-20T00:00:00.000Z",
          },
        }}
      />
    );

    expect(screen.getByRole("heading", { name: /Portfolio benchmarking/i })).toBeInTheDocument();
    expect(screen.getByText(/Alpha currently has the lowest vacancy rate/i)).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText(/Vacancy rank #1/i)).toBeInTheDocument();
  });

  it("renders a clean empty state when portfolio comparisons are not meaningful yet", () => {
    render(
      <PortfolioBenchmarkingPanel
        benchmarking={{
          summary: {
            propertyCount: 1,
            comparedPropertyCount: 1,
            benchmarkDimensions: ["vacancyRate"],
          },
          comparisons: [],
          insights: [],
          filters: {
            period: "30d",
            propertyId: null,
            from: "2026-03-21T00:00:00.000Z",
            to: "2026-04-20T00:00:00.000Z",
          },
        }}
      />
    );

    expect(
      screen.getByText(/Benchmarking becomes available when you have more than one active property/i)
    ).toBeInTheDocument();
  });
});
