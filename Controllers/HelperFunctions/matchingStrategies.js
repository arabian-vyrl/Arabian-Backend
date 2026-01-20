// ====================================
// matchingStrategies.js
// All 7 matching step functions
// ====================================

const {
  extractRegionParts,
  combineRegions,
  normalizePropertyType,
  normalizeRedinSubtype,
  isExactLocationMatch,
  isSimpleMatch,
  isCombinedRegionMatch,
  isPartialWordMatch,
  isStarting2WordsMatch,
  extractAndTrimCoordinates,
  hasValidCoordinates,
} = require("./matchingUtilities");

// ========== STEP 1: COMBINED REGION MATCH ==========

const executeStep1_CombinedRegionMatch = (property, redinPropertiesFlattened) => {
  const { region1, region2 } = extractRegionParts(
    property.custom_fields?.propertyfinder_region
  );

  if (!region1 || !property?.property_type) {
    return { matchResult: null, nameMatches: [] };
  }

  const propertyTypeClean = normalizePropertyType(property.property_type);

  const combinations = [
    combineRegions(region1, region2),
    combineRegions(region2, region1),
  ];

  const nameOnlyMatches = [];

  for (const combinedRegion of combinations) {
    if (!combinedRegion) continue;

    const nameMatches = redinPropertiesFlattened.filter((redin) => {
      if (!redin.property_name) return false;
      return isCombinedRegionMatch(combinedRegion, redin.property_name);
    });

    nameOnlyMatches.push(...nameMatches);

    const match = nameMatches.find((redin) => {
      if (!redin.main_subtype_name) return false;
      const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
      return redinSubtype === propertyTypeClean;
    });

    if (match) {
      return {
        matchResult: {
          match,
          matchedRegionPart: combinedRegion,
        },
        nameMatches: [],
      };
    }
  }

  return {
    matchResult: null,
    nameMatches: nameOnlyMatches,
  };
};

// ========== STEP 2: FIRST REGION EXACT MATCH ==========

const executeStep2_FirstRegionMatch = (property, redinPropertiesFlattened) => {
  const { region1 } = extractRegionParts(
    property.custom_fields?.propertyfinder_region
  );

  const propertyType = property.property_type;
  if (!region1 || !propertyType) return { matchResult: null, nameMatches: [] };

  const propertyTypeClean = normalizePropertyType(propertyType);

  const nameMatches = redinPropertiesFlattened.filter((redin) => {
    if (!redin.property_name) return false;
    return isExactLocationMatch(region1, redin.property_name);
  });

  const match = nameMatches.find((redin) => {
    if (!redin.main_subtype_name) return false;
    const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
    return redinSubtype === propertyTypeClean;
  });

  if (match) {
    return {
      matchResult: {
        match,
        matchedRegionPart: region1,
      },
      nameMatches: [],
    };
  }

  return { matchResult: null, nameMatches };
};

// ========== STEP 3: REGION 1 OR 2 MATCH ==========

const executeStep3_Region1Or2Match = (property, redinPropertiesFlattened) => {
  const { region1, region2 } = extractRegionParts(
    property.custom_fields?.propertyfinder_region
  );

  const propertyType = property.property_type;
  if (!propertyType) return { matchResult: null, nameMatches: [] };

  const propertyTypeClean = normalizePropertyType(propertyType);
  const nameOnlyMatches = [];

  // Try Region 1 first
  if (region1) {
    const nameMatches = redinPropertiesFlattened.filter((redin) => {
      if (!redin.property_name) return false;
      return isSimpleMatch(region1, redin.property_name);
    });

    nameOnlyMatches.push(...nameMatches);

    const region1Match = nameMatches.find((redin) => {
      if (!redin.main_subtype_name) return false;
      const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
      return redinSubtype === propertyTypeClean;
    });

    if (region1Match) {
      return {
        matchResult: {
          match: region1Match,
          matchedRegionPart: region1,
          matchedRegionLevel: 3.1,
        },
        nameMatches: [],
      };
    }
  }

  // Try combined Region 1 + Region 2
  if (region1 && region2) {
    const combinedRegion = `${region1} ${region2}`;

    const nameMatches = redinPropertiesFlattened.filter((redin) => {
      if (!redin.property_name) return false;
      return isSimpleMatch(combinedRegion, redin.property_name);
    });

    nameOnlyMatches.push(...nameMatches);

    const combinedMatch = nameMatches.find((redin) => {
      if (!redin.main_subtype_name) return false;
      const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
      return redinSubtype === propertyTypeClean;
    });

    if (combinedMatch) {
      return {
        matchResult: {
          match: combinedMatch,
          matchedRegionPart: combinedRegion,
          matchedRegionLevel: 3.2,
        },
        nameMatches: [],
      };
    }
  }

  return { matchResult: null, nameMatches: nameOnlyMatches };
};

// ========== STEP 4: SECOND REGION EXACT MATCH ==========

const executeStep4_SecondRegionMatch = (property, redinPropertiesFlattened) => {
  const { region2 } = extractRegionParts(
    property.custom_fields?.propertyfinder_region
  );

  const propertyType = property.property_type;
  if (!region2 || !propertyType) return { matchResult: null, nameMatches: [] };

  const propertyTypeClean = normalizePropertyType(propertyType);

  const nameMatches = redinPropertiesFlattened.filter((redin) => {
    if (!redin.property_name) return false;
    return isExactLocationMatch(region2, redin.property_name);
  });

  const match = nameMatches.find((redin) => {
    if (!redin.main_subtype_name) return false;
    const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
    return redinSubtype === propertyTypeClean;
  });

  if (match) {
    return {
      matchResult: {
        match,
        matchedRegionPart: region2,
      },
      nameMatches: [],
    };
  }

  return { matchResult: null, nameMatches };
};

// ========== STEP 5: PARTIAL WORD MATCH ==========

const executeStep5_PartialWordMatch = (property, redinPropertiesFlattened) => {
  const { region1 } = extractRegionParts(
    property.custom_fields?.propertyfinder_region
  );

  if (!region1 || !property?.property_type) {
    return { matchResult: null, nameMatches: [] };
  }

  const propertyTypeClean = normalizePropertyType(property.property_type);

  const nameMatches = redinPropertiesFlattened.filter((redin) => {
    if (!redin.property_name) return false;
    return isPartialWordMatch(region1, redin.property_name);
  });

  const match = nameMatches.find((redin) => {
    if (!redin.main_subtype_name) return false;
    const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
    return redinSubtype === propertyTypeClean;
  });

  if (match) {
    return {
      matchResult: {
        match,
        matchedRegionPart: region1,
      },
      nameMatches: [],
    };
  }

  return {
    matchResult: null,
    nameMatches,
  };
};

// ========== STEP 6: STARTING 2 WORDS MATCH ==========

const executeStep6_Starting2WordsMatch = (property, redinPropertiesFlattened) => {
  const { region1 } = extractRegionParts(
    property.custom_fields?.propertyfinder_region
  );

  const propertyType = property.property_type;

  if (!region1 || !propertyType) return { matchResult: null, nameMatches: [] };

  const propertyTypeClean = normalizePropertyType(propertyType);

  const nameMatches = redinPropertiesFlattened.filter((redin) => {
    if (!redin.property_name) return false;
    return isStarting2WordsMatch(region1, redin.property_name);
  });

  const match = nameMatches.find((redin) => {
    if (!redin.main_subtype_name) return false;
    const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
    return redinSubtype === propertyTypeClean;
  });

  if (match) {
    return {
      matchResult: {
        match,
        matchedRegionPart: region1,
      },
      nameMatches: [],
    };
  }

  return { matchResult: null, nameMatches };
};

// ========== STEP 7: COORDINATE MATCH ==========

const executeStep7_CoordinateMatch = (property, redinPropertiesFlattened) => {
  if (!hasValidCoordinates(property)) {
    return { matchResult: null, typeMismatchInfo: null, matchDetails: null };
  }

  const propertyCoords = extractAndTrimCoordinates(property.address_information);

  if (!propertyCoords) {
    return { matchResult: null, typeMismatchInfo: null, matchDetails: null };
  }

  const propertyTypeClean = normalizePropertyType(property.property_type);
  let typeMismatchInfo = null;

  const checkCoordAtLevel = (lat, lon, coordType) => {
    const coordMatches = redinPropertiesFlattened.filter((r) => {
      if (!r.coordinates || typeof r.coordinates !== "object") {
        return false;
      }

      if (r.coordinates.lat === undefined || r.coordinates.lon === undefined) {
        return false;
      }

      const redinLon = Math.trunc(r.coordinates.lon * 100) / 100;
      const redinLat = Math.trunc(r.coordinates.lat * 100) / 100;

      return redinLon === lon && redinLat === lat;
    });

    if (coordMatches.length === 0) return null;

    const match = coordMatches.find((redin) => {
      if (!redin.main_subtype_name) return false;
      const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
      return redinSubtype === propertyTypeClean;
    });

    if (match) {
      return {
        match,
        matchedRegionPart: null,
        matchedRegionLevel: 7,
        coordType,
        matchedCoords: { lat, lon },
      };
    } else if (coordMatches.length > 0 && !typeMismatchInfo) {
      typeMismatchInfo = {
        coordType,
        matchedCoords: { lat, lon },
        propertyType: property.property_type,
        availableTypes: coordMatches.map((m) => ({
          property_name: m.property_name,
          main_subtype_name: m.main_subtype_name,
          location_id: m.location_id,
        })),
      };
    }

    return null;
  };

  // Step 1: Try EXACT coordinates
  let result = checkCoordAtLevel(
    propertyCoords.lat,
    propertyCoords.lon,
    "exact"
  );
  if (result) {
    return { matchResult: result, typeMismatchInfo: null, matchDetails: { coordType: "exact" } };
  }

  // Step 2: Try DECREMENT latitude
  for (let offset of [-1, -2]) {
    const lat = Math.trunc(propertyCoords.lat * 100 + offset) / 100;
    result = checkCoordAtLevel(lat, propertyCoords.lon, "decrement");
    if (result) {
      return { matchResult: result, typeMismatchInfo: null, matchDetails: { coordType: "decrement" } };
    }
  }

  // Step 3: Try INCREMENT latitude
  for (let offset of [1, 2]) {
    const lat = Math.trunc(propertyCoords.lat * 100 + offset) / 100;
    result = checkCoordAtLevel(lat, propertyCoords.lon, "increment");
    if (result) {
      return { matchResult: result, typeMismatchInfo: null, matchDetails: { coordType: "increment" } };
    }
  }

  // Step 4: Try DECREMENT longitude
  for (let offset of [-1, -2]) {
    const lon = Math.trunc(propertyCoords.lon * 100 + offset) / 100;
    result = checkCoordAtLevel(propertyCoords.lat, lon, "decrement_lon");
    if (result) {
      return { matchResult: result, typeMismatchInfo: null, matchDetails: { coordType: "decrement_lon" } };
    }
  }

  // Step 5: Try INCREMENT longitude
  for (let offset of [1, 2]) {
    const lon = Math.trunc(propertyCoords.lon * 100 + offset) / 100;
    result = checkCoordAtLevel(propertyCoords.lat, lon, "increment_lon");
    if (result) {
      return { matchResult: result, typeMismatchInfo: null, matchDetails: { coordType: "increment_lon" } };
    }
  }

  if (typeMismatchInfo) {
    return { matchResult: null, typeMismatchInfo, matchDetails: null };
  }

  return { matchResult: null, typeMismatchInfo: null, matchDetails: null };
};

// ========== EXPORTS ==========

module.exports = {
  executeStep1_CombinedRegionMatch,
  executeStep2_FirstRegionMatch,
  executeStep3_Region1Or2Match,
  executeStep4_SecondRegionMatch,
  executeStep5_PartialWordMatch,
  executeStep6_Starting2WordsMatch,
  executeStep7_CoordinateMatch,
};