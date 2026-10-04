import { expect, it } from "vitest";
import { locateCoordinates, swissCoordinates } from "./health.location.js";

it("matches the published swisstopo navigation example within one metre", () => {
  const [east, north] = swissCoordinates(46 + 2 / 60 + 38.87 / 3600, 8 + 43 / 60 + 49.79 / 3600);
  expect(Math.abs(east - 2699999.76)).toBeLessThan(1);
  expect(Math.abs(north - 1099999.97)).toBeLessThan(1);
});
it("finds municipal regions and distinguishes France from Fribourg", () => {
  expect(locateCoordinates(46.5197, 6.6323, 20)).toMatchObject({
    municipalityId: 5586,
    regionId: "VD-1",
    country: "CH",
  });
  expect(locateCoordinates(46.2044, 6.1432, 20)).toMatchObject({ regionId: "GE-0", country: "CH" });
  expect(locateCoordinates(46.8065, 7.1619, 20)).toMatchObject({ regionId: "FR-1", country: "CH" });
  expect(locateCoordinates(46.195, 6.236, 20)).toMatchObject({
    regionId: "EU-FR",
    country: "FR",
    municipalityId: null,
  });
  expect(locateCoordinates(47.66, 9.175, 20)).toMatchObject({ regionId: "EU-DE", country: "DE" });
  expect(locateCoordinates(45.81, 9.085, 20)).toMatchObject({ regionId: "EU-IT", country: "IT" });
});
it("does not guess when the location is too imprecise or outside the map", () => {
  expect(locateCoordinates(46.5197, 6.6323, 10001)).toBeNull();
  expect(locateCoordinates(40.7, -74, 20)).toBeNull();
});
