const sharp = require("sharp");

function getPermutations(arr) {
  if (arr.length === 0) return [[]];
  const first = arr[0];
  const rest = arr.slice(1);
  const permsWithoutFirst = getPermutations(rest);
  const allPermutations = [];
  permsWithoutFirst.forEach((perm) => {
    for (let i = 0; i <= perm.length; i++) {
      const permWithFirst = [...perm.slice(0, i), first, ...perm.slice(i)];
      allPermutations.push(permWithFirst);
    }
  });
  return allPermutations;
}

async function fetchImageFromUrl(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch image from URL: ${url}. Status: ${response.status}`
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer;
  } catch (error) {
    console.error(`Error fetching image from URL ${url}: ${error.message}`);
    throw error;
  }
}

async function solveGlitch(compositeImageUrl, originalImageUrl) {
  try {
    const compositeBuffer = await fetchImageFromUrl(compositeImageUrl);
    const originalBuffer = await fetchImageFromUrl(originalImageUrl);

    const compositeSharp = sharp(compositeBuffer);
    const originalSharp = sharp(originalBuffer);

    const compositeMeta = await compositeSharp.metadata();
    const originalMeta = await originalSharp.metadata();

    if (
      !compositeMeta.width ||
      !compositeMeta.height ||
      !originalMeta.width ||
      !originalMeta.height
    ) {
      throw new Error("Could not read image metadata.");
    }

    let resizedOriginalBuffer;
    if (
      compositeMeta.width !== originalMeta.width ||
      compositeMeta.height !== originalMeta.height
    ) {
      resizedOriginalBuffer = await originalSharp
        .resize(compositeMeta.width, compositeMeta.height, { fit: "fill" })
        .ensureAlpha()
        .raw()
        .toBuffer();
    }

    const width = compositeMeta.width;
    const height = compositeMeta.height;
    const halfWidth = Math.floor(width / 2);
    const halfHeight = Math.floor(height / 2);

    const originalRawBuffer =
      resizedOriginalBuffer ||
      (await originalSharp.ensureAlpha().raw().toBuffer());

    const pieces = {
      A: compositeSharp
        .clone()
        .extract({ left: 0, top: 0, width: halfWidth, height: halfHeight }),
      B: compositeSharp.clone().extract({
        left: halfWidth,
        top: 0,
        width: width - halfWidth,
        height: halfHeight,
      }),
      C: compositeSharp.clone().extract({
        left: 0,
        top: halfHeight,
        width: halfWidth,
        height: height - halfHeight,
      }),
      D: compositeSharp.clone().extract({
        left: halfWidth,
        top: halfHeight,
        width: width - halfWidth,
        height: height - halfHeight,
      }),
    };

    const pieceBuffers = {};
    for (const label of ["A", "B", "C", "D"]) {
      pieceBuffers[label] = await pieces[label]
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      if (
        label === "A" &&
        (pieceBuffers[label].info.width !== halfWidth ||
          pieceBuffers[label].info.height !== halfHeight)
      ) {
        console.warn(
          `Potential issue: Extracted piece A size (${pieceBuffers[label].info.width}x${pieceBuffers[label].info.height}) differs from calculated quadrant size (${halfWidth}x${halfHeight})`
        );
      }
    }

    const labels = ["A", "B", "C", "D"];
    const permutations = getPermutations(labels);

    let bestMatch = {
      permutation: null,
      similarity: 0,
    };

    for (const perm of permutations) {
      const [tlLabel, trLabel, blLabel, brLabel] = perm;

      const compositeInstructions = [
        {
          input: pieceBuffers[tlLabel].data,
          raw: pieceBuffers[tlLabel].info,
          top: 0,
          left: 0,
        },
        {
          input: pieceBuffers[trLabel].data,
          raw: pieceBuffers[trLabel].info,
          top: 0,
          left: halfWidth,
        },
        {
          input: pieceBuffers[blLabel].data,
          raw: pieceBuffers[blLabel].info,
          top: halfHeight,
          left: 0,
        },
        {
          input: pieceBuffers[brLabel].data,
          raw: pieceBuffers[brLabel].info,
          top: halfHeight,
          left: halfWidth,
        },
      ];

      const reconstructedBuffer = await sharp({
        create: {
          width: width,
          height: height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite(compositeInstructions)
        .ensureAlpha()
        .raw()
        .toBuffer();

      const similarity = calculateImageSimilarity(
        originalRawBuffer,
        reconstructedBuffer
      );

      if (similarity > bestMatch.similarity) {
        bestMatch.permutation = perm;
        bestMatch.similarity = similarity;
      }

      if (similarity > 0.75) {
        bestMatch.permutation = perm;
        bestMatch.similarity = similarity;
        break;
      }
    }

    if (bestMatch.permutation) {
      /*console.log(
        `Best match found with permutation: ${bestMatch.permutation.join(
          ", "
        )} (similarity: ${bestMatch.similarity})`
      );*/

      return bestMatch.permutation.join("");
    }

    console.error("Error: Could not find any valid permutation.");
    return null;
  } catch (error) {
    console.error(`An error occurred in solveGlitch: ${error.message}`);
    console.error(error.stack);
    return null;
  }
}

function calculateImageSimilarity(buf1, buf2) {
  if (!buf1 || !buf2 || buf1.length !== buf2.length) {
    return 0;
  }

  let matchingPixels = 0;
  let totalPixels = buf1.length;

  let mse = 0;
  for (let i = 0; i < buf1.length; i++) {
    const diff = buf1[i] - buf2[i];
    mse += diff * diff;

    if (buf1[i] === buf2[i]) {
      matchingPixels++;
    }
  }

  mse = mse / (totalPixels * 255 * 255);
  const mseSimilarity = 1 - Math.sqrt(mse);

  const pixelMatchRatio = matchingPixels / totalPixels;

  return mseSimilarity * 0.7 + pixelMatchRatio * 0.3;
}

module.exports = {
  solveGlitch,
};
