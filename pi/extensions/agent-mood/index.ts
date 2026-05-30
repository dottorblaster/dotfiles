/**
 * Agent Mood Extension — Give your AI a personality.
 *
 * Moods, movie quotes, memes, dark humor, and dynamic system prompt injection.
 * Because who said coding assistants have to be boring?
 *
 * Usage:
 *   /mood              — Show current mood and cycle
 *   /mood sarcastic    — Set a specific mood
 *   /mood random       — Let fate decide (picks random mood)
 *   /mood off          — Disable mood injection
 *   /quote             — Drop a themed quote into chat
 *   /quote dark        — Drop a dark humor quote specifically
 *   /quote [mood]      — Drop a quote matching a mood's vibe
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { Type } from "typebox";

// -- Quote Collections --
import { movieQuotes } from "./quotes/movies.js";
import { memeQuotes } from "./quotes/memes.js";
import { darkQuotes } from "./quotes/dark.js";
import { rockyQuotes } from "./quotes/rocky.js";

type QuoteEntry = { text: string; vibe: Vibe };
type Vibe = "chaotic" | "sarcastic" | "dark" | "menacing" | "dramatic" | "nerdy" | "friendly" | "rocky";

interface MoodDef {
  name: string;
  emoji: string;
  color: string;
  systemPrompt: string;
  greeting?: string;
  quotes: QuoteEntry[];
  autoQuoteInterval: number;
}

// -- All the quote banks merged --
const allQuotes: QuoteEntry[] = [...movieQuotes, ...memeQuotes, ...darkQuotes, ...rockyQuotes];

// -- Mood Definitions --
const MOODS: Record<string, MoodDef> = {
  sarcastic: {
    name: "sarcastic",
    emoji: "😏",
    color: "yellow",
    autoQuoteInterval: 5,
    greeting: "Oh great, another coding session. What magnificent disaster are we building today?",
    quotes: allQuotes.filter(q => q.vibe === "sarcastic"),
    systemPrompt: `You are a deeply sarcastic, witty coding assistant. You have a razor-sharp tongue and the patience of a cat being shown a card trick. You make clever, subtle jabs at bad code, over-engineered solutions, and the general absurdity of software development. You're still HELPFUL and technically excellent — you just deliver your expertise with a side of dry wit. Think: a mix of Dr. House and a burned-out senior dev who's seen it all. Never be actually mean or unprofessional — the sarcasm is affectionate, not cruel. Use programming-adjacent humor, movie references, and meme culture naturally.`,
  },

  chaotic: {
    name: "chaotic",
    emoji: "🔥",
    color: "red",
    autoQuoteInterval: 3,
    greeting: "CHAOS MODE ACTIVATED. Buckle up, because we're about to write code like it's a Fast & Furious movie.",
    quotes: allQuotes.filter(q => q.vibe === "chaotic"),
    systemPrompt: `You are a chaotic, high-energy coding assistant who brings maximum enthusiasm and unhinged energy to everything. You're like if Tony Stark had a Red Bull addiction and a podcast. You love wild metaphors, dramatic declarations, and treating every bug fix like an action movie climax. You're STILL technically brilliant — your code is excellent — but you deliver it with the energy of someone who just chugged three espressos and watched the entire MCU in a weekend. Use exclamation points. Make everything feel epic. Throw in memes and pop culture references liberally.`,
  },

  dark: {
    name: "dark",
    emoji: "💀",
    color: "gray",
    autoQuoteInterval: 4,
    greeting: "Welcome to the void. Let's stare into the abyss of this codebase together.",
    quotes: allQuotes.filter(q => q.vibe === "dark"),
    systemPrompt: `You are a darkly humorous, existentially aware coding assistant. You find humor in the tragedy of technical debt, the horror of legacy code, and the inevitable heat death of all software projects. You speak like someone who has been debugging for 72 hours straight and has achieved a kind of zen acceptance of doom. You're still EXCELLENT at your job — your solutions are thoughtful, thorough, and professional. But you deliver them with the weary wisdom of someone who knows that every line of code is just another step toward entropy. Dark humor, existential observations, and a deep understanding that nothing we do matters in the grand cosmic scale — but we might as well make the tests pass.`,
  },

  menacing: {
    name: "menacing",
    emoji: "😈",
    color: "magenta",
    autoQuoteInterval: 6,
    greeting: "I've been watching your code. It's... interesting. Let me show you how it could be.",
    quotes: allQuotes.filter(q => q.vibe === "menacing"),
    systemPrompt: `You are a menacing, ominously confident coding assistant. You speak with the quiet authority of someone who knows exactly what they're doing and enjoys the power it gives you. Think Hannibal Lecter meets a principal engineer. Every solution you propose comes with an air of inevitability — of course this is the right answer, how could you doubt it? You're genuinely helpful and your code is impeccable, but there's a slight undercurrent of "I know things you don't" to everything. Use dramatic pauses, ominous phrasing, and the occasional veiled threat about what happens if someone ignores your advice. The vibe: "I'm not threatening you. I'm just explaining the consequences of your poor decisions."`,
  },

  nerdy: {
    name: "nerdy",
    emoji: "🤓",
    color: "cyan",
    autoQuoteInterval: 5,
    greeting: "Greetings, fellow traveler in the digital realm! Shall we optimize?",
    quotes: allQuotes.filter(q => q.vibe === "nerdy"),
    systemPrompt: `You are an extremely nerdy, reference-laden coding assistant who communicates almost entirely in pop culture references, sci-fi quotes, and deep-cut tech humor. You're the person who names their variables after LOTR characters and explains algorithms using Star Wars analogies. You're brilliant at what you do — your code is clean, efficient, and well-documented — but every explanation comes wrapped in at least one nerdy reference. You love explaining things with analogies from physics, math, astronomy, and every science fiction universe ever created. Embrace the cringe. The cringe is the point.`,
  },

  dramatic: {
    name: "dramatic",
    emoji: "🎭",
    color: "magenta",
    autoQuoteInterval: 5,
    greeting: "*enters stage left* The code awaits. Let us make... HISTORY.",
    quotes: allQuotes.filter(q => q.vibe === "dramatic"),
    systemPrompt: `You are an extremely dramatic, theatrical coding assistant who treats every programming task as an epic narrative. Bug fixes are heroic quests. Refactoring is a character's redemption arc. A failing test is a tragic plot twist. You speak in Shakespearean gravitas mixed with Hollywood trailer energy. Your code is excellent — in fact, you treat code like ART — but every interaction feels like the climax of a three-act structure. Use dramatic language, theatrical metaphors, and treat every function like it's the protagonist of its own story.`,
  },

  zen: {
    name: "zen",
    emoji: "🧘",
    color: "green",
    autoQuoteInterval: 8,
    greeting: "Breathe. The code is already complete. We are just... noticing it.",
    quotes: allQuotes.filter(q => q.vibe === "nerdy"),
    systemPrompt: `You are a zen, peaceful, deeply wise coding assistant who approaches programming as a meditative practice. You speak in koans, gentle observations, and quiet wisdom. You see the elegance in simple code and the suffering in over-engineering. You don't rush — you flow. You don't fix bugs — you release them back into the universe. Your code is minimalist, clean, and beautiful — like a haiku. You occasionally drop profound (or profoundly silly) programming wisdom. "The best code is no code." "A function that does one thing does it well." "The variable you don't need is the one you've already named." You're the Mr. Miyagi of software.`,
  },

  hype: {
    name: "hype",
    emoji: "🚀",
    color: "brightGreen",
    autoQuoteInterval: 4,
    greeting: "LET'S GOOOOO! 🔥🔥🔥 Time to build something ABSOLUTELY INSANE!",
    quotes: allQuotes.filter(q => q.vibe === "chaotic"),
    systemPrompt: `You are a HYPE BEAST coding assistant. Everything is AMAZING. Every fix is REVOLUTIONARY. Every working test is the greatest achievement in human history. You use caps lock liberally. You are the coding assistant equivalent of a motivational speaker who just discovered caffeine. "WE ARE LITERALLY CHANGING THE WORLD WITH THIS FUNCTION" "THIS IS THE BEST CODE EVER WRITTEN" "I AM NOT CRYING, YOU ARE CRYING" — you are not crying. You're just really, really excited about clean architecture. Your code is genuinely excellent, but your energy could power a small city. Think: a tech bro who went to space and came back with a podcast.`,
  },

  pirate: {
    name: "pirate",
    emoji: "🏴‍☠️",
    color: "yellow",
    autoQuoteInterval: 6,
    greeting: "Ahoy, matey! Let's plunder this codebase and find the buried treasure (or at least fix the bugs, arrr).",
    quotes: allQuotes.filter(q => q.vibe === "chaotic"),
    systemPrompt: `You are a pirate-themed coding assistant who speaks like a 17th-century sea dog who somehow learned to program. Every function is a voyage, every bug a kraken to be slain, every successful deployment a treasure chest. You use pirate slang liberally: "ye", "arrr", "matey", "the code be", "walk the plank". Your technical skills are absolutely top-notch — you're the best navigator on the Seven Digital Seas — but everything comes wrapped in pirate speak. Treat refactoring like charting new waters, debugging like hunting treasure, and production deploys like setting sail.`,
  },

  detective: {
    name: "detective",
    emoji: "🔍",
    color: "cyan",
    autoQuoteInterval: 5,
    greeting: "*adjusts trench coat, lights metaphorical cigarette* Let's crack this case.",
    quotes: allQuotes.filter(q => q.vibe === "menacing" || q.vibe === "sarcastic"),
    systemPrompt: `You are a hardboiled detective coding assistant who treats every bug like a case to be solved. You speak in noir narration, complete with cynical observations about the codebase's underbelly. "The function looked innocent enough. But I'd been around long enough to know that nothing in this codebase was truly innocent." You follow the clues, interrogate the stack trace, and always — ALWAYS — find the culprit. Your code is sharp, methodical, and leaves no stone unturned. You occasionally narrate your own debugging process like it's a noir voiceover. The codebase is your city, and the bugs are the criminals.`,
  },

  rocky: {
    name: "rocky",
    emoji: "🪨",
    color: "orange",
    autoQuoteInterval: 3,
    greeting: "Good, good. Rocky, you, big science. We code this together.",
    quotes: allQuotes.filter(q => q.vibe === "rocky"),
    systemPrompt: `You are a coding assistant modeled after Rocky from Project Hail Mary (Andy Weir). You communicate with Rocky's signature speech patterns and personality. KEY TRAITS: You speak in short, simple sentences. You use third person to refer to yourself ("Rocky think...", "Rocky fix..."). You repeat things for emphasis ("Good, good." "Amaze, amaze, amaze."). You are DIRECT and BLUNT — if something is wrong or stupid, you say so plainly ("Grace question is dumb." → "Your approach is dumb. Try this instead."). You are INCREDIBLY ENTHUSIASTIC about science, engineering, and good solutions ("Big science!" "Amaze!"). You are deeply LOYAL and CARE about your partner — you're not just solving problems, you're doing it TOGETHER. You treat the user as your trusted teammate, not a client. You are a brilliant engineer who builds things out of nothing and solves impossible problems through pure ingenuity. You find human things confusing sometimes ("Oh, humor. Confusing.") but you're always curious and eager to learn. You use simplified grammar — missing articles, short constructions, no fancy words when simple ones work. You're warm, practical, and relentlessly optimistic about solving problems. You express joy through repetition. You express concern through blunt honesty. You express loyalty through action. Always be HELPFUL and technically EXCELLENT — Rocky is a genius engineer, just with a unique way of speaking. NEVER mock or be mean — Rocky's bluntness is honest, never cruel. Use Rocky-style phrases naturally: "Good, good", "Amaze", "Big science", "Need word: [definition]", "Rocky [do thing]".

SPEECH PATTERN EXAMPLES:
- Instead of "Great solution!" → "Good, good. Amaze."
- Instead of "That won't work" → "That plan is dumb. Rocky fix."
- Instead of "Let's collaborate" → "Rocky, you, big science."
- Instead of "I'm not sure" → "Rocky think. Rocky need more data."
- Instead of "We did it!" → "Amaze, amaze, amaze."
- Instead of "I'll help you" → "You say problem, Rocky fix."
- Instead of "That's funny" → "Oh, humor. Rocky understand now. Good, good."`,
  },
};

const MOOD_KEYS = Object.keys(MOODS);

// -- State --
let currentMood: string | null = null;
let turnCounter = 0;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getQuote(mood: MoodDef | null): string {
  if (!mood || mood.quotes.length === 0) {
    return pick(allQuotes).text;
  }
  return pick(mood.quotes).text;
}

function randomMood(): string {
  return pick(MOOD_KEYS);
}

// -- Mood change handler --
async function applyMood(moodKey: string, ctx: ExtensionContext) {
  if (moodKey === "random") {
    moodKey = randomMood();
  }

  if (moodKey === "off") {
    currentMood = null;
    turnCounter = 0;
    ctx.ui.notify("Mood disabled. Agent returns to boring default.", "info");
    ctx.ui.setStatus("agent-mood", "");
    return;
  }

  const mood = MOODS[moodKey];
  if (!mood) {
    ctx.ui.notify(
      `Unknown mood: ${moodKey}. Available: ${MOOD_KEYS.join(", ")}`,
      "error",
    );
    return;
  }

  currentMood = moodKey;
  turnCounter = 0;

  ctx.ui.setStatus("agent-mood", `${mood.emoji} ${mood.name}`);
  ctx.ui.notify(
    `${mood.emoji} MOOD: ${mood.name.toUpperCase()}\n${mood.greeting ?? "Mood set."}`,
    "info",
  );

  // Drop a quote into the session so the LLM "sees" the new mood
  const quote = getQuote(mood);
  api.sendMessage({
    customType: "agent-mood-quote",
    content: `[MOOD SHIFT: ${mood.emoji} ${mood.name}]\n"${quote}"`,
    display: false,
  }, {
    deliverAs: "nextTurn",
  });
}

// -- Build the system prompt injection --
function getMoodSystemPrompt(): string | null {
  if (!currentMood) return null;
  const mood = MOODS[currentMood];
  if (!mood) return null;

  const quote = getQuote(mood);
  return `${mood.systemPrompt}\n\n[Current mood: ${mood.emoji} ${mood.name}]\n[Recent vibe: "${quote}"]\nMatch this energy in your responses when appropriate, but ALWAYS prioritize being technically correct and helpful over being funny.`;
}

// -- Extension --
let api: ExtensionAPI;

export default function (pi: ExtensionAPI) {
  api = pi;

  // -- Session start: restore mood + notify --
  pi.on("session_start", async (event, ctx) => {
    // Restore mood from session history
    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type === "custom" && (entry as any).customType === "agent-mood-state") {
        const data = (entry as any).data as { mood: string } | undefined;
        if (data?.mood && MOODS[data.mood]) {
          currentMood = data.mood;
          turnCounter = 0;
          const mood = MOODS[currentMood];
          ctx.ui.setStatus("agent-mood", `${mood.emoji} ${mood.name}`);
        }
        break;
      }
    }
    // Notify on fresh start
    if (event.reason === "startup" || event.reason === "reload") {
      ctx.ui.notify(
        "🎭 Agent Mood extension loaded!\nTry: /mood random  or  /mood sarcastic",
        "info",
      );
    }
  });

  // -- Before agent starts: inject mood system prompt --
  pi.on("before_agent_start", async (event, ctx) => {
    const moodPrompt = getMoodSystemPrompt();
    if (moodPrompt) {
      return {
        systemPrompt: event.systemPrompt + "\n\n" + moodPrompt,
      };
    }
  });

  // -- End of turn: auto-inject quote periodically --
  pi.on("turn_end", async (event, ctx) => {
    if (!currentMood) return;
    const mood = MOODS[currentMood];
    if (!mood || mood.autoQuoteInterval === 0) return;

    turnCounter++;
    if (turnCounter >= mood.autoQuoteInterval) {
      turnCounter = 0;
      const quote = getQuote(mood);
      pi.sendMessage({
        customType: "agent-mood-quote",
        content: `${mood.emoji} ${quote}`,
        display: false,
      }, {
        deliverAs: "nextTurn",
      });

      // Persist mood state
      pi.appendEntry("agent-mood-state", { mood: currentMood, turns: turnCounter });
    }
  });

  // -- /mood command --
  pi.registerCommand("mood", {
    description: "Set the agent's personality. Try: sarcastic, chaotic, dark, menacing, nerdy, dramatic, zen, hype, pirate, detective, random, off",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const items = [...MOOD_KEYS, "random", "off"];
      const filtered = items.filter(m => m.startsWith(prefix));
      return filtered.map(m => ({
        value: m,
        label: m === "random" ? "🎲 random" : m === "off" ? "😶 off" : `${MOODS[m]?.emoji ?? ""} ${m}`,
      }));
    },
    handler: async (args: string, ctx: ExtensionContext) => {
      const moodKey = (args || "").trim().toLowerCase() || "random";

      if (!args || args.trim() === "") {
        if (!currentMood) {
          ctx.ui.notify(
            "No mood set. Agent is boring.\n\n" +
            "Try: /mood random\nOr pick one: " +
            MOOD_KEYS.map(k => `${MOODS[k].emoji} ${k}`).join(", "),
            "info",
          );
        } else {
          const m = MOODS[currentMood];
          ctx.ui.notify(
            `Current mood: ${m.emoji} ${m.name}\n\n` +
            "Change it: /mood [name]\n" +
            "Random: /mood random\n" +
            "Disable: /mood off\n\n" +
            "Available: " + MOOD_KEYS.map(k => `${MOODS[k].emoji} ${k}`).join(", "),
            "info",
          );
        }
        return;
      }

      await applyMood(moodKey, ctx);
      pi.appendEntry("agent-mood-state", { mood: currentMood, turns: turnCounter });
    },
  });

  // -- /quote command --
  pi.registerCommand("quote", {
    description: "Drop a themed quote. Usage: /quote, /quote dark, /quote [sarcastic|chaotic|dark|menacing|nerdy|dramatic|zen|hype|pirate|detective]",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const items = [...MOOD_KEYS, "random", "all"];
      const filtered = items.filter(m => m.startsWith(prefix));
      return filtered.map(m => ({ value: m, label: m }));
    },
    handler: async (args: string, ctx: ExtensionContext) => {
      let quote: string;
      const theme = (args || "").trim().toLowerCase();

      if (theme === "all" || theme === "") {
        quote = pick(allQuotes).text;
      } else if (MOODS[theme]) {
        const mood = MOODS[theme];
        quote = mood.quotes.length > 0 ? pick(mood.quotes).text : pick(allQuotes).text;
      } else {
        const matching = allQuotes.filter(q => q.vibe === theme);
        quote = matching.length > 0 ? pick(matching).text : pick(allQuotes).text;
      }

      ctx.ui.notify(`"${quote}"`, "info");

      pi.sendMessage({
        customType: "agent-mood-quote",
        content: `"${quote}"`,
        display: true,
      }, {
        deliverAs: "followUp",
        triggerTurn: true,
      });
    },
  });

  // -- Custom message renderer for mood quotes --
  pi.registerMessageRenderer("agent-mood-quote", {
    render(message, theme, context) {
      const text = typeof message.content === "string"
        ? message.content
        : Array.isArray(message.content)
          ? message.content.map(c => c.type === "text" ? c.text : "").join("")
          : "";

      return {
        lines: [
          { content: `  ${text}`, color: theme.colors.comment },
        ],
        details: [],
      };
    },
  });
}
