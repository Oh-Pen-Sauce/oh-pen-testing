// Fixture: innerHTML with a literal constant. Must NOT flag.
export function renderLoader(el: HTMLElement) {
  el.innerHTML = "<div class='spinner'>Loading…</div>";
}
