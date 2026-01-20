// // const Property = require("../Models/PropertyModel");
// // const ExtractRedinLocation = require("../Models/ExtractLocationRedin");

// // const MatchgeoPiont = async (req, res) => {
// //   try {
// //     const allDubaiProperties = await Property.find(
// //       {
// //         "custom_fields.city": "Dubai",
// //         "general_listing_information.status": "Live",
// //       },
// //       {
// //         id: 1,
// //         "custom_fields.propertyfinder_region": 1,
// //         "custom_fields.city": 1,
// //         "general_listing_information.status": 1,
// //         property_type: 1,
// //         address_information: 1,
// //       }
// //     );

// //     // Fetch all Redin location data
// //     const allExtractRedinLocation = await ExtractRedinLocation.find({});

// //     console.log(
// //       "This is all Properties Object:",
// //       allDubaiProperties.length,
// //       "This is all Redin locations:",
// //       allExtractRedinLocation.length
// //     );

// //     // NEW: Helper to convert tower letters to numbers and vice versa
// //     const normalizeTowerIdentifier = (str) => {
// //       if (!str) return str;

// //       // Map of letter to number conversions (A=1, B=2, C=3, etc.)
// //       const letterToNumber = {
// //         a: "1",
// //         b: "2",
// //         c: "3",
// //         d: "4",
// //         e: "5",
// //         f: "6",
// //         g: "7",
// //         h: "8",
// //         i: "9",
// //         j: "10",
// //         k: "11",
// //         l: "12",
// //         m: "13",
// //         n: "14",
// //         o: "15",
// //         p: "16",
// //         q: "17",
// //         r: "18",
// //         s: "19",
// //         t: "20",
// //         u: "21",
// //         v: "22",
// //         w: "23",
// //         x: "24",
// //         y: "25",
// //         z: "26",
// //       };

// //       let normalized = str.toLowerCase();

// //       // Replace "tower X" or "building X" patterns where X is a letter
// //       normalized = normalized.replace(
// //         /\b(tower|building|block|phase)\s+([a-z])\b/gi,
// //         (match, prefix, letter) => {
// //           const number = letterToNumber[letter.toLowerCase()];
// //           return number
// //             ? `${prefix.toLowerCase()} ${number}`
// //             : match.toLowerCase();
// //         }
// //       );

// //       // Replace standalone letters at the end (e.g., "Sparkle B" -> "Sparkle 2")
// //       normalized = normalized.replace(/\s+([a-z])\s*$/i, (match, letter) => {
// //         const number = letterToNumber[letter.toLowerCase()];
// //         return number ? ` ${number}` : match;
// //       });

// //       return normalized;
// //     };

// //     // Check the coordinate are available or not
// //     const hasValidCoordinates = (property) => {
// //       if (!property.address_information) return false;

// //       const addressInfo = property.address_information.toObject
// //         ? property.address_information.toObject()
// //         : property.address_information;

// //       if (!addressInfo.Longitude_Latitude) return false;

// //       const coordString = addressInfo.Longitude_Latitude.toString().trim();
// //       if (!coordString || coordString === "") return false;

// //       const coords = coordString.split(",");
// //       if (coords.length !== 2) return false;

// //       const lon = parseFloat(coords[0].trim());
// //       const lat = parseFloat(coords[1].trim());

// //       return !isNaN(lon) && !isNaN(lat);
// //     };

// //     // NEW: Helper to create alternate versions with letter/number swaps
// //     const createAlternateVersions = (str) => {
// //       if (!str) return [str];

// //       const versions = [str];
// //       const normalized = normalizeTowerIdentifier(str);

// //       if (normalized !== str) {
// //         versions.push(normalized);
// //       }

// //       return versions;
// //     };

// //     // Helper: Aggressive normalization for flexible matching
// //     const normalizeForMatching = (str) => {
// //       if (!str) return "";

// //       let result = str.toLowerCase().trim();

// //       // Convert "Palm Jumeirah" → "the palm"
// //       result = result.replace(/\bpalm\s+jumeirah\b/g, "the palm");

// //       // Singularize views → view
// //       result = result.replace(/\bviews\b/g, "view");

// //       // Convert Roman numerals I-X to numbers (I → 1, II → 2, III → 3, etc.)
// //       const romanMap = {
// //         i: "1",
// //         ii: "2",
// //         iii: "3",
// //         iv: "4",
// //         v: "5",
// //         vi: "6",
// //         vii: "7",
// //         viii: "8",
// //         ix: "9",
// //         x: "10",
// //       };
// //       result = result.replace(/\b(i{1,3}|iv|v|vi{0,3}|ix|x)\b/gi, (match) => {
// //         return romanMap[match.toLowerCase()] || match;
// //       });

// //       // Remove developer names preceded by "by"
// //       result = result.replace(/\bby\s+\w+\b/g, "");

// //       // ===== Special Attessa handling =====
// //       if (result.includes("Attessa")) {
// //         result = result.replace(/\b(tower)\b/g, "");
// //       }

// //       // ===== Special Shoreline handling =====
// //       if (result.includes("shoreline")) {
// //         // Remove 'al' and 'apartments'
// //         result = result.replace(/\b(al|apartments?)\b/g, "");
// //       }

// //       // Tower is equal to the T1, T2, T3
// //       result = result.replace(/\bt\s*(\d+)\b/gi, "tower $1");

// //       // The palm is equal to the palm jumeirah
// //       result = result.replace(/\bthe\s+palm\b/gi, "palm jumeirah");

// //       // Remove hypen
// //       result = result.replace(/\s*-\s*/g, " ");

// //       // Replace & with "and"
// //       result = result.replace(/&/g, "and");

// //       // Remove anything inside parentheses including parentheses
// //       result = result.replace(/\(.*?\)/g, "");

// //       // Special case: Alaya Beach → remove 'Beach'
// //       result = result.replace(/\balaya\s+beach\b/gi, "alaya");

// //       // Replace numbers like 01, 04, 002 with 1, 4, 2
// //       result = result.replace(/\b0+(\d+)\b/g, "$1");

// //       // If string contains "Madinat Jumeirah Living - XYZ", extract only XYZ
// //       // const mjlMatch = result.match(/madinat jumeirah living\s*-\s*(.+)/i);
// //       // if (mjlMatch && mjlMatch[1]) {
// //       //   result = mjlMatch[1].trim();
// //       // }

// //       //Singularize cluster / clusters
// //       result = result.replace(/\b(clusters?)\b/g, "cluster");

// //       // Convert shorthand like T2 → Tower 2
// //       result = result.replace(/\bT(\d+)\b/g, "tower $1");

// //       // Singularize tower / towers
// //       result = result.replace(/\b(towers?)\b/g, "tower");

// //       // Singularize residence / residences
// //       result = result.replace(/\b(residences?)\b/g, "residence");

// //       // Remove other unwanted words
// //       result = result.replace(
// //         /\b(the|a|an|it|its|by|estate|residences|at| villas| premium)\b/g,
// //         ""
// //       );

// //       // ===== REMOVE "TOWER" COMPLETELY AT THE VERY LAST STEP =====
// //       result = result.replace(/\btower\b/g, "");

// //       // Clean extra spaces
// //       result = result.replace(/\s+/g, " ").trim();

// //       return result;
// //     };

// //     const normalizePropertyType = (type) => {
// //       if (!type) return "";

// //       const normalizedType = type.toLowerCase().trim();
// //       if (normalizedType === "office-space") return "office";
// //       if (normalizedType === "townhouse" || normalizedType === "bungalow")
// //         return "villa";
// //       if (normalizedType === "duplex" || normalizedType === "penthouse")
// //         return "apartment";
// //       return normalizedType;
// //     };

// //     // Helper: Extract only alphanumeric characters for strict comparison
// //     const extractAlphanumeric = (str) => {
// //       if (!str) return "";
// //       return str.toLowerCase().replace(/[^a-z0-9]/g, "");
// //     };

// //     // Helper: Check if two location names match EXACTLY (100% match - no extra words)
// //     const isExactLocationMatch = (propertyRegion, redinName) => {
// //       if (!propertyRegion || !redinName) return false;

// //       // NEW: Create alternate versions with tower letter/number conversions
// //       const propertyVersions = createAlternateVersions(propertyRegion);
// //       const redinVersions = createAlternateVersions(redinName);

// //       // Try matching with all version combinations
// //       for (const propVersion of propertyVersions) {
// //         for (const redinVersion of redinVersions) {
// //           if (attemptExactMatch(propVersion, redinVersion)) {
// //             return true;
// //           }
// //         }
// //       }

// //       return false;
// //     };

// //     // NEW: Separated matching logic
// //     const attemptExactMatch = (propertyRegion, redinName) => {
// //       const normalizedRegion = normalizeForMatching(propertyRegion);
// //       const normalizedRedin = normalizeForMatching(redinName);

// //       // Extract numbers from both strings
// //       const regionNumbers = normalizedRegion.match(/\d+/g) || [];
// //       const redinNumbers = normalizedRedin.match(/\d+/g) || [];

// //       // CRITICAL: If property region has numbers, redin name MUST have those exact numbers
// //       if (regionNumbers.length > 0) {
// //         if (redinNumbers.length === 0) return false;
// //         const allNumbersMatch = regionNumbers.every((num) =>
// //           redinNumbers.includes(num)
// //         );
// //         if (!allNumbersMatch) return false;
// //       }

// //       // If redin has numbers but property doesn't, reject
// //       if (redinNumbers.length > 0 && regionNumbers.length === 0) {
// //         return false;
// //       }

// //       // EXACT match after normalization (no extra words allowed)
// //       if (normalizedRegion === normalizedRedin) return true;

// //       // Remove all non-alphanumeric characters for strict comparison
// //       const regionClean = extractAlphanumeric(normalizedRegion);
// //       const redinClean = extractAlphanumeric(normalizedRedin);

// //       // Must be EXACTLY the same (100% match)
// //       if (regionClean === redinClean) return true;

// //       // If lengths differ significantly, reject
// //       const lengthDiff = Math.abs(regionClean.length - redinClean.length);
// //       if (lengthDiff > 2) return false;

// //       // Check if the words match exactly (order doesn't matter but must have same words)
// //       const regionWords = normalizedRegion
// //         .split(/\s+/)
// //         .filter((w) => w && w.length > 1)
// //         .sort();
// //       const redinWords = normalizedRedin
// //         .split(/\s+/)
// //         .filter((w) => w && w.length > 1)
// //         .sort();

// //       // Must have same number of meaningful words
// //       if (regionWords.length !== redinWords.length) return false;

// //       // Check if numbers match when words are same
// //       if (regionNumbers.length > 0 || redinNumbers.length > 0) {
// //         // Sort numbers for comparison
// //         const sortedRegionNumbers = regionNumbers.sort();
// //         const sortedRedinNumbers = redinNumbers.sort();

// //         // Numbers must be identical
// //         if (sortedRegionNumbers.length !== sortedRedinNumbers.length)
// //           return false;
// //         const numbersMatch = sortedRegionNumbers.every(
// //           (num, idx) => num === sortedRedinNumbers[idx]
// //         );
// //         if (!numbersMatch) return false;
// //       }

// //       // All words must match (case: "binghatti flare" vs "flare binghatti")
// //       const allWordsMatch = regionWords.every((word, idx) => {
// //         const redinWord = redinWords[idx];
// //         // Allow slight variation for very similar words
// //         const wordClean1 = extractAlphanumeric(word);
// //         const wordClean2 = extractAlphanumeric(redinWord);
// //         return wordClean1 === wordClean2;
// //       });

// //       return allWordsMatch;
// //     };

// //     // Helper: Simple normalization for Region 1 OR Region 2 matching
// //     const isSimpleMatch = (str1, str2) => {
// //       if (!str1 || !str2) return false;

// //       // Letter to number mapping
// //       const letterToNumber = {
// //         a: "1",
// //         b: "2",
// //         c: "3",
// //         d: "4",
// //         e: "5",
// //         f: "6",
// //         g: "7",
// //         h: "8",
// //         i: "9",
// //         j: "10",
// //         k: "11",
// //         l: "12",
// //         m: "13",
// //         n: "14",
// //         o: "15",
// //         p: "16",
// //         q: "17",
// //         r: "18",
// //         s: "19",
// //         t: "20",
// //         u: "21",
// //         v: "22",
// //         w: "23",
// //         x: "24",
// //         y: "25",
// //         z: "26",
// //       };

// //       const normalizeSimple = (str) => {
// //         if (!str) return "";

// //         let result = str.toLowerCase().trim();

// //         // Convert "Palm Jumeirah" → "the palm"
// //         result = result.replace(/\bpalm\s+jumeirah\b/g, "the palm");

// //         // Singularize "townhouses" → "townhouse"
// //         result = result.replace(/\btownhouses\b/gi, "townhouse");

// //         // Remove branding phrase: "the residences at"
// //         result = result.replace(/\bthe\s+residences?\s+at\s+/g, "");

// //         // Singularize views → view
// //         result = result.replace(/\bviews\b/g, "view");

// //         // Fix common spelling variations
// //         result = result.replace(/\bjumeriah\b/g, "jumeirah");

// //         // Convert single letters (Tower A, Building B, etc.) to numbers
// //         result = result.replace(
// //           /\b(tower|building|block|phase)\s+([a-z])\b/gi,
// //           (match, prefix, letter) => {
// //             const number = letterToNumber[letter.toLowerCase()];
// //             return number
// //               ? `${prefix.toLowerCase()} ${number}`
// //               : match.toLowerCase();
// //           }
// //         );

// //         // Convert standalone single letters at the end
// //         result = result.replace(/\s+([a-z])\s*$/i, (match, letter) => {
// //           const number = letterToNumber[letter.toLowerCase()];
// //           return number ? ` ${number}` : match;
// //         });

// //         // Remove common words
// //         result = result.replace(
// //           /\b(the|a|an|at|in|by|estate|building|premium|east|west|north|south|central|park)\b/g,
// //           ""
// //         );

// //         // Replace "One" with "1" when followed by JBR
// //         result = result.replace(/\b(one|1)\s*jbr\b/gi, "1 jbr");

// //         // Remove parentheses and anything inside
// //         result = result.replace(/\(.*?\)/g, "");

// //         // Remove hyphens
// //         result = result.replace(/\s*-\s*/g, " ");

// //         // Replace & with "and"
// //         result = result.replace(/&/g, "and");

// //         // Singularize residences → residence
// //         result = result.replace(/\bresidences\b/g, "residence");

// //         // Clean multiple spaces
// //         result = result.replace(/\s+/g, " ").trim();

// //         return result;
// //       };

// //       const normalized1 = normalizeSimple(str1);
// //       const normalized2 = normalizeSimple(str2);

// //       // Direct comparison
// //       if (normalized1 === normalized2) return true;

// //       // Word order independent comparison
// //       const words1 = normalized1
// //         .split(/\s+/)
// //         .filter((w) => w && w.length > 0)
// //         .sort();
// //       const words2 = normalized2
// //         .split(/\s+/)
// //         .filter((w) => w && w.length > 0)
// //         .sort();

// //       if (words1.length !== words2.length) return false;

// //       return words1.every((word, idx) => word === words2[idx]);
// //     };

// //     // Helper: Partial word-by-word matching (at least 2-3 words must match)
// //     const isPartialWordMatch = (propertyRegion, redinName) => {
// //       if (!propertyRegion || !redinName) return false;

// //       const normalizedRegion = normalizeForMatching(propertyRegion);
// //       const normalizedRedin = normalizeForMatching(redinName);

// //       // Get words from both strings (filter out single char words and numbers-only words)
// //       const regionWords = normalizedRegion
// //         .split(/\s+/)
// //         .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
// //         .map((w) => extractAlphanumeric(w));

// //       const redinWords = normalizedRedin
// //         .split(/\s+/)
// //         .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
// //         .map((w) => extractAlphanumeric(w));

// //       if (regionWords.length === 0 || redinWords.length === 0) return false;

// //       // Count matching words
// //       let matchingWordsCount = 0;

// //       regionWords.forEach((regionWord) => {
// //         if (redinWords.includes(regionWord)) {
// //           matchingWordsCount++;
// //         }
// //       });

// //       // Calculate total unique words
// //       const totalWords = Math.max(regionWords.length, redinWords.length);

// //       // Logic:
// //       // - If one has more info (3+ words), require at least 3 matching words
// //       // - Otherwise, require at least 2 matching words
// //       if (totalWords >= 3) {
// //         return matchingWordsCount >= 3;
// //       } else {
// //         return matchingWordsCount >= 2;
// //       }
// //     };

// //     // Helper: Match starting words (at least 2-3 starting words must match)
// //     const isStartingWordsMatch = (propertyRegion, redinName) => {
// //       if (!propertyRegion || !redinName) return false;

// //       const normalizedRegion = normalizeForMatching(propertyRegion);
// //       const normalizedRedin = normalizeForMatching(redinName);

// //       // Split by "at" and take the first part from region
// //       const regionMainPart = normalizedRegion.split(/\s+at\s+/i)[0].trim();

// //       // Get words from both strings (filter out single char words and numbers-only words)
// //       const regionWords = regionMainPart
// //         .split(/\s+/)
// //         .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
// //         .map((w) => extractAlphanumeric(w));

// //       const redinWords = normalizedRedin
// //         .split(/\s+/)
// //         .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
// //         .map((w) => extractAlphanumeric(w));

// //       if (regionWords.length === 0 || redinWords.length === 0) return false;

// //       // Count matching STARTING words (in order)
// //       let matchingStartingWords = 0;
// //       const minLength = Math.min(regionWords.length, redinWords.length);

// //       for (let i = 0; i < minLength; i++) {
// //         if (regionWords[i] === redinWords[i]) {
// //           matchingStartingWords++;
// //         } else {
// //           break; // Stop at first mismatch
// //         }
// //       }

// //       // Logic:
// //       // - If region has 3+ words, require at least 3 starting words match
// //       // - Otherwise, require at least 2 starting words match
// //       if (regionWords.length >= 3) {
// //         return matchingStartingWords >= 3;
// //       } else {
// //         return matchingStartingWords >= 2;
// //       }
// //     };

// //     // Add this helper to extract first name (main property name)
// //     const extractFirstName = (regionString) => {
// //       if (!regionString) return null;

// //       // Split by common separators (comma, hyphen, "at", "in")
// //       const parts = regionString.split(/[,\-]|(\sat\s)|(\sin\s)/i);
// //       if (parts.length === 0) return null;
// //       // Return the first meaningful part
// //       return parts[0].trim();
// //     };

// //     const findRegion1Or2Match = (property, redinArray, region1, region2) => {
// //       const propertyType = property.property_type;
// //       if (!propertyType) return { matchResult: null, nameMatches: [] };

// //       // ✅ FIX: Normalize the actual propertyType variable
// //       const propertyTypeClean = normalizePropertyType(propertyType);
// //       const nameOnlyMatches = [];

// //       // Try Region 1 first
// //       if (region1) {
// //         const nameMatches = redinArray.filter((redin) => {
// //           if (!redin.property_name) return false;
// //           return isSimpleMatch(region1, redin.property_name);
// //         });

// //         nameOnlyMatches.push(...nameMatches);

// //         const region1Match = nameMatches.find((redin) => {
// //           if (!redin.main_subtype_name) return false;
// //           let redinSubtype = redin.main_subtype_name.toLowerCase().trim();
// //           if (redinSubtype === "serviced/hotel apartment") {
// //             redinSubtype = "apartment";
// //           }

// //           if (redinSubtype === "hotel apartment") {
// //             redinSubtype = "apartment";
// //           }
// //           return redinSubtype === propertyTypeClean;
// //         });

// //         if (region1Match) {
// //           return {
// //             matchResult: {
// //               match: region1Match,
// //               matchedRegionPart: region1,
// //               matchedRegionLevel: 1,
// //             },
// //             nameMatches: [],
// //           };
// //         }
// //       }

// //       // Try combined Region 1 + Region 2
// //       if (region1 && region2) {
// //         const combinedRegion = `${region1} ${region2}`;

// //         const nameMatches = redinArray.filter((redin) => {
// //           if (!redin.property_name) return false;
// //           return isSimpleMatch(combinedRegion, redin.property_name);
// //         });

// //         nameOnlyMatches.push(...nameMatches);

// //         const combinedMatch = nameMatches.find((redin) => {
// //           if (!redin.main_subtype_name) return false;
// //           let redinSubtype = redin.main_subtype_name.toLowerCase().trim();

// //           if (redinSubtype === "serviced/hotel apartment") {
// //             redinSubtype = "apartment";
// //           }

// //           if (redinSubtype === "hotel apartment") {
// //             redinSubtype = "apartment";
// //           }

// //           return redinSubtype === propertyTypeClean;
// //         });

// //         if (combinedMatch) {
// //           return {
// //             matchResult: {
// //               match: combinedMatch,
// //               matchedRegionPart: combinedRegion,
// //               matchedRegionLevel: 1.2,
// //             },
// //             nameMatches: [],
// //           };
// //         }
// //       }

// //       return { matchResult: null, nameMatches: nameOnlyMatches };
// //     };

// //     // Helper: Match combined regions with word swapping
// //     const isCombinedRegionMatch = (propertyRegion, redinName) => {
// //       if (!propertyRegion || !redinName) return false;

// //       const normalizedRegion = normalizeForMatching(propertyRegion);
// //       const normalizedRedin = normalizeForMatching(redinName);

// //       // Split both by words
// //       const regionWords = normalizedRegion
// //         .split(/\s+/)
// //         .filter((w) => w && w.length > 1);
// //       const redinWords = normalizedRedin
// //         .split(/\s+/)
// //         .filter((w) => w && w.length > 1);

// //       if (regionWords.length === 0 || redinWords.length === 0) return false;

// //       // NEW: Sort both arrays to ignore order completely
// //       const regionWordsSorted = [...regionWords].sort();
// //       const redinWordsSorted = [...redinWords].sort();

// //       // Check if they have the same words (regardless of order)
// //       if (regionWordsSorted.length !== redinWordsSorted.length) return false;

// //       return regionWordsSorted.every(
// //         (word, idx) => word === redinWordsSorted[idx]
// //       );
// //     };

// //     // Helper to check if property name matches (ignoring subtype)
// //     const checkPropertyNameMatch = (propertyRegion, redinName) => {
// //       if (!propertyRegion || !redinName) return false;
// //       return isExactLocationMatch(propertyRegion, redinName);
// //     };

// //     // ==================== COORDINATE MATCHING HELPERS ====================

// //     // Extract and trim coordinates from Property database
// //     const extractAndTrimCoordinates = (addressInfo) => {
// //       try {
// //         if (!addressInfo) return null;

// //         const plainAddressInfo = addressInfo.toObject
// //           ? addressInfo.toObject()
// //           : addressInfo;

// //         if (!plainAddressInfo.Longitude_Latitude) return null;

// //         const coordString =
// //           plainAddressInfo.Longitude_Latitude.toString().trim();
// //         if (!coordString) return null;

// //         const coords = coordString.split(",");
// //         if (coords.length !== 2) return null;

// //         const lon = parseFloat(coords[0].trim());
// //         const lat = parseFloat(coords[1].trim());

// //         if (isNaN(lon) || isNaN(lat)) return null;

// //         const lonTrimmed = Math.trunc(lon * 100) / 100;
// //         const latTrimmed = Math.trunc(lat * 100) / 100;

// //         return {
// //           lon: lonTrimmed,
// //           lat: latTrimmed,
// //           original: { lon, lat },
// //         };
// //       } catch (error) {
// //         return null;
// //       }
// //     };

// //     // Extract and trim coordinates from Redin geo_point
// //     const extractAndTrimRedinCoordinates = (geoPoint) => {
// //       try {
// //         if (!geoPoint || !geoPoint.lon || !geoPoint.lat) return null;

// //         const lon = parseFloat(geoPoint.lon);
// //         const lat = parseFloat(geoPoint.lat);

// //         if (isNaN(lon) || isNaN(lat)) return null;

// //         const lonTrimmed = Math.trunc(lon * 100) / 100;
// //         const latTrimmed = Math.trunc(lat * 100) / 100;

// //         return {
// //           lon: lonTrimmed,
// //           lat: latTrimmed,
// //           original: { lon, lat },
// //         };
// //       } catch (error) {
// //         return null;
// //       }
// //     };

// //     const findCoordMatchWithTypeValidation = (property, redinArray) => {
// //       const propertyCoords = extractAndTrimCoordinates(
// //         property.address_information
// //       );
// //       if (!propertyCoords) return { matchResult: null, typeMismatchInfo: null };

// //       const propertyType = property.property_type;
// //       if (!propertyType) return { matchResult: null, typeMismatchInfo: null };

// //       const propertyTypeClean = propertyType.toLowerCase().trim();

// //       // Track type mismatches
// //       let typeMismatchInfo = null;

// //       // Function to check match at specific coordinates with type validation
// //       const checkCoordAtLevel = (lat, lon, coordType) => {
// //         const coordMatches = redinArray.filter((redin) => {
// //           return (
// //             redin.coordinates &&
// //             redin.coordinates.lat === lat &&
// //             redin.coordinates.lon === lon
// //           );
// //         });

// //         if (coordMatches.length === 0) return null;

// //         const match = coordMatches.find((redin) => {
// //           if (!redin.main_subtype_name) return false;
// //           let redinSubtype = redin.main_subtype_name.toLowerCase().trim();
// //           if (redinSubtype === "serviced/hotel apartment") {
// //             redinSubtype = "apartment";
// //           }

// //           if (redinSubtype === "hotel apartment") {
// //             redinSubtype = "apartment";
// //           }
// //           const normalizedPropertyType =
// //             normalizePropertyType(propertyTypeClean);
// //           return redinSubtype === normalizedPropertyType;
// //         });

// //         if (match) {
// //           return {
// //             match,
// //             matchedRegionPart: null,
// //             matchedRegionLevel: 0,
// //             coordType,
// //             matchedCoords: { lat, lon },
// //           };
// //         } else if (coordMatches.length > 0 && !typeMismatchInfo) {
// //           // Coordinates matched but type didn't - store this info
// //           typeMismatchInfo = {
// //             coordType,
// //             matchedCoords: { lat, lon },
// //             propertyType: propertyTypeClean,
// //             availableTypes: coordMatches.map((m) => ({
// //               property_name: m.property_name,
// //               main_subtype_name: m.main_subtype_name,
// //               location_id: m.location_id,
// //             })),
// //           };
// //         }

// //         return null;
// //       };

// //       // Try exact coordinates first
// //       let result = checkCoordAtLevel(
// //         propertyCoords.lat,
// //         propertyCoords.lon,
// //         "exact"
// //       );
// //       if (result) return { matchResult: result, typeMismatchInfo: null };

// //       // Try decrement (lat - 0.01, lat - 0.02)
// //       for (let offset of [-1, -2]) {
// //         const lat = Math.trunc(propertyCoords.lat * 100 + offset) / 100;
// //         result = checkCoordAtLevel(lat, propertyCoords.lon, "decrement");
// //         if (result) return { matchResult: result, typeMismatchInfo: null };
// //       }

// //       // Try increment (lat + 0.01, lat + 0.02)
// //       for (let offset of [1, 2]) {
// //         const lat = Math.trunc(propertyCoords.lat * 100 + offset) / 100;
// //         result = checkCoordAtLevel(lat, propertyCoords.lon, "increment");
// //         if (result) return { matchResult: result, typeMismatchInfo: null };
// //       }

// //       return { matchResult: null, typeMismatchInfo };
// //     };

// //     // ==================== END COORDINATE MATCHING HELPERS ====================

// //     // Build flattened Redin array for efficient matching (with coordinates)
// //     const redinFlattenedArray = [];
// //     allExtractRedinLocation.forEach((location) => {
// //       const redinCoords = extractAndTrimRedinCoordinates(location.geo_point);

// //       if (location.properties && Array.isArray(location.properties)) {
// //         location.properties.forEach((p) => {
// //           redinFlattenedArray.push({
// //             location_id: location.location_id,
// //             geo_point: location.geo_point,
// //             coordinates: redinCoords,
// //             property_id: p.property?.id,
// //             property_name: p.property?.name,
// //             main_subtype_name:
// //               p.property?.main_subtype_name || p.main_subtype_name,
// //             main_type_name: p.property?.main_type_name || p.main_type_name,
// //           });
// //         });
// //       }
// //     });

// //     // Stats object
// //     const stats = {
// //       totalDubaiProperties: allDubaiProperties.length,
// //       totalRedinLocations: allExtractRedinLocation.length,
// //       totalRedinProperties: redinFlattenedArray.length,
// //       totalPropertiesWithCoordinates: allDubaiProperties.filter((p) =>
// //         hasValidCoordinates(p)
// //       ).length,

// //       // Step 1.5: Combined region matching with word swap  ← ADD THIS
// //       step1_5_combinedRegionMatched: 0,
// //       step1_5_coordinatesAvailableInRemaining: 0,

// //       // Step 1: Region 1 exact matching
// //       step1_region1Matched: 0,
// //       step1_coordinatesAvailableInRemaining: 0,

// //       // Step 2: Region 2 exact matching
// //       step2_region2Matched: 0,
// //       step2_coordinatesAvailableInRemaining: 0,

// //       // Step 1.1: Try Region 1, fallback to Region 2 exact matching
// //       step1_1_region1Or2Matched: 0,
// //       step1_1_coordinatesAvailableInRemaining: 0,

// //       // Step 3: Partial word-by-word matching (2-3 words)
// //       step3_partialWordMatched: 0,
// //       step3_coordinatesAvailableInRemaining: 0,

// //       // Step 4: Starting words matching (2-3 starting words)
// //       step4_startingWordsMatched: 0,
// //       step4_coordinatesAvailableInRemaining: 0,

// //       // Step 5: Coordinate matching
// //     //   step5_coordMatched: 0,
// //     //   step5_exactCoordMatch: 0,
// //     //   step5_decrementCoordMatch: 0,
// //     //   step5_incrementCoordMatch: 0,

// //       //   step5_coordinatesAvailableBeforeMatching: 0,

// //       //   step5_coordinatesAvailableInRemaining: 0,

// //     //   step5_coordMatchedButTypeMismatch: 0,
// //     //   step5_coordMatchedExactButTypeMismatch: 0,
// //     //   step5_coordMatchedDecrementButTypeMismatch: 0,
// //     //   step5_coordMatchedIncrementButTypeMismatch: 0,

// //       step1_5_nameMatchedButSubtypeMismatch: 0,
// //       step1_nameMatchedButSubtypeMismatch: 0,
// //       step1_1_nameMatchedButSubtypeMismatch: 0,
// //       step2_nameMatchedButSubtypeMismatch: 0,
// //       step3_nameMatchedButSubtypeMismatch: 0,
// //       step4_nameMatchedButSubtypeMismatch: 0,

// //       // Final stats
// //       totalMatched: 0,
// //       totalUnmatched: 0,
// //       updateSuccess: 0,
// //       updateFailed: 0,
// //     };

// //     // Result arrays
// //     const step1_region1Matched = [];
// //     const step1_5_combinedRegionMatched = [];
// //     const step1_1_region1Or2Matched = [];
// //     const step2_region2Matched = [];
// //     const step3_partialWordMatched = [];
// //     const step4_startingWordsMatched = [];
// //     const step5_coordMatched = [];
// //     const step5_coordMatchedButTypeMismatch = [];
// //     const unmatchedProperties = [];
// //     const updatePromises = [];

// //     // ARRAYS for tracking remaining coordinates at each step:
// //     const step1_5_remainingWithCoordinates = [];
// //     const step1_remainingWithCoordinates = [];
// //     const step1_1_remainingWithCoordinates = [];
// //     const step2_remainingWithCoordinates = [];
// //     const step3_remainingWithCoordinates = [];
// //     const step4_remainingWithCoordinates = [];
// //     const step5_remainingWithCoordinates = [];

// //     const step1_5_nameMatchedButSubtypeMismatch = [];
// //     const step1_nameMatchedButSubtypeMismatch = [];
// //     const step1_1_nameMatchedButSubtypeMismatch = [];
// //     const step2_nameMatchedButSubtypeMismatch = [];
// //     const step3_nameMatchedButSubtypeMismatch = [];
// //     const step4_nameMatchedButSubtypeMismatch = [];

// //     // ADD THIS NEW SET TO TRACK ALREADY RECORDED PROPERTIES:
// //     const recordedSubtypeMismatchPropertyIds = new Set();

// //     // Extract region parts
// //     const extractRegionParts = (regionString) => {
// //       if (!regionString) return { region1: null, region2: null };
// //       const parts = regionString
// //         .split(",")
// //         .map((part) => part.trim())
// //         .filter((p) => p);
// //       return {
// //         region1: parts.length > 0 ? parts[0] : null,
// //         region2: parts.length > 1 ? parts[1] : null,
// //       };
// //     };

// //     const extractThreeRegions = (regionString) => {
// //       if (!regionString) return { region1: null, region2: null, region3: null };
// //       const parts = regionString
// //         .split(",")
// //         .map((part) => part.trim())
// //         .filter((p) => p);
// //       return {
// //         region1: parts.length > 0 ? parts[0] : null,
// //         region2: parts.length > 1 ? parts[1] : null,
// //         region3: parts.length > 2 ? parts[2] : null,
// //       };
// //     };

// //     // Combine Region
// //     const combineRegions = (region1, region2) => {
// //       return [region1, region2].filter(Boolean).join(" ");
// //     };

// //     // Helper: Find match by specific region and type (EXACT match required)
// //     const findRegionMatch = (property, redinArray, regionValue) => {
// //       const propertyType = property.property_type;
// //       if (!regionValue || !propertyType)
// //         return { matchResult: null, nameMatches: [] };

// //       const propertyTypeClean = normalizePropertyType(propertyType);

// //       const nameMatches = redinArray.filter((redin) => {
// //         if (!redin.property_name) return false;
// //         return isExactLocationMatch(regionValue, redin.property_name);
// //       });

// //       const match = nameMatches.find((redin) => {
// //         if (!redin.main_subtype_name) return false;

// //         let redinSubtype = redin.main_subtype_name.toLowerCase().trim();
// //         if (redinSubtype === "serviced/hotel apartment") {
// //           redinSubtype = "apartment";
// //         }
// //         return redinSubtype === propertyTypeClean;
// //       });

// //       if (match) {
// //         return {
// //           matchResult: {
// //             match,
// //             matchedRegionPart: regionValue,
// //           },
// //           nameMatches: [],
// //         };
// //       }

// //       return { matchResult: null, nameMatches };
// //     };

// //     // Helper: Find combined region match with word swapping
// //     const findCombinedRegionMatch = (
// //       property,
// //       redinArray,
// //       region1,
// //       region2
// //     ) => {
// //       if (!region1 || !property?.property_type) {
// //         return { matchResult: null, nameMatches: [] };
// //       }

// //       const propertyTypeClean = normalizePropertyType(property.property_type);

// //       const combinations = [
// //         combineRegions(region1, region2),
// //         combineRegions(region2, region1),
// //       ];

// //       const nameOnlyMatches = [];

// //       for (const combinedRegion of combinations) {
// //         if (!combinedRegion) continue;

// //         // 1️⃣ Match by combined region in name
// //         const nameMatches = redinArray.filter((redin) => {
// //           if (!redin.property_name) return false;
// //           return isCombinedRegionMatch(combinedRegion, redin.property_name);
// //         });

// //         nameOnlyMatches.push(...nameMatches);

// //         // 2️⃣ Match property type
// //         const match = nameMatches.find((redin) => {
// //           if (!redin.main_subtype_name) return false;
// //           return (
// //             redin.main_subtype_name.toLowerCase().trim() === propertyTypeClean
// //           );
// //         });

// //         if (match) {
// //           return {
// //             matchResult: {
// //               match,
// //               matchedRegionPart: combinedRegion,
// //             },
// //             nameMatches: [],
// //           };
// //         }
// //       }

// //       // No exact subtype match, return name-only matches
// //       return {
// //         matchResult: null,
// //         nameMatches: nameOnlyMatches,
// //       };
// //     };

// //     // Helper: Find partial word match by region 1
// //     const findPartialWordMatch = (property, redinArray, regionValue) => {
// //       if (!regionValue || !property?.property_type) {
// //         return { matchResult: null, nameMatches: [] };
// //       }

// //       const propertyTypeClean = normalizePropertyType(property.property_type);

// //       // 1️⃣ Match by partial word in name
// //       const nameMatches = redinArray.filter((redin) => {
// //         if (!redin.property_name) return false;
// //         return isPartialWordMatch(regionValue, redin.property_name);
// //       });

// //       // 2️⃣ Match by subtype
// //       const match = nameMatches.find((redin) => {
// //         if (!redin.main_subtype_name) return false;
// //         return (
// //           normalizePropertyType(redin.main_subtype_name) === propertyTypeClean
// //         );
// //       });

// //       if (match) {
// //         return {
// //           matchResult: {
// //             match,
// //             matchedRegionPart: regionValue,
// //           },
// //           nameMatches: [],
// //         };
// //       }

// //       // No exact subtype match
// //       return {
// //         matchResult: null,
// //         nameMatches,
// //       };
// //     };

// //     const findStartingWordsMatch = (property, redinArray, regionValue) => {
// //       const propertyType = property.property_type;

// //       if (!regionValue || !propertyType)
// //         return { matchResult: null, nameMatches: [] };

// //       const propertyTypeClean = normalizePropertyType(propertyType);

// //       const nameMatches = redinArray.filter((redin) => {
// //         if (!redin.property_name) return false;
// //         return isStartingWordsMatch(regionValue, redin.property_name);
// //       });

// //       const match = nameMatches.find((redin) => {
// //         if (!redin.main_subtype_name) return false;
// //         let redinSubtype = redin.main_subtype_name.toLowerCase().trim();
// //         if (redinSubtype === "serviced/hotel apartment") {
// //           redinSubtype = "apartment";
// //         }

// //         if (redinSubtype === "hotel apartment") {
// //           redinSubtype = "apartment";
// //         }
// //         return redinSubtype === propertyTypeClean;
// //       });

// //       if (match) {
// //         return {
// //           matchResult: {
// //             match,
// //             matchedRegionPart: regionValue,
// //           },
// //           nameMatches: [],
// //         };
// //       }

// //       return { matchResult: null, nameMatches };
// //     };

// //     // Helper: Update database
// //     const updatePropertyInDB = (
// //       property,
// //       matchData,
// //       matchType,
// //       regionLevel
// //     ) => {
// //       const updatePromise = Property.findOneAndUpdate(
// //         { id: property.id },
// //         {
// //           $set: {
// //             redin_location: {
// //               location_id: matchData.match.location_id,
// //               property_location_id: matchData.match.property_id,
// //               property_name: matchData.match.property_name,
// //               main_subtype_name: matchData.match.main_subtype_name,
// //               main_type_name: matchData.match.main_type_name,
// //               matched_by: matchType,
// //               matched_region_level: regionLevel,
// //               matched_region_part: matchData.matchedRegionPart,
// //             },
// //           },
// //         },
// //         { new: true }
// //       )
// //         .then((updated) => {
// //           if (updated) {
// //             stats.updateSuccess++;
// //             console.log(
// //               `✓ Property ${property.id}: ${matchType} (Level ${regionLevel}) → Updated`
// //             );
// //           } else {
// //             stats.updateFailed++;
// //             console.log(`✗ Property ${property.id}: Update failed - not found`);
// //           }
// //           return updated;
// //         })
// //         .catch((err) => {
// //           stats.updateFailed++;
// //           console.error(
// //             `✗ Property ${property.id}: Update error:`,
// //             err.message
// //           );
// //           return null;
// //         });

// //       updatePromises.push(updatePromise);
// //     };

// //     console.log("\n========== STARTING MATCHING PROCESS ==========\n");

// //     // STEP 1: Match by Region 1 + Type (EXACT)

// //     // STEP 1.5: Match by Combined Region (Region1 + Region2) with Word Swapping
// //     console.log(
// //       "\n--- STEP 1.5: Matching by Combined Region (Region1 + Region2) with Word Swapping ---"
// //     );

// //     const unmatchedAfterStep1_5 = [];

// //     for (const property of allDubaiProperties) {
// //       const { region1, region2 } = extractRegionParts(
// //         property.custom_fields?.propertyfinder_region
// //       );

// //       if (region1) {
// //         const { matchResult, nameMatches } = findCombinedRegionMatch(
// //           property,
// //           redinFlattenedArray,
// //           region1,
// //           region2
// //         );

// //         if (matchResult) {
// //           stats.step1_5_combinedRegionMatched++;
// //           stats.totalMatched++;

// //           step1_5_combinedRegionMatched.push({
// //             property_id: property.id,
// //             full_region: property.custom_fields?.propertyfinder_region,
// //             region1,
// //             region2,
// //             combined_region: combineRegions(region1, region2),
// //             property_type: property.property_type,
// //             matched_region_part: matchResult.matchedRegionPart,
// //             matched_redin: {
// //               location_id: matchResult.match.location_id,
// //               property_name: matchResult.match.property_name,
// //               main_subtype_name: matchResult.match.main_subtype_name,
// //             },
// //           });

// //           updatePropertyInDB(
// //             property,
// //             matchResult,
// //             "combined_region_match",
// //             1.5
// //           );
// //         } else if (nameMatches.length > 0) {
// //           // Name matched but subtype didn't
// //           if (!recordedSubtypeMismatchPropertyIds.has(property.id)) {
// //             stats.step1_5_nameMatchedButSubtypeMismatch++;
// //             recordedSubtypeMismatchPropertyIds.add(property.id);

// //             step1_5_nameMatchedButSubtypeMismatch.push({
// //               property_id: property.id,
// //               full_region: property.custom_fields?.propertyfinder_region,
// //               region1,
// //               region2,
// //               property_type: property.property_type,
// //               matched_in_step: "1.5",
// //               available_redin_matches: nameMatches.map((m) => ({
// //                 property_name: m.property_name,
// //                 main_subtype_name: m.main_subtype_name,
// //                 location_id: m.location_id,
// //               })),
// //             });
// //           }

// //           unmatchedAfterStep1_5.push(property);
// //         } else {
// //           unmatchedAfterStep1_5.push(property);
// //         }
// //       } else {
// //         unmatchedAfterStep1_5.push(property);
// //       }
// //     }

// //     console.log(
// //       `Step 1.5 Complete: ${stats.step1_5_combinedRegionMatched} matched (Combined Region with Word Swap), ${unmatchedAfterStep1_5.length} remaining unmatched`
// //     );

// //     // ADD THIS BLOCK:
// //     // stats.step1_5_coordinatesAvailableInRemaining =
// //     //   unmatchedAfterStep1_5.filter((p) => hasValidCoordinates(p)).length;
// //     // console.log(
// //     //   `  └─ Properties with coordinates in remaining: ${stats.step1_5_coordinatesAvailableInRemaining}`
// //     // );

// //     // unmatchedAfterStep1_5
// //     //   .filter((p) => hasValidCoordinates(p))
// //     //   .forEach((p) => {
// //     //     step1_5_remainingWithCoordinates.push({
// //     //       property_id: p.id,
// //     //       full_region: p.custom_fields?.propertyfinder_region,
// //     //       property_type: p.property_type,
// //     //       address_information: p.address_information,
// //     //     });
// //     //   });

// //     const unmatchedAfterStep1 = [];

// //     for (const property of unmatchedAfterStep1_5) {
// //       const { region1, region2 } = extractRegionParts(
// //         property.custom_fields?.propertyfinder_region
// //       );

// //       const { matchResult, nameMatches } = findRegionMatch(
// //         property,
// //         redinFlattenedArray,
// //         region1
// //       );

// //       if (matchResult) {
// //         stats.step1_region1Matched++;
// //         stats.totalMatched++;

// //         step1_region1Matched.push({
// //           property_id: property.id,
// //           full_region: property.custom_fields?.propertyfinder_region,
// //           address_information: region1,
// //           region2,
// //           property_type: property.property_type,
// //           matched_region_part: matchResult.matchedRegionPart,
// //           matched_redin: {
// //             location_id: matchResult.match.location_id,
// //             property_name: matchResult.match.property_name,
// //             main_subtype_name: matchResult.match.main_subtype_name,
// //           },
// //         });

// //         updatePropertyInDB(property, matchResult, "exact_region1_match", 1);
// //       } else if (nameMatches.length > 0) {
// //         if (!recordedSubtypeMismatchPropertyIds.has(property.id)) {
// //           stats.step1_nameMatchedButSubtypeMismatch++;
// //           recordedSubtypeMismatchPropertyIds.add(property.id);

// //           step1_nameMatchedButSubtypeMismatch.push({
// //             property_id: property.id,
// //             full_region: property.custom_fields?.propertyfinder_region,
// //             region1,
// //             region2,
// //             property_type: property.property_type,
// //             matched_in_step: "1.5",
// //             available_redin_matches: nameMatches.map((m) => ({
// //               property_name: m.property_name,
// //               main_subtype_name: m.main_subtype_name,
// //               location_id: m.location_id,
// //             })),
// //           });
// //         }

// //         unmatchedAfterStep1.push(property);
// //       } else {
// //         unmatchedAfterStep1.push(property);
// //       }
// //     }

// //     console.log(
// //       `Step 1 Complete: ${stats.step1_region1Matched} matched (Region 1), ${unmatchedAfterStep1.length} remaining unmatched`
// //     );

// //     // ADD THIS BLOCK:
// //     // stats.step1_coordinatesAvailableInRemaining = unmatchedAfterStep1.filter(
// //     //   (p) => hasValidCoordinates(p)
// //     // ).length;
// //     // console.log(
// //     //   `  └─ Properties with coordinates in remaining: ${stats.step1_coordinatesAvailableInRemaining}`
// //     // );

// //     // unmatchedAfterStep1
// //     //   .filter((p) => hasValidCoordinates(p))
// //     //   .forEach((p) => {
// //     //     step1_remainingWithCoordinates.push({
// //     //       property_id: p.id,
// //     //       full_region: p.custom_fields?.propertyfinder_region,
// //     //       property_type: p.property_type,
// //     //       address_information: p.address_information,
// //     //     });
// //     //   });

// //     console.log("\n--- STEP 1.1: Matching by Region 1 OR Region 2 (Exact) ---");

// //     const unmatchedAfterStep1_1 = [];

// //     for (const property of unmatchedAfterStep1) {
// //       const { region1, region2 } = extractRegionParts(
// //         property.custom_fields?.propertyfinder_region
// //       );

// //       const { matchResult, nameMatches } = findRegion1Or2Match(
// //         property,
// //         redinFlattenedArray,
// //         region1,
// //         region2
// //       );

// //       if (matchResult) {
// //         stats.step1_1_region1Or2Matched++;
// //         stats.totalMatched++;

// //         step1_1_region1Or2Matched.push({
// //           property_id: property.id,
// //           full_region: property.custom_fields?.propertyfinder_region,
// //           region1,
// //           region2,
// //           property_type: property.property_type,
// //           matched_region_part: matchResult.matchedRegionPart,
// //           matched_region_level: matchResult.matchedRegionLevel,
// //           matched_redin: {
// //             location_id: matchResult.match.location_id,
// //             property_name: matchResult.match.property_name,
// //             main_subtype_name: matchResult.match.main_subtype_name,
// //           },
// //         });

// //         updatePropertyInDB(
// //           property,
// //           matchResult,
// //           "exact_region1_or_region2_match",
// //           matchResult.matchedRegionLevel
// //         );
// //       } else if (nameMatches.length > 0) {
// //         if (!recordedSubtypeMismatchPropertyIds.has(property.id)) {
// //           stats.step1_1_nameMatchedButSubtypeMismatch++;
// //           recordedSubtypeMismatchPropertyIds.add(property.id);

// //           step1_1_nameMatchedButSubtypeMismatch.push({
// //             property_id: property.id,
// //             full_region: property.custom_fields?.propertyfinder_region,
// //             region1,
// //             region2,
// //             property_type: property.property_type,
// //             matched_in_step: "1.5",
// //             available_redin_matches: nameMatches.map((m) => ({
// //               property_name: m.property_name,
// //               main_subtype_name: m.main_subtype_name,
// //               location_id: m.location_id,
// //             })),
// //           });
// //         }

// //         unmatchedAfterStep1_1.push(property);
// //       } else {
// //         unmatchedAfterStep1_1.push(property);
// //       }
// //     }

// //     console.log(
// //       `Step 1.1 Complete: ${stats.step1_1_region1Or2Matched} matched (Region 1 or Region 2), ${unmatchedAfterStep1_1.length} remaining unmatched`
// //     );

// //     stats.step1_1_coordinatesAvailableInRemaining =
// //       unmatchedAfterStep1_1.filter((p) => hasValidCoordinates(p)).length;
// //     console.log(
// //       `  └─ Properties with coordinates in remaining: ${stats.step1_1_coordinatesAvailableInRemaining}`
// //     );

// //     unmatchedAfterStep1_1
// //       .filter((p) => hasValidCoordinates(p))
// //       .forEach((p) => {
// //         step1_1_remainingWithCoordinates.push({
// //           property_id: p.id,
// //           full_region: p.custom_fields?.propertyfinder_region,
// //           property_type: p.property_type,
// //           address_information: p.address_information,
// //         });
// //       });

// //     // STEP 2: Match by Region 2 + Type (EXACT)
// //     const unmatchedAfterStep2 = [];

// //     for (const property of unmatchedAfterStep1_1) {
// //       const { region1, region2 } = extractRegionParts(
// //         property.custom_fields?.propertyfinder_region
// //       );

// //       if (region2) {
// //         const { matchResult, nameMatches } = findRegionMatch(
// //           property,
// //           redinFlattenedArray,
// //           region2
// //         );

// //         if (matchResult) {
// //           stats.step2_region2Matched++;
// //           stats.totalMatched++;

// //           step2_region2Matched.push({
// //             property_id: property.id,
// //             full_region: property.custom_fields?.propertyfinder_region,
// //             region1,
// //             region2,
// //             property_type: property.property_type,
// //             matched_region_part: matchResult.matchedRegionPart,
// //             matched_redin: {
// //               location_id: matchResult.match.location_id,
// //               property_name: matchResult.match.property_name,
// //               main_subtype_name: matchResult.match.main_subtype_name,
// //             },
// //           });

// //           updatePropertyInDB(property, matchResult, "exact_region2_match", 2);
// //         } else if (nameMatches.length > 0) {
// //           if (!recordedSubtypeMismatchPropertyIds.has(property.id)) {
// //             stats.step2_nameMatchedButSubtypeMismatch++;
// //             recordedSubtypeMismatchPropertyIds.add(property.id);

// //             step2_nameMatchedButSubtypeMismatch.push({
// //               property_id: property.id,
// //               full_region: property.custom_fields?.propertyfinder_region,
// //               region1,
// //               region2,
// //               property_type: property.property_type,
// //               matched_in_step: "1.5",
// //               available_redin_matches: nameMatches.map((m) => ({
// //                 property_name: m.property_name,
// //                 main_subtype_name: m.main_subtype_name,
// //                 location_id: m.location_id,
// //               })),
// //             });
// //           }

// //           unmatchedAfterStep2.push(property);
// //         } else {
// //           unmatchedAfterStep2.push(property);
// //         }
// //       } else {
// //         unmatchedAfterStep2.push(property);
// //       }
// //     }

// //     console.log(
// //       `Step 2 Complete: ${stats.step2_region2Matched} matched (Region 2), ${unmatchedAfterStep2.length} remaining unmatched`
// //     );

// //     // // ADD THIS BLOCK:
// //     // stats.step2_coordinatesAvailableInRemaining = unmatchedAfterStep2.filter(
// //     //   (p) => hasValidCoordinates(p)
// //     // ).length;
// //     // console.log(
// //     //   `  └─ Properties with coordinates in remaining: ${stats.step2_coordinatesAvailableInRemaining}`
// //     // );

// //     // unmatchedAfterStep2
// //     //   .filter((p) => hasValidCoordinates(p))
// //     //   .forEach((p) => {
// //     //     step2_remainingWithCoordinates.push({
// //     //       property_id: p.id,
// //     //       full_region: p.custom_fields?.propertyfinder_region,
// //     //       property_type: p.property_type,
// //     //       address_information: p.address_information,
// //     //     });
// //     //   });

// //     // STEP 3: Partial Word-by-Word Matching (2-3 words must match)

// //     const unmatchedAfterStep3 = [];

// //     for (const property of unmatchedAfterStep2) {
// //       const { region1, region2 } = extractRegionParts(
// //         property.custom_fields?.propertyfinder_region
// //       );

// //       if (region1) {
// //         const { matchResult, nameMatches } = findPartialWordMatch(
// //           property,
// //           redinFlattenedArray,
// //           region1
// //         );

// //         if (matchResult) {
// //           stats.step3_partialWordMatched++;
// //           stats.totalMatched++;

// //           step3_partialWordMatched.push({
// //             property_id: property.id,
// //             full_region: property.custom_fields?.propertyfinder_region,
// //             region1,
// //             region2,
// //             property_type: property.property_type,
// //             matched_region_part: matchResult.matchedRegionPart,
// //             matched_redin: {
// //               location_id: matchResult.match.location_id,
// //               property_name: matchResult.match.property_name,
// //               main_subtype_name: matchResult.match.main_subtype_name,
// //             },
// //           });

// //           updatePropertyInDB(property, matchResult, "partial_word_match", 1);
// //         } else if (nameMatches.length > 0) {
// //           if (!recordedSubtypeMismatchPropertyIds.has(property.id)) {
// //             stats.step3_nameMatchedButSubtypeMismatch++;
// //             recordedSubtypeMismatchPropertyIds.add(property.id);

// //             step3_nameMatchedButSubtypeMismatch.push({
// //               property_id: property.id,
// //               full_region: property.custom_fields?.propertyfinder_region,
// //               region1,
// //               region2,
// //               property_type: property.property_type,
// //               matched_in_step: "1.5",
// //               available_redin_matches: nameMatches.map((m) => ({
// //                 property_name: m.property_name,
// //                 main_subtype_name: m.main_subtype_name,
// //                 location_id: m.location_id,
// //               })),
// //             });
// //           }

// //           unmatchedAfterStep3.push(property);
// //         } else {
// //           unmatchedAfterStep3.push(property);
// //         }
// //       } else {
// //         unmatchedAfterStep3.push(property);
// //       }
// //     }

// //     console.log(
// //       `Step 3 Complete: ${stats.step3_partialWordMatched} matched (Partial Words), ${unmatchedAfterStep3.length} remaining unmatched`
// //     );

// //     // ADD THIS BLOCK:
// //     stats.step3_coordinatesAvailableInRemaining = unmatchedAfterStep3.filter(
// //       (p) => hasValidCoordinates(p)
// //     ).length;
// //     console.log(
// //       `  └─ Properties with coordinates in remaining: ${stats.step3_coordinatesAvailableInRemaining}`
// //     );

// //     unmatchedAfterStep3
// //       .filter((p) => hasValidCoordinates(p))
// //       .forEach((p) => {
// //         step3_remainingWithCoordinates.push({
// //           property_id: p.id,
// //           full_region: p.custom_fields?.propertyfinder_region,
// //           property_type: p.property_type,
// //           address_information: p.address_information,
// //         });
// //       });

// //     // STEP 4: Starting Words Matching (2-3 starting words must match)
// //     const unmatchedAfterStep4 = [];

// //     for (const property of unmatchedAfterStep3) {
// //       const { region1, region2 } = extractRegionParts(
// //         property.custom_fields?.propertyfinder_region
// //       );

// //       if (region1) {
// //         const { matchResult, nameMatches } = findStartingWordsMatch(
// //           property,
// //           redinFlattenedArray,
// //           region1
// //         );

// //         if (matchResult) {
// //           stats.step4_startingWordsMatched++;
// //           stats.totalMatched++;

// //           step4_startingWordsMatched.push({
// //             property_id: property.id,
// //             full_region: property.custom_fields?.propertyfinder_region,
// //             region1,
// //             region2,
// //             property_type: property.property_type,
// //             matched_region_part: matchResult.matchedRegionPart,
// //             matched_redin: {
// //               location_id: matchResult.match.location_id,
// //               property_name: matchResult.match.property_name,
// //               main_subtype_name: matchResult.match.main_subtype_name,
// //             },
// //           });

// //           updatePropertyInDB(property, matchResult, "starting_words_match", 1);
// //         } else if (nameMatches.length > 0) {
// //           if (!recordedSubtypeMismatchPropertyIds.has(property.id)) {
// //             stats.step4_nameMatchedButSubtypeMismatch++;
// //             recordedSubtypeMismatchPropertyIds.add(property.id);

// //             step4_nameMatchedButSubtypeMismatch.push({
// //               property_id: property.id,
// //               full_region: property.custom_fields?.propertyfinder_region,
// //               region1,
// //               region2,
// //               property_type: property.property_type,
// //               matched_in_step: "1.5",
// //               available_redin_matches: nameMatches.map((m) => ({
// //                 property_name: m.property_name,
// //                 main_subtype_name: m.main_subtype_name,
// //                 location_id: m.location_id,
// //               })),
// //             });
// //           }

// //           unmatchedAfterStep4.push(property);
// //         } else {
// //           unmatchedAfterStep4.push(property);
// //         }
// //       } else {
// //         unmatchedAfterStep4.push(property);
// //       }
// //     }

// //     console.log(
// //       `Step 4 Complete: ${stats.step4_startingWordsMatched} matched (Starting Words), ${unmatchedAfterStep4.length} remaining unmatched`
// //     );

// //     // ADD THIS BLOCK:
// //     console.log(
// //       `Step 4 Complete: ${stats.step4_startingWordsMatched} matched (Starting Words), ${unmatchedAfterStep4.length} remaining unmatched`
// //     );

// //     // ADD THIS ENTIRE BLOCK:
// //     stats.totalUnmatched = unmatchedAfterStep4.length;

// //     // Populate unmatched properties from Step 4
// //     for (const property of unmatchedAfterStep4) {
// //       const { region1, region2 } = extractRegionParts(
// //         property.custom_fields?.propertyfinder_region
// //       );

// //       const unmatchedData = {
// //         property_id: property.id,
// //         address_information: property.address_information || null,
// //         full_region: property.custom_fields?.propertyfinder_region,
// //         region1,
// //         region2,
// //         property_type: property.property_type,
// //         reason: "no_match_found",
// //       };

// //       unmatchedProperties.push(unmatchedData);
// //     }

// //     console.log(`Total Unmatched Properties: ${stats.totalUnmatched}`);

// //     // Wait for all updates to complete
// //     console.log("\n--- Updating Database ---");
// //     // STEP 5: Coordinate Matching (Exact, Decrement, Increment with Type Validation)
// //     console.log(
// //       "\n--- STEP 5: Matching by Coordinates (Exact, Decrement, Increment) with Type Validation ---"
// //     );

// //     // ADD THESE LINES:
// //     // stats.step5_coordinatesAvailableBeforeMatching = unmatchedAfterStep4.filter(
// //     //   (p) => hasValidCoordinates(p)
// //     // ).length;
// //     // console.log(
// //     //   `Properties with coordinates available for coordinate matching: ${stats.step5_coordinatesAvailableBeforeMatching}`
// //     // );

// //     // const unmatchedAfterStep5 = [];

// //     // for (const property of unmatchedAfterStep4) {
// //     //   const { matchResult: coordResult, typeMismatchInfo } =
// //     //     findCoordMatchWithTypeValidation(property, redinFlattenedArray);

// //     //   if (coordResult) {
// //     //     // MATCHED - Coordinates + Type matched
// //     //     stats.step5_coordMatched++;
// //     //     stats.totalMatched++;

// //     //     const coordType = coordResult.coordType;
// //     //     if (coordType === "exact") {
// //     //       stats.step5_exactCoordMatch++;
// //     //     } else if (coordType === "decrement") {
// //     //       stats.step5_decrementCoordMatch++;
// //     //     } else if (coordType === "increment") {
// //     //       stats.step5_incrementCoordMatch++;
// //     //     }

// //     //     const propertyCoords = extractAndTrimCoordinates(
// //     //       property.address_information
// //     //     );
// //     //     const { region1, region2 } = extractRegionParts(
// //     //       property.custom_fields?.propertyfinder_region
// //     //     );

// //     //     step5_coordMatched.push({
// //     //       property_id: property.id,
// //     //       full_region: property.custom_fields?.propertyfinder_region,
// //     //       region1,
// //     //       region2,
// //     //       property_type: property.property_type,
// //     //       property_coords: propertyCoords,
// //     //       matched_coords: coordResult.matchedCoords,
// //     //       coord_match_type: coordType,
// //     //       matched_redin: {
// //     //         location_id: coordResult.match.location_id,
// //     //         property_name: coordResult.match.property_name,
// //     //         main_subtype_name: coordResult.match.main_subtype_name,
// //     //       },
// //     //     });

// //     //     updatePropertyInDB(
// //     //       property,
// //     //       coordResult,
// //     //       `coord_match_${coordType}`,
// //     //       0
// //     //     );
// //     //   } else if (typeMismatchInfo) {
// //     //     // COORDINATE MATCHED BUT TYPE DIDN'T MATCH
// //     //     stats.step5_coordMatchedButTypeMismatch++;

// //     //     const coordType = typeMismatchInfo.coordType;
// //     //     if (coordType === "exact") {
// //     //       stats.step5_coordMatchedExactButTypeMismatch++;
// //     //     } else if (coordType === "decrement") {
// //     //       stats.step5_coordMatchedDecrementButTypeMismatch++;
// //     //     } else if (coordType === "increment") {
// //     //       stats.step5_coordMatchedIncrementButTypeMismatch++;
// //     //     }

// //     //     const propertyCoords = extractAndTrimCoordinates(
// //     //       property.address_information
// //     //     );
// //     //     const { region1, region2 } = extractRegionParts(
// //     //       property.custom_fields?.propertyfinder_region
// //     //     );

// //     //     step5_coordMatchedButTypeMismatch.push({
// //     //       property_id: property.id,
// //     //       full_region: property.custom_fields?.propertyfinder_region,
// //     //       region1,
// //     //       region2,
// //     //       property_type: property.property_type,
// //     //       property_coords: propertyCoords,
// //     //       matched_coords: typeMismatchInfo.matchedCoords,
// //     //       coord_match_type: coordType,
// //     //       available_types: typeMismatchInfo.availableTypes,
// //     //     });

// //     //     const unmatchedData = {
// //     //       property_id: property.id,
// //     //       address_information: property.address_information || null,
// //     //       full_region: property.custom_fields?.propertyfinder_region,
// //     //       region1,
// //     //       region2,
// //     //       property_type: property.property_type,
// //     //       reason: "coordinate_matched_type_mismatch",
// //     //       coordinate_match_info: typeMismatchInfo,
// //     //     };

// //     //     unmatchedProperties.push(unmatchedData);
// //     //     unmatchedAfterStep5.push(property);
// //     //   } else {
// //     //     // NO COORDINATE MATCH AT ALL
// //     //     const { region1, region2 } = extractRegionParts(
// //     //       property.custom_fields?.propertyfinder_region
// //     //     );

// //     //     const unmatchedData = {
// //     //       property_id: property.id,
// //     //       address_information: property.address_information || null,
// //     //       full_region: property.custom_fields?.propertyfinder_region,
// //     //       region1,
// //     //       region2,
// //     //       property_type: property.property_type,
// //     //       reason: "no_match_found",
// //     //     };

// //     //     unmatchedProperties.push(unmatchedData);
// //     //     unmatchedAfterStep5.push(property);
// //     //   }
// //     // }

// //     // unmatchedAfterStep5
// //     //   .filter((p) => hasValidCoordinates(p))
// //     //   .forEach((p) => {
// //     //     step5_remainingWithCoordinates.push({
// //     //       property_id: p.id,
// //     //       full_region: p.custom_fields?.propertyfinder_region,
// //     //       property_type: p.property_type,
// //     //       address_information: p.address_information,
// //     //     });
// //     //   });

// //     stats.totalUnmatched = unmatchedAfterStep4.length;

// //     // Populate unmatched properties from Step 4
// //     for (const property of unmatchedAfterStep4) {
// //       const { region1, region2 } = extractRegionParts(
// //         property.custom_fields?.propertyfinder_region
// //       );

// //       const unmatchedData = {
// //         property_id: property.id,
// //         address_information: property.address_information || null,
// //         full_region: property.custom_fields?.propertyfinder_region,
// //         region1,
// //         region2,
// //         property_type: property.property_type,
// //         reason: "no_match_found",
// //       };

// //       unmatchedProperties.push(unmatchedData);
// //     }

// //     // Wait for all updates to complete
// //     console.log("\n--- Updating Database ---");
// //     await Promise.all(updatePromises);
// //     console.log(
// //       `Database Updates Complete: ${stats.updateSuccess} success, ${stats.updateFailed} failed`
// //     );

// //     // Final Console Output
// //     console.log("\n========== FINAL STATS ==========");
// //     console.log(`Total Dubai Properties: ${stats.totalDubaiProperties}`);
// //     console.log(`Total Redin Locations: ${stats.totalRedinLocations}`);
// //     console.log(`Total Redin Properties: ${stats.totalRedinProperties}`);
// //     console.log(`\n--- STEP 1: Region 1 Exact Matching ---`);
// //     console.log(
// //       `Total Matched (Region 1 Exact): ${stats.step1_region1Matched}`
// //     );
// //     console.log(`\n--- STEP 2: Region 2 Exact Matching ---`);
// //     console.log(
// //       `Total Matched (Region 2 Exact): ${stats.step2_region2Matched}`
// //     );
// //     console.log(`\n--- STEP 3: Partial Word Matching (2-3 Words) ---`);
// //     console.log(
// //       `Total Matched (Partial Words): ${stats.step3_partialWordMatched}`
// //     );
// //     console.log(
// //       `\n--- STEP 4: Starting Words Matching (2-3 Starting Words) ---`
// //     );
// //     console.log(
// //       `Total Matched (Starting Words): ${stats.step4_startingWordsMatched}`
// //     );

// //     // console.log(`\n--- STEP 5: Coordinate Matching (with Type Validation) ---`);
// //     // console.log(`Total Matched (Coordinates): ${stats.step5_coordMatched}`);
// //     // console.log(`  Exact Coordinates: ${stats.step5_exactCoordMatch}`);
// //     // console.log(`  Decrement Coordinates: ${stats.step5_decrementCoordMatch}`);
// //     // console.log(`  Increment Coordinates: ${stats.step5_incrementCoordMatch}`);

// //     console.log(`\n--- FINAL RESULTS ---`);
// //     console.log(`Total Matched: ${stats.totalMatched}`);
// //     console.log(`Total Unmatched: ${stats.totalUnmatched}`);
// //     console.log(`Database Updates Success: ${stats.updateSuccess}`);
// //     console.log(`Database Updates Failed: ${stats.updateFailed}`);
// //     console.log("=================================\n");

// //     console.log(
// //       "==============================This is the total match data=========================="
// //     );

// //     console.log(`\n--- NAME MATCHED BUT SUBTYPE MISMATCH ANALYSIS ---`);
// //     console.log(`Step 1.5: ${stats.step1_5_nameMatchedButSubtypeMismatch}`);
// //     console.log(`Step 1: ${stats.step1_nameMatchedButSubtypeMismatch}`);
// //     console.log(`Step 1.1: ${stats.step1_1_nameMatchedButSubtypeMismatch}`);
// //     console.log(`Step 2: ${stats.step2_nameMatchedButSubtypeMismatch}`);
// //     console.log(`Step 3: ${stats.step3_nameMatchedButSubtypeMismatch}`);
// //     console.log(`Step 4: ${stats.step4_nameMatchedButSubtypeMismatch}`);
// //     const totalNameMatchedSubtypeMismatch =
// //       stats.step1_5_nameMatchedButSubtypeMismatch +
// //       stats.step1_nameMatchedButSubtypeMismatch +
// //       stats.step1_1_nameMatchedButSubtypeMismatch +
// //       stats.step2_nameMatchedButSubtypeMismatch +
// //       stats.step3_nameMatchedButSubtypeMismatch +
// //       stats.step4_nameMatchedButSubtypeMismatch;
// //     console.log(
// //       `Total Name Matched But Subtype Mismatch: ${totalNameMatchedSubtypeMismatch}`
// //     );
// //     console.log("=================================\n");

// //     // const unmatchedAddresses = unmatchedProperties
// //     //   .filter(
// //     //     (p) =>
// //     //       p.address_information &&
// //     //       Object.keys(p.address_information).length > 0 &&
// //     //       Object.values(p.address_information).some(
// //     //         (v) => v && String(v).trim() !== ""
// //     //       )
// //     //   )
// //     //   .map((p) => ({
// //     //     property_id: p.property_id,
// //     //     address_information: p.address_information,
// //     //   }));

// //     // console.log(
// //     //   "============================== This is the total match data ==========================",
// //     //   unmatchedAddresses.length
// //     // );

// //     return res.json({
// //       success: true,
// //       stats,
// //       data: {
// //         step1_5_combinedRegionMatched: {
// //           count: step1_5_combinedRegionMatched.length,
// //           data: step1_5_combinedRegionMatched,
// //           // NEW: Add remaining coordinates after this step
// //           //   remainingWithCoordinates: {
// //           //     count: step1_5_remainingWithCoordinates.length,
// //           //     data: step1_5_remainingWithCoordinates,
// //           //   },
// //         },
// //         step1_region1Matched: {
// //           count: step1_region1Matched.length,
// //           data: step1_region1Matched,
// //           // NEW: Add remaining coordinates after this step
// //           //   remainingWithCoordinates: {
// //           //     count: step1_remainingWithCoordinates.length,
// //           //     data: step1_remainingWithCoordinates,
// //           //   },
// //         },
// //         step1_1_region1Or2Matched: {
// //           count: step1_1_region1Or2Matched.length,
// //           data: step1_1_region1Or2Matched,
// //           //   remainingWithCoordinates: {
// //           //     count: step1_1_remainingWithCoordinates.length,
// //           //     data: step1_1_remainingWithCoordinates,
// //           //   },
// //         },
// //         step2_region2Matched: {
// //           count: step2_region2Matched.length,
// //           data: step2_region2Matched,
// //           // NEW: Add remaining coordinates after this step
// //           //   remainingWithCoordinates: {
// //           //     count: step2_remainingWithCoordinates.length,
// //           //     data: step2_remainingWithCoordinates,
// //           //   },
// //         },
// //         step3_partialWordMatched: {
// //           count: step3_partialWordMatched.length,
// //           data: step3_partialWordMatched,
// //           // NEW: Add remaining coordinates after this step
// //           //   remainingWithCoordinates: {
// //           //     count: step3_remainingWithCoordinates.length,
// //           //     data: step3_remainingWithCoordinates,
// //           //   },
// //         },
// //         step4_startingWordsMatched: {
// //           count: step4_startingWordsMatched.length,
// //           data: step4_startingWordsMatched,
// //           // NEW: Add remaining coordinates after this step
// //           //   remainingWithCoordinates: {
// //           //     count: step4_remainingWithCoordinates.length,
// //           //     data: step4_remainingWithCoordinates,
// //           //   },
// //         },
// //         // step5_coordMatched: {
// //         //   count: step5_coordMatched.length,
// //         //   data: step5_coordMatched,
// //         //   exactMatches: step5_coordMatched.filter(
// //         //     (m) => m.coord_match_type === "exact"
// //         //   ).length,
// //         //   decrementMatches: step5_coordMatched.filter(
// //         //     (m) => m.coord_match_type === "decrement"
// //         //   ).length,
// //         //   incrementMatches: step5_coordMatched.filter(
// //         //     (m) => m.coord_match_type === "increment"
// //         //   ).length,
// //         // },
// //         // remainingWithCoordinates: {
// //         //   count: step5_remainingWithCoordinates.length,
// //         //   data: step5_remainingWithCoordinates,
// //         // },

// //         // After coordinates
// //         unmatched: {
// //           count: unmatchedProperties.length,
// //           data: unmatchedProperties,

// //           // NEW: Add remaining coordinates after this step
// //           //   remainingWithCoordinates: {
// //           //     count: step5_remainingWithCoordinates.length,
// //           //     data: step5_remainingWithCoordinates,
// //           //   },
// //         },

// //         nameMatchedButSubtypeMismatch: {
// //           step1_5: {
// //             count: step1_5_nameMatchedButSubtypeMismatch.length,
// //             data: step1_5_nameMatchedButSubtypeMismatch,
// //           },
// //           step1: {
// //             count: step1_nameMatchedButSubtypeMismatch.length,
// //             data: step1_nameMatchedButSubtypeMismatch,
// //           },
// //           step1_1: {
// //             count: step1_1_nameMatchedButSubtypeMismatch.length,
// //             data: step1_1_nameMatchedButSubtypeMismatch,
// //           },
// //           step2: {
// //             count: step2_nameMatchedButSubtypeMismatch.length,
// //             data: step2_nameMatchedButSubtypeMismatch,
// //           },
// //           step3: {
// //             count: step3_nameMatchedButSubtypeMismatch.length,
// //             data: step3_nameMatchedButSubtypeMismatch,
// //           },
// //           step4: {
// //             count: step4_nameMatchedButSubtypeMismatch.length,
// //             data: step4_nameMatchedButSubtypeMismatch,
// //           },
// //           total:
// //             stats.step1_5_nameMatchedButSubtypeMismatch +
// //             stats.step1_nameMatchedButSubtypeMismatch +
// //             stats.step1_1_nameMatchedButSubtypeMismatch +
// //             stats.step2_nameMatchedButSubtypeMismatch +
// //             stats.step3_nameMatchedButSubtypeMismatch +
// //             stats.step4_nameMatchedButSubtypeMismatch,
// //         },
// //         // unmatchedAddresses,
// //       },
// //     });
// //   } catch (error) {
// //     console.log("Error:", error);
// //     return res.status(500).json({
// //       success: false,
// //       message: "Server error",
// //       error: error.message,
// //     });
// //   }
// // };

// // module.exports = {
// //   MatchgeoPiont,
// // };

// const Property = require("../Models/PropertyModel");
// const ExtractRedinLocation = require("../Models/ExtractLocationRedin");

// const MatchgeoPiont = async (req, res) => {
//   try {
//     const allDubaiProperties = await Property.find(
//       {
//         "custom_fields.city": "Dubai",
//         "general_listing_information.status": "Live",
//       },
//       {
//         id: 1,
//         "custom_fields.propertyfinder_region": 1,
//         "custom_fields.city": 1,
//         "general_listing_information.status": 1,
//         address_information: 1,
//         property_type: 1,
//       }
//     );

//     // Fetch all Redin location data
//     const allExtractRedinLocation = await ExtractRedinLocation.find({});

//     console.log(
//       "This is all Properties Object:",
//       allDubaiProperties.length,
//       "This is all Redin locations:",
//       allExtractRedinLocation.length
//     );

//     // NEW: Helper to convert tower letters to numbers and vice versa
//     const normalizeTowerIdentifier = (str) => {
//       if (!str) return str;

//       // Map of letter to number conversions (A=1, B=2, C=3, etc.)
//       const letterToNumber = {
//         a: "1",
//         b: "2",
//         c: "3",
//         d: "4",
//         e: "5",
//         f: "6",
//         g: "7",
//         h: "8",
//         i: "9",
//         j: "10",
//         k: "11",
//         l: "12",
//         m: "13",
//         n: "14",
//         o: "15",
//         p: "16",
//         q: "17",
//         r: "18",
//         s: "19",
//         t: "20",
//         u: "21",
//         v: "22",
//         w: "23",
//         x: "24",
//         y: "25",
//         z: "26",
//       };

//       let normalized = str.toLowerCase();

//       // Replace "tower X" or "building X" patterns where X is a letter
//       normalized = normalized.replace(
//         /\b(tower|building|block|phase)\s+([a-z])\b/gi,
//         (match, prefix, letter) => {
//           const number = letterToNumber[letter.toLowerCase()];
//           return number
//             ? `${prefix.toLowerCase()} ${number}`
//             : match.toLowerCase();
//         }
//       );

//       // Replace standalone letters at the end (e.g., "Sparkle B" -> "Sparkle 2")
//       normalized = normalized.replace(/\s+([a-z])\s*$/i, (match, letter) => {
//         const number = letterToNumber[letter.toLowerCase()];
//         return number ? ` ${number}` : match;
//       });

//       return normalized;
//     };

//     // NEW: Helper to create alternate versions with letter/number swaps
//     const createAlternateVersions = (str) => {
//       if (!str) return [str];

//       const versions = [str];
//       const normalized = normalizeTowerIdentifier(str);

//       if (normalized !== str) {
//         versions.push(normalized);
//       }

//       return versions;
//     };

//     // Helper: Aggressive normalization for flexible matching
//     const normalizeForMatching = (str) => {
//       if (!str) return "";

//       let result = str.toLowerCase().trim();

//       // Convert "Palm Jumeirah" → "the palm"
//       result = result.replace(/\bpalm\s+jumeirah\b/g, "the palm");

//       // Singularize views → view
//       result = result.replace(/\bviews\b/g, "view");

//       // Convert Roman numerals I-X to numbers (I → 1, II → 2, III → 3, etc.)
//       const romanMap = {
//         i: "1",
//         ii: "2",
//         iii: "3",
//         iv: "4",
//         v: "5",
//         vi: "6",
//         vii: "7",
//         viii: "8",
//         ix: "9",
//         x: "10",
//       };
//       result = result.replace(/\b(i{1,3}|iv|v|vi{0,3}|ix|x)\b/gi, (match) => {
//         return romanMap[match.toLowerCase()] || match;
//       });

//       // Remove developer names preceded by "by"
//       result = result.replace(/\bby\s+\w+\b/g, "");

//       // ===== Special Attessa handling =====
//       if (result.includes("Attessa")) {
//         result = result.replace(/\b(tower)\b/g, "");
//       }

//       // ===== Special Shoreline handling =====
//       if (result.includes("shoreline")) {
//         // Remove 'al' and 'apartments'
//         result = result.replace(/\b(al|apartments?)\b/g, "");
//       }

//       // Tower is equal to the T1, T2, T3
//       result = result.replace(/\bt\s*(\d+)\b/gi, "tower $1");

//       // The palm is equal to the palm jumeirah
//       result = result.replace(/\bthe\s+palm\b/gi, "palm jumeirah");

//       // Remove hypen
//       result = result.replace(/\s*-\s*/g, " ");

//       // Replace & with "and"
//       result = result.replace(/&/g, "and");

//       // Remove anything inside parentheses including parentheses
//       result = result.replace(/\(.*?\)/g, "");

//       // Special case: Alaya Beach → remove 'Beach'
//       result = result.replace(/\balaya\s+beach\b/gi, "alaya");

//       // Replace numbers like 01, 04, 002 with 1, 4, 2
//       result = result.replace(/\b0+(\d+)\b/g, "$1");

//       //Singularize cluster / clusters
//       result = result.replace(/\b(clusters?)\b/g, "cluster");

//       // Convert shorthand like T2 → Tower 2
//       result = result.replace(/\bT(\d+)\b/g, "tower $1");

//       // Singularize tower / towers
//       result = result.replace(/\b(towers?)\b/g, "tower");

//       // Singularize residence / residences
//       result = result.replace(/\b(residences?)\b/g, "residence");

//       // Remove other unwanted words
//       result = result.replace(
//         /\b(the|a|an|it|its|by|estate|residences|at| villas| premium)\b/g,
//         ""
//       );

//       // ===== REMOVE "TOWER" COMPLETELY AT THE VERY LAST STEP =====
//       result = result.replace(/\btower\b/g, "");

//       // Clean extra spaces
//       result = result.replace(/\s+/g, " ").trim();

//       return result;
//     };

//     const normalizePropertyType = (type) => {
//       if (!type) return "";

//       const normalizedType = type.toLowerCase().trim();
//       if (normalizedType === "office-space") return "office";
//       if (normalizedType === "townhouse" || normalizedType === "bungalow")
//         return "villa";
//       if (normalizedType === "duplex" || normalizedType === "penthouse")
//         return "apartment";
//       return normalizedType;
//     };

//     const normalizeRedinSubtype = (subtypeName) => {
//       if (!subtypeName) return "";

//       // Normalize to lowercase and trim spaces
//       const normalized = subtypeName.toLowerCase().trim();

//       // console.log("Redin Subtype before normalization:", normalized);

//       // Regex to match "serviced/hotel apartment" or "hotel apartment" in any form
//       const hotelAptRegex = /(?:serviced\/)?hotel\s*apartment/i;

//       if (hotelAptRegex.test(normalized)) {
//         // console.log("Normalized Redin Subtype: IF Inner", "apartment");
//         return "apartment";
//       }

//       // console.log("Normalized Redin Subtype:", normalized);
//       return normalized;
//     };

//     // Helper: Extract only alphanumeric characters for strict comparison
//     const extractAlphanumeric = (str) => {
//       if (!str) return "";
//       return str.toLowerCase().replace(/[^a-z0-9]/g, "");
//     };

//     // Helper: Check if two location names match EXACTLY (100% match - no extra words)
//     const isExactLocationMatch = (propertyRegion, redinName) => {
//       if (!propertyRegion || !redinName) return false;

//       // NEW: Create alternate versions with tower letter/number conversions
//       const propertyVersions = createAlternateVersions(propertyRegion);
//       const redinVersions = createAlternateVersions(redinName);

//       // Try matching with all version combinations
//       for (const propVersion of propertyVersions) {
//         for (const redinVersion of redinVersions) {
//           if (attemptExactMatch(propVersion, redinVersion)) {
//             return true;
//           }
//         }
//       }

//       return false;
//     };

//     // NEW: Separated matching logic
//     const attemptExactMatch = (propertyRegion, redinName) => {
//       const normalizedRegion = normalizeForMatching(propertyRegion);
//       const normalizedRedin = normalizeForMatching(redinName);

//       // Extract numbers from both strings
//       const regionNumbers = normalizedRegion.match(/\d+/g) || [];
//       const redinNumbers = normalizedRedin.match(/\d+/g) || [];

//       // CRITICAL: If property region has numbers, redin name MUST have those exact numbers
//       if (regionNumbers.length > 0) {
//         if (redinNumbers.length === 0) return false;
//         const allNumbersMatch = regionNumbers.every((num) =>
//           redinNumbers.includes(num)
//         );
//         if (!allNumbersMatch) return false;
//       }

//       // If redin has numbers but property doesn't, reject
//       if (redinNumbers.length > 0 && regionNumbers.length === 0) {
//         return false;
//       }

//       // EXACT match after normalization (no extra words allowed)
//       if (normalizedRegion === normalizedRedin) return true;

//       // Remove all non-alphanumeric characters for strict comparison
//       const regionClean = extractAlphanumeric(normalizedRegion);
//       const redinClean = extractAlphanumeric(normalizedRedin);

//       // Must be EXACTLY the same (100% match)
//       if (regionClean === redinClean) return true;

//       // If lengths differ significantly, reject
//       const lengthDiff = Math.abs(regionClean.length - redinClean.length);
//       if (lengthDiff > 2) return false;

//       // Check if the words match exactly (order doesn't matter but must have same words)
//       const regionWords = normalizedRegion
//         .split(/\s+/)
//         .filter((w) => w && w.length > 1)
//         .sort();
//       const redinWords = normalizedRedin
//         .split(/\s+/)
//         .filter((w) => w && w.length > 1)
//         .sort();

//       // Must have same number of meaningful words
//       if (regionWords.length !== redinWords.length) return false;

//       // Check if numbers match when words are same
//       if (regionNumbers.length > 0 || redinNumbers.length > 0) {
//         // Sort numbers for comparison
//         const sortedRegionNumbers = regionNumbers.sort();
//         const sortedRedinNumbers = redinNumbers.sort();

//         // Numbers must be identical
//         if (sortedRegionNumbers.length !== sortedRedinNumbers.length)
//           return false;
//         const numbersMatch = sortedRegionNumbers.every(
//           (num, idx) => num === sortedRedinNumbers[idx]
//         );
//         if (!numbersMatch) return false;
//       }

//       // All words must match (case: "binghatti flare" vs "flare binghatti")
//       const allWordsMatch = regionWords.every((word, idx) => {
//         const redinWord = redinWords[idx];
//         // Allow slight variation for very similar words
//         const wordClean1 = extractAlphanumeric(word);
//         const wordClean2 = extractAlphanumeric(redinWord);
//         return wordClean1 === wordClean2;
//       });

//       return allWordsMatch;
//     };

//     // Helper: Simple normalization for Region 1 OR Region 2 matching
//     const isSimpleMatch = (str1, str2) => {
//       if (!str1 || !str2) return false;

//       // Letter to number mapping
//       const letterToNumber = {
//         a: "1",
//         b: "2",
//         c: "3",
//         d: "4",
//         e: "5",
//         f: "6",
//         g: "7",
//         h: "8",
//         i: "9",
//         j: "10",
//         k: "11",
//         l: "12",
//         m: "13",
//         n: "14",
//         o: "15",
//         p: "16",
//         q: "17",
//         r: "18",
//         s: "19",
//         t: "20",
//         u: "21",
//         v: "22",
//         w: "23",
//         x: "24",
//         y: "25",
//         z: "26",
//       };

//       const normalizeSimple = (str) => {
//         if (!str) return "";

//         let result = str.toLowerCase().trim();

//         // Convert "Palm Jumeirah" → "the palm"
//         result = result.replace(/\bpalm\s+jumeirah\b/g, "the palm");

//         // Singularize "townhouses" → "townhouse"
//         result = result.replace(/\btownhouses\b/gi, "townhouse");

//         // Remove branding phrase: "the residences at"
//         result = result.replace(/\bthe\s+residences?\s+at\s+/g, "");

//         // Singularize views → view
//         result = result.replace(/\bviews\b/g, "view");

//         // Fix common spelling variations
//         result = result.replace(/\bjumeriah\b/g, "jumeirah");

//         // Convert single letters (Tower A, Building B, etc.) to numbers
//         result = result.replace(
//           /\b(tower|building|block|phase)\s+([a-z])\b/gi,
//           (match, prefix, letter) => {
//             const number = letterToNumber[letter.toLowerCase()];
//             return number
//               ? `${prefix.toLowerCase()} ${number}`
//               : match.toLowerCase();
//           }
//         );

//         // Convert standalone single letters at the end
//         result = result.replace(/\s+([a-z])\s*$/i, (match, letter) => {
//           const number = letterToNumber[letter.toLowerCase()];
//           return number ? ` ${number}` : match;
//         });

//         // Remove common words
//         result = result.replace(
//           /\b(the|a|an|at|in|by|estate|building|premium|east|west|north|south|central|park)\b/g,
//           ""
//         );

//         // Replace "One" with "1" when followed by JBR
//         result = result.replace(/\b(one|1)\s*jbr\b/gi, "1 jbr");

//         // Remove parentheses and anything inside
//         result = result.replace(/\(.*?\)/g, "");

//         // Remove hyphens
//         result = result.replace(/\s*-\s*/g, " ");

//         // Replace & with "and"
//         result = result.replace(/&/g, "and");

//         // Singularize residences → residence
//         result = result.replace(/\bresidences\b/g, "residence");

//         // Clean multiple spaces
//         result = result.replace(/\s+/g, " ").trim();

//         return result;
//       };

//       const normalized1 = normalizeSimple(str1);
//       const normalized2 = normalizeSimple(str2);

//       // Direct comparison
//       if (normalized1 === normalized2) return true;

//       // Word order independent comparison
//       const words1 = normalized1
//         .split(/\s+/)
//         .filter((w) => w && w.length > 0)
//         .sort();
//       const words2 = normalized2
//         .split(/\s+/)
//         .filter((w) => w && w.length > 0)
//         .sort();

//       if (words1.length !== words2.length) return false;

//       return words1.every((word, idx) => word === words2[idx]);
//     };

//     // Helper: Partial word-by-word matching (at least 2-3 words must match)
//     const isPartialWordMatch = (propertyRegion, redinName) => {
//       if (!propertyRegion || !redinName) return false;

//       const normalizedRegion = normalizeForMatching(propertyRegion);
//       const normalizedRedin = normalizeForMatching(redinName);

//       // Get words from both strings (filter out single char words and numbers-only words)
//       const regionWords = normalizedRegion
//         .split(/\s+/)
//         .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
//         .map((w) => extractAlphanumeric(w));

//       const redinWords = normalizedRedin
//         .split(/\s+/)
//         .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
//         .map((w) => extractAlphanumeric(w));

//       if (regionWords.length === 0 || redinWords.length === 0) return false;

//       // Count matching words
//       let matchingWordsCount = 0;

//       regionWords.forEach((regionWord) => {
//         if (redinWords.includes(regionWord)) {
//           matchingWordsCount++;
//         }
//       });

//       // Calculate total unique words
//       const totalWords = Math.max(regionWords.length, redinWords.length);

//       // Logic:
//       // - If one has more info (3+ words), require at least 3 matching words
//       // - Otherwise, require at least 2 matching words
//       if (totalWords >= 3) {
//         return matchingWordsCount >= 3;
//       } else {
//         return matchingWordsCount >= 2;
//       }
//     };

//     // Helper: Match starting words (at least 2-3 starting words must match)
//     const isStartingWordsMatch = (propertyRegion, redinName) => {
//       if (!propertyRegion || !redinName) return false;

//       const normalizedRegion = normalizeForMatching(propertyRegion);
//       const normalizedRedin = normalizeForMatching(redinName);

//       // Split by "at" and take the first part from region
//       const regionMainPart = normalizedRegion.split(/\s+at\s+/i)[0].trim();

//       // Get words from both strings (filter out single char words and numbers-only words)
//       const regionWords = regionMainPart
//         .split(/\s+/)
//         .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
//         .map((w) => extractAlphanumeric(w));

//       const redinWords = normalizedRedin
//         .split(/\s+/)
//         .filter((w) => w && w.length > 1 && !/^\d+$/.test(w))
//         .map((w) => extractAlphanumeric(w));

//       if (regionWords.length === 0 || redinWords.length === 0) return false;

//       // Count matching STARTING words (in order)
//       let matchingStartingWords = 0;
//       const minLength = Math.min(regionWords.length, redinWords.length);

//       for (let i = 0; i < minLength; i++) {
//         if (regionWords[i] === redinWords[i]) {
//           matchingStartingWords++;
//         } else {
//           break; // Stop at first mismatch
//         }
//       }

//       // Logic:
//       // - If region has 3+ words, require at least 3 starting words match
//       // - Otherwise, require at least 2 starting words match
//       if (regionWords.length >= 3) {
//         return matchingStartingWords >= 3;
//       } else {
//         return matchingStartingWords >= 2;
//       }
//     };

//     const findRegion1Or2Match = (property, redinArray, region1, region2) => {
//       const propertyType = property.property_type;
//       if (!propertyType) return { matchResult: null, nameMatches: [] };

//       const propertyTypeClean = normalizePropertyType(propertyType);
//       const nameOnlyMatches = [];

//       // Try Region 1 first
//       if (region1) {
//         const nameMatches = redinArray.filter((redin) => {
//           if (!redin.property_name) return false;
//           return isSimpleMatch(region1, redin.property_name);
//         });

//         nameOnlyMatches.push(...nameMatches);

//         const region1Match = nameMatches.find((redin) => {
//           if (!redin.main_subtype_name) return false;
//           const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
//           return redinSubtype === propertyTypeClean;
//         });

//         if (region1Match) {
//           return {
//             matchResult: {
//               match: region1Match,
//               matchedRegionPart: region1,
//               matchedRegionLevel: 1,
//             },
//             nameMatches: [],
//           };
//         }
//       }

//       // Try combined Region 1 + Region 2
//       if (region1 && region2) {
//         const combinedRegion = `${region1} ${region2}`;

//         const nameMatches = redinArray.filter((redin) => {
//           if (!redin.property_name) return false;
//           return isSimpleMatch(combinedRegion, redin.property_name);
//         });

//         nameOnlyMatches.push(...nameMatches);

//         const combinedMatch = nameMatches.find((redin) => {
//           if (!redin.main_subtype_name) return false;
//           const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
//           return redinSubtype === propertyTypeClean;
//         });

//         if (combinedMatch) {
//           return {
//             matchResult: {
//               match: combinedMatch,
//               matchedRegionPart: combinedRegion,
//               matchedRegionLevel: 1.2,
//             },
//             nameMatches: [],
//           };
//         }
//       }

//       return { matchResult: null, nameMatches: nameOnlyMatches };
//     };

//     // Helper: Match combined regions with word swapping
//     const isCombinedRegionMatch = (propertyRegion, redinName) => {
//       if (!propertyRegion || !redinName) return false;

//       const normalizedRegion = normalizeForMatching(propertyRegion);
//       const normalizedRedin = normalizeForMatching(redinName);

//       // Split both by words
//       const regionWords = normalizedRegion
//         .split(/\s+/)
//         .filter((w) => w && w.length > 1);
//       const redinWords = normalizedRedin
//         .split(/\s+/)
//         .filter((w) => w && w.length > 1);

//       if (regionWords.length === 0 || redinWords.length === 0) return false;

//       // NEW: Sort both arrays to ignore order completely
//       const regionWordsSorted = [...regionWords].sort();
//       const redinWordsSorted = [...redinWords].sort();

//       // Check if they have the same words (regardless of order)
//       if (regionWordsSorted.length !== redinWordsSorted.length) return false;

//       return regionWordsSorted.every(
//         (word, idx) => word === redinWordsSorted[idx]
//       );
//     };

//     // Build flattened Redin array for efficient matching
//     const redinFlattenedArray = [];
//     allExtractRedinLocation.forEach((location) => {
//       if (location.properties && Array.isArray(location.properties)) {
//         location.properties.forEach((p) => {
//           redinFlattenedArray.push({
//             location_id: location.location_id,
//             coordinates: location.geo_point ? {
//           lat: location.geo_point.lat,
//           lon: location.geo_point.lon
//         } : null,
//             property_id: p.property?.id,
//             property_name: p.property?.name,
//             main_subtype_name:
//               p.property?.main_subtype_name || p.main_subtype_name,
//             main_type_name: p.property?.main_type_name || p.main_type_name,
//           });
//         });
//       }
//     });

// console.log("\n=== COORDINATE DEBUG ===");
// console.log("Sample Redin coordinates structure:", 
//   redinFlattenedArray.slice(0, 5).map(r => ({
//     property_name: r.property_name,
//     coordinates: r.coordinates,
//     has_coordinates: !!r.coordinates
//   }))
// );

// const redinWithCoords = redinFlattenedArray.filter(r => r.coordinates && r.coordinates.lat && r.coordinates.lon);
// console.log(`Total Redin entries with valid coordinates: ${redinWithCoords.length} out of ${redinFlattenedArray.length}`);

// if (redinWithCoords.length > 0) {
//   console.log("Sample trimmed Redin coordinates:", redinWithCoords.slice(0, 3).map(r => ({
//     property_name: r.property_name,
//     lat: Math.trunc(r.coordinates.lat * 100) / 100,
//     lon: Math.trunc(r.coordinates.lon * 100) / 100
//   })));
// }
// console.log("=== END COORDINATE DEBUG ===\n");


//     // Stats object
//     const stats = {
//       totalDubaiProperties: allDubaiProperties.length,
//       totalRedinLocations: allExtractRedinLocation.length,
//       totalRedinProperties: redinFlattenedArray.length,

//       step1_5_combinedRegionMatched: 0,

//       // Step 1: Region 1 exact matching
//       step1_region1Matched: 0,

//       // Step 1.1: Try Region 1, fallback to Region 2 exact matching
//       step1_1_region1Or2Matched: 0,

//       // Step 2: Region 2 exact matching
//       step2_region2Matched: 0,

//       // Coordinate matching stats
//       unmatchedPropertiesWithCoords: 0,
      
//       step3_coordinatesAvailableBeforeMatching: 0,
//       step3_coordMatched: 0,
//       step3_coordMatchedButTypeMismatch: 0,
//       // Step 3: Partial word-by-word matching (2-3 words)
//       step3_partialWordMatched: 0,

//       // Step 4: Starting words matching (2-3 starting words)
//       step4_startingWordsMatched: 0,

//       step1_5_nameMatchedButSubtypeMismatch: 0,
//       step1_nameMatchedButSubtypeMismatch: 0,
//       step1_1_nameMatchedButSubtypeMismatch: 0,
//       step2_nameMatchedButSubtypeMismatch: 0,
//       step3_nameMatchedButSubtypeMismatch: 0,
//       step4_nameMatchedButSubtypeMismatch: 0,
      

//       // Final stats
//       totalMatched: 0,
//       totalUnmatched: 0,
//       updateSuccess: 0,
//       updateFailed: 0,
//     };

//     // Result arrays
//     const step1_region1Matched = [];
//     const step1_5_combinedRegionMatched = [];
//     const step1_1_region1Or2Matched = [];
//     const step2_region2Matched = [];

//     const step3_coordMatched = [];
//     const step3_coordMatchedButTypeMismatch = [];

//     const step3_partialWordMatched = [];
//     const step4_startingWordsMatched = [];
//     const unmatchedProperties = [];
//     const updatePromises = [];

//     const step1_5_nameMatchedButSubtypeMismatch = [];
//     const step1_nameMatchedButSubtypeMismatch = [];
//     const step1_1_nameMatchedButSubtypeMismatch = [];
//     const step2_nameMatchedButSubtypeMismatch = [];
//     const step3_nameMatchedButSubtypeMismatch = [];
//     const step4_nameMatchedButSubtypeMismatch = [];

//     // ADD THIS NEW SET TO TRACK ALREADY RECORDED PROPERTIES:
//     const recordedSubtypeMismatchPropertyIds = new Set();

//     // Extract region parts
//     const extractRegionParts = (regionString) => {
//       if (!regionString) return { region1: null, region2: null };
//       const parts = regionString
//         .split(",")
//         .map((part) => part.trim())
//         .filter((p) => p);
//       return {
//         region1: parts.length > 0 ? parts[0] : null,
//         region2: parts.length > 1 ? parts[1] : null,
//       };
//     };

//     // Combine Region
//     const combineRegions = (region1, region2) => {
//       return [region1, region2].filter(Boolean).join(" ");
//     };

//     // Helper: Find match by specific region and type (EXACT match required)
//     const findRegionMatch = (property, redinArray, regionValue) => {
//       const propertyType = property.property_type;
//       if (!regionValue || !propertyType)
//         return { matchResult: null, nameMatches: [] };

//       const propertyTypeClean = normalizePropertyType(propertyType);

//       const nameMatches = redinArray.filter((redin) => {
//         if (!redin.property_name) return false;
//         return isExactLocationMatch(regionValue, redin.property_name);
//       });

//       const match = nameMatches.find((redin) => {
//         if (!redin.main_subtype_name) return false;
//         const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
//         return redinSubtype === propertyTypeClean;
//       });

//       if (match) {
//         return {
//           matchResult: {
//             match,
//             matchedRegionPart: regionValue,
//           },
//           nameMatches: [],
//         };
//       }

//       return { matchResult: null, nameMatches };
//     };

//     // Helper: Find combined region match with word swapping
//     const findCombinedRegionMatch = (
//       property,
//       redinArray,
//       region1,
//       region2
//     ) => {
//       if (!region1 || !property?.property_type) {
//         return { matchResult: null, nameMatches: [] };
//       }

//       const propertyTypeClean = normalizePropertyType(property.property_type);

//       const combinations = [
//         combineRegions(region1, region2),
//         combineRegions(region2, region1),
//       ];

//       const nameOnlyMatches = [];

//       for (const combinedRegion of combinations) {
//         if (!combinedRegion) continue;

//         // 1️⃣ Match by combined region in name
//         const nameMatches = redinArray.filter((redin) => {
//           if (!redin.property_name) return false;
//           return isCombinedRegionMatch(combinedRegion, redin.property_name);
//         });

//         nameOnlyMatches.push(...nameMatches);

//         const match = nameMatches.find((redin) => {
//           if (!redin.main_subtype_name) return false;
//           const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
//           return redinSubtype === propertyTypeClean;
//         });

//         if (match) {
//           return {
//             matchResult: {
//               match,
//               matchedRegionPart: combinedRegion,
//             },
//             nameMatches: [],
//           };
//         }
//       }

//       // No exact subtype match, return name-only matches
//       return {
//         matchResult: null,
//         nameMatches: nameOnlyMatches,
//       };
//     };

// const extractAndTrimCoordinates = (addressInfo) => {
//   try {
//     if (!addressInfo) return null;

//     const plainAddressInfo = addressInfo.toObject
//       ? addressInfo.toObject()
//       : addressInfo;

//     if (!plainAddressInfo.Longitude_Latitude) return null;

//     const coordString = plainAddressInfo.Longitude_Latitude.toString().trim();
//     if (!coordString) return null;

//     const coords = coordString.split(",");
//     if (coords.length !== 2) return null;

//     const v1 = parseFloat(coords[0].trim());
//     const v2 = parseFloat(coords[1].trim());

//     if (isNaN(v1) || isNaN(v2)) return null;

//     let lat, lon;

//     // Determine which value is latitude and which is longitude
//     // Dubai coordinates: Latitude ~25.xx, Longitude ~55.xx
//     const v1Floor = Math.floor(v1);
//     const v2Floor = Math.floor(v2);

//     if (v1Floor === 25 && v2Floor === 55) {
//       // First value is latitude, second is longitude
//       lat = v1;
//       lon = v2;
//     } else if (v1Floor === 55 && v2Floor === 25) {
//       // First value is longitude, second is latitude (swapped)
//       lon = v1;
//       lat = v2;
//     } else {
//       // Neither value matches Dubai's coordinate range
//       console.log(`⚠️ Invalid coordinate range: ${v1}, ${v2} (expected ~25 and ~55)`);
//       return null;
//     }

//     // Validate that coordinates are within reasonable Dubai bounds
//     if (lat < 24 || lat > 26 || lon < 54 || lon > 56) {
//       console.log(`⚠️ Coordinates out of Dubai bounds: lat=${lat}, lon=${lon}`);
//       return null;
//     }

//     console.log(`✓ Extracted coordinates: lat=${lat}, lon=${lon} (from: ${coordString})`);

//     return {
//       lat: Math.trunc(lat * 100) / 100,
//       lon: Math.trunc(lon * 100) / 100,
//       original: { lat, lon },
//     };
//   } catch (error) {
//     console.log(`❌ Error extracting coordinates:`, error.message);
//     return null;
//   }
// };

//     const hasValidCoordinates = (property) => {
//   try {
//     const extracted = extractAndTrimCoordinates(property.address_information);
//     return extracted !== null;
//   } catch (error) {
//     return false;
//   }
// };

// function findExactCoordMatchWithTypeValidation(property, redinArray) {
//   if (!hasValidCoordinates(property)) {
//     console.log(`❌ Property ${property.id}: No valid coordinates`);
//     return { matchResult: null, typeMismatchInfo: null };
//   }

//   const propertyCoords = extractAndTrimCoordinates(
//     property.address_information
//   );

//   if (!propertyCoords) {
//     console.log(`❌ Property ${property.id}: Failed to extract coordinates`);
//     return { matchResult: null, typeMismatchInfo: null };
//   }

//   console.log(`🔍 Property ${property.id}: Searching for coords:`, {
//     lat: propertyCoords.lat,
//     lon: propertyCoords.lon,
//     property_type: property.property_type
//   });

//   const propertyTypeClean = normalizePropertyType(property.property_type);
//   let typeMismatchInfo = null;

//   // Helper function to check coordinates at a specific lat/lon with type validation
//   const checkCoordAtLevel = (lat, lon, coordType) => {
//     const coordMatches = redinArray.filter((r) => {
//       if (!r.coordinates || typeof r.coordinates !== 'object') {
//         return false;
//       }

//       if (r.coordinates.lat === undefined || r.coordinates.lon === undefined) {
//         return false;
//       }

//       const redinLon = Math.trunc(r.coordinates.lon * 100) / 100;
//       const redinLat = Math.trunc(r.coordinates.lat * 100) / 100;

//       return redinLon === lon && redinLat === lat;
//     });

//     if (coordMatches.length === 0) return null;

//     console.log(`   ✓ Found ${coordMatches.length} matches at ${coordType} coords (${lat}, ${lon})`);

//     // Try to find a match with correct subtype
//     const match = coordMatches.find((redin) => {
//       if (!redin.main_subtype_name) return false;
//       const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
//       return redinSubtype === propertyTypeClean;
//     });

//     if (match) {
//       console.log(`✅✅ Property ${property.id}: FULL MATCH (${coordType} coords + type)!`, {
//         matched_property: match.property_name,
//         coords: { lat, lon },
//         type: match.main_subtype_name
//       });
      
//       return {
//         match,
//         matchedRegionPart: null,
//         matchedRegionLevel: 0,
//         coordType,
//         matchedCoords: { lat, lon },
//       };
//     } else if (coordMatches.length > 0 && !typeMismatchInfo) {
//       // Coordinates matched but type didn't - store this info (only once)
//       console.log(`⚠️ Property ${property.id}: Coords matched but type mismatch at ${coordType}`, {
//         available_types: coordMatches.map(m => m.main_subtype_name)
//       });
      
//       typeMismatchInfo = {
//         coordType,
//         matchedCoords: { lat, lon },
//         propertyType: property.property_type,
//         availableTypes: coordMatches.map((m) => ({
//           property_name: m.property_name,
//           main_subtype_name: m.main_subtype_name,
//           location_id: m.location_id,
//         })),
//       };
//     }

//     return null;
//   };

//   // Step 1: Try EXACT coordinates
//   console.log(`   Trying EXACT coordinates...`);
//   let result = checkCoordAtLevel(propertyCoords.lat, propertyCoords.lon, "exact");
//   if (result) {
//     return { matchResult: result, typeMismatchInfo: null };
//   }

//   // Step 2: Try DECREMENT latitude (lat - 0.01, lat - 0.02)
//   console.log(`   Trying DECREMENT coordinates...`);
//   for (let offset of [-1, -2]) {
//     const lat = Math.trunc(propertyCoords.lat * 100 + offset) / 100;
//     console.log(`     Checking lat: ${lat} (offset: ${offset})`);
//     result = checkCoordAtLevel(lat, propertyCoords.lon, "decrement");
//     if (result) {
//       return { matchResult: result, typeMismatchInfo: null };
//     }
//   }

//   // Step 3: Try INCREMENT latitude (lat + 0.01, lat + 0.02)
//   console.log(`   Trying INCREMENT coordinates...`);
//   for (let offset of [1, 2]) {
//     const lat = Math.trunc(propertyCoords.lat * 100 + offset) / 100;
//     console.log(`     Checking lat: ${lat} (offset: +${offset})`);
//     result = checkCoordAtLevel(lat, propertyCoords.lon, "increment");
//     if (result) {
//       return { matchResult: result, typeMismatchInfo: null };
//     }
//   }

//   // Step 4: Try DECREMENT longitude (lon - 0.01, lon - 0.02)
//   console.log(`   Trying DECREMENT longitude...`);
//   for (let offset of [-1, -2]) {
//     const lon = Math.trunc(propertyCoords.lon * 100 + offset) / 100;
//     console.log(`     Checking lon: ${lon} (offset: ${offset})`);
//     result = checkCoordAtLevel(propertyCoords.lat, lon, "decrement_lon");
//     if (result) {
//       return { matchResult: result, typeMismatchInfo: null };
//     }
//   }

//   // Step 5: Try INCREMENT longitude (lon + 0.01, lon + 0.02)
//   console.log(`   Trying INCREMENT longitude...`);
//   for (let offset of [1, 2]) {
//     const lon = Math.trunc(propertyCoords.lon * 100 + offset) / 100;
//     console.log(`     Checking lon: ${lon} (offset: +${offset})`);
//     result = checkCoordAtLevel(propertyCoords.lat, lon, "increment_lon");
//     if (result) {
//       return { matchResult: result, typeMismatchInfo: null };
//     }
//   }

//   console.log(`❌ Property ${property.id}: No coordinate matches found (tried exact, ±0.01, ±0.02 on both lat/lon)`);

//   // If we found coordinate matches but type mismatched, return that info
//   if (typeMismatchInfo) {
//     return { matchResult: null, typeMismatchInfo };
//   }

//   // No matches at all
//   return { matchResult: null, typeMismatchInfo: null };
// }

//     // Helper: Find partial word match by region 1
//     const findPartialWordMatch = (property, redinArray, regionValue) => {
//       if (!regionValue || !property?.property_type) {
//         return { matchResult: null, nameMatches: [] };
//       }

//       const propertyTypeClean = normalizePropertyType(property.property_type);

//       // 1️⃣ Match by partial word in name
//       const nameMatches = redinArray.filter((redin) => {
//         if (!redin.property_name) return false;
//         return isPartialWordMatch(regionValue, redin.property_name);
//       });

//        const match = nameMatches.find((redin) => {
//         if (!redin.main_subtype_name) return false;
//         const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
//         return redinSubtype === propertyTypeClean;
//       });

//       if (match) {
//         return {
//           matchResult: {
//             match,
//             matchedRegionPart: regionValue,
//           },
//           nameMatches: [],
//         };
//       }

//       // No exact subtype match
//       return {
//         matchResult: null,
//         nameMatches,
//       };
//     };

//     const findStartingWordsMatch = (property, redinArray, regionValue) => {
//       const propertyType = property.property_type;

//       if (!regionValue || !propertyType)
//         return { matchResult: null, nameMatches: [] };

//       const propertyTypeClean = normalizePropertyType(propertyType);

//       const nameMatches = redinArray.filter((redin) => {
//         if (!redin.property_name) return false;
//         return isStartingWordsMatch(regionValue, redin.property_name);
//       });

//       const match = nameMatches.find((redin) => {
//         if (!redin.main_subtype_name) return false;
//          const redinSubtype = normalizeRedinSubtype(redin.main_subtype_name);
//         return redinSubtype === propertyTypeClean;
//       });

//       if (match) {
//         return {
//           matchResult: {
//             match,
//             matchedRegionPart: regionValue,
//           },
//           nameMatches: [],
//         };
//       }

//       return { matchResult: null, nameMatches };
//     };

//     // Helper: Update database
//     const updatePropertyInDB = (
//       property,
//       matchData,
//       matchType,
//       regionLevel
//     ) => {
//       const updatePromise = Property.findOneAndUpdate(
//         { id: property.id },
//         {
//           $set: {
//             redin_location: {
//               location_id: matchData.match.location_id,
//               property_location_id: matchData.match.property_id,
//               property_name: matchData.match.property_name,
//               main_subtype_name: matchData.match.main_subtype_name,
//               main_type_name: matchData.match.main_type_name,
//               matched_by: matchType,
//               matched_region_level: regionLevel,
//               matched_region_part: matchData.matchedRegionPart,
//             },
//           },
//         },
//         { new: true }
//       )
//         .then((updated) => {
//           if (updated) {
//             stats.updateSuccess++;
//             console.log(
//               `✓ Property ${property.id}: ${matchType} (Level ${regionLevel}) → Updated`
//             );
//           } else {
//             stats.updateFailed++;
//             console.log(`✗ Property ${property.id}: Update failed - not found`);
//           }
//           return updated;
//         })
//         .catch((err) => {
//           stats.updateFailed++;
//           console.error(
//             `✗ Property ${property.id}: Update error:`,
//             err.message
//           );
//           return null;
//         });

//       updatePromises.push(updatePromise);
//     };

//     console.log("\n========== STARTING MATCHING PROCESS ==========\n");

//     // STEP 1.5: Match by Combined Region (Region1 + Region2) with Word Swapping
//     console.log(
//       "\n--- STEP 1.5: Matching by Combined Region (Region1 + Region2) with Word Swapping ---"
//     );

//     const unmatchedAfterStep1_5 = [];

//     for (const property of allDubaiProperties) {
//       const { region1, region2 } = extractRegionParts(
//         property.custom_fields?.propertyfinder_region
//       );

//       if (region1) {
//         const { matchResult, nameMatches } = findCombinedRegionMatch(
//           property,
//           redinFlattenedArray,
//           region1,
//           region2
//         );

//         if (matchResult) {
//           stats.step1_5_combinedRegionMatched++;
//           stats.totalMatched++;

//           step1_5_combinedRegionMatched.push({
//             property_id: property.id,
//             full_region: property.custom_fields?.propertyfinder_region,
//             region1,
//             region2,
//             combined_region: combineRegions(region1, region2),
//             property_type: property.property_type,
//             matched_region_part: matchResult.matchedRegionPart,
//             matched_redin: {
//               location_id: matchResult.match.location_id,
//               property_name: matchResult.match.property_name,
//               main_subtype_name: matchResult.match.main_subtype_name,
//             },
//           });

//           updatePropertyInDB(
//             property,
//             matchResult,
//             "combined_region_match",
//             1.5
//           );
//         } else if (nameMatches.length > 0) {
//           // Name matched but subtype didn't
//           if (!recordedSubtypeMismatchPropertyIds.has(property.id)) {
//             stats.step1_5_nameMatchedButSubtypeMismatch++;
//             recordedSubtypeMismatchPropertyIds.add(property.id);

//             step1_5_nameMatchedButSubtypeMismatch.push({
//               property_id: property.id,
//               full_region: property.custom_fields?.propertyfinder_region,
//               region1,
//               region2,
//               property_type: property.property_type,
//               matched_in_step: "1.5",
//               available_redin_matches: nameMatches.map((m) => ({
//                 property_name: m.property_name,
//                 main_subtype_name: m.main_subtype_name,
//                 location_id: m.location_id,
//               })),
//             });
//           }

//           unmatchedAfterStep1_5.push(property);
//         } else {
//           unmatchedAfterStep1_5.push(property);
//         }
//       } else {
//         unmatchedAfterStep1_5.push(property);
//       }
//     }

//     console.log(
//       `Step 1.5 Complete: ${stats.step1_5_combinedRegionMatched} matched (Combined Region with Word Swap), ${unmatchedAfterStep1_5.length} remaining unmatched`
//     );

//     // STEP 1: Match by Region 1 + Type (EXACT)
//     console.log("\n--- STEP 1: Matching by Region 1 (Exact) ---");

//     const unmatchedAfterStep1 = [];

//     for (const property of unmatchedAfterStep1_5) {
//       const { region1, region2 } = extractRegionParts(
//         property.custom_fields?.propertyfinder_region
//       );

//       const { matchResult, nameMatches } = findRegionMatch(
//         property,
//         redinFlattenedArray,
//         region1
//       );

//       if (matchResult) {
//         stats.step1_region1Matched++;
//         stats.totalMatched++;

//         step1_region1Matched.push({
//           property_id: property.id,
//           full_region: property.custom_fields?.propertyfinder_region,
//           region1,
//           region2,
//           property_type: property.property_type,
//           matched_region_part: matchResult.matchedRegionPart,
//           matched_redin: {
//             location_id: matchResult.match.location_id,
//             property_name: matchResult.match.property_name,
//             main_subtype_name: matchResult.match.main_subtype_name,
//           },
//         });

//         updatePropertyInDB(property, matchResult, "exact_region1_match", 1);
//       } else if (nameMatches.length > 0) {
//         if (!recordedSubtypeMismatchPropertyIds.has(property.id)) {
//           stats.step1_nameMatchedButSubtypeMismatch++;
//           recordedSubtypeMismatchPropertyIds.add(property.id);

//           step1_nameMatchedButSubtypeMismatch.push({
//             property_id: property.id,
//             full_region: property.custom_fields?.propertyfinder_region,
//             region1,
//             region2,
//             property_type: property.property_type,
//             matched_in_step: "1",
//             available_redin_matches: nameMatches.map((m) => ({
//               property_name: m.property_name,
//               main_subtype_name: m.main_subtype_name,
//               location_id: m.location_id,
//             })),
//           });
//         }

//         unmatchedAfterStep1.push(property);
//       } else {
//         unmatchedAfterStep1.push(property);
//       }
//     }

//     console.log(
//       `Step 1 Complete: ${stats.step1_region1Matched} matched (Region 1), ${unmatchedAfterStep1.length} remaining unmatched`
//     );

//     // STEP 1.1: Match by Region 1 OR Region 2 (Exact)
//     console.log("\n--- STEP 1.1: Matching by Region 1 OR Region 2 (Exact) ---");

//     const unmatchedAfterStep1_1 = [];

//     for (const property of unmatchedAfterStep1) {
//       const { region1, region2 } = extractRegionParts(
//         property.custom_fields?.propertyfinder_region
//       );

//       const { matchResult, nameMatches } = findRegion1Or2Match(
//         property,
//         redinFlattenedArray,
//         region1,
//         region2
//       );

//       if (matchResult) {
//         stats.step1_1_region1Or2Matched++;
//         stats.totalMatched++;

//         step1_1_region1Or2Matched.push({
//           property_id: property.id,
//           full_region: property.custom_fields?.propertyfinder_region,
//           region1,
//           region2,
//           property_type: property.property_type,
//           matched_region_part: matchResult.matchedRegionPart,
//           matched_region_level: matchResult.matchedRegionLevel,
//           matched_redin: {
//             location_id: matchResult.match.location_id,
//             property_name: matchResult.match.property_name,
//             main_subtype_name: matchResult.match.main_subtype_name,
//           },
//         });

//         updatePropertyInDB(
//           property,
//           matchResult,
//           "exact_region1_or_region2_match",
//           matchResult.matchedRegionLevel
//         );
//       } else if (nameMatches.length > 0) {
//         if (!recordedSubtypeMismatchPropertyIds.has(property.id)) {
//           stats.step1_1_nameMatchedButSubtypeMismatch++;
//           recordedSubtypeMismatchPropertyIds.add(property.id);

//           step1_1_nameMatchedButSubtypeMismatch.push({
//             property_id: property.id,
//             full_region: property.custom_fields?.propertyfinder_region,
//             region1,
//             region2,
//             property_type: property.property_type,
//             matched_in_step: "1.1",
//             available_redin_matches: nameMatches.map((m) => ({
//               property_name: m.property_name,
//               main_subtype_name: m.main_subtype_name,
//               location_id: m.location_id,
//             })),
//           });
//         }

//         unmatchedAfterStep1_1.push(property);
//       } else {
//         unmatchedAfterStep1_1.push(property);
//       }
//     }

//     console.log(
//       `Step 1.1 Complete: ${stats.step1_1_region1Or2Matched} matched (Region 1 or Region 2), ${unmatchedAfterStep1_1.length} remaining unmatched`
//     );

//     // STEP 2: Match by Region 2 + Type (EXACT)
//     console.log("\n--- STEP 2: Matching by Region 2 (Exact) ---");

//     const unmatchedAfterStep2 = [];

//     for (const property of unmatchedAfterStep1_1) {
//       const { region1, region2 } = extractRegionParts(
//         property.custom_fields?.propertyfinder_region
//       );

//       if (region2) {
//         const { matchResult, nameMatches } = findRegionMatch(
//           property,
//           redinFlattenedArray,
//           region2
//         );

//         if (matchResult) {
//           stats.step2_region2Matched++;
//           stats.totalMatched++;

//           step2_region2Matched.push({
//             property_id: property.id,
//             full_region: property.custom_fields?.propertyfinder_region,
//             region1,
//             region2,
//             property_type: property.property_type,
//             matched_region_part: matchResult.matchedRegionPart,
//             matched_redin: {
//               location_id: matchResult.match.location_id,
//               property_name: matchResult.match.property_name,
//               main_subtype_name: matchResult.match.main_subtype_name,
//             },
//           });

//           updatePropertyInDB(property, matchResult, "exact_region2_match", 2);
//         } else if (nameMatches.length > 0) {
//           if (!recordedSubtypeMismatchPropertyIds.has(property.id)) {
//             stats.step2_nameMatchedButSubtypeMismatch++;
//             recordedSubtypeMismatchPropertyIds.add(property.id);

//             step2_nameMatchedButSubtypeMismatch.push({
//               property_id: property.id,
//               full_region: property.custom_fields?.propertyfinder_region,
//               region1,
//               region2,
//               property_type: property.property_type,
//               matched_in_step: "2",
//               available_redin_matches: nameMatches.map((m) => ({
//                 property_name: m.property_name,
//                 main_subtype_name: m.main_subtype_name,
//                 location_id: m.location_id,
//               })),
//             });
//           }

//           unmatchedAfterStep2.push(property);
//         } else {
//           unmatchedAfterStep2.push(property);
//         }
//       } else {
//         unmatchedAfterStep2.push(property);
//       }
//     }

//     console.log(
//       `Step 2 Complete: ${stats.step2_region2Matched} matched (Region 2), ${unmatchedAfterStep2.length} remaining unmatched`
//     );

// //     console.log(
// //       "\n--- Re-fetching unmatched properties with address information ---"
// //     );


// //     const unmatchedPropertyIds = unmatchedAfterStep2.map((p) => p.id);
// //     const unmatchedPropertiesWithCoords = await Property.find(
// //       { id: { $in: unmatchedPropertyIds } },
// //       {



// //         id: 1,
// //         "custom_fields.propertyfinder_region": 1,
// //         property_type: 1,
// //         address_information: 1,
// //       }
// //     );

// // console.log(
// //   "Total unmatched properties With coordinates to re-fetch:",
// //   unmatchedPropertiesWithCoords
// // );

    
// //     console.log(
// //   `Re-fetched ${unmatchedPropertiesWithCoords.length} properties with coordinates`
// // );

// // // ✅ ADD THIS DEBUG BLOCK
// // console.log("\n--- DEBUG: Checking first 3 properties ---");
// // for (let i = 0; i < unmatchedPropertiesWithCoords.length; i++) {
// //   const prop = unmatchedPropertiesWithCoords[i];
// //   console.log(`Property ${i + 1}:`, {
// //     id: prop.id,
// //     hasAddressInfo: !!prop.address_information,
// //     addressInfo: prop.address_information,
// //     hasCoords: hasValidCoordinates(prop),
// //     extracted: extractAndTrimCoordinates(prop.address_information)
// //   });
// // }
// //     console.log("--- END DEBUG ---\n");

// //     console.log(
// //       "\n--- STEP 3: Matching by Coordinates (Exact Only) with SubType Validation ---"
// //     );
// //     const unmatchedAfterStep3 = [];

// //     // Count properties with valid coordinates
// //     stats.step3_coordinatesAvailableBeforeMatching = unmatchedPropertiesWithCoords.filter(
// //       (p) => hasValidCoordinates(p)
// //     ).length;

// //     console.log(
// //       `Properties with coordinates available: ${stats.step3_coordinatesAvailableBeforeMatching}`
// //     );

// //     // ✅ ADD THIS DEBUG LOG
// //     console.log(
// //       `Sample property address_information:`,
// //       unmatchedPropertiesWithCoords[0]?.address_information
// //     );

// //     for (const property of unmatchedPropertiesWithCoords) {
// //       const { matchResult, typeMismatchInfo } =
// //         findExactCoordMatchWithTypeValidation(property, redinFlattenedArray);

// //       const { region1, region2 } = extractRegionParts(
// //         property.custom_fields?.propertyfinder_region
// //       );

// //       if (matchResult) {
// //         stats.step3_coordMatched++;
// //         stats.totalMatched++;

// //         const propertyCoords = extractAndTrimCoordinates(
// //           property.address_information
// //         );

// //         step3_coordMatched.push({
// //           property_id: property.id,
// //           full_region: property.custom_fields?.propertyfinder_region,
// //           region1,
// //           region2,
// //           property_type: property.property_type,
// //           property_coords: propertyCoords,
// //           matched_coords: matchResult.matchedCoords,
// //           matched_redin: {
// //             location_id: matchResult.match.location_id,
// //             property_name: matchResult.match.property_name,
// //             main_subtype_name: matchResult.match.main_subtype_name,
// //           },
// //         });

// //         updatePropertyInDB(property, matchResult, "coord_match_exact", 3);
// //       } else if (typeMismatchInfo) {
// //         stats.step3_coordMatchedButTypeMismatch++;

// //         const propertyCoords = extractAndTrimCoordinates(
// //           property.address_information
// //         );

// //         step3_coordMatchedButTypeMismatch.push({
// //           property_id: property.id,
// //           full_region: property.custom_fields?.propertyfinder_region,
// //           region1,
// //           region2,
// //           property_type: property.property_type,
// //           property_coords: propertyCoords,
// //           matched_coords: typeMismatchInfo.matchedCoords,
// //           available_redin_matches: typeMismatchInfo.availableTypes,
// //         });

// //         unmatchedProperties.push({
// //           property_id: property.id,
// //           address_information: property.address_information,
// //           full_region: property.custom_fields?.propertyfinder_region,
// //           region1,
// //           region2,
// //           property_type: property.property_type,
// //           reason: "coordinate_matched_type_mismatch",
// //           coordinate_match_info: typeMismatchInfo,
// //         });

// //         unmatchedAfterStep3.push(property);
// //       } else {
// //         unmatchedAfterStep3.push(property);
// //       }
// //     }

    
//         const unmatchedAfterStep3 = [];

//     // STEP 3: Partial Word-by-Word Matching (2-3 words must match)
//     console.log("\n--- STEP 3: Matching by Partial Words (2-3 words) ---");

//     for (const property of unmatchedAfterStep2) {
//       const { region1, region2 } = extractRegionParts(
//         property.custom_fields?.propertyfinder_region
//       );

//       if (region1) {
//         const { matchResult, nameMatches } = findPartialWordMatch(
//           property,
//           redinFlattenedArray,
//           region1
//         );

//         if (matchResult) {
//           stats.step3_partialWordMatched++;
//           stats.totalMatched++;

//           step3_partialWordMatched.push({
//             property_id: property.id,
//             full_region: property.custom_fields?.propertyfinder_region,
//             region1,
//             region2,
//             property_type: property.property_type,
//             matched_region_part: matchResult.matchedRegionPart,
//             matched_redin: {
//               location_id: matchResult.match.location_id,
//               property_name: matchResult.match.property_name,
//               main_subtype_name: matchResult.match.main_subtype_name,
//             },
//           });

//           updatePropertyInDB(property, matchResult, "partial_word_match", 3);
//         } else if (nameMatches.length > 0) {
//           if (!recordedSubtypeMismatchPropertyIds.has(property.id)) {
//             stats.step3_nameMatchedButSubtypeMismatch++;
//             recordedSubtypeMismatchPropertyIds.add(property.id);

//             step3_nameMatchedButSubtypeMismatch.push({
//               property_id: property.id,
//               full_region: property.custom_fields?.propertyfinder_region,
//               region1,
//               region2,
//               property_type: property.property_type,
//               matched_in_step: "3",
//               available_redin_matches: nameMatches.map((m) => ({
//                 property_name: m.property_name,
//                 main_subtype_name: m.main_subtype_name,
//                 location_id: m.location_id,
//               })),
//             });
//           }

//           unmatchedAfterStep3.push(property);
//         } else {
//           unmatchedAfterStep3.push(property);
//         }
//       } else {
//         unmatchedAfterStep3.push(property);
//       }
//     }

//     console.log(
//       `Step 3 Complete: ${stats.step3_partialWordMatched} matched (Partial Words)`
//     );

//     // STEP 4: Starting Words Matching (2-3 starting words must match)
//     console.log(
//       "\n--- STEP 4: Matching by Starting Words (2-3 starting words) ---"
//     );

//     const unmatchedAfterStep4 = [];

//     for (const property of unmatchedAfterStep3) {
//       const { region1, region2 } = extractRegionParts(
//         property.custom_fields?.propertyfinder_region
//       );

//       if (region1) {
//         const { matchResult, nameMatches } = findStartingWordsMatch(
//           property,
//           redinFlattenedArray,
//           region1
//         );

//         if (matchResult) {
//           stats.step4_startingWordsMatched++;
//           stats.totalMatched++;

//           step4_startingWordsMatched.push({
//             property_id: property.id,
//             full_region: property.custom_fields?.propertyfinder_region,
//             region1,
//             region2,
//             property_type: property.property_type,
//             matched_region_part: matchResult.matchedRegionPart,
//             matched_redin: {
//               location_id: matchResult.match.location_id,
//               property_name: matchResult.match.property_name,
//               main_subtype_name: matchResult.match.main_subtype_name,
//             },
//           });

//           updatePropertyInDB(property, matchResult, "starting_words_match", 4);
//         } else if (nameMatches.length > 0) {
//           if (!recordedSubtypeMismatchPropertyIds.has(property.id)) {
//             stats.step4_nameMatchedButSubtypeMismatch++;
//             recordedSubtypeMismatchPropertyIds.add(property.id);

//             step4_nameMatchedButSubtypeMismatch.push({
//               property_id: property.id,
//               full_region: property.custom_fields?.propertyfinder_region,
//               region1,
//               region2,
//               property_type: property.property_type,
//               matched_in_step: "4",
//               available_redin_matches: nameMatches.map((m) => ({
//                 property_name: m.property_name,
//                 main_subtype_name: m.main_subtype_name,
//                 location_id: m.location_id,
//               })),
//             });
//           }

//           unmatchedAfterStep4.push(property);
//         } else {
//           unmatchedAfterStep4.push(property);
//         }
//       } else {
//         unmatchedAfterStep4.push(property);
//       }
//     }

//     console.log(
//       `Step 4 Complete: ${stats.step4_startingWordsMatched} matched (Starting Words), ${unmatchedAfterStep4.length} remaining unmatched`
//     );

//     // Remaining unmatched properties
//     for (const property of unmatchedAfterStep3) {
//       const { region1, region2 } = extractRegionParts(
//         property.custom_fields?.propertyfinder_region
//       );

//       unmatchedProperties.push({
//         property_id: property.id,
//         full_region: property.custom_fields?.propertyfinder_region,
//         region1,
//         region2,
//         property_type: property.property_type,
//         reason: "no_match_found",
//       });
//     }

//     stats.totalUnmatched = unmatchedProperties.length;

//     // Wait for all updates to complete
//     console.log("\n--- Updating Database ---");
//     await Promise.all(updatePromises);
//     console.log(
//       `Database Updates Complete: ${stats.updateSuccess} success, ${stats.updateFailed} failed`
//     );

//     // Final Console Output
//     console.log("\n========== FINAL STATS ==========");
//     console.log(`Total Dubai Properties: ${stats.totalDubaiProperties}`);
//     console.log(`Total Redin Locations: ${stats.totalRedinLocations}`);
//     console.log(`Total Redin Properties: ${stats.totalRedinProperties}`);
//     console.log(`\n--- STEP 1.5: Combined Region Matching (Word Swap) ---`);
//     console.log(
//       `Total Matched (Combined Region): ${stats.step1_5_combinedRegionMatched}`
//     );
//     console.log(`\n--- STEP 1: Region 1 Exact Matching ---`);
//     console.log(
//       `Total Matched (Region 1 Exact): ${stats.step1_region1Matched}`
//     );
//     console.log(`\n--- STEP 1.1: Region 1 OR Region 2 Exact Matching ---`);
//     console.log(
//       `Total Matched (Region 1 or 2): ${stats.step1_1_region1Or2Matched}`
//     );
//     console.log(`\n--- STEP 2: Region 2 Exact Matching ---`);
//     console.log(
//       `Total Matched (Region 2 Exact): ${stats.step2_region2Matched}`
//     );

//     console.log(`\n--- STEP 3: Coordinate Matching ---`);
//     console.log(
//       `Properties with coordinates: ${stats.step3_coordinatesAvailableBeforeMatching}`
//     );
//     console.log(`Matched (Coordinates + Type): ${stats.step3_coordMatched}`);
//     console.log(
//       `Matched Coordinates but Type Mismatch: ${stats.step3_coordMatchedButTypeMismatch}`
//     );

//     // console.log(`\n--- STEP 3: Partial Word Matching (2-3 Words) ---`);
//     // console.log(
//     //   `Total Matched (Partial Words): ${stats.step3_partialWordMatched}`
//     // );
//     // console.log(
//     //   `\n--- STEP 4: Starting Words Matching (2-3 Starting Words) ---`
//     // );
//     // console.log(
//     //   `Total Matched (Starting Words): ${stats.step4_startingWordsMatched}`
//     // );

//     console.log(`\n--- FINAL RESULTS ---`);
//     console.log(`Total Matched: ${stats.totalMatched}`);
//     console.log(`Total Unmatched: ${stats.totalUnmatched}`);
//     console.log(`Database Updates Success: ${stats.updateSuccess}`);
//     console.log(`Database Updates Failed: ${stats.updateFailed}`);
//     console.log("=================================\n");

//     console.log(`\n--- NAME MATCHED BUT SUBTYPE MISMATCH ANALYSIS ---`);
//     console.log(`Step 1.5: ${stats.step1_5_nameMatchedButSubtypeMismatch}`);
//     console.log(`Step 1: ${stats.step1_nameMatchedButSubtypeMismatch}`);
//     console.log(`Step 1.1: ${stats.step1_1_nameMatchedButSubtypeMismatch}`);
//     console.log(`Step 2: ${stats.step2_nameMatchedButSubtypeMismatch}`);
//     // console.log(`Step 3: ${stats.step3_nameMatchedButSubtypeMismatch}`);
//     // console.log(`Step 4: ${stats.step4_nameMatchedButSubtypeMismatch}`);
//     const totalNameMatchedSubtypeMismatch =
//       stats.step1_5_nameMatchedButSubtypeMismatch +
//       stats.step1_nameMatchedButSubtypeMismatch +
//       stats.step1_1_nameMatchedButSubtypeMismatch +
//       stats.step2_nameMatchedButSubtypeMismatch +
//       stats.step3_nameMatchedButSubtypeMismatch +
//       stats.step4_nameMatchedButSubtypeMismatch;
//     console.log(
//       `Total Name Matched But Subtype Mismatch: ${totalNameMatchedSubtypeMismatch}`
//     );
//     console.log("=================================\n");

//     return res.json({
//       success: true,
//       stats,
//       data: {
//         step1_5_combinedRegionMatched: {
//           count: step1_5_combinedRegionMatched.length,
//           data: step1_5_combinedRegionMatched,
//         },
//         step1_region1Matched: {
//           count: step1_region1Matched.length,
//           data: step1_region1Matched,
//         },
//         step1_1_region1Or2Matched: {
//           count: step1_1_region1Or2Matched.length,
//           data: step1_1_region1Or2Matched,
//         },
//         step2_region2Matched: {
//           count: step2_region2Matched.length,
//           data: step2_region2Matched,
//         },

//         step3_coordMatched: {
//           count: step3_coordMatched.length,
//           data: step3_coordMatched,
//         },
//         step3_coordMatchedButTypeMismatch: {
//           count: step3_coordMatchedButTypeMismatch.length,
//           data: step3_coordMatchedButTypeMismatch,
//         },

//         // step3_partialWordMatched: {
//         //   count: step3_partialWordMatched.length,
//         //   data: step3_partialWordMatched,
//         // },
//         // step4_startingWordsMatched: {
//         //   count: step4_startingWordsMatched.length,
//         //   data: step4_startingWordsMatched,
//         // },
//         unmatched: {
//           count: unmatchedProperties.length,
//           data: unmatchedProperties,
//         },
//         nameMatchedButSubtypeMismatch: {
//           step1_5: {
//             count: step1_5_nameMatchedButSubtypeMismatch.length,
//             data: step1_5_nameMatchedButSubtypeMismatch,
//           },
//           step1: {
//             count: step1_nameMatchedButSubtypeMismatch.length,
//             data: step1_nameMatchedButSubtypeMismatch,
//           },
//           step1_1: {
//             count: step1_1_nameMatchedButSubtypeMismatch.length,
//             data: step1_1_nameMatchedButSubtypeMismatch,
//           },
//           step2: {
//             count: step2_nameMatchedButSubtypeMismatch.length,
//             data: step2_nameMatchedButSubtypeMismatch,
//           },

//           step3: {
//             count: step3_nameMatchedButSubtypeMismatch.length,
//             data: step3_nameMatchedButSubtypeMismatch,
//           },
//           step4: {
//             count: step4_nameMatchedButSubtypeMismatch.length,
//             data: step4_nameMatchedButSubtypeMismatch,
//           },
//           total: totalNameMatchedSubtypeMismatch,
//         },
//       },
//     });
//   } catch (error) {
//     console.log("Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };

// module.exports = {
//   MatchgeoPiont,
// };


const Property = require("../Models/PropertyModel");
const ExtractRedinLocation = require("../Models/ExtractLocationRedin");

const {
  extractRegionParts,
  countAvailableCoordinates,
  updatePropertyInDatabase,
  extractAndTrimCoordinates,
} = require("./HelperFunctions/matchingUtilities");

const {
  executeStep1_CombinedRegionMatch,
  executeStep2_FirstRegionMatch,
  executeStep3_Region1Or2Match,
  executeStep4_SecondRegionMatch,
  executeStep5_PartialWordMatch,
  executeStep6_Starting2WordsMatch,
  executeStep7_CoordinateMatch,
} = require("./HelperFunctions/matchingStrategies");



const GetPropertyID = async (propertyIds) => {
  console.log("Received Property IDs:", propertyIds);

  if (propertyIds && propertyIds.length > 0) {
    await PropertyIDsMatchWithRedin(propertyIds);
  } else {
    console.log("No IDs received, skipping matching.");
  }
};


const PropertyIDsMatchWithRedin = async (propertyIds = []) => {
  console.log("Total IDs received:", propertyIds.length);

  const propertyQuery = {
    id: { $in: propertyIds },
    "custom_fields.city": "Dubai",
    "general_listing_information.status": "Live",
  };

  const dubaiLiveProperties = await Property.find(propertyQuery, {
    id: 1,
    "custom_fields.propertyfinder_region": 1,
    "custom_fields.city": 1,
    "general_listing_information.status": 1,
    address_information: 1,
    property_type: 1,
    redin_location: 1,
  });

  console.log("Dubai Live properties found:", dubaiLiveProperties.length);

  const redinLocationData = await ExtractRedinLocation.find({});

  // Flatten Redin properties
  const redinPropertiesFlattened = [];
  redinLocationData.forEach((location) => {
    if (location.properties && Array.isArray(location.properties)) {
      location.properties.forEach((p) => {
        redinPropertiesFlattened.push({
          location_id: location.location_id,
          coordinates: location.geo_point
            ? { lat: location.geo_point.lat, lon: location.geo_point.lon }
            : null,
          property_id: p.property?.id,
          property_name: p.property?.name,
          main_subtype_name:
            p.property?.main_subtype_name || p.main_subtype_name,
          main_type_name: p.property?.main_type_name || p.main_type_name,
        });
      });
    }
  });

  const updatePromises = [];

  const createMatchedObject = (property, matchResult) => {
    const { region1, region2 } = extractRegionParts(
      property.custom_fields?.propertyfinder_region
    );

    return {
      property_id: property.id,
      full_region: property.custom_fields?.propertyfinder_region,
      region1,
      region2,
      property_type: property.property_type,
      matched_region_part: matchResult.matchedRegionPart,
      matched_redin: {
        location_id: matchResult.match.location_id,
        property_name: matchResult.match.property_name,
        main_subtype_name: matchResult.match.main_subtype_name,
      },
    };
  };

  const stats ={
    dbUpdateSuccess: 0,
    dbUpdateFailed: 0,
  }

  const executeMatchingStep = async (
    stepNumber,
    stepName,
    unmatchedProperties,
    matchingFunction
  ) => {
    const stillUnmatched = [];

    for (const property of unmatchedProperties) {
      const result = matchingFunction(property, redinPropertiesFlattened);
      const { matchResult } = result;

      if (matchResult) {
        // ✅ Minimal match log you want
        console.log(
          `✅ Matched in STEP ${stepNumber} (${stepName}): ${property.id} -> ${matchResult.match?.property_name}`
        );
        // DB update (kept, but no stats/extra logs)
       updatePropertyInDatabase(
          property,
          matchResult,
          stepName,
          stepNumber,
          updatePromises, 
          stats
        );
      } else {
        stillUnmatched.push(property);
      }
    }
    return stillUnmatched;
  };

  // ========== EXECUTE ALL STEPS ==========
  let unmatchedProperties = dubaiLiveProperties;

  unmatchedProperties = await executeMatchingStep(
    1,
    "combined_region_match",
    unmatchedProperties,
    executeStep1_CombinedRegionMatch
  );

  unmatchedProperties = await executeMatchingStep(
    2,
    "first_region_match",
    unmatchedProperties,
    executeStep2_FirstRegionMatch
  );

  unmatchedProperties = await executeMatchingStep(
    3,
    "region_1_or_2_match",
    unmatchedProperties,
    executeStep3_Region1Or2Match
  );

  unmatchedProperties = await executeMatchingStep(
    4,
    "second_region_match",
    unmatchedProperties,
    executeStep4_SecondRegionMatch
  );

  unmatchedProperties = await executeMatchingStep(
    5,
    "partial_word_match",
    unmatchedProperties,
    executeStep5_PartialWordMatch
  );

  unmatchedProperties = await executeMatchingStep(
    6,
    "starting_2_words_match",
    unmatchedProperties,
    executeStep6_Starting2WordsMatch
  );

  unmatchedProperties = await executeMatchingStep(
    7,
    "coordinate_match",
    unmatchedProperties,
    executeStep7_CoordinateMatch
  );

  // ========== WAIT FOR DB UPDATES ==========
  await Promise.all(updatePromises);

  return {
    matchedCount: dubaiLiveProperties.length - unmatchedProperties.length,
    unmatchedCount: unmatchedProperties.length,
    unmatchedIds: unmatchedProperties.map((p) => p.id),
  };
};

// ========== MAIN CONTROLLER ==========

// const MatchgeoPiont = async (req, res) => {
//   try {
//     console.log("\n========== STARTING MATCHING PROCESS ==========\n");

//     // ========== FETCH DATA ==========
//     // const dubaiLiveProperties = await Property.find(
//     //   {
//     //     "custom_fields.city": "Dubai",
//     //     "general_listing_information.status": "Live",
//     //   },
//     //   {
//     //     id: 1,
//     //     "custom_fields.propertyfinder_region": 1,
//     //     "custom_fields.city": 1,
//     //     "general_listing_information.status": 1,
//     //     address_information: 1,
//     //     property_type: 1,
//     //   },
//     // );

//     // ========== FETCH DATA ==========
//     // Check if force rematch is requested
//     const forceRematch = req.query.forceRematch === "true";

//     // Build query to exclude already matched properties (unless forceRematch is true)
//     const propertyQuery = {
//       "custom_fields.city": "Dubai",
//       "general_listing_information.status": "Live",
//     };

//     // Only fetch unmatched properties (or all if forceRematch)
//     if (!forceRematch) {
//       propertyQuery.$or = [
//         { "redin_location.location_id": { $exists: false } },
//         { "redin_location.location_id": null },
//         { redin_location: { $exists: false } },
//       ];
//     }

//     const dubaiLiveProperties = await Property.find(propertyQuery, {
//       id: 1,
//       "custom_fields.propertyfinder_region": 1,
//       "custom_fields.city": 1,
//       "general_listing_information.status": 1,
//       address_information: 1,
//       property_type: 1,
//       redin_location: 1, 
//     });

//     const redinLocationData = await ExtractRedinLocation.find({});

//     // Get total count of all Dubai Live properties (for reporting)
//     const totalDubaiLivePropertiesCount = await Property.countDocuments({
//       "custom_fields.city": "Dubai",
//       "general_listing_information.status": "Live",
//     });

//     // Get count of already matched properties
//     const alreadyMatchedCount = await Property.countDocuments({
//       "custom_fields.city": "Dubai",
//       "general_listing_information.status": "Live",
//       "redin_location.location_id": { $exists: true, $ne: null },
//     });

//     console.log(`\n========== QUERY SUMMARY ==========`);
//     console.log(`Force Rematch: ${forceRematch ? "YES" : "NO"}`);
//     console.log(
//       `Total Dubai Live Properties: ${totalDubaiLivePropertiesCount}`,
//     );
//     console.log(`Already Matched (Skipped): ${alreadyMatchedCount}`);
//     console.log(`Properties to Process: ${dubaiLiveProperties.length}`);
//     console.log(`Redin Locations: ${redinLocationData.length}`);
//     console.log(`===================================\n`);

//     console.log(
//       `Fetched ${dubaiLiveProperties.length} Dubai properties and ${redinLocationData.length} Redin locations`,
//     );

//     // ========== BUILD FLATTENED REDIN ARRAY ==========
//     const redinPropertiesFlattened = [];
//     redinLocationData.forEach((location) => {
//       if (location.properties && Array.isArray(location.properties)) {
//         location.properties.forEach((p) => {
//           redinPropertiesFlattened.push({
//             location_id: location.location_id,
//             coordinates: location.geo_point
//               ? {
//                   lat: location.geo_point.lat,
//                   lon: location.geo_point.lon,
//                 }
//               : null,
//             property_id: p.property?.id,
//             property_name: p.property?.name,
//             main_subtype_name:
//               p.property?.main_subtype_name || p.main_subtype_name,
//             main_type_name: p.property?.main_type_name || p.main_type_name,
//           });
//         });
//       }
//     });

//     console.log(
//       `Built ${redinPropertiesFlattened.length} flattened Redin properties`,
//     );

//     // ========== INITIALIZE STATISTICS ==========
//     const stats = {
//       // Initial counts
//       // totalDubaiLiveProperties: dubaiLiveProperties.length,
//       totalDubaiLiveProperties: totalDubaiLivePropertiesCount,
//       alreadyMatchedProperties: alreadyMatchedCount,
//       propertiesToProcess: dubaiLiveProperties.length,

//       totalAvailableCoordinates: countAvailableCoordinates(dubaiLiveProperties),
//       totalRedinLocations: redinLocationData.length,
//       totalRedinProperties: redinPropertiesFlattened.length,

//       // Step 1: Combined Region Match
//       step1CombinedMatchedTotal: 0,
//       afterStep1AvailableCoordinates: 0,
//       totalPropertiesMatchStep1_ButSubTypeMisMatch: 0,

//       // Step 2: First Region Match
//       step2FirstRegionMatchedTotal: 0,
//       afterStep2AvailableCoordinates: 0,
//       totalPropertiesMatchStep2_ButSubTypeMisMatch: 0,

//       // Step 3: Region 1 or 2 Match
//       step3_1or2_regionMatchedTotal: 0,
//       afterStep3AvailableCoordinates: 0,
//       totalPropertiesMatchStep3_ButSubTypeMisMatch: 0,

//       // Step 4: Second Region Match
//       step4SecondRegionMatchedTotal: 0,
//       afterStep4AvailableCoordinates: 0,
//       totalPropertiesMatchStep4_ButSubTypeMisMatch: 0,

//       // Step 5: Partial Word Match
//       step5_partialWordMatchedTotal: 0,
//       afterStep5AvailableCoordinates: 0,
//       totalPropertiesMatchStep5_ButSubTypeMisMatch: 0,

//       // Step 6: Starting 2 Words Match
//       step6_starting2WordMatchedTotal: 0,
//       afterStep6AvailableCoordinates: 0,
//       totalPropertiesMatchStep6_ButSubTypeMisMatch: 0,

//       // Step 7: Coordinate Match
//       step7_matchedWithCoordinates: 0,
//       step7_coordExactMatches: 0,
//       step7_coordIncrementMatches: 0,
//       step7_coordDecrementMatches: 0,
//       step7_coordIncrementLonMatches: 0,
//       step7_coordDecrementLonMatches: 0,
//       afterStep7AvailableCoordinates: 0,
//       totalPropertiesMatchStep7_ButSubTypeMisMatch: 0,

//       // Final totals
//       totalMatchedProperties: 0,
//       totalUnmatchedProperties: 0,
//       dbUpdateSuccess: 0,
//       dbUpdateFailed: 0,
//     };

//     // ========== RESULT ARRAYS ==========
//     const results = {
//       step1_matched: [],
//       step1_subtypeMismatches: [],

//       step2_matched: [],
//       step2_subtypeMismatches: [],

//       step3_matched: [],
//       step3_subtypeMismatches: [],

//       step4_matched: [],
//       step4_subtypeMismatches: [],

//       step5_matched: [],
//       step5_subtypeMismatches: [],

//       step6_matched: [],
//       step6_subtypeMismatches: [],

//       step7_matched: [],
//       step7_subtypeMismatches: [],

//       unmatched: [],
//     };

//     const updatePromises = [];
//     const subtypeMismatchTrackedIds = new Set();
//     const successfullyMatchedIds = new Set();

//     // ========== HELPER FUNCTIONS ==========
//     const createMatchedObject = (
//       property,
//       matchResult,
//       stepNumber,
//       matchDetails = null,
//     ) => {
//       const { region1, region2 } = extractRegionParts(
//         property.custom_fields?.propertyfinder_region,
//       );

//       const baseObject = {
//         property_id: property.id,
//         full_region: property.custom_fields?.propertyfinder_region,
//         region1,
//         region2,
//         property_type: property.property_type,
//         matched_region_part: matchResult.matchedRegionPart,
//         matched_redin: {
//           location_id: matchResult.match.location_id,
//           property_name: matchResult.match.property_name,
//           main_subtype_name: matchResult.match.main_subtype_name,
//         },
//       };

//       // Add coordinate details for Step 7
//       if (stepNumber === 7 && matchDetails) {
//         const propertyCoords = extractAndTrimCoordinates(
//           property.address_information,
//         );

//         baseObject.coordinate_match_details = {
//           property_coordinates: {
//             original: propertyCoords?.original || null,
//             trimmed: {
//               lat: propertyCoords?.lat || null,
//               lon: propertyCoords?.lon || null,
//             },
//           },
//           redin_coordinates: matchResult.match.coordinates || null,
//           match_type: matchDetails.coordType,
//           matched_at_coords: matchResult.matchedCoords || null,
//         };
//       }

//       return baseObject;
//     };

//     const createSubtypeMismatchObject = (property, nameMatches, stepNumber) => {
//       const { region1, region2 } = extractRegionParts(
//         property.custom_fields?.propertyfinder_region,
//       );

//       return {
//         property_id: property.id,
//         full_region: property.custom_fields?.propertyfinder_region,
//         region1,
//         region2,
//         property_type: property.property_type,
//         matched_in_step: stepNumber,
//         available_redin_matches: nameMatches.map((m) => ({
//           property_name: m.property_name,
//           main_subtype_name: m.main_subtype_name,
//           location_id: m.location_id,
//         })),
//       };
//     };

//     const executeMatchingStep = async (
//   stepNumber,
//   stepName,
//   unmatchedProperties,
//   matchingFunction,
// ) => {
//   console.log(`\n--- STEP ${stepNumber}: ${stepName} ---`);

//   const matched = [];
//   const subtypeMismatches = [];
//   const stillUnmatched = [];

//   for (const property of unmatchedProperties) {
//     const result = matchingFunction(property, redinPropertiesFlattened);
//     const { matchResult, nameMatches, typeMismatchInfo, matchDetails } = result;

//     if (matchResult) {
//       // ✅ FULL MATCH FOUND
//       matched.push(
//         createMatchedObject(property, matchResult, stepNumber, matchDetails),
//       );

//       // 🔥 ADD THIS: Remove from mismatch tracking if it was there
//       if (subtypeMismatchTrackedIds.has(property.id)) {
//         console.log(`  ✓ Property ${property.id} was in mismatch, now MATCHED - removing from mismatch tracking`);
//         subtypeMismatchTrackedIds.delete(property.id); // ⬅️ REMOVE!
        
//         // Also decrease the mismatch count
//         for (let i = 1; i < stepNumber; i++) {
//           if (stats[`totalPropertiesMatchStep${i}_ButSubTypeMisMatch`] > 0) {
//             stats[`totalPropertiesMatchStep${i}_ButSubTypeMisMatch`]--;
//             break; // Only decrease once
//           }
//         }
//       }

//       // Track as successfully matched
//       successfullyMatchedIds.add(property.id); // ⬅️ ADD THIS

//       // Increment stats
//       if (stepNumber === 1) {
//         stats.step1CombinedMatchedTotal++;
//       } else if (stepNumber === 2) {
//         stats.step2FirstRegionMatchedTotal++;
//       } else if (stepNumber === 3) {
//         stats.step3_1or2_regionMatchedTotal++;
//       } else if (stepNumber === 4) {
//         stats.step4SecondRegionMatchedTotal++;
//       } else if (stepNumber === 5) {
//         stats.step5_partialWordMatchedTotal++;
//       } else if (stepNumber === 6) {
//         stats.step6_starting2WordMatchedTotal++;
//       } else if (stepNumber === 7) {
//         stats.step7_matchedWithCoordinates++;

//         if (matchDetails) {
//           if (matchDetails.coordType === "exact") {
//             stats.step7_coordExactMatches++;
//           } else if (matchDetails.coordType === "increment") {
//             stats.step7_coordIncrementMatches++;
//           } else if (matchDetails.coordType === "decrement") {
//             stats.step7_coordDecrementMatches++;
//           } else if (matchDetails.coordType === "increment_lon") {
//             stats.step7_coordIncrementLonMatches++;
//           } else if (matchDetails.coordType === "decrement_lon") {
//             stats.step7_coordDecrementLonMatches++;
//           }
//         }
//       }

//       stats.totalMatchedProperties++;
//        updatePropertyInDatabase(
//         property,
//         matchResult,
//         stepName,
//         stepNumber,
//         updatePromises,
//         stats,
//       );
//     } else if (
//       (nameMatches && nameMatches.length > 0) ||
//       typeMismatchInfo
//     ) {
//       // ❌ NAME MATCHED BUT SUBTYPE MISMATCH
//       if (!subtypeMismatchTrackedIds.has(property.id)) {
//         const mismatchData = typeMismatchInfo
//           ? typeMismatchInfo.availableTypes
//           : nameMatches;

//         subtypeMismatches.push(
//           createSubtypeMismatchObject(property, mismatchData, stepNumber),
//         );
//         stats[`totalPropertiesMatchStep${stepNumber}_ButSubTypeMisMatch`]++;
//         subtypeMismatchTrackedIds.add(property.id);
//       }
//       stillUnmatched.push(property);
//     } else {
//       // ❌ NO MATCH AT ALL
//       stillUnmatched.push(property);
//     }
//   }

//   stats[`afterStep${stepNumber}AvailableCoordinates`] =
//     countAvailableCoordinates(stillUnmatched);

//   results[`step${stepNumber}_matched`] = matched;
//   results[`step${stepNumber}_subtypeMismatches`] = subtypeMismatches;

//   console.log(
//     `Step ${stepNumber} Complete: ${matched.length} matched, ${stillUnmatched.length} remaining`,
//   );

//   return stillUnmatched;
// };





//     // ========== EXECUTE ALL STEPS ==========

//     let unmatchedProperties = dubaiLiveProperties;

//     // Step 1: Combined Region Match
//     unmatchedProperties = await executeMatchingStep(
//       1,
//       "combined_region_match",
//       unmatchedProperties,
//       executeStep1_CombinedRegionMatch,
//     );

//     // Step 2: First Region Match
//     unmatchedProperties = await executeMatchingStep(
//       2,
//       "first_region_match",
//       unmatchedProperties,
//       executeStep2_FirstRegionMatch,
//     );

//     // Step 3: Region 1 or 2 Match
//     unmatchedProperties = await executeMatchingStep(
//       3,
//       "region_1_or_2_match",
//       unmatchedProperties,
//       executeStep3_Region1Or2Match,
//     );

//     // Step 4: Second Region Match
//     unmatchedProperties = await executeMatchingStep(
//       4,
//       "second_region_match",
//       unmatchedProperties,
//       executeStep4_SecondRegionMatch,
//     );

//     // Step 5: Partial Word Match
//     unmatchedProperties = await executeMatchingStep(
//       5,
//       "partial_word_match",
//       unmatchedProperties,
//       executeStep5_PartialWordMatch,
//     );

//     // Step 6: Starting 2 Words Match
//     unmatchedProperties = await executeMatchingStep(
//       6,
//       "starting_2_words_match",
//       unmatchedProperties,
//       executeStep6_Starting2WordsMatch,
//     );

//     // Step 7: Coordinate Match
//     unmatchedProperties = await executeMatchingStep(
//       7,
//       "coordinate_match",
//       unmatchedProperties,
//       executeStep7_CoordinateMatch,
//     );

//     // ========== RECORD UNMATCHED PROPERTIES ==========

//        // ========== WAIT FOR DB UPDATES ==========
//     console.log("\n--- Updating Database ---");
//     await Promise.all(updatePromises);
//     console.log(
//       `Database Updates Complete: ${stats.dbUpdateSuccess} success, ${stats.dbUpdateFailed} failed`,
//     );

//     // ========== DEBUG - CHECK FINAL UNMATCHED COUNT ==========
//     console.log("\n========== DEBUG INFO ==========");
//     console.log(`Properties in unmatchedProperties array: ${unmatchedProperties.length}`);
//     console.log(`Properties in subtypeMismatchTrackedIds: ${subtypeMismatchTrackedIds.size}`);
//     console.log(`Total matched (from stats): ${stats.totalMatchedProperties}`);
//     console.log(`Expected unmatched: ${stats.totalDubaiLiveProperties - stats.totalMatchedProperties}`);

//     // List the property IDs in unmatchedProperties
//     console.log("\nUnmatched Property IDs:");
//     unmatchedProperties.forEach(p => {
//       const isInSubtypeMismatch = subtypeMismatchTrackedIds.has(p.id);
//       console.log(`  ${p.id} - ${isInSubtypeMismatch ? 'HAS subtype mismatch' : 'NO match at all'}`);
//     });
//     console.log("================================\n");

//     // ========== RECORD UNMATCHED PROPERTIES ==========
   
//     const nameMatchedButSubtypeNotMatch = [];
// const nameNotMatchedAtAll = [];

// console.log("\n========== UNMATCHED ANALYSIS ==========");
// console.log(`unmatchedProperties array length: ${unmatchedProperties.length}`);
// console.log(`subtypeMismatchTrackedIds size: ${subtypeMismatchTrackedIds.size}`);
// console.log(`successfullyMatchedIds size: ${successfullyMatchedIds.size}`);

// // 🔥 IMPORTANT: Only process properties that were NOT successfully matched
// for (const property of unmatchedProperties) {
//   const propertyId = property.id;

//   // ✅ Skip if this property was matched in any later step
//   if (successfullyMatchedIds.has(propertyId)) {
//     console.log(`  ⏭️  ${propertyId} was matched later - SKIPPING from unmatched`);
//     continue;
//   }

//   // Check if this property had a subtype mismatch
//   const hasSubtypeMismatch = subtypeMismatchTrackedIds.has(propertyId);

//   if (hasSubtypeMismatch) {
//     // Find the mismatch info from results
//     let mismatchInfo = null;
//     for (let i = 1; i <= 7; i++) {
//       const stepMismatches = results[`step${i}_subtypeMismatches`] || [];
//       const found = stepMismatches.find(m => m.property_id === propertyId);
//       if (found) {
//         mismatchInfo = {
//           ...found,
//           address_information: property.address_information,
//         };
//         break;
//       }
//     }

//     if (mismatchInfo) {
//       nameMatchedButSubtypeNotMatch.push(mismatchInfo);
//       console.log(`  ✓ Subtype mismatch (FINAL): ${propertyId}`);
//     }
//   } else {
//     // No name match at all
//     const { region1, region2 } = extractRegionParts(
//       property.custom_fields?.propertyfinder_region
//     );

//     nameNotMatchedAtAll.push({
//       property_id: propertyId,
//       full_region: property.custom_fields?.propertyfinder_region,
//       region1,
//       region2,
//       property_type: property.property_type,
//       address_information: property.address_information,
//       reason: "no_name_match_found",
//     });
//     console.log(`  ✓ No match at all (FINAL): ${propertyId}`);
//   }
// }

// console.log(`\n--- Final Breakdown ---`);
// console.log(`Name matched, subtype mismatch (FINAL): ${nameMatchedButSubtypeNotMatch.length}`);
// console.log(`No name match at all (FINAL): ${nameNotMatchedAtAll.length}`);
// console.log(`Total unmatched (FINAL): ${nameMatchedButSubtypeNotMatch.length + nameNotMatchedAtAll.length}`);

// // ✅ VALIDATION
// const finalUnmatchedCount = nameMatchedButSubtypeNotMatch.length + nameNotMatchedAtAll.length;

// console.log(`\n--- Math Validation ---`);
// console.log(`Total properties: ${stats.totalDubaiLiveProperties}`);
// console.log(`Successfully matched: ${stats.totalMatchedProperties}`);
// console.log(`Final unmatched: ${finalUnmatchedCount}`);
// console.log(`Sum: ${stats.totalMatchedProperties + finalUnmatchedCount}`);
// console.log(`Expected: ${stats.totalDubaiLiveProperties}`);
// console.log(`Match? ${stats.totalMatchedProperties + finalUnmatchedCount === stats.totalDubaiLiveProperties ? '✅ YES' : '❌ NO'}`);
// console.log("========================\n");

// results.unmatched = [
//   ...nameMatchedButSubtypeNotMatch,
//   ...nameNotMatchedAtAll,
// ];

//       stats.totalUnmatchedProperties = nameMatchedButSubtypeNotMatch.length + nameNotMatchedAtAll.length;
//     // ========== WAIT FOR DB UPDATES ==========
//     console.log("\n--- Updating Database ---");
//     await Promise.all(updatePromises);
//     console.log(
//       `Database Updates Complete: ${stats.dbUpdateSuccess} success, ${stats.dbUpdateFailed} failed`,
//     );

//     // ========== PRINT FINAL STATS ==========
//     console.log("\n========== FINAL STATISTICS ==========");
//     console.log(
//       `Total Dubai Live Properties: ${stats.totalDubaiLiveProperties}`,
//     );
//     console.log(`Already Matched (Skipped): ${stats.alreadyMatchedProperties}`);
//     console.log(`Properties Processed: ${stats.propertiesToProcess}`);
//     console.log(
//       `Total Available Coordinates: ${stats.totalAvailableCoordinates}`,
//     );
//     console.log(
//       `\nStep 1 - Combined Region: ${stats.step1CombinedMatchedTotal} matched`,
//     );
//     console.log(
//       `  Subtype Mismatches: ${stats.totalPropertiesMatchStep1_ButSubTypeMisMatch}`,
//     );
//     console.log(`  Coordinates After: ${stats.afterStep1AvailableCoordinates}`);
//     console.log(
//       `\nStep 2 - First Region: ${stats.step2FirstRegionMatchedTotal} matched`,
//     );
//     console.log(
//       `  Subtype Mismatches: ${stats.totalPropertiesMatchStep2_ButSubTypeMisMatch}`,
//     );
//     console.log(`  Coordinates After: ${stats.afterStep2AvailableCoordinates}`);
//     console.log(
//       `\nStep 3 - Region 1 or 2: ${stats.step3_1or2_regionMatchedTotal} matched`,
//     );
//     console.log(
//       `  Subtype Mismatches: ${stats.totalPropertiesMatchStep3_ButSubTypeMisMatch}`,
//     );
//     console.log(`  Coordinates After: ${stats.afterStep3AvailableCoordinates}`);
//     console.log(
//       `\nStep 4 - Second Region: ${stats.step4SecondRegionMatchedTotal} matched`,
//     );
//     console.log(
//       `  Subtype Mismatches: ${stats.totalPropertiesMatchStep4_ButSubTypeMisMatch}`,
//     );
//     console.log(`  Coordinates After: ${stats.afterStep4AvailableCoordinates}`);
//     console.log(
//       `\nStep 5 - Partial Words: ${stats.step5_partialWordMatchedTotal} matched`,
//     );
//     console.log(
//       `  Subtype Mismatches: ${stats.totalPropertiesMatchStep5_ButSubTypeMisMatch}`,
//     );
//     console.log(`  Coordinates After: ${stats.afterStep5AvailableCoordinates}`);
//     console.log(
//       `\nStep 6 - Starting 2 Words: ${stats.step6_starting2WordMatchedTotal} matched`,
//     );
//     console.log(
//       `  Subtype Mismatches: ${stats.totalPropertiesMatchStep6_ButSubTypeMisMatch}`,
//     );
//     console.log(`  Coordinates After: ${stats.afterStep6AvailableCoordinates}`);
//     console.log(
//       `\nStep 7 - Coordinates: ${stats.step7_matchedWithCoordinates} matched`,
//     );
//     console.log(`  Exact Matches: ${stats.step7_coordExactMatches}`);
//     console.log(`  Increment Lat: ${stats.step7_coordIncrementMatches}`);
//     console.log(`  Decrement Lat: ${stats.step7_coordDecrementMatches}`);
//     console.log(`  Increment Lon: ${stats.step7_coordIncrementLonMatches}`);
//     console.log(`  Decrement Lon: ${stats.step7_coordDecrementLonMatches}`);
//     console.log(
//       `  Subtype Mismatches: ${stats.totalPropertiesMatchStep7_ButSubTypeMisMatch}`,
//     );
//     console.log(`  Coordinates After: ${stats.afterStep7AvailableCoordinates}`);
//     console.log(`\nTotal Matched: ${stats.totalMatchedProperties}`);
//     console.log(`Total Unmatched: ${stats.totalUnmatchedProperties}`);
//     console.log("=====================================\n");

//     // ========== RETURN RESPONSE ==========
//     return res.json({
//       success: true,
//       stats,
//       data: {
//         step1_combinedRegion: {
//           matched: results.step1_matched,
//           subtypeMismatches: results.step1_subtypeMismatches,
//         },
//         step2_firstRegion: {
//           matched: results.step2_matched,
//           subtypeMismatches: results.step2_subtypeMismatches,
//         },
//         step3_region1Or2: {
//           matched: results.step3_matched,
//           subtypeMismatches: results.step3_subtypeMismatches,
//         },
//         step4_secondRegion: {
//           matched: results.step4_matched,
//           subtypeMismatches: results.step4_subtypeMismatches,
//         },
//         step5_partialWords: {
//           matched: results.step5_matched,
//           subtypeMismatches: results.step5_subtypeMismatches,
//         },
//         step6_starting2Words: {
//           matched: results.step6_matched,
//           subtypeMismatches: results.step6_subtypeMismatches,
//         },
//         step7_coordinates: {
//           matched: results.step7_matched,
//           subtypeMismatches: results.step7_subtypeMismatches,
//         },
//         unmatched: {
//           nameMatchedButSubtypeNotMatch: nameMatchedButSubtypeNotMatch,
//           nameNotMatchedAtAll: nameNotMatchedAtAll,
//           all: results.unmatched,
//           summary: {
//             total: results.unmatched.length,
//             subtypeMismatch: nameMatchedButSubtypeNotMatch.length,
//             noMatch: nameNotMatchedAtAll.length,
//           }
//         }
//       },
//     });
//   } catch (error) {
//     console.error("Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };


const BATCH_SIZE = 50; // Process 50 properties per batch
const YIELD_INTERVAL = 10; // Yield to event loop every 10 iterations

// ========== HELPER: Yield to Event Loop ==========
const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));

// ========== OPTIMIZED: Build Flattened Redin Array ==========
const buildFlattenedRedinArray = async (redinLocationData) => {
  const redinPropertiesFlattened = [];

  for (let i = 0; i < redinLocationData.length; i++) {
    const location = redinLocationData[i];

    if (location.properties && Array.isArray(location.properties)) {
      location.properties.forEach((p) => {
        redinPropertiesFlattened.push({
          location_id: location.location_id,
          coordinates: location.geo_point
            ? { lat: location.geo_point.lat, lon: location.geo_point.lon }
            : null,
          property_id: p.property?.id,
          property_name: p.property?.name,
          main_subtype_name:
            p.property?.main_subtype_name || p.main_subtype_name,
          main_type_name: p.property?.main_type_name || p.main_type_name,
        });
      });
    }

    // Yield every YIELD_INTERVAL iterations
    if (i % YIELD_INTERVAL === 0) {
      await yieldToEventLoop();
    }
  }

  return redinPropertiesFlattened;
};

// ========== OPTIMIZED: Non-Blocking Matching Step ==========
const executeMatchingStepNonBlocking = async (
  stepNumber,
  stepName,
  unmatchedProperties,
  matchingFunction,
  redinPropertiesFlattened,
  stats,
  results,
  bulkOperations,
  subtypeMismatchTrackedIds,
  successfullyMatchedIds,
) => {
  console.log(`\n--- STEP ${stepNumber}: ${stepName} ---`);

  const matched = [];
  const subtypeMismatches = [];
  const stillUnmatched = [];

  for (let i = 0; i < unmatchedProperties.length; i++) {
    const property = unmatchedProperties[i];
    const result = matchingFunction(property, redinPropertiesFlattened);
    const { matchResult, nameMatches, typeMismatchInfo, matchDetails } = result;

    if (matchResult) {
      // ✅ FULL MATCH FOUND
      matched.push(
        createMatchedObject(property, matchResult, stepNumber, matchDetails),
      );

      // Remove from mismatch tracking if it was there
      if (subtypeMismatchTrackedIds.has(property.id)) {
        subtypeMismatchTrackedIds.delete(property.id);
      }

      successfullyMatchedIds.add(property.id);

      // Update stats
      updateStatsForMatch(stats, stepNumber, matchDetails);
      stats.totalMatchedProperties++;

      // Add to bulk operations instead of individual update
      bulkOperations.push({
        updateOne: {
          filter: { id: property.id },
          update: {
            $set: {
              redin_location: {
                location_id: matchResult.match.location_id,
                property_location_id: matchResult.match.property_id,
                property_name: matchResult.match.property_name,
                main_subtype_name: matchResult.match.main_subtype_name,
                main_type_name: matchResult.match.main_type_name,
                matched_by: stepName,
                matched_region_level: stepNumber,
                matched_region_part: matchResult.matchedRegionPart,
              },
            },
          },
        },
      });
    } else if ((nameMatches && nameMatches.length > 0) || typeMismatchInfo) {
      // ❌ NAME MATCHED BUT SUBTYPE MISMATCH
      if (!subtypeMismatchTrackedIds.has(property.id)) {
        const mismatchData = typeMismatchInfo
          ? typeMismatchInfo.availableTypes
          : nameMatches;

        subtypeMismatches.push(
          createSubtypeMismatchObject(property, mismatchData, stepNumber),
        );
        stats[`totalPropertiesMatchStep${stepNumber}_ButSubTypeMisMatch`]++;
        subtypeMismatchTrackedIds.add(property.id);
      }
      stillUnmatched.push(property);
    } else {
      // ❌ NO MATCH AT ALL
      stillUnmatched.push(property);
    }

    // Yield to event loop periodically to prevent blocking
    if (i % YIELD_INTERVAL === 0) {
      await yieldToEventLoop();
    }
  }

  stats[`afterStep${stepNumber}AvailableCoordinates`] =
    countAvailableCoordinates(stillUnmatched);

  results[`step${stepNumber}_matched`] = matched;
  results[`step${stepNumber}_subtypeMismatches`] = subtypeMismatches;

  console.log(
    `Step ${stepNumber} Complete: ${matched.length} matched, ${stillUnmatched.length} remaining`,
  );

  return stillUnmatched;
};

// ========== HELPER: Update Stats ==========
const updateStatsForMatch = (stats, stepNumber, matchDetails) => {
  if (stepNumber === 1) stats.step1CombinedMatchedTotal++;
  else if (stepNumber === 2) stats.step2FirstRegionMatchedTotal++;
  else if (stepNumber === 3) stats.step3_1or2_regionMatchedTotal++;
  else if (stepNumber === 4) stats.step4SecondRegionMatchedTotal++;
  else if (stepNumber === 5) stats.step5_partialWordMatchedTotal++;
  else if (stepNumber === 6) stats.step6_starting2WordMatchedTotal++;
  else if (stepNumber === 7) {
    stats.step7_matchedWithCoordinates++;
    if (matchDetails) {
      if (matchDetails.coordType === "exact") stats.step7_coordExactMatches++;
      else if (matchDetails.coordType === "increment")
        stats.step7_coordIncrementMatches++;
      else if (matchDetails.coordType === "decrement")
        stats.step7_coordDecrementMatches++;
      else if (matchDetails.coordType === "increment_lon")
        stats.step7_coordIncrementLonMatches++;
      else if (matchDetails.coordType === "decrement_lon")
        stats.step7_coordDecrementLonMatches++;
    }
  }
};

// ========== HELPER: Create Matched Object ==========
const createMatchedObject = (
  property,
  matchResult,
  stepNumber,
  matchDetails = null,
) => {
  const { region1, region2 } = extractRegionParts(
    property.custom_fields?.propertyfinder_region,
  );

  const baseObject = {
    property_id: property.id,
    full_region: property.custom_fields?.propertyfinder_region,
    region1,
    region2,
    property_type: property.property_type,
    matched_region_part: matchResult.matchedRegionPart,
    matched_redin: {
      location_id: matchResult.match.location_id,
      property_name: matchResult.match.property_name,
      main_subtype_name: matchResult.match.main_subtype_name,
    },
  };

  if (stepNumber === 7 && matchDetails) {
    const propertyCoords = extractAndTrimCoordinates(
      property.address_information,
    );
    baseObject.coordinate_match_details = {
      property_coordinates: {
        original: propertyCoords?.original || null,
        trimmed: {
          lat: propertyCoords?.lat || null,
          lon: propertyCoords?.lon || null,
        },
      },
      redin_coordinates: matchResult.match.coordinates || null,
      match_type: matchDetails.coordType,
      matched_at_coords: matchResult.matchedCoords || null,
    };
  }

  return baseObject;
};

// ========== HELPER: Create Subtype Mismatch Object ==========
const createSubtypeMismatchObject = (property, nameMatches, stepNumber) => {
  const { region1, region2 } = extractRegionParts(
    property.custom_fields?.propertyfinder_region,
  );

  return {
    property_id: property.id,
    full_region: property.custom_fields?.propertyfinder_region,
    region1,
    region2,
    property_type: property.property_type,
    matched_in_step: stepNumber,
    available_redin_matches: nameMatches.map((m) => ({
      property_name: m.property_name,
      main_subtype_name: m.main_subtype_name,
      location_id: m.location_id,
    })),
  };
};


const MatchgeoPiont = async (req, res) => {
  const startTime = Date.now();

  try {
    console.log(
      "\n========== STARTING OPTIMIZED GEO POINT MATCHING ==========",
    );

    const forceRematch = req.query.forceRematch === "true";

    // Build query
    const propertyQuery = {
      "custom_fields.city": "Dubai",
      "general_listing_information.status": "Live",
    };

    if (!forceRematch) {
      propertyQuery.$or = [
        { "redin_location.location_id": { $exists: false } },
        { "redin_location.location_id": null },
        { redin_location: { $exists: false } },
      ];
    }

    // ========== PARALLEL DATA FETCHING ==========
    console.log("Fetching data in parallel...");

    const [
      dubaiLiveProperties,
      redinLocationData,
      totalDubaiLivePropertiesCount,
      alreadyMatchedCount,
    ] = await Promise.all([
      Property.find(propertyQuery, {
        id: 1,
        "custom_fields.propertyfinder_region": 1,
        "custom_fields.city": 1,
        "general_listing_information.status": 1,
        address_information: 1,
        property_type: 1,
        redin_location: 1,
      }).lean(), // Use lean() for better performance - plain JS objects

      ExtractRedinLocation.find({}).lean(), // Use lean() here too

      Property.countDocuments({
        "custom_fields.city": "Dubai",
        "general_listing_information.status": "Live",
      }),

      Property.countDocuments({
        "custom_fields.city": "Dubai",
        "general_listing_information.status": "Live",
        "redin_location.location_id": { $exists: true, $ne: null },
      }),
    ]);

    console.log(`\n========== QUERY SUMMARY ==========`);
    console.log(`Force Rematch: ${forceRematch ? "YES" : "NO"}`);
    console.log(
      `Total Dubai Live Properties: ${totalDubaiLivePropertiesCount}`,
    );
    console.log(`Already Matched (Skipped): ${alreadyMatchedCount}`);
    console.log(`Properties to Process: ${dubaiLiveProperties.length}`);
    console.log(`Redin Locations: ${redinLocationData.length}`);
    console.log(`===================================\n`);

    // ========== BUILD FLATTENED REDIN ARRAY (Non-Blocking) ==========
    console.log("Building flattened Redin array...");
    const redinPropertiesFlattened =
      await buildFlattenedRedinArray(redinLocationData);
    console.log(
      `Built ${redinPropertiesFlattened.length} flattened Redin properties`,
    );

    // ========== INITIALIZE STATS & RESULTS ==========
    const stats = {
      totalDubaiLiveProperties: totalDubaiLivePropertiesCount,
      alreadyMatchedProperties: alreadyMatchedCount,
      propertiesToProcess: dubaiLiveProperties.length,
      totalAvailableCoordinates: countAvailableCoordinates(dubaiLiveProperties),
      totalRedinLocations: redinLocationData.length,
      totalRedinProperties: redinPropertiesFlattened.length,
      step1CombinedMatchedTotal: 0,
      afterStep1AvailableCoordinates: 0,
      totalPropertiesMatchStep1_ButSubTypeMisMatch: 0,
      step2FirstRegionMatchedTotal: 0,
      afterStep2AvailableCoordinates: 0,
      totalPropertiesMatchStep2_ButSubTypeMisMatch: 0,
      step3_1or2_regionMatchedTotal: 0,
      afterStep3AvailableCoordinates: 0,
      totalPropertiesMatchStep3_ButSubTypeMisMatch: 0,
      step4SecondRegionMatchedTotal: 0,
      afterStep4AvailableCoordinates: 0,
      totalPropertiesMatchStep4_ButSubTypeMisMatch: 0,
      step5_partialWordMatchedTotal: 0,
      afterStep5AvailableCoordinates: 0,
      totalPropertiesMatchStep5_ButSubTypeMisMatch: 0,
      step6_starting2WordMatchedTotal: 0,
      afterStep6AvailableCoordinates: 0,
      totalPropertiesMatchStep6_ButSubTypeMisMatch: 0,
      step7_matchedWithCoordinates: 0,
      step7_coordExactMatches: 0,
      step7_coordIncrementMatches: 0,
      step7_coordDecrementMatches: 0,
      step7_coordIncrementLonMatches: 0,
      step7_coordDecrementLonMatches: 0,
      afterStep7AvailableCoordinates: 0,
      totalPropertiesMatchStep7_ButSubTypeMisMatch: 0,
      totalMatchedProperties: 0,
      totalUnmatchedProperties: 0,
      dbUpdateSuccess: 0,
      dbUpdateFailed: 0,
    };

    const results = {
      step1_matched: [],
      step1_subtypeMismatches: [],
      step2_matched: [],
      step2_subtypeMismatches: [],
      step3_matched: [],
      step3_subtypeMismatches: [],
      step4_matched: [],
      step4_subtypeMismatches: [],
      step5_matched: [],
      step5_subtypeMismatches: [],
      step6_matched: [],
      step6_subtypeMismatches: [],
      step7_matched: [],
      step7_subtypeMismatches: [],
      unmatched: [],
    };

    const bulkOperations = []; // Collect all updates for bulk write
    const subtypeMismatchTrackedIds = new Set();
    const successfullyMatchedIds = new Set();

    // ========== EXECUTE ALL STEPS (Non-Blocking) ==========
    let unmatchedProperties = dubaiLiveProperties;

    const matchingSteps = [
      {
        num: 1,
        name: "combined_region_match",
        fn: executeStep1_CombinedRegionMatch,
      },
      { num: 2, name: "first_region_match", fn: executeStep2_FirstRegionMatch },
      { num: 3, name: "region_1_or_2_match", fn: executeStep3_Region1Or2Match },
      {
        num: 4,
        name: "second_region_match",
        fn: executeStep4_SecondRegionMatch,
      },
      { num: 5, name: "partial_word_match", fn: executeStep5_PartialWordMatch },
      {
        num: 6,
        name: "starting_2_words_match",
        fn: executeStep6_Starting2WordsMatch,
      },
      { num: 7, name: "coordinate_match", fn: executeStep7_CoordinateMatch },
    ];

    for (const step of matchingSteps) {
      unmatchedProperties = await executeMatchingStepNonBlocking(
        step.num,
        step.name,
        unmatchedProperties,
        step.fn,
        redinPropertiesFlattened,
        stats,
        results,
        bulkOperations,
        subtypeMismatchTrackedIds,
        successfullyMatchedIds,
      );
    }

    // ========== BULK DATABASE UPDATE ==========
    console.log("\n--- Performing Bulk Database Update ---");

    if (bulkOperations.length > 0) {
      // Split into chunks of 1000 for MongoDB bulk write limit
      const BULK_CHUNK_SIZE = 1000;

      for (let i = 0; i < bulkOperations.length; i += BULK_CHUNK_SIZE) {
        const chunk = bulkOperations.slice(i, i + BULK_CHUNK_SIZE);

        try {
          const result = await Property.bulkWrite(chunk, { ordered: false });
          stats.dbUpdateSuccess += result.modifiedCount || chunk.length;
          console.log(
            `Bulk update chunk ${Math.floor(i / BULK_CHUNK_SIZE) + 1}: ${result.modifiedCount || chunk.length} updated`,
          );
        } catch (bulkError) {
          console.error(`Bulk update error:`, bulkError.message);
          stats.dbUpdateFailed += chunk.length;
        }

        // Yield between bulk writes
        await yieldToEventLoop();
      }
    }

    console.log(
      `Database Updates Complete: ${stats.dbUpdateSuccess} success, ${stats.dbUpdateFailed} failed`,
    );

    // ========== RECORD UNMATCHED PROPERTIES ==========
    const nameMatchedButSubtypeNotMatch = [];
    const nameNotMatchedAtAll = [];

    for (const property of unmatchedProperties) {
      if (successfullyMatchedIds.has(property.id)) continue;

      if (subtypeMismatchTrackedIds.has(property.id)) {
        let mismatchInfo = null;
        for (let i = 1; i <= 7; i++) {
          const found = results[`step${i}_subtypeMismatches`]?.find(
            (m) => m.property_id === property.id,
          );
          if (found) {
            mismatchInfo = {
              ...found,
              address_information: property.address_information,
            };
            break;
          }
        }
        if (mismatchInfo) nameMatchedButSubtypeNotMatch.push(mismatchInfo);
      } else {
        const { region1, region2 } = extractRegionParts(
          property.custom_fields?.propertyfinder_region,
        );
        nameNotMatchedAtAll.push({
          property_id: property.id,
          full_region: property.custom_fields?.propertyfinder_region,
          region1,
          region2,
          property_type: property.property_type,
          address_information: property.address_information,
          reason: "no_name_match_found",
        });
      }
    }

    results.unmatched = [
      ...nameMatchedButSubtypeNotMatch,
      ...nameNotMatchedAtAll,
    ];
    stats.totalUnmatchedProperties = results.unmatched.length;

    // ========== FINAL STATS ==========
    const endTime = Date.now();
    const executionTime = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n========== FINAL STATISTICS ==========");
    console.log(`Execution Time: ${executionTime} seconds`);
    console.log(`Total Matched: ${stats.totalMatchedProperties}`);
    console.log(`Total Unmatched: ${stats.totalUnmatchedProperties}`);
    console.log(
      `DB Updates: ${stats.dbUpdateSuccess} success, ${stats.dbUpdateFailed} failed`,
    );

    return res.status(200).json({
      success: true,
      executionTime: `${executionTime} seconds`,
      statistics: stats,

      // Counts for each step
      step1_matched_count: results.step1_matched.length,
      step2_matched_count: results.step2_matched.length,
      step3_matched_count: results.step3_matched.length,
      step4_matched_count: results.step4_matched.length,
      step5_matched_count: results.step5_matched.length,
      step6_matched_count: results.step6_matched.length,
      step7_matched_count: results.step7_matched.length,

      // Matched data per step
      data: {
        step1_matched: results.step1_matched,
        step1_subtypeMismatches: results.step1_subtypeMismatches,
        step2_matched: results.step2_matched,
        step2_subtypeMismatches: results.step2_subtypeMismatches,
        step3_matched: results.step3_matched,
        step3_subtypeMismatches: results.step3_subtypeMismatches,
        step4_matched: results.step4_matched,
        step4_subtypeMismatches: results.step4_subtypeMismatches,
        step5_matched: results.step5_matched,
        step5_subtypeMismatches: results.step5_subtypeMismatches,
        step6_matched: results.step6_matched,
        step6_subtypeMismatches: results.step6_subtypeMismatches,
        step7_matched: results.step7_matched,
        step7_subtypeMismatches: results.step7_subtypeMismatches,
      },

      // Unmatched properties separated
      unmatched: {
        nameMatchedButSubtypeNotMatch: nameMatchedButSubtypeNotMatch,
        nameNotMatchedAtAll: nameNotMatchedAtAll,
      },
    });
  } catch (error) {
    console.error("MatchGeoPointOptimized Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};




const MatchGeoPointBackground = async (req, res) => {
  // Check if already running
  if (backgroundJobStatus.isRunning) {
    return res.status(409).json({
      success: false,
      message: "Background matching job is already running",
      status: backgroundJobStatus,
    });
  }

  const forceRematch = req.query.forceRematch === "true";

  // Reset status
  backgroundJobStatus = {
    isRunning: true,
    progress: 0,
    totalProperties: 0,
    matchedCount: 0,
    startTime: new Date().toISOString(),
    lastUpdate: new Date().toISOString(),
    error: null,
  };

  // Return immediately
  res.status(202).json({
    success: true,
    message: "Background matching job started",
    statusEndpoint: "/match-geo-point/status",
  });

  // Run the actual processing in the background
  setImmediate(async () => {
    try {
      await runBackgroundMatching(forceRematch);
    } catch (error) {
      backgroundJobStatus.error = error.message;
      backgroundJobStatus.isRunning = false;
      console.error("Background matching error:", error);
    }
  });
};

const runBackgroundMatching = async (forceRematch) => {
  try {
    const propertyQuery = {
      "custom_fields.city": "Dubai",
      "general_listing_information.status": "Live",
    };

    if (!forceRematch) {
      propertyQuery.$or = [
        { "redin_location.location_id": { $exists: false } },
        { "redin_location.location_id": null },
        { redin_location: { $exists: false } },
      ];
    }

    // Use cursor for memory-efficient streaming
    const propertyCursor = Property.find(propertyQuery, {
      id: 1,
      "custom_fields.propertyfinder_region": 1,
      "custom_fields.city": 1,
      "general_listing_information.status": 1,
      address_information: 1,
      property_type: 1,
      redin_location: 1,
    })
      .lean()
      .cursor();

    const redinLocationData = await ExtractRedinLocation.find({}).lean();
    const redinPropertiesFlattened =
      await buildFlattenedRedinArray(redinLocationData);

    backgroundJobStatus.totalProperties =
      await Property.countDocuments(propertyQuery);

    const bulkOperations = [];
    let processedCount = 0;

    const matchingFunctions = [
      executeStep1_CombinedRegionMatch,
      executeStep2_FirstRegionMatch,
      executeStep3_Region1Or2Match,
      executeStep4_SecondRegionMatch,
      executeStep5_PartialWordMatch,
      executeStep6_Starting2WordsMatch,
      executeStep7_CoordinateMatch,
    ];

    // Process properties in streaming fashion
    for await (const property of propertyCursor) {
      // Try each matching step
      for (const stepFn of matchingFunctions) {
        const result = stepFn(property, redinPropertiesFlattened);
        if (result.matchResult) {
          bulkOperations.push({
            updateOne: {
              filter: { id: property.id },
              update: {
                $set: {
                  redin_location: {
                    location_id: result.matchResult.match.location_id,
                    property_location_id: result.matchResult.match.property_id,
                    property_name: result.matchResult.match.property_name,
                    main_subtype_name:
                      result.matchResult.match.main_subtype_name,
                    main_type_name: result.matchResult.match.main_type_name,
                    matched_by: stepFn.name,
                    matched_region_part: result.matchResult.matchedRegionPart,
                  },
                },
              },
            },
          });
          backgroundJobStatus.matchedCount++;
          break; // Stop after first match
        }
      }

      processedCount++;
      backgroundJobStatus.progress = Math.round(
        (processedCount / backgroundJobStatus.totalProperties) * 100,
      );
      backgroundJobStatus.lastUpdate = new Date().toISOString();

      // Bulk write every 500 operations
      if (bulkOperations.length >= 500) {
        await Property.bulkWrite(bulkOperations, { ordered: false });
        bulkOperations.length = 0;
        await yieldToEventLoop();
      }

      // Yield periodically
      if (processedCount % YIELD_INTERVAL === 0) {
        await yieldToEventLoop();
      }
    }

    // Final bulk write
    if (bulkOperations.length > 0) {
      await Property.bulkWrite(bulkOperations, { ordered: false });
    }

    backgroundJobStatus.isRunning = false;
    backgroundJobStatus.progress = 100;
    console.log("Background matching completed successfully");
  } catch (error) {
    backgroundJobStatus.error = error.message;
    backgroundJobStatus.isRunning = false;
    throw error;
  }
};

const GetBackgroundJobStatus = (req, res) => {
  return res.status(200).json({
    success: true,
    status: backgroundJobStatus,
  });
};





module.exports = {
  MatchgeoPiont,
  GetPropertyID, 
  MatchGeoPointBackground
};