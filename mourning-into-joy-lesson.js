'use strict';
document.getElementById('printLesson').addEventListener('click', () => window.print());
let openedForPrint = [];
addEventListener('beforeprint', () => {
  openedForPrint = [...document.querySelectorAll('details:not([open])')];
  openedForPrint.forEach(detail => { detail.open = true; });
});
addEventListener('afterprint', () => {
  openedForPrint.forEach(detail => { detail.open = false; });
  openedForPrint = [];
});
