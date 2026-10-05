// The grid reserves space for the actual controls; fit the square inside its cell.
export function fitStudioPaper(stage, paper) {
  const {width, height} = stage.getBoundingClientRect();
  const side = Math.max(0, Math.floor(Math.min(width, height, 900)));
  paper.style.setProperty('--paper-side', side + 'px');
  return side;
}
export function watchStudioPaper(stage, paper, {Observer = globalThis.ResizeObserver, window = globalThis.window} = {}) {
  const fit = () => fitStudioPaper(stage, paper);
  const observer = Observer ? new Observer(fit) : null;
  observer?.observe(stage);
  window?.addEventListener('resize', fit);
  window?.addEventListener('orientationchange', fit);
  window?.visualViewport?.addEventListener('resize', fit);
  fit();
  return fit;
}
