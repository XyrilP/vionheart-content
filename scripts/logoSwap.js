const MODULE_ID = "vionheart-content";
const LOGO_KEY = "customLogo";
const LOGO_DIRECTORY = "modules/vionheart-content/assets/custom-logos";
const LOGO_MARKERS = ["pathfinder", "logo", "brand"];

Hooks.once("init", () => {
  // Populate the dropdown from the existing module asset folder.
  registerLogoChoice();
});

async function registerLogoChoice() {
  const choices = { "": "None" };
  try {
    const listing = await FilePicker.browse("data", LOGO_DIRECTORY);
    for (const path of listing.files ?? []) {
      if (/\.(avif|gif|jpe?g|png|svg|webp)$/i.test(path)) {
        const fileName = path.split(/[\\/]/).pop();
        choices[path] = fileName;
      }
    }
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not list ${LOGO_DIRECTORY}`, error);
  }

  game.settings.register(MODULE_ID, LOGO_KEY, {
    name: "Custom Pathfinder logo",
    hint: "Choose an image from assets/custom-logos, or select None to use the original logo.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    choices,
    onChange: () => refreshOpenActorSheets()
  });
}

function refreshOpenActorSheets() {
  for (const app of Object.values(ui.windows)) {
    if (app.actor && game.system.id === "pf2e") app.render(false);
  }
}

Hooks.on("renderActorSheet", (app, html) => {
  if (!app.actor || game.system.id !== "pf2e") return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root?.querySelectorAll) return;
  const imagePath = game.settings.get(MODULE_ID, LOGO_KEY) ?? "";
  if (imagePath) replaceSystemLogo(root, imagePath);
  else restoreSystemLogo(root);

  if (root.dataset.vionheartLogoObserver) return;
  root.dataset.vionheartLogoObserver = "true";
  const observer = new MutationObserver(() => {
    const chosen = game.settings.get(MODULE_ID, LOGO_KEY) ?? "";
    if (chosen) replaceSystemLogo(root, chosen);
    else restoreSystemLogo(root);
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "style", "class", "alt", "aria-label"] });
  app._vionheartLogoObserver = observer;
  app.once?.("close", () => observer.disconnect());
});

function replaceSystemLogo(root, imagePath) {
  const elements = root.querySelectorAll("img, svg, [style*='background-image'], [class*='logo' i], [class*='brand' i], [aria-label], [title]");
  for (const element of elements) {
    const src = element instanceof HTMLImageElement ? element.getAttribute("src") ?? "" : "";
    const background = element.style?.backgroundImage ?? "";
    const computedBackground = getComputedStyle(element).backgroundImage;
    if (element instanceof HTMLImageElement && element.dataset.vionheartOriginalSrc === undefined && element.getAttribute("src") === imagePath) continue;
    if (element.dataset?.vionheartCustomLogo === imagePath) continue;
    const text = [src, background, computedBackground, element.getAttribute("alt"), element.getAttribute("aria-label"), element.getAttribute("title"), element.className?.toString?.()]
      .filter(Boolean).join(" ").toLowerCase();
    if (!LOGO_MARKERS.some(marker => text.includes(marker))) continue;

    if (element instanceof HTMLImageElement) {
      if (element.dataset.vionheartOriginalSrc === undefined) element.dataset.vionheartOriginalSrc = element.getAttribute("src") ?? "";
      element.dataset.vionheartCustomLogo = imagePath;
      element.src = imagePath;
      element.alt = "";
    } else if (element instanceof SVGElement) {
      const bounds = element.getBoundingClientRect();
      const replacement = document.createElement("img");
      replacement.src = imagePath;
      replacement.alt = "";
      replacement.dataset.vionheartLogoReplacement = "true";
      replacement._vionheartOriginalSvg = element.cloneNode(true);
      replacement.style.width = `${bounds.width}px`;
      replacement.style.height = `${bounds.height}px`;
      replacement.style.objectFit = "contain";
      element.replaceWith(replacement);
    } else {
      if (!element.dataset.vionheartOriginalBackground) element.dataset.vionheartOriginalBackground = element.style.backgroundImage || "";
      element.dataset.vionheartCustomLogo = imagePath;
      element.style.backgroundImage = `url(${JSON.stringify(imagePath)})`;
      element.style.backgroundSize = "contain";
      element.style.backgroundPosition = "center";
      element.style.backgroundRepeat = "no-repeat";
      for (const child of element.querySelectorAll("img")) {
        const childText = `${child.src} ${child.alt}`.toLowerCase();
        if (LOGO_MARKERS.some(marker => childText.includes(marker))) child.remove();
      }
    }
  }
}

function restoreSystemLogo(root) {
  for (const image of root.querySelectorAll("img[data-vionheart-original-src]")) {
    image.src = image.dataset.vionheartOriginalSrc;
    delete image.dataset.vionheartCustomLogo;
    delete image.dataset.vionheartOriginalSrc;
  }
  for (const element of root.querySelectorAll("[data-vionheart-custom-logo]")) {
    element.style.backgroundImage = element.dataset.vionheartOriginalBackground ?? "";
    delete element.dataset.vionheartCustomLogo;
    delete element.dataset.vionheartOriginalBackground;
  }
  for (const replacement of root.querySelectorAll("img[data-vionheart-logo-replacement]")) {
    if (replacement._vionheartOriginalSvg) replacement.replaceWith(replacement._vionheartOriginalSvg);
    else replacement.remove();
  }
}
