// ====================================
// matchingUtilities.js
// Helper functions for property matching
// ====================================

const Property = require("../../Models/PropertyModel");

// ========== NORMALIZATION FUNCTIONS ==========

const normalizeTowerIdentifier = (str) => {
  if (!str) return str;

  const letterToNumber = {
    a: "1", b: "2", c: "3", d: "4", e: "5", f: "6", g: "7", h: "8", i: "9", j: "10",
    k: "11", l: "12", m: "13", n: "14", o: "15", p: "16", q: "17", r: "18", s: "19",
    t: "20", u: "21", v: "22", w: "23", x: "24", y: "25", z: "26",
  };

  let normalized = str.toLowerCase();

  normalized = normalized.replace(
    /\b(tower|building|block|phase)\s+([a-z])\b/gi,
    (match, prefix, letter) => {
      const number = letterToNumber[letter.toLowerCase()];
      return number ? `${prefix.toLowerCase()} ${number}` : match.toLowerCase();
    }
  );

  normalized = normalized.replace(/\s+([a-z])\s*$/i, (match, letter) => {
    const number = letterToNumber[letter.toLowerCase()];
    return number ? ` ${number}` : match;
  });

  return normalized;
};

const createAlternateVersions = (str) => {
  if (!str) return [str];
  const versions = [str];
  const normalized = normalizeTowerIdentifier(str);
  if (normalized !== str) {
    versions.push(normalized);
  }
  return versions;
};

const normalizeForMatching = (str) => {
  if (!str) return "";

  let result = str.toLowerCase().trim();

  result = result.replace(/\bpalm\s+jumeirah\b/g, "the palm");
  result = result.replace(/\bviews\b/g, "view");

  const romanMap = {
    i: "1", ii: "2", iii: "3", iv: "4", v: "5",
    vi: "6", vii: "7", viii: "8", ix: "9", x: "10",
  };
  result = result.replace(/\b(i{1,3}|iv|v|vi{0,3}|ix|x)\b/gi, (match) => {
    return romanMap[match.toLowerCase()] || match;
  });

  result = result.replace(/\bby\s+\w+\b/g, "");

  if (result.includes("attessa")) {
    result = result.replace(/\b(tower)\b/g, "");
  }

  // Condition for 52-42 Tower 
  result = result.replace(/\b5242\b/, "52-42");

  if (result.includes("shoreline")) {
    result = result.replace(/\b(al|apartments?)\b/g, "");
  }
  result = result.replace(/\bt\s*(\d+)\b/gi, "tower $1");
  result = result.replace(/\bthe\s+palm\b/gi, "palm jumeirah");
  result = result.replace(/\s*-\s*/g, " ");
  result = result.replace(/&/g, "and");
  result = result.replace(/\(.*?\)/g, "");
  result = result.replace(/\balaya\s+beach\b/gi, "alaya");
  result = result.replace(/\b0+(\d+)\b/g, "$1");
  result = result.replace(/\b(clusters?)\b/g, "cluster");
  result = result.replace(/\bT(\d+)\b/g, "tower $1");
  result = result.replace(/\b(towers?)\b/g, "tower");
  result = result.replace(/\b(residences?)\b/g, "residence");
  result = result.replace(
    /\b(the|a|an|it|its|by|estate|residences|at|villas|premium|binghatti|cluster|phase|block)\b/g,
    ""
  );
  result = result.replace(/\btower\b/g, "");
  result = result.replace(/\s+/g, " ").trim();

  return result;
};

const normalizePropertyType = (type) => {
  if (!type) return "";

  const normalizedType = type.toLowerCase().trim();
  if (normalizedType === "office-space") return "office";
  if (normalizedType === "townhouse" || normalizedType === "bungalow") return "villa";
  if (normalizedType === "duplex" || normalizedType === "penthouse") return "apartment";
  return normalizedType;
};

const normalizeRedinSubtype = (subtypeName) => {
  if (!subtypeName) return "";

  const normalized = subtypeName.toLowerCase().trim();
  const hotelAptRegex = /(?:serviced\/)?hotel\s*apartment/i;

  if (hotelAptRegex.test(normalized)) {
    return "apartment";
  }

  return normalized;
};

const extractAlphanumeric = (str) => {
  if (!str) return "";
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
};

// ========== REGION EXTRACTION ==========

const extractRegionParts = (regionString) => {
  if (!regionString) return { region1: null, region2: null };
  const parts = regionString
    .split(",")
    .map((part) => part.trim())
    .filter((p) => p);
  return {
    region1: parts.length > 0 ? parts[0] : null,
    region2: parts.length > 1 ? parts[1] : null,
  };
};

const combineRegions = (region1, region2) => {
  return [region1, region2].filter(Boolean).join(" ");
};

// ========== COORDINATE FUNCTIONS ==========

const extractAndTrimCoordinates = (addressInfo) => {
  try {
    if (!addressInfo) return null;

    const plainAddressInfo = addressInfo.toObject
      ? addressInfo.toObject()
      : addressInfo;

    if (!plainAddressInfo.Longitude_Latitude) return null;

    const coordString = plainAddressInfo.Longitude_Latitude.toString().trim();
    if (!coordString) return null;

    const coords = coordString.split(",");
    if (coords.length !== 2) return null;

    const v1 = parseFloat(coords[0].trim());
    const v2 = parseFloat(coords[1].trim());

    if (isNaN(v1) || isNaN(v2)) return null;

    let lat, lon;

    const v1Floor = Math.floor(v1);
    const v2Floor = Math.floor(v2);

    // ✅ FIXED: Accept latitude range 24-25, longitude range 54-56
    if ((v1Floor >= 24 && v1Floor <= 25) && (v2Floor >= 54 && v2Floor <= 56)) {
      // v1 is latitude (24.xx or 25.xx), v2 is longitude (54.xx, 55.xx, or 56.xx)
      lat = v1;
      lon = v2;
    } else if ((v1Floor >= 54 && v1Floor <= 56) && (v2Floor >= 24 && v2Floor <= 25)) {
      // v1 is longitude, v2 is latitude (swapped order)
      lon = v1;
      lat = v2;
    } else {
      // Invalid coordinates for Dubai
      return null;
    }

    // Validate final coordinates are within Dubai bounds
    if (lat < 24 || lat > 26 || lon < 54 || lon > 56) {
      return null;
    }

    return {
      lat: Math.trunc(lat * 100) / 100,
      lon: Math.trunc(lon * 100) / 100,
      original: { lat, lon },
    };
  } catch (error) {
    return null;
  }
};

const hasValidCoordinates = (property) => {
  try {
    const extracted = extractAndTrimCoordinates(property.address_information);
    return extracted !== null;
  } catch (error) {
    return false;
  }
};

const countAvailableCoordinates = (properties) => {
  return properties.filter((p) => hasValidCoordinates(p)).length;
};

// ========== MATCHING HELPERS ==========

const isExactLocationMatch = (propertyRegion, redinName) => {
  if (!propertyRegion || !redinName) return false;

  const propertyVersions = createAlternateVersions(propertyRegion);
  const redinVersions = createAlternateVersions(redinName);

  for (const propVersion of propertyVersions) {
    for (const redinVersion of redinVersions) {
      if (attemptExactMatch(propVersion, redinVersion)) {
        return true;
      }
    }
  }

  return false;
};

const attemptExactMatch = (propertyRegion, redinName) => {
  const normalizedRegion = normalizeForMatching(propertyRegion);
  const normalizedRedin = normalizeForMatching(redinName);

  const regionNumbers = normalizedRegion.match(/\d+/g) || [];
  const redinNumbers = normalizedRedin.match(/\d+/g) || [];

  if (regionNumbers.length > 0) {
    if (redinNumbers.length === 0) return false;
    const allNumbersMatch = regionNumbers.every((num) =>
      redinNumbers.includes(num)
    );
    if (!allNumbersMatch) return false;
  }

  if (redinNumbers.length > 0 && regionNumbers.length === 0) {
    return false;
  }

  if (normalizedRegion === normalizedRedin) return true;

  const regionClean = extractAlphanumeric(normalizedRegion);
  const redinClean = extractAlphanumeric(normalizedRedin);

  if (regionClean === redinClean) return true;

  const lengthDiff = Math.abs(regionClean.length - redinClean.length);
  if (lengthDiff > 2) return false;

  const regionWords = normalizedRegion
    .split(/\s+/)
    .filter((w) => w && w.length > 1)
    .sort();
  const redinWords = normalizedRedin
    .split(/\s+/)
    .filter((w) => w && w.length > 1)
    .sort();

  if (regionWords.length !== redinWords.length) return false;

  if (regionNumbers.length > 0 || redinNumbers.length > 0) {
    const sortedRegionNumbers = regionNumbers.sort();
    const sortedRedinNumbers = redinNumbers.sort();

    if (sortedRegionNumbers.length !== sortedRedinNumbers.length) return false;
    const numbersMatch = sortedRegionNumbers.every(
      (num, idx) => num === sortedRedinNumbers[idx]
    );
    if (!numbersMatch) return false;
  }

  const allWordsMatch = regionWords.every((word, idx) => {
    const redinWord = redinWords[idx];
    const wordClean1 = extractAlphanumeric(word);
    const wordClean2 = extractAlphanumeric(redinWord);
    return wordClean1 === wordClean2;
  });

  return allWordsMatch;
};

const isSimpleMatch = (str1, str2) => {
  if (!str1 || !str2) return false;

  const letterToNumber = {
    a: "1", b: "2", c: "3", d: "4", e: "5", f: "6", g: "7", h: "8", i: "9", j: "10",
    k: "11", l: "12", m: "13", n: "14", o: "15", p: "16", q: "17", r: "18", s: "19",
    t: "20", u: "21", v: "22", w: "23", x: "24", y: "25", z: "26",
  };

  const normalizeSimple = (str) => {
    if (!str) return "";

    let result = str.toLowerCase().trim();

    result = result.replace(/\bpalm\s+jumeirah\b/g, "the palm");
    result = result.replace(/\btownhouses\b/gi, "townhouse");
    result = result.replace(/\bthe\s+residences?\s+at\s+/g, "");
    result = result.replace(/\bviews\b/g, "view");
    result = result.replace(/\bjumeriah\b/g, "jumeirah");

    result = result.replace(
      /\b(tower|building|block|phase)\s+([a-z])\b/gi,
      (match, prefix, letter) => {
        const number = letterToNumber[letter.toLowerCase()];
        return number
          ? `${prefix.toLowerCase()} ${number}`
          : match.toLowerCase();
      }
    );

    result = result.replace(/\s+([a-z])\s*$/i, (match, letter) => {
      const number = letterToNumber[letter.toLowerCase()];
      return number ? ` ${number}` : match;
    });

    result = result.replace(
      /\b(the|a|an|at|in|by|estate|building|premium|east|west|north|south|central|park)\b/g,
      ""
    );

    result = result.replace(/\b(one|1)\s*jbr\b/gi, "1 jbr");
    result = result.replace(/\(.*?\)/g, "");
    result = result.replace(/\s*-\s*/g, " ");
    result = result.replace(/&/g, "and");
    result = result.replace(/\bresidences\b/g, "residence");
    result = result.replace(/\s+/g, " ").trim();

    return result;
  };

  const normalized1 = normalizeSimple(str1);
  const normalized2 = normalizeSimple(str2);

  if (normalized1 === normalized2) return true;

  const words1 = normalized1
    .split(/\s+/)
    .filter((w) => w && w.length > 0)
    .sort();
  const words2 = normalized2
    .split(/\s+/)
    .filter((w) => w && w.length > 0)
    .sort();

  if (words1.length !== words2.length) return false;

  return words1.every((word, idx) => word === words2[idx]);
};

const isCombinedRegionMatch = (propertyRegion, redinName) => {
  if (!propertyRegion || !redinName) return false;

  const normalizedRegion = normalizeForMatching(propertyRegion);
  const normalizedRedin = normalizeForMatching(redinName);

  const regionWords = normalizedRegion
    .split(/\s+/)
    .filter((w) => w && w.length > 1);
  const redinWords = normalizedRedin
    .split(/\s+/)
    .filter((w) => w && w.length > 1);

  if (regionWords.length === 0 || redinWords.length === 0) return false;

  const regionWordsSorted = [...regionWords].sort();
  const redinWordsSorted = [...redinWords].sort();

  if (regionWordsSorted.length !== redinWordsSorted.length) return false;

  return regionWordsSorted.every(
    (word, idx) => word === redinWordsSorted[idx]
  );
};

const isPartialWordMatch = (propertyRegion, redinName) => {
  if (!propertyRegion || !redinName) return false;

  const normalizedRegion = normalizeForMatching(propertyRegion);
  const normalizedRedin = normalizeForMatching(redinName);

  const regionWords = normalizedRegion
    .split(/\s+/)
    .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
    .map((w) => extractAlphanumeric(w));

  const redinWords = normalizedRedin
    .split(/\s+/)
    .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
    .map((w) => extractAlphanumeric(w));

  if (regionWords.length === 0 || redinWords.length === 0) return false;

  let matchingWordsCount = 0;

  regionWords.forEach((regionWord) => {
    if (redinWords.includes(regionWord)) {
      matchingWordsCount++;
    }
  });

  const totalWords = Math.max(regionWords.length, redinWords.length);

  if (totalWords >= 3) {
    return matchingWordsCount >= 3;
  } else {
    return matchingWordsCount >= 2;
  }
};

const isStarting2WordsMatch = (propertyRegion, redinName) => {
  if (!propertyRegion || !redinName) return false;

  const normalizedRegion = normalizeForMatching(propertyRegion);
  const normalizedRedin = normalizeForMatching(redinName);

  const regionMainPart = normalizedRegion.split(/\s+at\s+/i)[0].trim();

  const regionWords = regionMainPart
    .split(/\s+/)
    .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
    .map((w) => extractAlphanumeric(w));

  const redinWords = normalizedRedin
    .split(/\s+/)
    .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
    .map((w) => extractAlphanumeric(w));

  if (regionWords.length === 0 || redinWords.length === 0) return false;

  let matchingStartingWords = 0;
  const minLength = Math.min(2, Math.min(regionWords.length, redinWords.length));

  for (let i = 0; i < minLength; i++) {
    if (regionWords[i] === redinWords[i]) {
      matchingStartingWords++;
    } else {
      break;
    }
  }

  return matchingStartingWords >= 2;
};

// ========== DATABASE UPDATE ==========

const updatePropertyInDatabase = async (
  property,
  matchData,
  matchType,
  stepLevel,
  updatePromises,
  stats
) => {
  const updatePromise = Property.findOneAndUpdate(
    { id: property.id },
    {
      $set: {
        redin_location: {
          location_id: matchData.match.location_id,
          property_location_id: matchData.match.property_id,
          property_name: matchData.match.property_name,
          main_subtype_name: matchData.match.main_subtype_name,
          main_type_name: matchData.match.main_type_name,
          matched_by: matchType,
          matched_region_level: stepLevel,
          matched_region_part: matchData.matchedRegionPart,
        },
      },
    },
    { new: true }
  )
    .then((updated) => {
      if (updated) {
        stats.dbUpdateSuccess++;
      } else {
        stats.dbUpdateFailed++;
      }
      return updated;
    })
    .catch((err) => {
      stats.dbUpdateFailed++;
      console.error(`✗ Property ${property.id}: Update error:`, err.message);
      return null;
    });

  updatePromises.push(updatePromise);
};

// ========== EXPORTS ==========

module.exports = {
  normalizeForMatching,
  normalizePropertyType,
  normalizeRedinSubtype,
  normalizeTowerIdentifier,
  createAlternateVersions,
  extractAlphanumeric,
  extractRegionParts,
  combineRegions,
  extractAndTrimCoordinates,
  hasValidCoordinates,
  countAvailableCoordinates,
  isExactLocationMatch,
  isSimpleMatch,
  isCombinedRegionMatch,
  isPartialWordMatch,
  isStarting2WordsMatch,
  updatePropertyInDatabase,
};