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

const pictureDialog = document.getElementById('pictureDialog');
let previousPictureFocus;
document.querySelectorAll('.enlarge-picture').forEach(button => {
  button.addEventListener('click', () => {
    previousPictureFocus = button;
    const sourceImage = button.querySelector('img');
    document.getElementById('dialogImage').src = sourceImage.src;
    document.getElementById('dialogImage').alt = sourceImage.alt;
    document.getElementById('dialogCaption').textContent = button.closest('figure').querySelector('figcaption').childNodes[0].textContent.trim();
    pictureDialog.showModal();
    document.body.style.overflow = 'hidden';
  });
});
document.getElementById('closePicture').addEventListener('click', () => pictureDialog.close());
pictureDialog.addEventListener('click', event => { if (event.target === pictureDialog) pictureDialog.close(); });
pictureDialog.addEventListener('close', () => {
  document.body.style.overflow = '';
  document.getElementById('dialogImage').removeAttribute('src');
  previousPictureFocus?.focus({ preventScroll: true });
});
