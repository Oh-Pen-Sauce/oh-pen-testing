// Fixture: innerHTML assigned a user-controlled variable. Should flag.
export function renderComment(el: HTMLElement, comment: string) {
  el.innerHTML = comment;
}
