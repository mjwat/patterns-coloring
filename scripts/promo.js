const bookPromoCard = document.getElementById("bookPromoCard");
const dismissBookPromo = document.getElementById("dismissBookPromo");

if (bookPromoCard && dismissBookPromo) {
  dismissBookPromo.addEventListener("click", () => {
    bookPromoCard.hidden = true;
  });
}
