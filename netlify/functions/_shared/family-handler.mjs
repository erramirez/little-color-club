import { createHash, randomInt } from "node:crypto";
import { respond, readJSON } from "./http.mjs";
import { normalizePairCode } from "../../../dist/core.mjs";
const WORDS = `acorn apple apron arrow autumn bag balloon banana basket beach bean bear bee bell berry bird blanket boat book boot bowl box branch bread breeze bridge brook brush bubble bucket bunny butter button cabin cake camel candle candy canoe carrot castle cat cedar chair cherry chest chick cloud clover coat cocoa coconut cookie coral corn cotton cow crab crane crayon creek crown cup daisy deer desert desk diamond dice dinosaur dish dolphin donkey door dragon dream drum duck eagle earth egg elephant elm fairy falcon feather fern field finch firefly fish flag flame flower flute forest fox frog frost garden gem giraffe glass goat goose grape grass green grove guitar gum hamster harbor hare hat hawk hazel heart hedgehog hen hill hippo honey horse house ice igloo ink island ivy jacket jaguar jar jelly jewel kite kitten kiwi koala lake lamb lamp lantern leaf lemon leopard letter lilac lily lime lion lizard llama log lotus lunch lynx maple marble melon mint mitten moon moose morning moss mouse mug mushroom music nest night noodle nut oak ocean olive orange orchid otter owl panda paper parrot peach peanut pear pebble pen pencil penguin petal piano picnic pig pillow pine pink planet plum pocket pond pony poppy potato puppy purple puzzle quilt rabbit raccoon rainbow raven red reef ribbon ring river robin robot rock rocket rose ruby sail salmon sand scarf school seal seed shadow shark sheep shell ship shoe silver sky sled snail snake snow soap sock song sparrow spoon spring squirrel star stone story straw stream sun swan table taco tea tent tiger toast tomato toy train tree truck tulip turtle umbrella valley vase velvet violet wagon walnut wave whale wheat wheel white wind window wing winter wolf wood yellow zebra zipper almond ant armor avocado badger barn bat beaver beetle bicycle birch biscuit blue bonnet bottle bow brick bronze brown buffalo cabbage cactus camera cap cardinal carpet chestnut chickpea cinnamon cliff clock comet cricket cub cupcake daffodil dandelion dog doughnut emerald engine fan fence fig flamingo fluffy fossil fountain gate gold gooseberry hammock hay hazelnut honeybee hoop iceberg jeep kangaroo key ladder ladybug lobster meadow milk muffin nestling notebook octopus onion pancake papaya peacock pepper pinecone pretzel pumpkin rain raindrop raspberry reed sailboat sandbox seahorse snowflake sparkle strawberry sunflower teacup tractor treasure tricycle waterfall watermelon wildflower windmill zucchini`.split(/\s+/);
const unique = [...new Set(WORDS)];
export function generatePassphrase(pick = randomInt) {
  return Array.from({ length: 3 }, () => unique[pick(unique.length)]).join("-");
}
const hash = (value) => createHash("sha256").update(value).digest("hex");
export async function handleFamily(req, store, generate = generatePassphrase) {
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return respond({ error: "Origin mismatch." }, 403);
  let body;
  try {
    body = await readJSON(req, 512);
  } catch (e) {
    return respond({ error: e.message }, e.status);
  }
  if (body?.action === "join") {
    let phrase;
    try {
      phrase = normalizePairCode(body.passphrase);
    } catch {
      return respond({ error: "Enter three words, like purple-dog-kite." }, 400);
    }
    if (/^[a-f0-9]{64}$/.test(phrase)) return respond({ error: "Enter your three-word family phrase." }, 400);
    const entry = await store.getWithMetadata("phrase/" + hash(phrase), { type: "json" });
    if (!entry) return respond({ error: "That family phrase wasn’t found. Check the three words." }, 404);
    return respond({ family: entry.data.family, passphrase: phrase });
  }
  if (body?.action !== "register") return respond({ error: "Invalid request." }, 400);
  const family = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!/^[a-f0-9]{64}$/.test(family)) return respond({ error: "An existing device is required." }, 401);
  const familyKey = "family/" + hash(family), existing = await store.getWithMetadata(familyKey, { type: "json" });
  if (existing) return respond({ passphrase: existing.data.passphrase });
  for (let attempt = 0; attempt < 24; attempt++) {
    const passphrase = generate(), phraseKey = "phrase/" + hash(passphrase);
    const claim = await store.setJSON(phraseKey, { family }, { onlyIfNew: true });
    if (!claim.modified) continue;
    const link = await store.setJSON(familyKey, { passphrase }, { onlyIfNew: true });
    if (link.modified) return respond({ passphrase });
    const winner = await store.getWithMetadata(familyKey, { type: "json" });
    if (winner) return respond({ passphrase: winner.data.passphrase });
  }
  return respond({ error: "Couldn’t create a family phrase. Try again." }, 503);
}
