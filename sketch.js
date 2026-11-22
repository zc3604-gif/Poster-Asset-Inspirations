// One prompt in, 20 poster items out, through the Replicate proxy.
// https://editor.p5js.org/dano/sketches/4arclMflQ

const replicateProxy =
  "https://replicateproxy-tc5vweqxmq-uc.a.run.app/create_n_get";

const modelVersion =
  "meta/meta-llama-3-8b-instruct:5a6809ca6288247d06daf6365557e5e429063f32a21146b2a807c682652136b8";

const savedKey = "poster-saved-words";
const saved = new Set(loadSaved());

let promptField;
let askButton;
let replyDiv;
let savedList;
let busy = false;

function setup() {
  noCanvas();

  const box = createDiv();
  box.class("saved-box");
  box.parent(document.body);
  createElement("h2", "Saved").parent(box);
  savedList = createElement("ul");
  savedList.parent(box);
  renderSaved();

  createElement("h1", "20 items");
  createP("One prompt. Twenty short items for a poster. Star one to keep it.").class(
    "note"
  );

  promptField = createInput("dance");
  promptField.elt.addEventListener("keydown", (event) => {
    if (event.key === "Enter") ask();
  });

  askButton = createButton("Ask");
  askButton.mousePressed(ask);

  replyDiv = createDiv("");
  replyDiv.class("reply");
  showPlaceholder("The 20 items will show up here.");
}

async function ask() {
  if (busy) return;

  const theme = promptField.value().trim();
  if (!theme) {
    showPlaceholder("Type a prompt first.");
    return;
  }

  busy = true;
  askButton.elt.disabled = true;
  showPlaceholder("Asking Replicate...");

  try {
    const text = await askForText(theme);
    const items = itemsFromText(text);
    if (items.length === 0) {
      showPlaceholder("No items came back. Try again.");
      return;
    }
    showItems(items);
  } catch (error) {
    showPlaceholder(error.message);
  } finally {
    busy = false;
    askButton.elt.disabled = false;
  }
}

function showPlaceholder(message) {
  replyDiv.html("");
  const note = createP(message);
  note.class("placeholder");
  note.parent(replyDiv);
}

function showItems(items) {
  replyDiv.html("");
  const list = createElement("ol");
  list.parent(replyDiv);
  for (const item of items) {
    const row = createElement("li");
    row.parent(list);

    const label = createSpan("");
    label.elt.textContent = item;
    label.parent(row);

    const star = createButton(saved.has(item) ? "★" : "☆");
    star.class("star");
    star.attribute("aria-label", "Save " + item);
    star.elt.dataset.item = item;
    star.parent(row);
    star.mousePressed(() => toggleSaved(item));
  }
}

function toggleSaved(item) {
  if (saved.has(item)) saved.delete(item);
  else saved.add(item);
  persistSaved();
  renderSaved();
  refreshStars();
}

function renderSaved() {
  savedList.html("");
  if (saved.size === 0) {
    const empty = createElement("li", "None yet");
    empty.class("empty");
    empty.parent(savedList);
    return;
  }

  for (const word of saved) {
    const row = createElement("li");
    row.parent(savedList);

    const label = createSpan("");
    label.elt.textContent = word;
    label.parent(row);

    const remove = createButton("×");
    remove.class("remove");
    remove.attribute("aria-label", "Remove " + word);
    remove.parent(row);
    remove.mousePressed(() => toggleSaved(word));
  }
}

function refreshStars() {
  for (const button of document.querySelectorAll("button.star")) {
    button.textContent = saved.has(button.dataset.item) ? "★" : "☆";
  }
}

function loadSaved() {
  try {
    const stored = JSON.parse(localStorage.getItem(savedKey) || "[]");
    return Array.isArray(stored) ? stored.filter((word) => typeof word === "string") : [];
  } catch (error) {
    return [];
  }
}

function persistSaved() {
  localStorage.setItem(savedKey, JSON.stringify([...saved]));
}

function itemsFromText(text) {
  return text
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•]|\d+[.)]\s*)/, "")
        .replace(/[.!?;:,"']+$/g, "")
        .trim()
    )
    .filter((line) => line && line.split(/\s+/).length <= 5)
    .slice(0, 20);
}

async function askForText(theme) {
  const prompt = [
    `Theme: ${theme}`,
    "List exactly 20 related visual items for a poster.",
    "Rules:",
    "- one item per line",
    "- each item is 1 to 3 words",
    "- objects, materials, symbols, or gestures",
    "- no numbers",
    "- no punctuation",
    "- no sentences",
    "- no intro or closing",
  ].join("\n");

  const data = {
    version: modelVersion,
    input: {
      prompt: prompt,
      max_tokens: 220,
      temperature: 0.8,
    },
  };

  const response = await fetch(replicateProxy, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const payload = await response.json();
  if (!response.ok || payload.error) {
    const message = payload.error || payload.detail || "Request failed.";
    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message)
    );
  }

  if (Array.isArray(payload.output)) return payload.output.join("");
  if (typeof payload.output === "string") return payload.output;
  throw new Error("The proxy returned no text.");
}
